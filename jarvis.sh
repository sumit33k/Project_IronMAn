#!/usr/bin/env bash
# jarvis.sh — quick-start shortcut for Project IronMan (local dev)
#
# Usage:
#   ./jarvis.sh              start API + frontend (default)
#   ./jarvis.sh start        start API + frontend
#   ./jarvis.sh stop         kill running instances
#   ./jarvis.sh restart      stop then start
#   ./jarvis.sh logs         tail API and frontend logs side-by-side
#   ./jarvis.sh status       show whether API / frontend are up
#   ./jarvis.sh voice        also start the voice infra (Docker Compose)
#   ./jarvis.sh --no-browser skip opening the browser on start
#
# First-time setup?  Run ./start.sh instead — it installs deps + migrates.

set -euo pipefail

# ── Colors ────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${CYAN}⚡${NC} $*"; }
ok()      { echo -e "${GREEN}✔${NC}  $*"; }
warn()    { echo -e "${YELLOW}⚠${NC}  $*"; }
die()     { echo -e "${RED}✘${NC}  $*" >&2; exit 1; }

# ── Paths ─────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"
API_DIR="$REPO_ROOT/apps/api"
WEB_DIR="$REPO_ROOT/apps/web"
VENV="$API_DIR/.venv"
ENV_FILE="$REPO_ROOT/.env"
API_PID_FILE="/tmp/jarvis-api.pid"
WEB_PID_FILE="/tmp/jarvis-web.pid"
API_LOG="/tmp/jarvis-api.log"
WEB_LOG="/tmp/jarvis-web.log"

# ── Config (override via env or flags) ────────────────────────
API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-3005}"
OPEN_BROWSER=true
WITH_VOICE=false

# ── Parse args ────────────────────────────────────────────────
COMMAND="start"
for arg in "$@"; do
  case "$arg" in
    start|stop|restart|logs|status|voice) COMMAND="$arg" ;;
    --no-browser) OPEN_BROWSER=false ;;
    --help|-h)
      sed -n '/^# Usage/,/^$/p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *) warn "Unknown argument: $arg" ;;
  esac
done

# ── Helpers ───────────────────────────────────────────────────
load_env() {
  [[ -f "$ENV_FILE" ]] || die ".env not found at $ENV_FILE. Run ./start.sh first."
  set -a; source "$ENV_FILE"; set +a
}

api_up()  { curl -sf "http://127.0.0.1:${API_PORT}/health" &>/dev/null; }
web_up()  { curl -sf "http://127.0.0.1:${WEB_PORT}"        &>/dev/null; }

wait_url() {
  local url="$1" label="$2" secs="${3:-30}" i=0
  printf "  Waiting for %-12s" "$label"
  while (( i < secs )); do
    curl -sf "$url" &>/dev/null && { echo " ready"; return 0; }
    printf "."; sleep 1; (( i++ ))
  done
  echo " timeout"
  return 1
}

open_browser() {
  [[ "$OPEN_BROWSER" != true ]] && return
  local url="http://localhost:${WEB_PORT}"
  if   [[ "$(uname)" == "Darwin" ]];              then open "$url" 2>/dev/null || true
  elif command -v xdg-open &>/dev/null;            then xdg-open "$url" 2>/dev/null || true
  elif command -v wslview &>/dev/null;             then wslview "$url" 2>/dev/null || true
  fi
}

# ── stop ──────────────────────────────────────────────────────
cmd_stop() {
  local stopped=false

  for pf in "$API_PID_FILE" "$WEB_PID_FILE"; do
    if [[ -f "$pf" ]]; then
      pid="$(cat "$pf")"
      if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null && ok "Stopped pid $pid"
      fi
      rm -f "$pf"
      stopped=true
    fi
  done

  # Also zap anything still holding the ports (handles orphans)
  for port in "$API_PORT" "$WEB_PORT"; do
    pids="$(lsof -ti ":$port" 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      echo "$pids" | xargs kill 2>/dev/null || true
      ok "Freed port $port"
      stopped=true
    fi
  done

  $stopped && ok "Jarvis stopped." || info "Nothing was running."
}

# ── status ────────────────────────────────────────────────────
cmd_status() {
  echo ""
  if api_up; then ok "API     http://localhost:${API_PORT}"
  else            warn "API     not running"
  fi
  if web_up; then ok "Web     http://localhost:${WEB_PORT}"
  else            warn "Web     not running"
  fi
  echo ""
}

