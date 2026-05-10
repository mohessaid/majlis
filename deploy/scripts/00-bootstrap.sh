#!/usr/bin/env bash
# ============================================================
# Majlis — Full Bootstrap
# Runs all setup steps on a fresh AMD GPU droplet.
# Prompts for required secrets interactively.
#
# Usage (on the droplet as root):
#   curl -fsSL https://raw.githubusercontent.com/<owner>/majlis/main/deploy/scripts/00-bootstrap.sh | bash
#
#   — or after cloning —
#   sudo bash deploy/scripts/00-bootstrap.sh
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
ask()   { echo -e "${BOLD}[ASK]${NC}   $*"; }
die()   { echo -e "${RED}[ERR]${NC}   $*"; exit 1; }

[[ $EUID -eq 0 ]] || die "Run as root: sudo bash $0"
cd "$REPO_ROOT"

echo ""
echo -e "${BOLD}${CYAN}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║         Majlis — Full Droplet Bootstrap        ║${NC}"
echo -e "${BOLD}${CYAN}╚═══════════════════════════════════════════════╝${NC}"
echo ""

# ── Step 1: Collect secrets ─────────────────────────────────────────────────
if [[ -f .env ]]; then
  warn ".env already exists — skipping secret prompts. Edit manually if needed."
else
  echo -e "${YELLOW}You'll need these before continuing:${NC}"
  echo "  1. HuggingFace token (https://huggingface.co/settings/tokens)"
  echo "  2. Tavily API key (https://app.tavily.com)"
  echo "  3. Clerk secret key (https://clerk.com dashboard → API Keys)"
  echo "  4. Your Cloudflare Pages URL (e.g. https://majlis.pages.dev)"
  echo "  5. Your domain pointing to this droplet (optional, for SSL)"
  echo ""

  ask "Enter HuggingFace token (hf_...): "
  read -r -s HF_TOKEN; echo ""

  ask "Enter Tavily API key (tvly-... or press Enter to skip): "
  read -r -s TAVILY_API_KEY; echo ""

  ask "Enter Clerk secret key (sk_live_... or press Enter to skip): "
  read -r -s CLERK_SECRET_KEY; echo ""

  ask "Enter frontend origin URL (default: https://majlis.pages.dev): "
  read -r FRONTEND_ORIGIN
  FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-https://majlis.pages.dev}"

  ask "Enter your domain for SSL (e.g. api.majlis.app) or press Enter to skip: "
  read -r DOMAIN

  info "Writing .env file…"
  cat > .env << ENVFILE
# Majlis production secrets — DO NOT COMMIT THIS FILE
HF_TOKEN=${HF_TOKEN}
TAVILY_API_KEY=${TAVILY_API_KEY}
CLERK_SECRET_KEY=${CLERK_SECRET_KEY}
FRONTEND_ORIGIN=${FRONTEND_ORIGIN}
ENVFILE
  chmod 600 .env
  ok ".env written"
fi

# ── Step 2: System setup ────────────────────────────────────────────────────
info "Running system setup (01-setup-droplet.sh)…"
bash "$SCRIPT_DIR/01-setup-droplet.sh"

# ── Step 3: Create required host directories ─────────────────────────────────
info "Creating host mount directories…"
mkdir -p /opt/majlis/data/{hf_cache,db}
chown -R root:docker /opt/majlis/data
chmod -R 775 /opt/majlis/data
ok "Directories ready"

# ── Step 4: SSL (optional) ───────────────────────────────────────────────────
if [[ -n "${DOMAIN:-}" ]]; then
  info "Setting up SSL for $DOMAIN…"
  bash "$SCRIPT_DIR/03-ssl.sh" "$DOMAIN"
else
  warn "No domain provided — running without SSL (HTTP only). Add SSL later with:"
  warn "  bash deploy/scripts/03-ssl.sh <your-domain>"
  mkdir -p ssl
  # Generate a self-signed cert so nginx doesn't fail on first start
  if ! [[ -f ssl/cert.pem ]]; then
    info "Generating self-signed cert (development only)…"
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout ssl/key.pem \
      -out ssl/cert.pem \
      -subj "/CN=localhost" 2>/dev/null
    ok "Self-signed cert generated"
  fi
fi

# ── Step 5: Deploy ────────────────────────────────────────────────────────────
info "Starting Majlis services…"
bash "$SCRIPT_DIR/02-deploy.sh"

# ── Step 6: Final health report ───────────────────────────────────────────────
info "Running health report…"
sleep 5
bash "$SCRIPT_DIR/04-health-check.sh"

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║           Bootstrap complete!                  ║${NC}"
echo -e "${GREEN}${BOLD}╚═══════════════════════════════════════════════╝${NC}"
echo ""
DROPLET_IP=$(curl -sf http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address 2>/dev/null || hostname -I | awk '{print $1}')
echo "  Backend API:    http://${DROPLET_IP}/health"
if [[ -n "${DOMAIN:-}" ]]; then
  echo "  Backend (SSL):  https://${DOMAIN}/health"
fi
echo ""
echo "  Models are downloading in the background (~30 GB)."
echo "  Monitor:  docker compose logs -f vllm-llama"
echo ""
echo "  Once all models are ready, point your frontend .env to:"
echo "    VITE_API_URL=http://${DROPLET_IP}"
echo ""
