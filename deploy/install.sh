#!/usr/bin/env bash
# Instalador do Portal 27º BPM/M para Debian 12 (bookworm) com Apache.
# Uso (como root, dentro da pasta do projeto):  sudo bash deploy/install.sh
set -euo pipefail

APP_DIR=/opt/portal-27bpmm
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_IP="${SERVER_IP:-10.35.94.20}"

echo "==> Pacotes do sistema"
apt-get update
apt-get install -y python3 python3-venv curl gnupg rsync apache2

echo "==> Node.js 22 (para compilar a interface)"
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
corepack enable || npm install -g yarn

echo "==> MongoDB 8.0 (repositório oficial)"
if ! command -v mongod >/dev/null; then
  curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-8.0.gpg
  echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] http://repo.mongodb.org/apt/debian bookworm/mongodb-org/8.0 main" \
    > /etc/apt/sources.list.d/mongodb-org-8.0.list
  apt-get update
  apt-get install -y mongodb-org
fi
systemctl enable --now mongod

echo "==> Copiando arquivos para $APP_DIR"
mkdir -p "$APP_DIR"
rsync -a --delete --exclude node_modules --exclude .git --exclude 'backend/.env' \
  "$SRC_DIR/backend" "$SRC_DIR/frontend" "$SRC_DIR/deploy" "$APP_DIR/"

echo "==> Configuração (.env)"
if [ ! -f "$APP_DIR/backend/.env" ]; then
  cat > "$APP_DIR/backend/.env" <<EOF
MONGO_URL="mongodb://127.0.0.1:27017"
DB_NAME="portal27bpmm"
CORS_ORIGINS="http://$SERVER_IP"
JWT_SECRET="$(python3 -c 'import secrets;print(secrets.token_hex(32))')"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="admin123"
STATUS_HOST="127.0.0.1"
EOF
fi

echo "==> Backend Python (venv)"
python3 -m venv "$APP_DIR/venv"
"$APP_DIR/venv/bin/pip" install --upgrade pip
"$APP_DIR/venv/bin/pip" install -r "$APP_DIR/deploy/requirements-server.txt"

echo "==> Compilando a interface"
cd "$APP_DIR/frontend"
yarn install
DISABLE_VISUAL_EDITS=true DISABLE_EMERGENT_OVERLAY=true yarn build

chown -R www-data:www-data "$APP_DIR"

echo "==> Serviço systemd"
cp "$APP_DIR/deploy/portal-27bpmm.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now portal-27bpmm
systemctl restart portal-27bpmm

echo "==> Apache"
a2enmod proxy proxy_http >/dev/null
cp "$APP_DIR/deploy/apache-portal-27bpmm.conf" /etc/apache2/sites-available/portal-27bpmm.conf
a2ensite portal-27bpmm >/dev/null
a2dissite 000-default >/dev/null || true   # o portal passa a ser a página inicial do IP
apache2ctl configtest
systemctl reload apache2

echo
echo "Pronto! Acesse: http://$SERVER_IP/   (admin / admin123 — troque a senha em 'Minha conta')"