# ── logs ──────────────────────────────────────────────────────
cmd_logs() {
  echo -e "${BOLD}Tailing API and frontend logs (Ctrl+C to quit):${NC}"
  echo -e "  ${CYAN}API:${NC}      $API_LOG"
  echo -e "  ${CYAN}Frontend:${NC} $WEB_LOG"
  echo ""
  tail -f "$API_LOG" "$WEB_LOG" 2>/dev/null || die "No logs found yet. Start Jarvis first."
}

# ── voice (Docker Compose) ────────────────────────────────────
cmd_voice() {
  local compose="$REPO_ROOT/infra/docker-compose.voice.yml"
  [[ -f "$compose" ]] || die "Voice compose file not found: $compose"
  command -v docker &>/dev/null || die "Docker not installed."
  info "Starting voice infra (Piper TTS + openWakeWord)..."
  docker compose -f "$compose" up -d
  ok "Voice services up. Check health at http://localhost:8000/voice/providers/health"
}

# ── start ─────────────────────────────────────────────────────
cmd_start() {
  # Pre-flight
  load_env

  [[ -d "$VENV" ]]    || die "Python venv not found at $VENV. Run ./start.sh first."
  [[ -d "$WEB_DIR/node_modules" ]] || die "Node modules missing. Run ./start.sh first."

  if api_up || web_up; then
    echo ""
    echo -e "${BOLD}${GREEN}  Jarvis is already running!${NC}"
    cmd_status
    printf "  Restart? [y/N] "
    read -r choice
    [[ "${choice:-n}" =~ ^[Yy]$ ]] && cmd_stop || exit 0
    sleep 1
  fi

  # Start API
  info "Starting API on port $API_PORT..."
  (
    source "$VENV/bin/activate"
    set -a; source "$ENV_FILE"; set +a
    export FRONTEND_URL="${FRONTEND_URL:-http://localhost:${WEB_PORT}}"
    cd "$API_DIR"
    exec uvicorn app.main:app --port "$API_PORT" --host 127.0.0.1
  ) >> "$API_LOG" 2>&1 &
  echo $! > "$API_PID_FILE"

  # Start frontend
  info "Starting frontend on port $WEB_PORT..."
  (
    set -a; source "$ENV_FILE"; set +a
    export NEXT_PUBLIC_API_URL="http://127.0.0.1:${API_PORT}"
    cd "$WEB_DIR"
    exec npm run dev -- --port "$WEB_PORT"
  ) >> "$WEB_LOG" 2>&1 &
  echo $! > "$WEB_PID_FILE"

  # Optionally start voice
  [[ "$WITH_VOICE" == true ]] && cmd_voice

  # Wait for readiness
  wait_url "http://127.0.0.1:${API_PORT}/health" "API"      30 || warn "API slow to start — check $API_LOG"
  wait_url "http://127.0.0.1:${WEB_PORT}"        "Frontend" 60 || warn "Frontend slow to start — check $WEB_LOG"

  echo ""
  echo -e "${BOLD}${GREEN}  Jarvis is running!${NC}"
  echo -e "  ${CYAN}UI:${NC}       http://localhost:${WEB_PORT}"
  echo -e "  ${CYAN}API:${NC}      http://localhost:${API_PORT}"
  echo -e "  ${CYAN}Docs:${NC}     http://localhost:${API_PORT}/docs"
  echo -e "  ${CYAN}Logs:${NC}     ./jarvis.sh logs"
  echo -e "  ${CYAN}Stop:${NC}     ./jarvis.sh stop"
  echo ""

  # macOS notification
  if [[ "$(uname)" == "Darwin" ]] && command -v osascript &>/dev/null; then
    osascript -e "display notification \"Jarvis ready — http://localhost:${WEB_PORT}\" with title \"Jarvis Command Center\" sound name \"Glass\"" 2>/dev/null || true
  fi

  open_browser
}

# ── dispatch ──────────────────────────────────────────────────
case "$COMMAND" in
  start)   cmd_start   ;;
  stop)    cmd_stop    ;;
  restart) cmd_stop; sleep 1; cmd_start ;;
  logs)    cmd_logs    ;;
  status)  cmd_status  ;;
  voice)   cmd_voice   ;;
esac
