# Deploying DevOrbit to a VPS (Hostinger KVM 2, Ubuntu 24.04)

Tested in an Ubuntu 24.04 container with the same Nginx + pm2 setup.

## Before you start
- A domain pointed at the VPS IP (an `A` record). HTTPS is required for the proctoring camera.
- MongoDB Atlas → Network Access → add the VPS IP.
- Your `backend/.env` from your laptop, with:
  - `FRONTEND_URL=https://your-domain.com`
  - `JUDGE0_RAPIDAPI_KEY=...` (leave empty to use the free public Judge0)
  - a long random `JWT_SECRET`

## Steps (as root on the VPS)
```bash
git clone <your-repo-url> /root/hackercit
cd /root/hackercit
# copy backend/.env here (e.g. scp backend/.env root@VPS_IP:/root/hackercit/backend/.env)
bash deploy/setup.sh your-domain.com
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

## Alternative: Docker instead of pm2
If you prefer Docker on the VPS, skip `setup.sh`'s pm2 part and run from the repo root:
```bash
docker compose -f docker/docker-compose.yml up -d --build
```
It reads `backend/.env`, listens on `127.0.0.1:3000`, and restarts automatically. Put Nginx (`deploy/nginx.conf`) and certbot in front exactly as above.

## Addresses
- Students: `https://your-domain.com`
- Admins: `https://your-domain.com/admin`

## Updating after a code change
```bash
cd /root/hackercit && git pull && npm install && pm2 restart devorbit
```

## Useful commands
- `pm2 logs devorbit` — live logs
- `pm2 status` — is it running
- `curl -s localhost:3000/api/health` — health check
