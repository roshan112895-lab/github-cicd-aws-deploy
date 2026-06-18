# TaskFlow — EC2 Deployment Guide

Deploy the TaskFlow app to AWS EC2 with **nginx**, **PM2**, **GitHub Actions**, and **Supabase** (production database).

## Architecture

```
Browser → EC2:80 (nginx) → localhost:5001 (PM2/Node) → Supabase PostgreSQL
```

| Component | Role |
|-----------|------|
| **nginx** | Public HTTP on port 80 |
| **PM2** | Keeps Node.js running on port **5001** |
| **GitHub Actions** | Auto-deploy on push to `main` |
| **Supabase** | Production database (not installed on EC2) |
| **pgAdmin4** | Local development database only |

---

## Part 1 — AWS EC2 setup (one time)

### 1.1 Launch instance

- AMI: **Ubuntu 22.04 or 24.04 LTS**
- Instance type: `t2.micro` or larger
- Create/download a `.pem` key pair

### 1.2 Security group inbound rules

| Type | Port | Source |
|------|------|--------|
| SSH | 22 | Your IP (recommended) |
| HTTP | 80 | `0.0.0.0/0` |

> **Note:** Use `http://` in the browser, not `https://`. Port 443 is only needed if you add SSL later.

### 1.3 Elastic IP (recommended)

Allocate and associate an Elastic IP so the public address does not change after restart.

---

## Part 2 — Server bootstrap (one time)

SSH into EC2:

```bash
ssh -i "your-key.pem" ubuntu@YOUR_EC2_IP
```

### 2.1 Update system and install dependencies

```bash
sudo apt update && sudo apt upgrade -y

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx

node -v   # v20.x
npm -v

# PM2
sudo npm install -g pm2
```

### 2.2 Create app directory

```bash
sudo mkdir -p /var/www/express-app/logs
sudo chown -R ubuntu:ubuntu /var/www/express-app
cd /var/www/express-app
```

### 2.3 Configure nginx

```bash
sudo nano /etc/nginx/sites-available/express-app
```

Paste:

```nginx
server {
    listen 80;
    server_name YOUR_EC2_IP_OR_DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

Enable site:

```bash
sudo ln -sf /etc/nginx/sites-available/express-app /etc/nginx/sites-enabled/express-app
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### 2.4 PM2 startup on boot

```bash
pm2 startup
# Run the command it prints, then:
pm2 save
```

---

## Part 3 — Production environment (Supabase)

On EC2, create `/var/www/express-app/.env`:

```bash
cd /var/www/express-app
nano .env
```

```env
PORT=5001
NODE_ENV=production
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[ENCODED-PASSWORD]@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.[PROJECT-REF]:[ENCODED-PASSWORD]@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres
AUTH_TOKEN_SECRET=your-strong-random-secret
AUTH_TOKEN_TTL=86400
```

**Important:**

- Get connection strings from **Supabase → Project Settings → Database**
- URL-encode special characters in password (`@` → `%40`, `#` → `%23`)
- `DATABASE_URL` must contain `supabase.com` — **not** `127.0.0.1`

Verify:

```bash
grep DATABASE_URL .env
```

### Migrate seed data to Supabase (one time, from local machine)

```bash
npm run migrate:supabase
```

---

## Part 4 — GitHub Secrets

Repo → **Settings → Secrets and variables → Actions**:

| Secret | Description |
|--------|-------------|
| `EC2_HOST` | EC2 public IP or DNS (e.g. `35.172.192.6`) |
| `EC2_USERNAME` | `ubuntu` |
| `EC2_SSH_KEY` | Full `.pem` private key contents |
| `DATABASE_URL` | Supabase transaction pooler URI (port 6543) |
| `DIRECT_URL` | Supabase session pooler URI (port 5432) |
| `AUTH_TOKEN_SECRET` | Strong random string for auth tokens |
| `AUTH_TOKEN_TTL` | `86400` (optional) |

Copy SSH key from local machine:

