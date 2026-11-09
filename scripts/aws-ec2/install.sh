#!/bin/bash
# Run as: sudo bash deploy.sh   (re-runnable: pulls latest code, rebuilds, restarts)
set -euo pipefail

APP_USER="ssm-user"                       # must already exist (created on first SSM session)
REPO_URL="https://github.com/edgarmoarmask/Clinik-management-system.git"
REPO_DIR="/home/Clinik-management-system"
WEB_ROOT="/home/app"
# Module path: if your main.py is in backend/app/main.py use app.main:app
APP_MODULE="app.main:app"
# API base URL baked into the frontend build. Empty = relative (/api/...),
# which works on any domain because nginx and CloudFront serve both frontend and API.
# Override only if needed: sudo API_URL=https://example.com bash deploy.sh
API_URL="${API_URL:-}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run with sudo: sudo bash deploy.sh" >&2
  exit 1
fi

# ---------- 1. Code + build (as $APP_USER) ----------
mkdir -p "$REPO_DIR" "$WEB_ROOT"
chown "$APP_USER:$APP_USER" "$REPO_DIR" "$WEB_ROOT"
chmod 755 /home "$WEB_ROOT"

sudo -u "$APP_USER" -H env REPO_URL="$REPO_URL" REPO_DIR="$REPO_DIR" VITE_API_URL="$API_URL" bash -euo pipefail <<'USER_STEPS'
if [ -d "$REPO_DIR/.git" ]; then
  git -C "$REPO_DIR" pull
else
  git clone "$REPO_URL" "$REPO_DIR"
fi

cd "$REPO_DIR/backend"
uv sync
chmod +x scripts/prestart.sh
uv run scripts/prestart.sh      # needs your .env / database to be reachable

cd ../frontend
bun install
bun run build
USER_STEPS

# ---------- 2. Publish frontend build to nginx web root ----------
if [ -d "$REPO_DIR/backend/app/frontend" ]; then
  BUILD_DIR="$REPO_DIR/backend/app/frontend"
elif [ -d "$REPO_DIR/frontend/dist" ]; then
  BUILD_DIR="$REPO_DIR/frontend/dist"
else
  echo "Frontend build output not found" >&2
  exit 1
fi
rm -rf "${WEB_ROOT:?}"/*
cp -r "$BUILD_DIR"/. "$WEB_ROOT"/
chown -R "$APP_USER:$APP_USER" "$WEB_ROOT"

# ---------- 3. nginx ----------
cat > /etc/nginx/nginx.conf <<'CONF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log;
pid /run/nginx.pid;
events { worker_connections 512; }
http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    access_log /var/log/nginx/access.log;
    sendfile on;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml image/svg+xml;

    server {
        listen 80 default_server;
        server_name _;

        root /home/app;
        index index.html;

        # backend
        location /api/ {
            proxy_pass http://127.0.0.1:8000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
        }

        # frontend (SPA fallback to index.html)
        location / {
            try_files $uri $uri/ /index.html;
        }

        # long cache for hashed build assets
        location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?)$ {
            expires 7d;
            add_header Cache-Control "public";
            try_files $uri =404;
        }
    }
}
CONF

nginx -t

# ---------- 4. FastAPI systemd service ----------
cat > /etc/systemd/system/fastapi.service <<UNIT
[Unit]
Description=FastAPI (uvicorn via uv)
After=network.target

[Service]
User=${APP_USER}
WorkingDirectory=${REPO_DIR}/backend
ExecStart=/usr/local/bin/uv run uvicorn ${APP_MODULE} --host 127.0.0.1 --port 8000 --proxy-headers --forwarded-allow-ips=127.0.0.1
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable fastapi
systemctl restart fastapi
systemctl enable nginx
systemctl restart nginx

echo "Done. Check: systemctl status fastapi nginx"