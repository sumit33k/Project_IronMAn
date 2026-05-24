#!/usr/bin/env bash
set -euo pipefail

# ── Colors ──────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

# ── Config ──────────────────────────────────────────────────
REPO_URL="https://github.com/sumit33k/project_ironman.git"
DEFAULT_MODEL="llama3.1"
API_PORT=8000
WEB_PORT=3000

# ── Runtime state ───────────────────────────────────────────
MODEL="$DEFAULT_MODEL"
OPEN_BROWSER=true
REPO_ROOT=""
API_PID=""
WEB_PID=""

# ── Helpers ─────────────────────────────────────────────────
info()    { echo -e "${CYAN}ℹ  $*${NC}"; }
success() { echo -e "${GREEN}✓  $*${NC}"; }
warn()    { echo -e "${YELLOW}⚠  $*${NC}"; }
error()   { echo -e "${RED}✗  $*${NC}"; exit 1; }
step()    { echo -e "\n${BOLD}${BLUE}── $* ──${NC}"; }

usage() {
  echo -e "${BOLD}Usage:${NC} $0 [options]"
  echo ""
  echo "Options:"
  echo "  --model MODEL     Ollama model to pull (default: llama3.1)"
  echo "  --no-browser      Don't open browser after start"
  echo "  --dev             Start in dev mode (default)"
  echo "  --help            Show this help"
  exit 0
}

# ── Arg parsing ─────────────────────────────────────────────
parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --model)
        shift
        [[ $# -eq 0 ]] && error "--model requires a value"
        MODEL="$1"
        ;;
      --no-browser) OPEN_BROWSER=false ;;
      --dev)        ;;  # default; accepted for clarity
      --help|-h)    usage ;;
      *) warn "Unknown flag: $1. Ignoring." ;;
    esac
    shift
  done
}

# ── Step 1: Check requirements ───────────────────────────────
check_requirements() {
  step "Checking requirements"

  local all_ok=true

  # git
  if command -v git &>/dev/null; then
    success "git $(git --version | awk '{print $3}')"
  else
    warn "git not found — install it from https://git-scm.com"
    all_ok=false
  fi

  # python3 (need 3.11+)
  if command -v python3 &>/dev/null; then
    local py_ver
    py_ver=$(python3 -c 'import sys; print("%d.%d" % sys.version_info[:2])')
    local py_major py_minor
    py_major=$(echo "$py_ver" | cut -d. -f1)
    py_minor=$(echo "$py_ver" | cut -d. -f2)
    if [[ "$py_major" -ge 3 && "$py_minor" -ge 11 ]]; then
      success "python3 $py_ver"
    else
      warn "python3 $py_ver found but 3.11+ required"
      all_ok=false
    fi
  else
    warn "python3 not found — install Python 3.11+ from https://python.org"
    all_ok=false
  fi

  # node (need 20+)
  if command -v node &>/dev/null; then
    local node_ver
    node_ver=$(node --version | tr -d 'v')
    local node_major
    node_major=$(echo "$node_ver" | cut -d. -f1)
    if [[ "$node_major" -ge 20 ]]; then
      success "node v$node_ver"
    else
      warn "node v$node_ver found but v20+ required"
      all_ok=false
    fi
  else
    warn "node not found — install Node.js 20+ from https://nodejs.org"
    all_ok=false
  fi

  # npm
  if command -v npm &>/dev/null; then
    success "npm $(npm --version)"
  else
    warn "npm not found — install Node.js which includes npm"
    all_ok=false
  fi

  # curl
  if command -v curl &>/dev/null; then
    success "curl $(curl --version | head -1 | awk '{print $2}')"
  else
    warn "curl not found — install it via your package manager"
    all_ok=false
  fi

  # ollama (just check installed, not running)
  if command -v ollama &>/dev/null; then
    success "ollama $(ollama --version 2>/dev/null | awk '{print $NF}' || echo 'installed')"
  else
    info "ollama not installed (will offer to install below)"
  fi

  if [[ "$all_ok" == false ]]; then
    warn "Some requirements are missing. Setup may fail."
    echo -n "Continue anyway? [y/N] "
    read -r reply
    [[ "$reply" =~ ^[Yy]$ ]] || error "Aborted."
  fi
}

# ── Step 2: Repo setup ───────────────────────────────────────
setup_repo() {
  step "Setting up repository"

  # Detect if we're already inside the repo
  if [[ -d "apps" && -f "package.json" ]]; then
    REPO_ROOT="$(pwd)"
    success "Already inside repo at $REPO_ROOT"
    return
  fi

  echo -n "Clone repo to current directory ($(pwd))? [Y/n] "
  read -r reply
  if [[ -z "$reply" || "$reply" =~ ^[Yy]$ ]]; then
    git clone "$REPO_URL" jarvis-command-center
    REPO_ROOT="$(pwd)/jarvis-command-center"
    cd "$REPO_ROOT"
    success "Cloned to $REPO_ROOT"
  else
    error "No repo found and clone declined. Run this script from inside the repo."
  fi
}

