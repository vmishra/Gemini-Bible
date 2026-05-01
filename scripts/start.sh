#!/usr/bin/env bash
# Start backend (uvicorn :8000) and frontend (vite :5173) in the background.
# Logs land in .run/. Stop with scripts/stop.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT/.run"
mkdir -p "$RUN_DIR"

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

# --- backend ---
cd "$ROOT/backend"
if [[ ! -d .venv ]]; then
  echo "[start] creating backend venv"
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
if [[ ! -f .venv/.deps-installed ]]; then
  echo "[start] installing backend deps"
  pip install -e . >"$RUN_DIR/backend-install.log" 2>&1
  touch .venv/.deps-installed
fi

echo "[start] backend → http://localhost:$BACKEND_PORT"
nohup uvicorn app.main:app --host 0.0.0.0 --port "$BACKEND_PORT" \
  >"$RUN_DIR/backend.log" 2>&1 &
echo $! >"$RUN_DIR/backend.pid"

# --- frontend ---
cd "$ROOT/frontend"
if [[ ! -d node_modules ]]; then
  echo "[start] installing frontend deps"
  pnpm install >"$RUN_DIR/frontend-install.log" 2>&1
fi

echo "[start] frontend → http://localhost:$FRONTEND_PORT"
nohup pnpm dev --port "$FRONTEND_PORT" --strictPort \
  >"$RUN_DIR/frontend.log" 2>&1 &
echo $! >"$RUN_DIR/frontend.pid"

cat <<EOF

  backend  pid $(cat "$RUN_DIR/backend.pid")  log: .run/backend.log
  frontend pid $(cat "$RUN_DIR/frontend.pid") log: .run/frontend.log

  open http://localhost:$FRONTEND_PORT
  stop  scripts/stop.sh
EOF
