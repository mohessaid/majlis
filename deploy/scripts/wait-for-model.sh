#!/usr/bin/env bash
# Polls a URL until it returns HTTP 200 or timeout.
# Usage: wait-for-model.sh <url> <timeout_seconds>
URL="${1:-http://localhost:8005/health}"
TIMEOUT="${2:-120}"
INTERVAL=5
elapsed=0

echo "[wait] Waiting for $URL (timeout ${TIMEOUT}s)…"
while ! curl -sf "$URL" -o /dev/null 2>/dev/null; do
  sleep $INTERVAL
  elapsed=$((elapsed + INTERVAL))
  if (( elapsed >= TIMEOUT )); then
    echo "[wait] Timed out waiting for $URL"
    exit 1
  fi
  echo "[wait] Still waiting… ${elapsed}s / ${TIMEOUT}s"
done
echo "[wait] $URL is ready!"
