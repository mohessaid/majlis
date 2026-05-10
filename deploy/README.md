# Majlis — Deployment Guide

## Overview

| Component | Where | How |
|---|---|---|
| Backend (FastAPI + vLLM) | AMD MI300X DigitalOcean Droplet | Docker Compose |
| Frontend (React) | Cloudflare Pages | `wrangler pages deploy` |
| SSL | Let's Encrypt via certbot | `03-ssl.sh` |
| CI/CD | GitHub Actions | `.github/workflows/deploy.yml` |

---

## One-Time Droplet Setup

### 1. Create the Droplet

In DigitalOcean:
- GPU Droplets → AMD MI300X
- OS: Ubuntu 22.04 with ROCm 7.2 (pre-installed)
- Add your SSH key
- Note the public IP

### 2. Clone the repo on the droplet

```bash
ssh root@<DROPLET_IP>
git clone https://github.com/<your-org>/majlis.git /opt/majlis/repo
cd /opt/majlis/repo
```

### 3. Run the bootstrap (does everything)

```bash
sudo bash deploy/scripts/00-bootstrap.sh
```

This will:
- Prompt for your secrets (HF token, Tavily, Clerk)
- Install Docker, configure ROCm device access, set up firewall
- Optionally generate SSL cert (if you have a domain)
- Start all services
- Print a health report

### 4. (Optional) Pre-download models

Model weights are pulled on first container start (~30 GB). If you want them
ready before your first request, pre-download them:

```bash
bash deploy/scripts/06-preload-models.sh
```

---

## Ongoing Deployments

### Manual deploy (from the droplet)

```bash
cd /opt/majlis/repo
git pull
bash deploy/scripts/02-deploy.sh --pull
```

### CI/CD (from GitHub → droplet)

Push to `main` → GitHub Actions auto-deploys:
1. Builds frontend → Cloudflare Pages
2. Builds backend Docker image → GHCR
3. SSH to droplet → pulls image → restarts backend + nginx

#### Required GitHub Secrets

Go to Settings → Secrets and Variables → Actions:

| Secret | Value |
|---|---|
| `CF_API_TOKEN` | Cloudflare API token (Cloudflare Pages: Edit) |
| `CF_ACCOUNT_ID` | Your Cloudflare account ID |
| `VITE_API_URL` | `https://your-droplet-ip-or-domain` |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `DROPLET_IP` | Your droplet's public IP |
| `DROPLET_USER` | `root` (or `majlis`) |
| `DROPLET_SSH_KEY` | Private SSH key (contents of `~/.ssh/id_rsa`) |

---

## SSL Certificate

If you have a domain (e.g. `api.majlis.app`) pointed at the droplet:

```bash
bash deploy/scripts/03-ssl.sh api.majlis.app
```

Certificates auto-renew every 60 days via cron.

---

## Health & Monitoring

```bash
# Full health report
bash deploy/scripts/04-health-check.sh

# Live backend logs
docker compose logs -f backend

# Monitor a specific model loading
docker compose logs -f vllm-llama

# GPU memory usage
rocm-smi --showmeminfo vram

# All container status
docker compose ps
```

---

## Rollback

```bash
# List available image tags
bash deploy/scripts/05-rollback.sh

# Roll back to a specific tag
bash deploy/scripts/05-rollback.sh sha-abc1234
```

---

## Script Reference

| Script | Purpose |
|---|---|
| `00-bootstrap.sh` | Full one-shot setup from scratch |
| `01-setup-droplet.sh` | System packages, Docker, firewall, ROCm |
| `02-deploy.sh` | Deploy / update (safe for re-runs) |
| `03-ssl.sh <domain>` | Let's Encrypt cert + nginx HTTPS |
| `04-health-check.sh` | Full health report with GPU stats |
| `05-rollback.sh [tag]` | Roll back backend to previous image |
| `06-preload-models.sh` | Pre-download all model weights |
| `wait-for-model.sh` | Internal: polls vLLM until ready |

---

## Directory Layout on Droplet

```
/opt/majlis/
├── repo/                  ← git clone lives here
│   ├── docker-compose.yml
│   ├── nginx.conf
│   ├── .env               ← secrets (chmod 600)
│   └── ssl/               ← TLS certs
└── data/
    ├── hf_cache/          ← HuggingFace model weights (~30 GB)
    └── db/                ← SQLite database file
```

---

## Common Issues

**Models stuck loading:**
```bash
docker compose logs --tail=50 vllm-llama
# Usually a VRAM allocation issue or ROCm device access problem
```

**GPU not visible in container:**
```bash
# Verify devices are passed correctly
docker run --rm \
  --device /dev/kfd \
  --device /dev/dri \
  --group-add video --group-add render \
  rocm/vllm-dev:latest rocm-smi
```

**Backend can't reach vLLM:**
```bash
# Test from within the backend container
docker exec majlis-backend curl http://vllm-curator:8005/health
```

**SSL certificate errors:**
```bash
# Check cert expiry
openssl x509 -enddate -noout -in ssl/cert.pem
# Force renew
certbot renew --force-renewal
```
