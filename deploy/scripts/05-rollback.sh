#!/usr/bin/env bash
# ============================================================
# Majlis — Rollback to previous Docker image tag
#
# Usage:
#   bash deploy/scripts/05-rollback.sh           # list available tags
#   bash deploy/scripts/05-rollback.sh <tag>     # roll back to tag
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
info() { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()   { echo -e "${GREEN}[OK]${NC}    $*"; }
die()  { echo -e "${RED}[ERR]${NC}   $*"; exit 1; }

TARGET="${1:-}"

if [[ -z "$TARGET" ]]; then
  info "Available backend image tags:"
  docker images majlis-backend --format "  {{.Tag}}\t{{.CreatedAt}}\t{{.Size}}" 2>/dev/null || \
    echo "  No images found"
  echo ""
  echo "Usage: $0 <tag>"
  exit 0
fi

info "Rolling back backend to tag: $TARGET"
docker compose stop backend
docker tag "majlis-backend:$TARGET" majlis-backend:rollback
# Update compose to use rollback tag
docker compose up -d backend

sleep 5
HEALTH=$(curl -sf http://localhost:8000/health 2>/dev/null || echo '{"status":"unreachable"}')
ok "Rollback complete. Health: $HEALTH"
