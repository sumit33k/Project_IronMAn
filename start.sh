#!/usr/bin/env bash
# Jarvis Command Center — local desktop launcher
# Run this from anywhere inside the cloned repo. It will:
#   1. Pull latest changes from the current branch
#   2. Sync Python and Node.js dependencies if lockfiles changed
#   3. Ensure Ollama is running
#   4. Launch the API and the web frontend
#   5. Open the UI in your browser
set -euo pipefail

# ── Colors ───────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${CYAN}[jarvis]${NC} $*"; }
success() { echo -e "${GREEN}[jarvis]${NC} $*"; }
warn()    { echo -e "${YELLOW}[jarvis]${NC} WARNING: $*"; }
fatal()   { echo -e "${RED}[jarvis]${NC} ERROR: $*" >&2; exit 1; }
step()    { echo -e "\n${BOLD}${BLUE}── $* ──${NC}"; }

# ── Config ───────────────────────────────────────────────────
API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-3000}"
DEFAULT_MODEL="llama3.1"
OPEN_BROWSER=true
API_PID="" WEB_PID=""

# ── Parse flags ──────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --no-browser) OPEN_BROWSER=false ;;
    --help|-h)
      echo -e "${BOLD}Usage:${NC} $0 [--no-browser] [--help]"
      echo "  --no-browser   Skip opening the browser after startup"
      exit 0 ;;
    *) warn "Unknown flag: $arg — ignoring" ;;
  esac
done

# ── Banner ───────────────────────────────────────────────────
echo -e "${BOLD}${BLUE}"
cat <<'EOF'
  ╔════════════════════════════════════════╗
  ║   ⚡  Jarvis Command Center            ║
  ║      Project IronMan  –  start.sh      ║
  ╚════════════════════════════════════════╝
EOF
echo -e "${NC}"

# ── Locate repo root ─────────────────────────────────────────
# Resolve the directory this script lives in, then walk up until we find the
# apps/ directory that marks the repo root.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"
# If the script was placed in a subdirectory, walk upward to find apps/
while [[ "$REPO_ROOT" != "/" && ! -d "$REPO_ROOT/apps" ]]; do
  REPO_ROOT="$(dirname "$REPO_ROOT")"
done
[[ -d "$REPO_ROOT/apps" ]] || fatal "Could not locate repo root (no apps/ directory found). Run this script from inside the repo."
success "Repo root: $REPO_ROOT"

# ── Step 1: Pull latest (no re-clone) ────────────────────────
step "Pulling latest changes"
cd "$REPO_ROOT"

if ! command -v git &>/dev/null; then
  warn "git not found — skipping pull. Install git to stay up to date."
elif ! git rev-parse --is-inside-work-tree &>/dev/null; then
  warn "Not a git repository — skipping pull."
else
  CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")"
  if [[ -z "$CURRENT_BRANCH" || "$CURRENT_BRANCH" == "HEAD" ]]; then
    warn "Detached HEAD — skipping pull."
  else
    info "Branch: $CURRENT_BRANCH"
    if git remote get-url origin &>/dev/null; then
      info "Fetching origin/$CURRENT_BRANCH..."
      if git fetch origin "$CURRENT_BRANCH" --quiet 2>/dev/null; then
        LOCAL=$(git rev-parse HEAD)
        REMOTE=$(git rev-parse "origin/$CURRENT_BRANCH" 2>/dev/null || echo "$LOCAL")
        if [[ "$LOCAL" == "$REMOTE" ]]; then
          success "Already up to date."
        else
          info "New commits detected — merging..."
          if git merge --ff-only "origin/$CURRENT_BRANCH" --quiet; then
            success "Updated to $(git rev-parse --short HEAD)."
          else
            warn "Fast-forward not possible (local commits ahead or diverged). Skipping auto-merge."
            info "Run 'git pull' manually if you want to reconcile changes."
          fi
        fi
      else
        warn "Network unreachable or origin fetch failed — running with existing code."
      fi
    else
      warn "No remote 'origin' configured — skipping pull."
    fi
  fi
fi

# ── Step 2: Prereq checks ────────────────────────────────────
step "Checking prerequisites"

check_cmd() {
  local cmd="$1" label="$2" hint="$3" required="${4:-true}"
  if command -v "$cmd" &>/dev/null; then
    success "$label: $($cmd --version 2>&1 | head -1 | awk '{print $NF}')"
    return 0
  else
    if [[ "$required" == true ]]; then
      fatal "$label not found. $hint"
    else
      warn "$label not found. $hint"
      return 1
    fi
  fi
}

