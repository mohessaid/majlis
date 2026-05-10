#!/usr/bin/env bash
# ============================================================
# Majlis — Deploy / Update
# Run from the repo root on the droplet (or via SSH from CI).
#
# Usage:
#   bash deploy/scripts/02-deploy.sh [--pull] [--no-rebuild]
#
# Flags:
#   --pull        git pull before deploying
#   --no-rebuild  skip docker build (just restart)
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
die()   { echo -e "${RED}[ERR]${NC}   $*"; exit 1; }

DO_PULL=false
DO_REBUILD=true

for arg in "$@"; do
  case $arg in
    --pull)       DO_PULL=true ;;
    --no-rebuild) DO_REBUILD=false ;;
  esac
done

cd "$REPO_ROOT"

# ── Validate .env exists ────────────────────────────────────────────────────
[[ -f .env ]] || die ".env not found. Copy .env.example → .env and fill in secrets."

# Load env vars for validation
set -o allexport; source .env; set +o allexport

[[ -n "${HF_TOKEN:-}" ]]        || warn "HF_TOKEN not set — Llama download will fail."
[[ -n "${TAVILY_API_KEY:-}" ]]  || warn "TAVILY_API_KEY not set — web search disabled."
[[ -n "${CLERK_SECRET_KEY:-}" ]] || warn "CLERK_SECRET_KEY not set — auth in dev mode."

# ── Optional git pull ────────────────────────────────────────────────────────
if $DO_PULL; then
  info "Pulling latest code…"
  git pull --rebase origin main
  ok "Code updated"
fi

# ── Pull vLLM ROCm image ─────────────────────────────────────────────────────
info "Pulling vLLM ROCm image…"
docker pull rocm/vllm-dev:latest 2>&1 | tail -3 || warn "Pull failed — using cached image."

# ── Build backend image ───────────────────────────────────────────────────────
if $DO_REBUILD; then
  info "Building backend Docker image…"
  docker compose build --no-cache backend
  ok "Backend image built"
fi

# ── Rolling restart ───────────────────────────────────────────────────────────
info "Starting services…"

# Start model servers first and wait for them to be ready
docker compose up -d \
  vllm-curator \
  vllm-llama \
  vllm-qwen \
  vllm-mistral \
  vllm-deepseek

info "Waiting for Curator model to be ready (this takes ~2 min on first run)…"
bash "$SCRIPT_DIR/wait-for-model.sh" "http://localhost:8005/health" 120 || \
  warn "Curator health check timed out — backend will retry."

info "Starting backend and nginx…"
docker compose up -d backend nginx

# ── Health check ─────────────────────────────────────────────────────────────
info "Running health check…"
sleep 5
HEALTH=$(curl -sf http://localhost:8000/health 2>/dev/null || echo '{"status":"unreachable"}')
STATUS=$(echo "$HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','?'))" 2>/dev/null || echo "?")

if [[ "$STATUS" == "ok" ]]; then
  ok "Backend is healthy: $HEALTH"
else
  warn "Backend health: $HEALTH"
  warn "Check logs: docker compose logs --tail=50 backend"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Majlis is live!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "Useful commands:"
echo "  docker compose logs -f backend          # backend logs"
echo "  docker compose logs -f vllm-llama       # model logs"
echo "  docker compose ps                       # service status"
echo "  bash deploy/scripts/04-health-check.sh  # full health report"
echo ""
