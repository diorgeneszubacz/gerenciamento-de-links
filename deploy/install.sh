#!/usr/bin/env bash
# Instalador do Portal 27º BPM/M para Debian 12 (bookworm) com Apache + MySQL/MariaDB.
# Uso (como root, dentro da pasta do projeto):  sudo bash deploy/install.sh
# Se o root do MySQL exigir senha:              sudo MYSQL_ROOT_PASSWORD='senha' bash deploy/install.sh
set -euo pipefail

APP_DIR=/opt/portal-27bpmm
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_IP="${SERVER_IP:-10.35.94.20}"
DB_NAME="${DB_NAME:-portal27bpmm}"
DB_USER="${DB_USER:-portal}"

echo "==> Pacotes do sistema"
apt-get update
apt-get install -y python3 python3-venv curl rsync apache2

echo "==> MySQL / MariaDB"
if ! command -v mysql >/dev/null; then
  apt-get install -y mariadb-server
  systemctl enable --now mariadb
fi
MYSQL=(mysql -uroot)
[ -n "${MYSQL_ROOT_PASSWORD:-}" ] && MYSQL+=("-p${MYSQL_ROOT_PASSWORD}")

echo "==> Node.js 22 (apenas para compilar a interface)"
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
corepack enable || npm install -g yarn

echo "==> Copiando arquivos para $APP_DIR"
mkdir -p "$APP_DIR"
rsync -a --delete --exclude node_modules --exclude .git --exclude 'backend/.env' --exclude 'backend/data' \
  "$SRC_DIR/backend" "$SRC_DIR/frontend" "$SRC_DIR/deploy" "$APP_DIR/"

echo "==> Banco de dados e configuração (.env)"
if [ ! -f "$APP_DIR/backend/.env" ]; then
  DB_PASS="$(python3 -c 'import secrets;print(secrets.token_urlsafe(18))')"
  "${MYSQL[@]}" <<SQL
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
CREATE USER IF NOT EXISTS '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$DB_PASS';
ALTER USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
ALTER USER '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$DB_PASS';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'localhost';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
  cat > "$APP_DIR/backend/.env" <<EOF
DATABASE_URL="mysql+aiomysql://$DB_USER:$DB_PASS@127.0.0.1:3306/$DB_NAME?charset=utf8mb4"
CORS_ORIGINS="http://$SERVER_IP"
JWT_SECRET="$(python3 -c 'import secrets;print(secrets.token_hex(32))')"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="admin123"
STATUS_HOST="127.0.0.1"
EOF
  chmod 600 "$APP_DIR/backend/.env"
  echo "    Banco '$DB_NAME' criado. Usuário MySQL: $DB_USER (senha em $APP_DIR/backend/.env)"
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
systemctl enable portal-27bpmm
systemctl restart portal-27bpmm

echo "==> Apache"
a2enmod proxy proxy_http alias >/dev/null
cp "$APP_DIR/deploy/apache-portal-27bpmm.conf" /etc/apache2/sites-available/portal-27bpmm.conf
a2ensite portal-27bpmm >/dev/null
a2dissite 000-default >/dev/null || true   # o portal assume a raiz; /var/www/html continua servido
apache2ctl configtest
systemctl reload apache2

echo
echo "Pronto! Acesse: http://$SERVER_IP/   (admin / admin123 — troque a senha em 'Minha conta')"
