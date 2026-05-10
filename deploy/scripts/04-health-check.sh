#!/usr/bin/env bash
# ============================================================
# Majlis — Full Health Report
# Run from repo root on the droplet.
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}✓${NC}  $*"; }
fail() { echo -e "  ${RED}✗${NC}  $*"; }
info() { echo -e "${CYAN}$*${NC}"; }

cd "$REPO_ROOT"

echo ""
info "════════════════════════════════════════════════"
info "  Majlis Health Report — $(date)"
info "════════════════════════════════════════════════"

# ── Docker services ──────────────────────────────────────────────────────────
echo ""
info "── Docker Services ──"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

# ── GPU check ────────────────────────────────────────────────────────────────
echo ""
info "── GPU (AMD MI300X) ──"
if command -v rocm-smi &>/dev/null; then
  rocm-smi --showproductname 2>/dev/null | head -5
  rocm-smi --showmeminfo vram 2>/dev/null | head -10
else
  echo "  rocm-smi not available"
fi

# ── vLLM model endpoints ─────────────────────────────────────────────────────
echo ""
info "── Model Endpoints ──"
declare -A MODELS=(
  ["vllm-llama (8001)"]="http://localhost:8001/health"
  ["vllm-qwen (8002)"]="http://localhost:8002/health"
  ["vllm-mistral (8003)"]="http://localhost:8003/health"
  ["vllm-deepseek (8004)"]="http://localhost:8004/health"
  ["vllm-curator (8005)"]="http://localhost:8005/health"
)

for name in "${!MODELS[@]}"; do
  url="${MODELS[$name]}"
  if curl -sf "$url" -o /dev/null 2>/dev/null; then
    ok "$name"
  else
    fail "$name (down or still loading)"
  fi
done

# ── Backend API ──────────────────────────────────────────────────────────────
echo ""
info "── Backend API ──"
HEALTH=$(curl -sf http://localhost:8000/health 2>/dev/null || echo '{"status":"unreachable"}')
STATUS=$(echo "$HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','?'))" 2>/dev/null || echo "?")
if [[ "$STATUS" == "ok" ]]; then
  ok "FastAPI /health → $HEALTH"
else
  fail "FastAPI /health → $HEALTH"
fi

# ── Nginx / HTTPS ─────────────────────────────────────────────────────────────
echo ""
info "── Nginx ──"
if curl -sf http://localhost:80 -o /dev/null 2>/dev/null; then
  ok "Port 80 responding"
else
  fail "Port 80 not responding"
fi

# Check for SSL cert
if [[ -f ssl/cert.pem ]]; then
  EXPIRY=$(openssl x509 -enddate -noout -in ssl/cert.pem 2>/dev/null | cut -d= -f2)
  ok "SSL cert present — expires: $EXPIRY"
else
  echo "  SSL cert not yet configured (run 03-ssl.sh)"
fi

# ── Disk usage ────────────────────────────────────────────────────────────────
echo ""
info "── Disk Usage ──"
df -h / | tail -1 | awk '{printf "  Used: %s / %s (%s)\n", $3, $2, $5}'
echo "  HuggingFace cache:"
du -sh /var/lib/docker/volumes/majlis_hf_cache 2>/dev/null || echo "  (volume not found)"

# ── Recent logs ───────────────────────────────────────────────────────────────
echo ""
info "── Recent Backend Logs (last 10 lines) ──"
docker compose logs --tail=10 backend 2>/dev/null | sed 's/^/  /'

echo ""
info "════════════════════════════════════════════════"