# ── Step 3: .env ─────────────────────────────────────────────
setup_env() {
  step "Environment configuration"

  local env_file="${REPO_ROOT:-.}/.env"
  local example_file="${REPO_ROOT:-.}/.env.example"

  if [[ -f "$env_file" ]]; then
    info ".env already exists — skipping"
  elif [[ -f "$example_file" ]]; then
    cp "$example_file" "$env_file"
    success "Created .env from .env.example"
    info "Edit .env to customise settings before starting."
  else
    warn ".env.example not found — skipping .env creation"
  fi
}

# ── Step 4: Python venv ──────────────────────────────────────
setup_python() {
  step "Setting up Python environment"

  local api_dir="${REPO_ROOT:-.}/apps/api"
  [[ -d "$api_dir" ]] || error "apps/api directory not found at $api_dir"

  cd "$api_dir"

  if [[ ! -d ".venv" ]]; then
    info "Creating virtual environment..."
    python3 -m venv .venv
    success "Created .venv"
  else
    info ".venv already exists — skipping creation"
  fi

  # shellcheck disable=SC1091
  source .venv/bin/activate
  info "Installing Python dependencies..."
  pip install -r requirements.txt --quiet
  success "Python dependencies installed"

  deactivate 2>/dev/null || true
  cd "${REPO_ROOT:-.}"
}

# ── Step 5: Node.js deps ─────────────────────────────────────
setup_node() {
  step "Setting up Node.js dependencies"

  local web_dir="${REPO_ROOT:-.}/apps/web"
  [[ -d "$web_dir" ]] || error "apps/web directory not found at $web_dir"

  cd "$web_dir"
  info "Installing Node.js dependencies (this may take a minute)..."
  npm install --silent
  success "Node.js dependencies installed"

  cd "${REPO_ROOT:-.}"
}

# ── Step 6: Ollama ───────────────────────────────────────────
setup_ollama() {
  step "Setting up Ollama"

  if ! command -v ollama &>/dev/null; then
    if [[ "$(uname)" == "Darwin" ]]; then
      warn "Ollama not found."
      info "Install Ollama for macOS: https://ollama.ai/download"
      info "Download the .dmg, install it, then re-run this script."
      error "Please install Ollama and retry."
    else
      # Linux
      warn "Ollama not found."
      echo -n "Install Ollama via the official installer? [Y/n] "
      read -r reply
      if [[ -z "$reply" || "$reply" =~ ^[Yy]$ ]]; then
        info "Running: curl -fsSL https://ollama.ai/install.sh | sh"
        curl -fsSL https://ollama.ai/install.sh | sh
        success "Ollama installed"
      else
        info "Skipping Ollama install."
        info "Install manually: https://ollama.ai/download"
        return
      fi
    fi
  else
    success "Ollama is already installed"
  fi

  # Check if Ollama is running
  if curl -sf http://localhost:11434/api/tags &>/dev/null; then
    success "Ollama is running"
  else
    info "Starting Ollama server..."
    ollama serve &>/dev/null &
    sleep 3
    if curl -sf http://localhost:11434/api/tags &>/dev/null; then
      success "Ollama server started"
    else
      warn "Ollama server may not be ready yet — proceeding anyway"
    fi
  fi
}

# ── Step 7: Pull model ───────────────────────────────────────
pull_model() {
  step "AI model selection"

  echo ""
  echo -e "  Available models:"
  echo -e "  ${BOLD}1)${NC} llama3.1     — 4.7 GB, best quality (needs 8 GB RAM)"
  echo -e "  ${BOLD}2)${NC} mistral      — 4.1 GB, good balance"
  echo -e "  ${BOLD}3)${NC} phi3         — 2.3 GB, fast (4 GB RAM ok)"
  echo -e "  ${BOLD}4)${NC} qwen2.5:3b   — 1.9 GB, lightest"
  echo -e "  ${BOLD}5)${NC} Custom (enter model name)"
  echo ""
  echo -n "  Select model [default: $MODEL]: "
  read -r selection

  case "$selection" in
    1) MODEL="llama3.1" ;;
    2) MODEL="mistral" ;;
    3) MODEL="phi3" ;;
    4) MODEL="qwen2.5:3b" ;;
    5)
      echo -n "  Enter model name: "
      read -r custom_model
      [[ -n "$custom_model" ]] && MODEL="$custom_model"
      ;;
    "")
      info "Using default: $MODEL"
      ;;
    *)
      warn "Invalid selection — using default: $MODEL"
      ;;
  esac

  info "Pulling model: $MODEL (this may take several minutes on first run)..."
  if ollama pull "$MODEL"; then
    success "Model '$MODEL' is ready"
  else
    warn "Failed to pull model '$MODEL'. You can pull it later with: ollama pull $MODEL"
  fi

  # Update .env with selected model
  local env_file="${REPO_ROOT:-.}/.env"
  if [[ -f "$env_file" ]]; then
    if grep -q "^OLLAMA_MODEL=" "$env_file"; then
      sed -i.bak "s|^OLLAMA_MODEL=.*|OLLAMA_MODEL=$MODEL|" "$env_file" && rm -f "${env_file}.bak"
    else
      echo "OLLAMA_MODEL=$MODEL" >> "$env_file"
    fi
    info "Updated OLLAMA_MODEL=$MODEL in .env"
  fi
}

