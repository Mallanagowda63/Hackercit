#!/usr/bin/env bash
# One-time VPS setup for Ubuntu 24.04. Run as root from the repo root:
#   bash deploy/setup.sh your-domain.com
set -euo pipefail

DOMAIN="${1:?Usage: bash deploy/setup.sh your-domain.com}"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"

apt-get update
apt-get install -y curl nginx ufw

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

npm install -g pm2
cd "$APP_DIR"
npm install

if [ ! -f backend/.env ]; then
  echo "backend/.env is missing. Copy it from your laptop before continuing." >&2
  exit 1
fi

sed "s/YOUR_DOMAIN/$DOMAIN/" deploy/nginx.conf > /etc/nginx/sites-available/devorbit
ln -sf /etc/nginx/sites-available/devorbit /etc/nginx/sites-enabled/devorbit
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

ufw allow OpenSSH
ufw allow "Nginx Full"
ufw --force enable

pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root

echo
echo "App is up on http://$DOMAIN"
echo "For HTTPS run: apt-get install -y certbot python3-certbot-nginx && certbot --nginx -d $DOMAIN"
