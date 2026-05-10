#!/usr/bin/env bash
# ============================================================
# Majlis — AMD MI300X Droplet Initial Setup
# Run this ONCE on a fresh DigitalOcean AMD GPU droplet.
#
# Tested on: Ubuntu 22.04 + ROCm 7.2 (DO GPU droplet image)
#
# Usage:
#   ssh root@<droplet-ip>
#   curl -fsSL https://raw.githubusercontent.com/.../01-setup-droplet.sh | bash
#
#   — or —
#
#   scp deploy/scripts/01-setup-droplet.sh root@<droplet-ip>:~
#   ssh root@<droplet-ip> bash 01-setup-droplet.sh
# ============================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
die()   { echo -e "${RED}[ERR]${NC}  $*"; exit 1; }

[[ $EUID -eq 0 ]] || die "Run as root (sudo bash $0)"

# ── 1. System packages ──────────────────────────────────────────────────────
info "Updating system packages…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get upgrade -y -q
apt-get install -y -q \
  curl wget git unzip jq \
  ca-certificates gnupg lsb-release \
  software-properties-common \
  htop nvtop ufw fail2ban \
  python3-pip python3-venv

# ── 2. Docker ───────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  info "Installing Docker…"
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
  # Add non-root user if exists
  if id ubuntu &>/dev/null; then
    usermod -aG docker ubuntu
  fi
else
  ok "Docker already installed ($(docker --version))"
fi

# Docker Compose v2 (plugin)
if ! docker compose version &>/dev/null; then
  info "Installing Docker Compose plugin…"
  apt-get install -y docker-compose-plugin
fi
ok "Docker Compose: $(docker compose version --short)"

# ── 3. ROCm device access for Docker ────────────────────────────────────────
info "Configuring ROCm device access…"

# Verify ROCm is present (DO GPU droplets ship with it)
if ! command -v rocm-smi &>/dev/null; then
  warn "rocm-smi not found — installing ROCm 7.x…"
  apt-get install -y rocm-smi-lib rocm-hip-sdk || \
    warn "ROCm install failed — if this is a GPU droplet, ROCm should already be present."
fi

# Ensure render + video groups exist and Docker daemon can access them
for grp in video render; do
  groupadd -f $grp
  if id ubuntu &>/dev/null; then usermod -aG $grp ubuntu; fi
done

# Add Docker daemon ROCm device permissions
DOCKER_DAEMON=/etc/docker/daemon.json
if [[ ! -f $DOCKER_DAEMON ]]; then
  echo '{"log-driver": "json-file", "log-opts": {"max-size": "100m", "max-file": "3"}}' > $DOCKER_DAEMON
fi
systemctl reload docker 2>/dev/null || systemctl restart docker

# ── 4. Verify GPU is visible ─────────────────────────────────────────────────
info "Checking GPU visibility…"
if command -v rocm-smi &>/dev/null; then
  rocm-smi --showproductname | head -5
  ok "AMD GPU detected"
else
  warn "rocm-smi unavailable — GPU check skipped"
fi

# ── 5. Firewall ──────────────────────────────────────────────────────────────
info "Configuring UFW firewall…"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp    # HTTP  (redirects to HTTPS)
ufw allow 443/tcp   # HTTPS (Nginx → FastAPI)
# vLLM ports are NOT exposed publicly — internal Docker network only
ufw --force enable
ok "Firewall configured"

# ── 6. fail2ban ──────────────────────────────────────────────────────────────
info "Enabling fail2ban…"
systemctl enable --now fail2ban

# ── 7. Create majlis user ─────────────────────────────────────────────────────
if ! id majlis &>/dev/null; then
  info "Creating majlis system user…"
  useradd -m -s /bin/bash -G docker,video,render majlis
fi

# ── 8. App directory ──────────────────────────────────────────────────────────
APP_DIR=/opt/majlis
mkdir -p "$APP_DIR"/{ssl,data,logs}
chown -R majlis:majlis "$APP_DIR"
ok "App directory: $APP_DIR"

# ── 9. Swap (safety net — MI300X has 192 GB HBM but host RAM may be limited) ─
SWAP_FILE=/swapfile
if [[ ! -f $SWAP_FILE ]]; then
  info "Creating 16 GB swapfile…"
  fallocate -l 16G $SWAP_FILE
  chmod 600 $SWAP_FILE
  mkswap $SWAP_FILE
  swapon $SWAP_FILE
  echo "$SWAP_FILE none swap sw 0 0" >> /etc/fstab
fi

# ── 10. Install systemd service ──────────────────────────────────────────────
APP_DIR=/opt/majlis
SYSTEMD_SRC="$APP_DIR/repo/deploy/systemd/majlis.service"
if [[ -f "$SYSTEMD_SRC" ]]; then
  info "Installing majlis systemd service…"
  cp "$SYSTEMD_SRC" /etc/systemd/system/majlis.service
  systemctl daemon-reload
  systemctl enable majlis.service
  ok "majlis.service enabled (auto-starts on reboot)"
fi

# ── 11. Summary ───────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Droplet setup complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo "Next steps:"
echo "  1. Copy the repo:  git clone <your-repo> $APP_DIR/repo"
echo "  2. Set env vars:   cp $APP_DIR/repo/.env.example $APP_DIR/repo/.env && nano $APP_DIR/repo/.env"
echo "  3. Get SSL cert:   bash $APP_DIR/repo/deploy/scripts/03-ssl.sh <your-domain>"
echo "  4. Deploy:         bash $APP_DIR/repo/deploy/scripts/02-deploy.sh"
echo ""
