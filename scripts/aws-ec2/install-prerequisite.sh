dnf install git nginx unzip 

# bun
curl -fsSL https://bun.sh/install | sudo BUN_INSTALL=/usr/local bash

# uv
curl -LsSf https://astral.sh/uv/install.sh | sudo env UV_INSTALL_DIR=/usr/local/bin UV_NO_MODIFY_PATH=1 sh