# ── Wait helpers ─────────────────────────────────────────────
wait_for_url() {
  local url="$1" timeout="$2" label="$3"
  local elapsed=0
  while [[ $elapsed -lt $timeout ]]; do
    if curl -sf "$url" &>/dev/null; then
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
    printf "."
  done
  echo ""
  return 1
}

# ── Step 9: Start services ────────────────────────────────────
start_services() {
  step "Starting services"

  echo ""
  echo -e "  ${BOLD}To start Jarvis manually:${NC}"
  echo ""
  echo -e "  ${CYAN}Terminal 1 (API):${NC}"
  echo "    cd apps/api"
  echo "    source .venv/bin/activate"
  echo "    uvicorn app.main:app --reload --port $API_PORT"
  echo ""
  echo -e "  ${CYAN}Terminal 2 (Frontend):${NC}"
  echo "    cd apps/web"
  echo "    npm run dev"
  echo ""

  echo -n "Start both services now in the background? [Y/n] "
  read -r reply
  if [[ -n "$reply" && ! "$reply" =~ ^[Yy]$ ]]; then
    info "Skipping service start. Run the commands above to start manually."
    return
  fi

  local api_dir="${REPO_ROOT:-.}/apps/api"
  local web_dir="${REPO_ROOT:-.}/apps/web"

  info "Starting API server..."
  (cd "$api_dir" && source .venv/bin/activate && uvicorn app.main:app --port "$API_PORT" > /tmp/jarvis-api.log 2>&1) &
  API_PID=$!

  info "Starting frontend..."
  (cd "$web_dir" && npm run dev > /tmp/jarvis-web.log 2>&1) &
  WEB_PID=$!

  echo -n "  Waiting for API"
  if wait_for_url "http://localhost:${API_PORT}/health" 30 "API"; then
    echo ""
    success "API is up at http://localhost:$API_PORT"
  else
    warn "API did not respond within 30s — check /tmp/jarvis-api.log"
  fi

  echo -n "  Waiting for frontend"
  if wait_for_url "http://localhost:${WEB_PORT}" 45 "frontend"; then
    echo ""
    success "Frontend is up at http://localhost:$WEB_PORT"
  else
    warn "Frontend did not respond within 45s — check /tmp/jarvis-web.log"
  fi

  if [[ "$OPEN_BROWSER" == true ]]; then
    if [[ "$(uname)" == "Darwin" ]]; then
      open "http://localhost:$WEB_PORT" 2>/dev/null || true
    else
      xdg-open "http://localhost:$WEB_PORT" 2>/dev/null || true
    fi
  fi

  echo ""
  success "Jarvis is running!"
  echo -e "  ${CYAN}API:${NC}     http://localhost:$API_PORT"
  echo -e "  ${CYAN}UI:${NC}      http://localhost:$WEB_PORT"
  echo -e "  ${CYAN}API docs:${NC} http://localhost:$API_PORT/docs"
  echo ""
  info "Logs: /tmp/jarvis-api.log and /tmp/jarvis-web.log"
  info "To stop: kill $API_PID $WEB_PID"
}

# ── Main ─────────────────────────────────────────────────────
main() {
  echo -e "${BOLD}${BLUE}"
  echo "  ╔══════════════════════════════════════╗"
  echo "  ║   ⚡ Jarvis Command Center Setup     ║"
  echo "  ║      Project IronMan                 ║"
  echo "  ╚══════════════════════════════════════╝"
  echo -e "${NC}"

  parse_args "$@"

  check_requirements
  setup_repo
  setup_env
  setup_python
  setup_node
  setup_ollama
  pull_model
  start_services

  echo ""
  success "Setup complete! Open http://localhost:$WEB_PORT to get started."
}

main "$@"
