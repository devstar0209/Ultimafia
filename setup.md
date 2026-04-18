# Ubuntu Server Setup Without Docker

This guide explains how to run this project on an Ubuntu server without Docker.

It is written for the current project structure:

- Express backend serves the built frontend from `react_main/build_public`
- PM2 runs three Node processes: `www`, `games`, and `chat`
- Redis is expected on `localhost:6379`
- MongoDB is required
- Nginx should terminate HTTPS and proxy websocket traffic

## 1. Install system packages

```bash
sudo apt update
sudo apt install -y git curl nginx redis-server build-essential
```

If you are using a local MongoDB instance, install and start MongoDB too. If you are using MongoDB Atlas, you can skip local MongoDB installation.

## 2. Install Node with NVM

This repo expects Node `22.17.0`.

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.nvm/nvm.sh
nvm install 22.17.0
nvm use 22.17.0
nvm alias default 22.17.0
```

## 3. Clone the repository

```bash
git clone https://github.com/devstar0209/Ultimafia
cd Ultimafia
```

## 4. Create the backend environment file

Copy the template:

```bash
cp ./docs/server_env ./.env
```

Update `.env` for production. Example:

```env
NODE_ENV=production
PORT=3000
UPLOAD_PATH=uploads
BASE_URL=https://your-domain.com

CHAT_PORT=2999
GAME_PORT=3010
SOCKET_PING_INTERVAL=10000
SERVER_SOCKET_PING_INTERVAL=2000
GAME_CREATION_TIMEOUT=5000

SESSION_SECRET=replace-this
LOAD_BALANCER_KEY=replace-this
BOT_KEY=replace-this

MONGO_URI=mongodb+srv://USERNAME:PASSWORD@HOST/ultimafia
MONGO_USER=USERNAME
MONGO_PW=PASSWORD
REDIS_DB=0

FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...
FIREBASE_PROJECT_ID=...
FIREBASE_MESSAGING_SENDER_ID=...
FIREBASE_APP_ID=...
FIREBASE_MEASUREMENT_ID=...
FIREBASE_JSON_FILE=secrets/firebase.json

EMAIL_DOMAINS=["gmail.com","hotmail.com","aol.com","msn.com","yandex.ru","live.com","icloud.com","gmail.com.sg","yahoo.com","mail.com","outlook.com","hotmail.co.uk"]

IP_API_URL=https://ipqualityscore.com/api/json/ip
IP_API_KEY=
IP_API_PARAMS=strictness=0&allow_public_access_points=true&fast=true&lighter_penalties=true&mobile=true

RECAPTCHA_KEY=
RESERVED_NAMES={}
REPORT_DISCORD_WEBHOOK=[]
```

Notes:

- `MONGO_URI` is the connection string that the backend actually uses.
- Redis is hardcoded to `redis://localhost:6379` in `modules/redis.js`, so Redis should run on the same server unless you patch that file.
- `GAME_PORT` is used by the game service. Use `3010` unless you intentionally change the websocket route too.

## 5. Create the frontend environment file

Copy the template:

```bash
cp ./docs/client_env ./react_main/.env
```

Update `react_main/.env` for production:

```env
PORT=3001

REACT_APP_URL=https://your-domain.com
REACT_APP_SOCKET_URI=your-domain.com
REACT_APP_SOCKET_PROTOCOL=wss
REACT_APP_USE_PORT=false
REACT_APP_CHAT_PORT=2999

REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_AUTH_DOMAIN=...
REACT_APP_FIREBASE_PROJECT_ID=...
REACT_APP_FIREBASE_STORAGE_BUCKET=...
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=...
REACT_APP_FIREBASE_APP_ID=...
REACT_APP_FIREBASE_MEASUREMENT_ID=...

REACT_APP_ENVIRONMENT=production
REACT_APP_RECAPTCHA_KEY=
REACT_APP_EMAIL_DOMAINS=["gmail.com","hotmail.com","aol.com","msn.com","yandex.ru","live.com","icloud.com","gmail.com.sg","yahoo.com","mail.com","outlook.com","hotmail.co.uk"]
```

Notes:

- `REACT_APP_USE_PORT=false` makes chat and game websockets use path-based URLs instead of direct port-based URLs.
- Chat uses `/chatSocket`.
- Games use `/<port>`, which is usually `/3010`.

## 6. Add the Firebase service account file

Create a private folder for secrets:

```bash
mkdir -p secrets
```

Put your Firebase service account JSON at:

```bash
secrets/firebase.json
```

Your backend `.env` should point `FIREBASE_JSON_FILE=secrets/firebase.json`.

Do not reuse a committed development credential file in production.

## 7. Install project dependencies

Install backend dependencies:

```bash
npm ci
```

Install frontend dependencies and build:

```bash
cd react_main
npm ci
bash build.sh
cd ..
```

When process is killed
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

This creates `react_main/build_public`, which the Express app serves in production.

## 8. Install PM2 and start the app

Install PM2 globally or use `npx`.

```bash
npm install -g pm2
```

Start the production processes:

```bash
pm2 start pm2-prod.json
pm2 save
pm2 status
```

Important:

- Do not use `npm start` for production here.
- In this repo, `npm start` uses `pm2-dev.json`, not `pm2-prod.json`.

View logs with:

```bash
pm2 logs
```

## 9. Configure PM2 startup

```bash
pm2 startup
```

Run the command PM2 prints, then:

```bash
pm2 save
```

## 10. Configure Nginx

Create an Nginx site config such as `/etc/nginx/sites-available/ultimafia`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /chatSocket {
        proxy_pass http://127.0.0.1:2999;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location /3010 {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/ultimafia /etc/nginx/sites-enabled/ultimafia
sudo nginx -t
sudo systemctl reload nginx
```

If you use a different game port, update both the backend env and the `/3010` Nginx route to match.

## 11. Install HTTPS certificates

With Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

After Certbot finishes, reload Nginx if needed:

```bash
sudo systemctl reload nginx
```

## 12. Open the required firewall ports

If UFW is enabled:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

You normally do not need to expose `2999` or `3010` publicly if Nginx is proxying them locally.

## 13. Verify the deployment

Check services:

```bash
systemctl status redis-server
pm2 status
pm2 logs --lines 100
curl http://127.0.0.1:3000
```

Things to confirm:

- the backend listens on port `3000`
- the chat process is running on port `2999`
- the game process is running on port `3010`
- `react_main/build_public/index.html` exists
- MongoDB connection succeeds
- the site loads over `https://your-domain.com`
- chat and game websockets connect successfully

## 14. Updating the app later

```bash
cd ~/Ultimafia
git pull
npm ci
cd react_main
npm ci
bash build.sh
cd ..
pm2 restart pm2-prod.json
```

## Common gotchas

- If the site loads but the frontend is blank, rebuild the frontend so `react_main/build_public` exists.
- If login or Firebase-backed features fail, re-check both env files and the Firebase service account JSON path.
- If chat fails, verify `REACT_APP_USE_PORT=false`, `REACT_APP_SOCKET_PROTOCOL=wss`, and the Nginx `/chatSocket` websocket proxy.
- If game joining fails, verify the Nginx websocket route for `/3010` and that `GAME_PORT=3010`.
- If PM2 starts the wrong config, use `pm2 start pm2-prod.json` explicitly.
