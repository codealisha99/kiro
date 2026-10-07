# Deploy Kiro to Production

Step-by-step guide to put Kiro live on the internet. Kiro is a Docker multi-service app (web + API + AI + Postgres + Redis). For MVP, deploy **without Kubernetes** on a single VPS using the existing `docker-compose.yml`.

---

## Accounts you need

| Account | Why | Sign up |
|---|---|---|
| **GitHub** | Host the code | https://github.com |
| **OpenAI** | Embeddings + synthesized answers (`AI_LLM_API_KEY`) | https://platform.openai.com |
| **DigitalOcean** *(recommended)* or **Hetzner** | One cloud server for the whole stack | https://cloud.digitalocean.com · https://www.hetzner.com |
| **Domain registrar** *(optional)* | Custom domain (Namecheap, Cloudflare, Google Domains, etc.) | any registrar |

You do **not** need Vercel or Kubernetes for MVP.

---

## Architecture (what goes live)

```
Internet
   │
   ├─ https://yourdomain.com      → Nginx → web  (:3000)  Next.js
   └─ https://api.yourdomain.com  → Nginx → api  (:3001)  NestJS
                                              │
                              ┌───────────────┼───────────────┐
                              ▼               ▼               ▼
                           postgres        redis             ai
                          (pgvector)      (BullMQ)        (:8000)
                                                              │
                                                              ▼
                                                         OpenAI API
```

Keep Postgres, Redis, and the AI service **private** (not exposed to the public internet).

---

## Phase 0 — Prove it works locally first

Do this before buying a server.

```bash
cd kiro
cp .env.example .env
```

1. Open `.env` and set `AI_LLM_API_KEY=sk-...` (from OpenAI → API keys).
2. Run:

```bash
pnpm infra          # postgres + redis
pnpm setup          # install, migrate, AI deps
pnpm dev            # web :3000 · api :3001 · ai :8000
```

3. Open http://localhost:3000
4. Register a workspace → **Load Northwind demo**
5. Ask: *“What is our refund policy?”*
6. Confirm you get an answer with sources.

If that fails, do **not** deploy yet.

Without `AI_LLM_API_KEY`, keyword search and extractive fallback still work; semantic search and LLM answers degrade.

---

## Phase 1 — Create an OpenAI API key

1. Sign up at https://platform.openai.com/signup
2. Add a payment method (embeddings and chat are usage-based)
3. Create an API key under **API keys**
4. Store it somewhere safe — it goes only in server env vars, **never** in git

Suggested models (already the defaults in `.env.example`):

- Chat: `gpt-4o-mini`
- Embeddings: `text-embedding-3-small` (1536 dimensions — must match pgvector)

---

## Phase 2 — Create the cloud server

### 2.1 DigitalOcean Droplet

1. Sign up at https://cloud.digitalocean.com
2. **Create → Droplets**
3. Choose:
   - **Ubuntu 24.04 LTS**
   - **Basic** plan
   - **4 GB RAM / 2 vCPU** minimum (**8 GB** is safer for AI + Postgres)
   - Region near your users
   - Auth: **SSH key** (recommended) or a strong password
4. Create the Droplet and copy its **public IP** (example: `64.23.x.x`)

### 2.2 Point a domain (recommended)

At your DNS provider, create:

| Type | Name | Value |
|---|---|---|
| A | `@` or `kiro` | Droplet public IP |
| A | `api` | same Droplet public IP |

Examples:

- `kiro.yourcompany.com` → web
- `api.kiro.yourcompany.com` or `api.yourcompany.com` → API

DNS can take a few minutes to a few hours.

---

## Phase 3 — Prepare the server

SSH in:

```bash
ssh root@YOUR_DROPLET_IP
```

Install Docker, Git, Nginx, and Certbot:

```bash
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
apt install -y git nginx certbot python3-certbot-nginx
```

Clone the repo:

```bash
mkdir -p /opt && cd /opt
git clone https://github.com/YOUR_USER/kiro.git
cd kiro
```

Use your real GitHub URL. For a **private** repo, add a deploy key or use a GitHub personal access token.

---

## Phase 4 — Production environment

```bash
cp .env.example .env
nano .env
```

Generate a strong JWT secret:

```bash
openssl rand -hex 32
```

Set values like this (replace placeholders):

```bash
# ---- apps/api ----
DATABASE_URL="postgresql://kiro:STRONG_DB_PASSWORD@postgres:5432/kiro?schema=public"
REDIS_URL="redis://redis:6379"
JWT_SECRET="PASTE_OPENSSL_OUTPUT_HERE"
JWT_EXPIRES_IN_SECONDS=3600
LOG_LEVEL="info"

# ---- apps/web (browser calls this URL) ----
NEXT_PUBLIC_API_URL="https://api.yourdomain.com"
# Temporary without domain:
# NEXT_PUBLIC_API_URL="http://YOUR_DROPLET_IP:3001"

# ---- apps/ai ----
AI_SERVICE_URL="http://ai:8000"
AI_LLM_BASE_URL="https://api.openai.com/v1"
AI_LLM_API_KEY="sk-..."
AI_LLM_MODEL="gpt-4o-mini"
AI_EMBEDDING_MODEL="text-embedding-3-small"
AI_EMBEDDING_DIMENSIONS=1536
```

### Required production fixes before first deploy

#### 1. `NEXT_PUBLIC_API_URL` must be set at **build** time

Next.js inlines `NEXT_PUBLIC_*` values into the client bundle during `next build`. Runtime-only env in Compose is not enough.

