#!/usr/bin/env bash
# Stop the background backend + frontend started by scripts/start.sh.
# Falls back to killing whatever is listening on the configured ports.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT/.run"

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

stop_pidfile() {
  local label="$1" file="$2"
  if [[ -f "$file" ]]; then
    local pid
    pid="$(cat "$file")"
    if kill -0 "$pid" 2>/dev/null; then
      echo "[stop] $label pid $pid"
      kill "$pid" 2>/dev/null || true
      # Give it a moment, then force.
      sleep 0.5
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$file"
  fi
}

stop_port() {
  local label="$1" port="$2"
  local pids
  pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "[stop] $label fallback — killing pids on :$port → $pids"
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 0.5
    # shellcheck disable=SC2086
    kill -9 $pids 2>/dev/null || true
  fi
}

stop_pidfile backend "$RUN_DIR/backend.pid"
stop_pidfile frontend "$RUN_DIR/frontend.pid"

stop_port backend "$BACKEND_PORT"
stop_port frontend "$FRONTEND_PORT"

echo "[stop] done"
