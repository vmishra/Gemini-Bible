#!/usr/bin/env bash
# Gemini Bible — single entrypoint for start / stop / restart / status / logs.
#
# Usage:
#   ./app.sh start     provision deps, background uvicorn :8165 and vite :5142
#   ./app.sh stop      kill by pidfile, fall back to ports 8165 / 5142
#   ./app.sh restart   stop then start
#   ./app.sh status    print pid + listening port for each side
#   ./app.sh logs      tail -f backend + frontend logs
#
# Env overrides: BACKEND_PORT, FRONTEND_PORT.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_DIR="$ROOT/.run"
BACKEND_PORT="${BACKEND_PORT:-8165}"
FRONTEND_PORT="${FRONTEND_PORT:-5142}"
BACKEND_PID="$RUN_DIR/backend.pid"
FRONTEND_PID="$RUN_DIR/frontend.pid"
BACKEND_LOG="$RUN_DIR/backend.log"
FRONTEND_LOG="$RUN_DIR/frontend.log"

log() { printf '[app] %s\n' "$*"; }

is_alive() {
  local file="$1"
  [[ -f "$file" ]] && kill -0 "$(cat "$file")" 2>/dev/null
}

start_backend() {
  if is_alive "$BACKEND_PID"; then
    log "backend already running (pid $(cat "$BACKEND_PID"))"
    return 0
  fi
  cd "$ROOT/backend"
  if [[ ! -d .venv ]]; then
    log "creating backend venv"
    python3 -m venv .venv
  fi
  # shellcheck disable=SC1091
  source .venv/bin/activate
  if [[ ! -f .venv/.deps-installed ]]; then
    log "installing backend deps"
    pip install -e . >"$RUN_DIR/backend-install.log" 2>&1
    touch .venv/.deps-installed
  fi
  log "backend → http://localhost:$BACKEND_PORT"
  nohup uvicorn app.main:app --host 0.0.0.0 --port "$BACKEND_PORT" \
    >"$BACKEND_LOG" 2>&1 &
  echo $! >"$BACKEND_PID"
}

start_frontend() {
  if is_alive "$FRONTEND_PID"; then
    log "frontend already running (pid $(cat "$FRONTEND_PID"))"
    return 0
  fi
  cd "$ROOT/frontend"
  if [[ ! -d node_modules ]]; then
    log "installing frontend deps"
    pnpm install >"$RUN_DIR/frontend-install.log" 2>&1
  fi
  log "frontend → http://localhost:$FRONTEND_PORT"
  nohup pnpm dev --port "$FRONTEND_PORT" --strictPort \
    >"$FRONTEND_LOG" 2>&1 &
  echo $! >"$FRONTEND_PID"
}

stop_pidfile() {
  local label="$1" file="$2"
  if [[ -f "$file" ]]; then
    local pid
    pid="$(cat "$file")"
    if kill -0 "$pid" 2>/dev/null; then
      log "$label pid $pid"
      kill "$pid" 2>/dev/null || true
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
    log "$label fallback — killing pids on :$port → $pids"
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 0.5
    # shellcheck disable=SC2086
    kill -9 $pids 2>/dev/null || true
  fi
}

cmd_start() {
  mkdir -p "$RUN_DIR"
  start_backend
  start_frontend
  cat <<EOF

  backend  pid $(cat "$BACKEND_PID" 2>/dev/null || echo '?')  log: .run/backend.log
  frontend pid $(cat "$FRONTEND_PID" 2>/dev/null || echo '?')  log: .run/frontend.log

  open  http://localhost:$FRONTEND_PORT
  stop  ./app.sh stop
EOF
}

cmd_stop() {
  stop_pidfile backend "$BACKEND_PID"
  stop_pidfile frontend "$FRONTEND_PID"
  stop_port backend "$BACKEND_PORT"
  stop_port frontend "$FRONTEND_PORT"
  log "stopped"
}

cmd_restart() {
  cmd_stop
  cmd_start
}

cmd_status() {
  for pair in "backend:$BACKEND_PID:$BACKEND_PORT" "frontend:$FRONTEND_PID:$FRONTEND_PORT"; do
    IFS=: read -r label file port <<<"$pair"
    if is_alive "$file"; then
      printf '  %-9s up   pid %s   port %s\n' "$label" "$(cat "$file")" "$port"
    else
      printf '  %-9s down              port %s\n' "$label" "$port"
    fi
  done
}

cmd_logs() {
  mkdir -p "$RUN_DIR"
  touch "$BACKEND_LOG" "$FRONTEND_LOG"
  tail -f "$BACKEND_LOG" "$FRONTEND_LOG"
}

case "${1:-}" in
  start)   cmd_start ;;
  stop)    cmd_stop ;;
  restart) cmd_restart ;;
  status)  cmd_status ;;
  logs)    cmd_logs ;;
  *)
    cat <<EOF
usage: ./app.sh {start|stop|restart|status|logs}

  start     provision deps + spawn backend (:$BACKEND_PORT) and frontend (:$FRONTEND_PORT)
  stop      kill by pidfile, fall back to ports
  restart   stop then start
  status    print pid + port for each side
  logs      tail -f backend + frontend logs
EOF
    exit 2
    ;;
esac