Update `apps/web/Dockerfile`:

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm install --frozen-lockfile
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @kiro/web build
EXPOSE 3000
CMD ["pnpm", "--filter", "@kiro/web", "start"]
```

Update `docker-compose.yml` `web` service:

```yaml
web:
  build:
    context: .
    dockerfile: apps/web/Dockerfile
    args:
      NEXT_PUBLIC_API_URL: "${NEXT_PUBLIC_API_URL}"
  # ...rest unchanged
```

#### 2. Change the Postgres password

In `docker-compose.yml`, change `POSTGRES_PASSWORD` from `kiro` to a strong password, and keep `DATABASE_URL` in `.env` in sync.

#### 3. Never commit `.env`

Confirm `.env` is in `.gitignore`. Secrets live on the server only.

---

## Phase 5 — Launch the stack

On the server:

```bash
cd /opt/kiro
docker compose up -d --build
docker compose ps
docker compose logs -f api
```

Wait until:

| Service | Expected |
|---|---|
| `postgres` | healthy |
| `redis` | healthy |
| `ai` | healthy / started |
| `api` | started (Prisma migrations run on boot) |
| `web` | started |

Smoke checks from the server:

```bash
curl -s http://127.0.0.1:8000/admin/health
curl -s -I http://127.0.0.1:3000
curl -s -I http://127.0.0.1:3001
```

Useful commands:

```bash
docker compose logs -f          # all services
docker compose logs -f api ai   # API + AI only
docker compose restart
docker compose down             # stop (keeps volumes)
docker compose down -v          # stop AND wipe DB/redis data — destructive
```

---

## Phase 6 — HTTPS with Nginx

Users should hit ports **80/443**, not raw 3000/3001.

Create `/etc/nginx/sites-available/kiro`:

```nginx
server {
  server_name yourdomain.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

server {
  server_name api.yourdomain.com;

  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Enable the site and get certificates:

```bash
ln -s /etc/nginx/sites-available/kiro /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d yourdomain.com -d api.yourdomain.com
```

Rebuild web so the browser uses the HTTPS API URL:

```bash
# Confirm .env has:
# NEXT_PUBLIC_API_URL="https://api.yourdomain.com"
cd /opt/kiro
docker compose up -d --build web
```

### Firewall

```bash
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable
```

Do **not** expose Postgres (`5433`), Redis (`6379`), or AI (`8000`) to the public internet.

---

## Phase 7 — Launch checklist (“is everything perfect?”)

Work through in order:

1. Open `https://yourdomain.com`
2. Register a new workspace
3. Click **Load Northwind demo**
4. Wait until the UI says knowledge is ready
5. Ask: *“What is our refund policy?”* → answer + citations
6. Log out and log in again (JWT works)
7. Open the site on another browser or phone
8. Confirm OpenAI usage appears in the OpenAI dashboard (embeddings ran)
9. Restart and confirm data persists:

```bash
docker compose restart
# demo data and login still work
```

10. Security pass:
    - [ ] `.env` is **not** in GitHub
    - [ ] `JWT_SECRET` is **not** `dev-secret-change-me`
    - [ ] Postgres password is not the default `kiro`
    - [ ] Ports 5433 / 6379 / 8000 are closed externally
    - [ ] Web and API are served over HTTPS
    - [ ] `NEXT_PUBLIC_API_URL` points at the public HTTPS API (not `localhost`)

---

## Updating after code changes

On the server:

```bash
cd /opt/kiro
git pull
docker compose up -d --build
```

If you changed `NEXT_PUBLIC_API_URL`, always rebuild `web` (build-time env).

Database migrations are applied by the API container entrypoint on startup.

---

## Alternative: Railway (no VPS)

If you prefer a managed UI instead of a Droplet:

1. Create an account at https://railway.app and log in with GitHub
2. Create a project
3. Railway does **not** run `docker-compose.yml` as one file — recreate each service:

| Compose service | Railway action |
|---|---|
| `postgres` | Railway Postgres + pgvector, or deploy `pgvector/pgvector:pg16` |
| `redis` | Railway Redis plugin |
| `api` | Deploy from GitHub, Dockerfile `apps/api/Dockerfile` |
| `ai` | Deploy from GitHub, Dockerfile `apps/ai/Dockerfile` |
| `web` | Deploy from GitHub, Dockerfile `apps/web/Dockerfile`, set build arg `NEXT_PUBLIC_API_URL` |

4. Wire internal URLs between services (private networking)
5. Generate public domains for **web** and **api** only
6. Keep Postgres, Redis, and AI private

The VPS + Compose path matches this repo best for MVP.

---

## Rough monthly cost

| Item | Estimate |
|---|---|
| Droplet (4–8 GB) | ~$24–48 / month |
| OpenAI usage | usage-based (demo + light pilot is usually low) |
| Domain | ~$10–15 / year |
| SSL (Let’s Encrypt) | free |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Web loads but API calls fail / CORS / network error | `NEXT_PUBLIC_API_URL` wrong or not rebuilt | Set HTTPS API URL in `.env`, rebuild `web` |
| Answers are weak / no semantic search | Missing or invalid `AI_LLM_API_KEY` | Set key, restart `ai` and `api` |
| API won’t start | DB not ready / bad `DATABASE_URL` | `docker compose logs api postgres`, fix password/URL |
| Demo never finishes embedding | AI service down or OpenAI errors | `docker compose logs ai`, check API key + billing |
| HTTPS cert fails | DNS not pointing at Droplet yet | Wait for DNS, retry `certbot` |
| Login works then fails after restart | Volume wiped or wrong secret | Don’t use `down -v`; keep stable `JWT_SECRET` |

---

## Related docs

- Local runbook: [../README.md](../README.md)
- Architecture & testing: [architecture-and-testing.md](architecture-and-testing.md)
- Build plan / phases: [../build-plan.md](../build-plan.md)