check_cmd python3   "python3"  "Install Python 3.11+ from https://python.org"
check_cmd node      "node"     "Install Node.js 20+ from https://nodejs.org"
check_cmd npm       "npm"      "Install Node.js (npm is bundled) from https://nodejs.org"

# python version gate
PY_MINOR=$(python3 -c 'import sys; print(sys.version_info.minor)')
PY_MAJOR=$(python3 -c 'import sys; print(sys.version_info.major)')
[[ "$PY_MAJOR" -ge 3 && "$PY_MINOR" -ge 11 ]] || fatal "Python 3.11+ required (found $(python3 --version)). See https://python.org"

# node version gate
NODE_MAJOR=$(node --version | tr -d 'v' | cut -d. -f1)
[[ "$NODE_MAJOR" -ge 18 ]] || fatal "Node.js 18+ required (found $(node --version)). See https://nodejs.org"

# ── Step 3: Python dependencies ──────────────────────────────
step "Python environment"

API_DIR="$REPO_ROOT/apps/api"
[[ -d "$API_DIR" ]] || fatal "apps/api not found at $API_DIR"

cd "$API_DIR"
VENV="$API_DIR/.venv"

if [[ ! -d "$VENV" ]]; then
  info "Creating virtual environment..."
  python3 -m venv "$VENV"
  success "Created .venv"
fi

# shellcheck disable=SC1091
source "$VENV/bin/activate"

REQ="$API_DIR/requirements.txt"
STAMP="$VENV/.req-installed"

needs_pip_install() {
  [[ ! -f "$STAMP" ]] && return 0
  [[ "$REQ" -nt "$STAMP" ]] && return 0
  return 1
}

if needs_pip_install; then
  info "Installing/updating Python dependencies..."
  pip install -r "$REQ" --quiet
  touch "$STAMP"
  success "Python dependencies up to date"
else
  success "Python dependencies already installed"
fi

# ── Step 4: Node.js dependencies ─────────────────────────────
step "Node.js dependencies"

WEB_DIR="$REPO_ROOT/apps/web"
[[ -d "$WEB_DIR" ]] || fatal "apps/web not found at $WEB_DIR"

cd "$WEB_DIR"

LOCK="$WEB_DIR/package-lock.json"
NM_STAMP="$WEB_DIR/node_modules/.install-stamp"

needs_npm_install() {
  [[ ! -d "$WEB_DIR/node_modules" ]] && return 0
  [[ -f "$LOCK" && -f "$NM_STAMP" && "$LOCK" -nt "$NM_STAMP" ]] && return 0
  [[ ! -f "$NM_STAMP" ]] && return 0
  return 1
}

if needs_npm_install; then
  info "Installing/updating Node.js dependencies..."
  npm install --legacy-peer-deps --silent
  touch "$NM_STAMP"
  success "Node.js dependencies up to date"
else
  success "Node.js dependencies already installed"
fi

# ── Step 5: Ollama ───────────────────────────────────────────
step "Ollama AI engine"

cd "$REPO_ROOT"
OLLAMA_MODEL="${OLLAMA_MODEL:-$DEFAULT_MODEL}"

if ! command -v ollama &>/dev/null; then
  warn "Ollama is not installed. AI features will be unavailable."
  if [[ "$(uname)" == "Darwin" ]]; then
    info "Install: https://ollama.ai/download (macOS .dmg)"
  else
    info "Install: curl -fsSL https://ollama.ai/install.sh | sh"
  fi
else
  if curl -sf http://localhost:11434/api/tags &>/dev/null; then
    success "Ollama already running"
  else
    info "Starting Ollama server..."
    nohup ollama serve > /tmp/jarvis-ollama.log 2>&1 &
    OLLAMA_PID=$!
    for i in $(seq 1 8); do
      sleep 1
      if curl -sf http://localhost:11434/api/tags &>/dev/null; then
        success "Ollama server started (pid $OLLAMA_PID)"
        break
      fi
      if [[ "$i" -eq 8 ]]; then
        warn "Ollama did not become ready — check /tmp/jarvis-ollama.log"
      fi
    done
  fi

  # Verify model is available (non-blocking)
  if curl -sf http://localhost:11434/api/tags &>/dev/null; then
    if ! ollama list 2>/dev/null | grep -q "^${OLLAMA_MODEL}"; then
      info "Model '${OLLAMA_MODEL}' not found locally. Pulling (this may take a while)..."
      ollama pull "$OLLAMA_MODEL" && success "Model '${OLLAMA_MODEL}' ready" || \
        warn "Could not pull '${OLLAMA_MODEL}'. Pull it manually: ollama pull ${OLLAMA_MODEL}"
    else
      success "Model '${OLLAMA_MODEL}' available"
    fi
  fi