```bash
cat your-key.pem
# Copy ALL content including BEGIN/END lines
```

---

## Part 5 — GitHub Actions deploy

Workflow file: `.github/workflows/deploy-aws.yml`

### Trigger deploy

- Push to `main`, or
- GitHub → **Actions** → **Deploy to EC2** → **Run workflow**

### What the workflow does

1. Builds deployment package (`src`, `public`, `scripts`, `ecosystem.config.js`)
2. SSH to EC2 and extracts files to `/var/www/express-app`
3. Writes `.env` from GitHub Secrets (Supabase)
4. Runs `npm ci --omit=dev`
5. `pm2 reload ecosystem.config.js --update-env`
6. Verifies `/health` and `/api/tasks`

---

## Part 6 — PM2 commands

After first deploy or manual setup:

```bash
cd /var/www/express-app
npm ci --omit=dev

# First start
pm2 start ecosystem.config.js
pm2 save

# After updates
pm2 reload ecosystem.config.js --update-env
```

Useful commands:

```bash
pm2 status
pm2 logs express-app --lines 50
pm2 restart express-app
pm2 delete express-app
```

Expected logs:

```text
PostgreSQL connected (Supabase)
Task Manager running at http://localhost:5001
```

---

## Part 7 — Verify deployment

### On EC2

```bash
curl http://localhost:5001/health
curl http://localhost:5001/api/tasks
curl http://localhost/health
pm2 status
```

### From browser

Use **HTTP** (not HTTPS):

```
http://YOUR_EC2_IP
http://ec2-XX-XX-XX-XX.compute-1.amazonaws.com
```

### From local machine

```bash
curl http://YOUR_EC2_IP/health
curl http://YOUR_EC2_IP/api/tasks
```

---

## Part 8 — Local development

Local uses **pgAdmin4 / PostgreSQL**, not Supabase.

`.env` on your machine:

```env
PORT=5001
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/taskFlowDb
AUTH_TOKEN_SECRET=change-this-secret-in-production
AUTH_TOKEN_TTL=86400
```

```bash
npm install
npm run start:dev
# http://localhost:5001
```

Useful scripts:

```bash
npm run db:check              # Test local DB
npm run db:check:supabase     # Test Supabase connection
npm run migrate:postgres      # JSON → local Postgres
npm run migrate:supabase      # JSON → Supabase
```

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `ERR_CONNECTION_TIMED_OUT` | Browser using HTTPS | Use `http://` not `https://` |
| `ECONNREFUSED 127.0.0.1:5432` | Missing Supabase URL in `.env` | Add `DATABASE_URL` with `supabase.com` |
| `502 Bad Gateway` | PM2 app not running | `pm2 start ecosystem.config.js` |
| `502 Bad Gateway` | Wrong nginx port | `proxy_pass http://127.0.0.1:5001` |
| PM2 `errored` | Missing dependencies | `npm ci --omit=dev` |
| Empty tasks in UI | Supabase empty | Run `npm run migrate:supabase` locally |
| Deploy SSH fails | Wrong secrets | Update `EC2_HOST` and `EC2_SSH_KEY` |

### Reset PM2

```bash
cd /var/www/express-app
pm2 delete express-app
pm2 start ecosystem.config.js
pm2 save
pm2 logs express-app
```

### nginx logs

```bash
sudo tail -f /var/log/nginx/error.log
```

---

## Optional — HTTPS with custom domain

1. Point domain A record to EC2 IP
2. Open port 443 in security group
3. Update nginx `server_name` to your domain
4. Run Certbot:

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## Quick reference

| Environment | Database | Config | URL |
|-------------|----------|--------|-----|
| Local | pgAdmin4 / PostgreSQL | `.env` | `http://localhost:5001` |
| Production | Supabase | EC2 `.env` + GitHub Secrets | `http://EC2_IP` |

```bash
# Deploy
git push origin main

# Manual PM2 reload on EC2
cd /var/www/express-app && pm2 reload ecosystem.config.js --update-env
```
