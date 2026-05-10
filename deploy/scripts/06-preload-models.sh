#!/usr/bin/env bash
# ============================================================
# Majlis — Pre-download model weights
# Downloads all 5 models to the HuggingFace cache volume
# BEFORE starting vLLM — avoids slow first-request latency.
#
# Usage:
#   bash deploy/scripts/06-preload-models.sh
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
die()   { echo -e "${RED}[ERR]${NC}   $*"; exit 1; }

[[ -f "$REPO_ROOT/.env" ]] || die ".env not found. Run 00-bootstrap.sh first."
source "$REPO_ROOT/.env"
[[ -n "${HF_TOKEN:-}" ]] || die "HF_TOKEN not set in .env"

MODELS=(
  "Qwen/Qwen2.5-0.5B-Instruct"       # Curator — smallest, download first
  "Qwen/Qwen2.5-7B-Instruct"
  "mistralai/Mistral-7B-Instruct-v0.3"
  "deepseek-ai/DeepSeek-R1-Distill-Llama-8B"
  "meta-llama/Llama-3.1-8B-Instruct"  # Gated — needs HF_TOKEN + license acceptance
)

CACHE_DIR="/opt/majlis/data/hf_cache"
mkdir -p "$CACHE_DIR"

info "Downloading model weights to $CACHE_DIR"
info "Total download: ~30–35 GB. This runs in the background."
echo ""

for MODEL in "${MODELS[@]}"; do
  info "Downloading $MODEL…"
  docker run --rm \
    -e HUGGING_FACE_HUB_TOKEN="$HF_TOKEN" \
    -v "$CACHE_DIR:/root/.cache/huggingface" \
    python:3.12-slim \
    sh -c "pip install -q huggingface_hub && \
           python -c \"from huggingface_hub import snapshot_download; \
           snapshot_download('$MODEL', ignore_patterns=['*.gguf', '*.bin'])\"" \
    && ok "$MODEL downloaded" \
    || echo "  Warning: $MODEL download failed (check HF token / license)"
done

echo ""
ok "All models pre-loaded. You can now start vLLM services:"
echo "  docker compose up -d vllm-curator vllm-llama vllm-qwen vllm-mistral vllm-deepseek"
