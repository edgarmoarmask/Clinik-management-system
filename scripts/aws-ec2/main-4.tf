terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Asia Pacific (Malaysia)
provider "aws" {
  region = "ap-southeast-5"
}

variable "instance_type" {
  description = "t4g.nano (ARM) is the cheapest. Use t3.nano if t4g is unavailable in your AZ."
  type        = string
  default     = "t4g.nano"
}

# Latest Amazon Linux 2023 AMI (ARM64 for t4g; switch to x86_64 for t3)
data "aws_ssm_parameter" "al2023" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}

data "aws_vpc" "default" {
  default = true
}

# AWS-managed list of CloudFront origin-facing IP ranges
data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

resource "aws_security_group" "web" {
  name_prefix = "web-cloudfront-"
  description = "Allow HTTP only from CloudFront"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description     = "HTTP from CloudFront"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    prefix_list_ids = [data.aws_ec2_managed_prefix_list.cloudfront.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# SSM access (no SSH port needed): aws ssm start-session --target <instance-id>
resource "aws_iam_role" "ssm" {
  name_prefix = "ec2-ssm-"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.ssm.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "ssm" {
  name_prefix = "ec2-ssm-"
  role        = aws_iam_role.ssm.name
}

resource "aws_instance" "app" {
  ami                         = nonsensitive(data.aws_ssm_parameter.al2023.value)
  instance_type               = var.instance_type
  vpc_security_group_ids      = [aws_security_group.web.id]
  iam_instance_profile        = aws_iam_instance_profile.ssm.name
  associate_public_ip_address = true

  root_block_device {
    volume_size = 8
    volume_type = "gp3"
  }

  metadata_options {
    http_tokens = "required"
  }

  user_data = <<-EOF
    #!/bin/bash
    set -euxo pipefail

    dnf install -y nginx git unzip

    # bun (system-wide)
    export BUN_INSTALL=/usr/local
    curl -fsSL https://bun.sh/install | bash

    # uv (system-wide)
    curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin UV_NO_MODIFY_PATH=1 sh

    # static frontend dir (readable by nginx)
    mkdir -p /home/app
    chown ec2-user:ec2-user /home/app
    chmod 755 /home /home/app
    [ -f /home/app/index.html ] || echo '<h1>It works</h1>' > /home/app/index.html

    # nginx.conf: static frontend from /home/app, /api/ proxied to FastAPI on 127.0.0.1:8000
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

    # FastAPI project dir + systemd service
    mkdir -p /home/first-clinik/backend
    chown -R ec2-user:ec2-user /home/first-clinik

    cat > /etc/systemd/system/fastapi.service <<'UNIT'
    [Unit]
    Description=FastAPI (uvicorn via uv)
    After=network.target

    [Service]
    User=ec2-user
    WorkingDirectory=/home/first-clinik/backend
    ExecStart=/usr/local/bin/uv run uvicorn main:app --host 127.0.0.1 --port 8000 --proxy-headers --forwarded-allow-ips=127.0.0.1
    Restart=always
    RestartSec=5

    [Install]
    WantedBy=multi-user.target
    UNIT

    systemctl daemon-reload
    # enabled for boot, but not started: the code isn't deployed yet
    systemctl enable fastapi

    systemctl enable --now nginx
  EOF

  tags = {
    Name = "fastapi-nginx"
  }
}

# ---------- CloudFront ----------
data "aws_cloudfront_cache_policy" "optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled"
}

# forwards all viewer headers (incl. Authorization), cookies and query strings, except Host
data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

resource "aws_cloudfront_distribution" "app" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = "fastapi-nginx"
  price_class     = "PriceClass_200" # includes Asia edge locations

  origin {
    origin_id   = "ec2"
    domain_name = aws_instance.app.public_dns

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # frontend static files (cached)
  default_cache_behavior {
    target_origin_id       = "ec2"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = data.aws_cloudfront_cache_policy.optimized.id
  }

  # backend API (never cached, all methods allowed)
  ordered_cache_behavior {
    path_pattern             = "/api/*"
    target_origin_id         = "ec2"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    compress                 = true
    cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

output "cloudfront_url" {
  value = "https://${aws_cloudfront_distribution.app.domain_name}"
}

output "instance_id" {
  value = aws_instance.app.id
}

# Use this as the CloudFront origin domain (HTTP only, port 80)
output "cloudfront_origin_domain" {
  value = aws_instance.app.public_dns
}