fi

# ── Step 6: .env ─────────────────────────────────────────────
step "Environment file"

ENV_FILE="$REPO_ROOT/.env"
EXAMPLE_FILE="$REPO_ROOT/.env.example"

if [[ -f "$ENV_FILE" ]]; then
  success ".env already exists"
elif [[ -f "$EXAMPLE_FILE" ]]; then
  cp "$EXAMPLE_FILE" "$ENV_FILE"
  success "Created .env from .env.example"
  info "Edit $ENV_FILE to customise settings (API keys, model, etc.)"
else
  info "No .env or .env.example found — using defaults (Ollama at localhost:11434)"
fi

# ── Cleanup trap ─────────────────────────────────────────────
cleanup() {
  echo ""
  info "Shutting down..."
  [[ -n "$API_PID" ]] && kill "$API_PID" 2>/dev/null && info "API stopped"
  [[ -n "$WEB_PID" ]] && kill "$WEB_PID" 2>/dev/null && info "Frontend stopped"
  success "Jarvis stopped. Goodbye."
}
trap cleanup EXIT INT TERM

# ── Wait helper ───────────────────────────────────────────────
wait_for_url() {
  local url="$1" timeout_s="$2" label="$3"
  local i=0
  printf "  Waiting for %-12s" "$label"
  while [[ $i -lt $timeout_s ]]; do
    if curl -sf "$url" &>/dev/null; then
      echo " ready"
      return 0
    fi
    sleep 1; i=$((i+1)); printf "."
  done
  echo " timeout"
  return 1
}

# ── Step 7: Start services ────────────────────────────────────
step "Starting services"

# API
info "Starting API (port $API_PORT)..."
(
  source "$VENV/bin/activate"
  if [[ -f "$REPO_ROOT/.env" ]]; then
    set -a; source "$REPO_ROOT/.env"; set +a
  fi
  cd "$API_DIR"
  exec uvicorn app.main:app --port "$API_PORT" --host 127.0.0.1 \
    >> /tmp/jarvis-api.log 2>&1
) &
API_PID=$!

# Frontend
info "Starting frontend (port $WEB_PORT)..."
(
  cd "$WEB_DIR"
  if [[ -f "$REPO_ROOT/.env.local" ]]; then
    set -a; source "$REPO_ROOT/.env.local"; set +a
  fi
  exec npm run dev -- --port "$WEB_PORT" \
    >> /tmp/jarvis-web.log 2>&1
) &
WEB_PID=$!

# Wait
if ! wait_for_url "http://127.0.0.1:${API_PORT}/health" 30 "API"; then
  warn "API did not start in 30 s. Last lines of /tmp/jarvis-api.log:"
  tail -10 /tmp/jarvis-api.log 2>/dev/null || true
fi

if ! wait_for_url "http://127.0.0.1:${WEB_PORT}" 60 "Frontend"; then
  warn "Frontend did not start in 60 s. Last lines of /tmp/jarvis-web.log:"
  tail -10 /tmp/jarvis-web.log 2>/dev/null || true
fi

# ── Done ─────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}  Jarvis is running!${NC}"
echo -e "  ${CYAN}UI:${NC}       http://localhost:${WEB_PORT}"
echo -e "  ${CYAN}API:${NC}      http://localhost:${API_PORT}"
echo -e "  ${CYAN}API docs:${NC} http://localhost:${API_PORT}/docs"
echo -e "  ${CYAN}Logs:${NC}     /tmp/jarvis-api.log  |  /tmp/jarvis-web.log"
echo ""
info "Press Ctrl+C to stop all services."

if [[ "$OPEN_BROWSER" == true ]]; then
  sleep 1
  if [[ "$(uname)" == "Darwin" ]]; then
    open "http://localhost:${WEB_PORT}" 2>/dev/null || true
  elif command -v xdg-open &>/dev/null; then
    xdg-open "http://localhost:${WEB_PORT}" 2>/dev/null || true
  elif command -v wslview &>/dev/null; then
    wslview "http://localhost:${WEB_PORT}" 2>/dev/null || true
  fi
fi

# Keep the script alive so Ctrl+C triggers the cleanup trap
wait "$API_PID" "$WEB_PID" 2>/dev/null || true
