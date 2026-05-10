#!/usr/bin/env bash
# ============================================================
# Majlis — SSL Certificate Setup (Let's Encrypt / certbot)
#
# Usage:
#   bash deploy/scripts/03-ssl.sh <your-domain>
#   bash deploy/scripts/03-ssl.sh api.majlis.app
#
# Prerequisites:
#   - DNS A record pointing <domain> → this droplet's IP
#   - Port 80 open on firewall
# ============================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
die()   { echo -e "${RED}[ERR]${NC}   $*"; exit 1; }

DOMAIN="${1:-}"
[[ -n "$DOMAIN" ]] || die "Usage: $0 <domain>  e.g. $0 api.majlis.app"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SSL_DIR="$REPO_ROOT/ssl"
mkdir -p "$SSL_DIR"

# ── Install certbot ──────────────────────────────────────────────────────────
if ! command -v certbot &>/dev/null; then
  info "Installing certbot…"
  apt-get install -y certbot
fi

# ── Stop nginx temporarily (standalone challenge) ────────────────────────────
info "Stopping nginx for standalone ACME challenge…"
docker compose -f "$REPO_ROOT/docker-compose.yml" stop nginx 2>/dev/null || true

# ── Issue certificate ─────────────────────────────────────────────────────────
info "Requesting certificate for $DOMAIN…"
certbot certonly \
  --standalone \
  --non-interactive \
  --agree-tos \
  --email "admin@${DOMAIN}" \
  -d "$DOMAIN"

# ── Copy certs to project ssl/ dir ───────────────────────────────────────────
info "Copying certificates to $SSL_DIR…"
cp /etc/letsencrypt/live/"$DOMAIN"/fullchain.pem "$SSL_DIR/cert.pem"
cp /etc/letsencrypt/live/"$DOMAIN"/privkey.pem   "$SSL_DIR/key.pem"
chmod 644 "$SSL_DIR/cert.pem"
chmod 600 "$SSL_DIR/key.pem"

# ── Update nginx.conf with the domain name ───────────────────────────────────
NGINX_CONF="$REPO_ROOT/nginx.conf"
if grep -q "server_name _;" "$NGINX_CONF"; then
  info "Updating nginx.conf server_name to $DOMAIN…"
  sed -i "s/server_name _;/server_name $DOMAIN;/g" "$NGINX_CONF"
  ok "nginx.conf updated"
fi

# ── Restart nginx ─────────────────────────────────────────────────────────────
info "Restarting nginx…"
docker compose -f "$REPO_ROOT/docker-compose.yml" up -d nginx
sleep 3
docker compose -f "$REPO_ROOT/docker-compose.yml" ps nginx

# ── Set up auto-renewal ───────────────────────────────────────────────────────
info "Setting up certbot auto-renewal…"
RENEW_SCRIPT="/etc/cron.d/certbot-majlis"
cat > "$RENEW_SCRIPT" << CRON
# Renew cert and reload nginx every 60 days at 3am
0 3 */60 * * root certbot renew --quiet --deploy-hook "cp /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ${SSL_DIR}/cert.pem && cp /etc/letsencrypt/live/${DOMAIN}/privkey.pem ${SSL_DIR}/key.pem && docker compose -f ${REPO_ROOT}/docker-compose.yml restart nginx"
CRON
chmod 644 "$RENEW_SCRIPT"

ok "Auto-renewal configured"
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  SSL certificate installed for $DOMAIN${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo "Test: curl -I https://$DOMAIN/health"
echo ""
