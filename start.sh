#!/usr/bin/env bash
# Jarvis Command Center — local desktop launcher
# Run this from anywhere inside the cloned repo. It will:
#   1. Pull latest changes from the current branch
#   2. Ensure/create .env
#   3. Sync Python and Node.js dependencies if lockfiles changed
#   4. Ensure PostgreSQL is running and the database exists
#   5. Run Alembic migrations against the DATABASE_URL from .env
#   6. Ensure Ollama is running
#   7. Launch the API and the web frontend
#   8. Open the UI in your browser

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
WEB_PORT="${WEB_PORT:-3005}"
DEFAULT_MODEL="llama3.1"
OPEN_BROWSER=true
API_PID=""
WEB_PID=""
PID_FILE="/tmp/jarvis-launcher.pid"

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
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"

while [[ "$REPO_ROOT" != "/" && ! -d "$REPO_ROOT/apps" ]]; do
  REPO_ROOT="$(dirname "$REPO_ROOT")"
done

[[ -d "$REPO_ROOT/apps" ]] || fatal "Could not locate repo root. No apps/ directory found."

success "Repo root: $REPO_ROOT"

# ── Derived paths ────────────────────────────────────────────
API_DIR="$REPO_ROOT/apps/api"
WEB_DIR="$REPO_ROOT/apps/web"
VENV="$API_DIR/.venv"
ENV_FILE="$REPO_ROOT/.env"
EXAMPLE_FILE="$REPO_ROOT/.env.example"

# ── Parse flags ──────────────────────────────────────────────
parse_args() {
  for arg in "$@"; do
    case "$arg" in
      --no-browser)
        OPEN_BROWSER=false
        ;;
      --help|-h)
        echo -e "${BOLD}Usage:${NC} $0 [--no-browser] [--help]"
        echo "  --no-browser   Skip opening the browser after startup"
        exit 0
        ;;
      *)
        warn "Unknown flag: $arg — ignoring"
        ;;
    esac
  done
}

# ── Helpers ──────────────────────────────────────────────────
load_env() {
  if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
  fi
}

get_db_name_from_database_url() {
  local url="${DATABASE_URL:-}"

  if [[ -z "$url" ]]; then
    echo ""
    return
  fi

  # Remove query string if present.
  url="${url%%\?*}"

  # Return the last path segment.
  basename "$url"
}

is_postgres_url() {
  [[ "${DATABASE_URL:-}" == postgresql://* || "${DATABASE_URL:-}" == postgres://* ]]
}

# ── Step: Already running? ───────────────────────────────────
check_already_running() {
  if curl -sf "http://127.0.0.1:${API_PORT}/health" &>/dev/null; then
    echo ""
    echo -e "${BOLD}${GREEN}  Jarvis is already running!${NC}"
    echo -e "  ${CYAN}UI:${NC}  http://localhost:${WEB_PORT}"
    echo -e "  ${CYAN}API:${NC} http://localhost:${API_PORT}"
    echo ""

    if [[ "$OPEN_BROWSER" == true && "$(uname)" == "Darwin" ]]; then
      open "http://localhost:${WEB_PORT}" 2>/dev/null || true
    fi

    printf "  Restart Jarvis? [y/N] "
    read -r _restart_choice

    if [[ "${_restart_choice:-n}" =~ ^[Yy]$ ]]; then
      info "Stopping existing instance..."
      if [[ -f "$PID_FILE" ]]; then
        _old_pid="$(cat "$PID_FILE")"
        kill "$_old_pid" 2>/dev/null || true
        sleep 2
      else
        # Fall back to killing by port if PID file is missing
        lsof -ti ":${API_PORT}" 2>/dev/null | xargs kill -9 2>/dev/null || true
        lsof -ti ":${WEB_PORT}" 2>/dev/null | xargs kill -9 2>/dev/null || true
        sleep 1
      fi
      success "Existing instance stopped. Restarting..."
    else
      exit 0
    fi
  fi
}

# ── Step: Environment file ───────────────────────────────────
setup_env() {
  step "Environment file"

  if [[ -f "$ENV_FILE" ]]; then
    success ".env already exists"
  elif [[ -f "$EXAMPLE_FILE" ]]; then
    cp "$EXAMPLE_FILE" "$ENV_FILE"
    success "Created .env from .env.example"
    info "Edit $ENV_FILE to customise settings if needed."
  else
    warn "No .env or .env.example found. Creating a default Postgres .env."
    cat > "$ENV_FILE" <<'EOF'
DATABASE_URL=postgresql://localhost/ironman_jarvis
EOF
    success "Created default .env"
  fi

  load_env

  if [[ -n "${DATABASE_URL:-}" ]]; then
    success "DATABASE_URL loaded: $DATABASE_URL"
  else
    fatal "DATABASE_URL is not set. Add it to $ENV_FILE, for example: DATABASE_URL=postgresql://localhost/ironman_jarvis"
  fi
}

# ── Step: Pull latest ────────────────────────────────────────
setup_repo() {
  step "Pulling latest changes"

  cd "$REPO_ROOT"

  if ! command -v git &>/dev/null; then
    warn "git not found — skipping pull."
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
          LOCAL="$(git rev-parse HEAD)"
          REMOTE="$(git rev-parse "origin/$CURRENT_BRANCH" 2>/dev/null || echo "$LOCAL")"

          if [[ "$LOCAL" == "$REMOTE" ]]; then
            success "Already up to date."
          else
            info "New commits detected — merging..."

            if git merge --ff-only "origin/$CURRENT_BRANCH" --quiet; then
              success "Updated to $(git rev-parse --short HEAD)."
            else
              warn "Fast-forward not possible. Skipping auto-merge."
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
}

# ── Step: Prereq checks ──────────────────────────────────────
check_requirements() {
  step "Checking prerequisites"

  check_cmd() {
    local cmd="$1"
    local label="$2"
    local hint="$3"
    local required="${4:-true}"

    if command -v "$cmd" &>/dev/null; then
      success "$label: $($cmd --version 2>&1 | head -1)"
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

  check_cmd python3 "python3" "Install Python 3.11+ from https://python.org"
  check_cmd node "node" "Install Node.js 20+ from https://nodejs.org"
  check_cmd npm "npm" "Install Node.js. npm is bundled with Node.js."

  PY_MAJOR="$(python3 -c 'import sys; print(sys.version_info.major)')"
  PY_MINOR="$(python3 -c 'import sys; print(sys.version_info.minor)')"

  if [[ "$PY_MAJOR" -lt 3 || "$PY_MINOR" -lt 11 ]]; then
    fatal "Python 3.11+ required. Found $(python3 --version)."
  fi

  NODE_MAJOR="$(node --version | tr -d 'v' | cut -d. -f1)"

  if [[ "$NODE_MAJOR" -lt 18 ]]; then
    fatal "Node.js 18+ required. Found $(node --version)."
  fi
}

# ── Step: Python environment ─────────────────────────────────
setup_python() {
  step "Python environment"

  [[ -d "$API_DIR" ]] || fatal "apps/api not found at $API_DIR"

  cd "$API_DIR"

  if [[ ! -d "$VENV" ]]; then
    info "Creating virtual environment..."
    python3 -m venv "$VENV"
    success "Created .venv"
  fi

  # shellcheck disable=SC1091
  source "$VENV/bin/activate"

  REQ="$API_DIR/requirements.txt"
  STAMP="$VENV/.req-installed"

  if [[ ! -f "$REQ" ]]; then
    warn "No requirements.txt found at $REQ — skipping pip install."
  else
    if [[ ! -f "$STAMP" || "$REQ" -nt "$STAMP" ]]; then
      info "Installing/updating Python dependencies..."
      python -m pip install --upgrade pip setuptools wheel --quiet
      pip install -r "$REQ" --quiet
      touch "$STAMP"
      success "Python dependencies up to date"
    else
      success "Python dependencies already installed"
    fi
  fi

  deactivate 2>/dev/null || true
  cd "$REPO_ROOT"
}

# ── Step: Node.js dependencies ───────────────────────────────
setup_node() {
  step "Node.js dependencies"

  [[ -d "$WEB_DIR" ]] || fatal "apps/web not found at $WEB_DIR"

  cd "$WEB_DIR"

  LOCK="$WEB_DIR/package-lock.json"
  NM_STAMP="$WEB_DIR/node_modules/.install-stamp"

  needs_npm_install() {
    [[ ! -d "$WEB_DIR/node_modules" ]] && return 0
    [[ ! -f "$NM_STAMP" ]] && return 0
    [[ -f "$LOCK" && "$LOCK" -nt "$NM_STAMP" ]] && return 0
    return 1
  }

  if needs_npm_install; then
    info "Installing/updating Node.js dependencies..."
    npm install --legacy-peer-deps --silent
    mkdir -p "$WEB_DIR/node_modules"
    touch "$NM_STAMP"
    success "Node.js dependencies up to date"
  else
    success "Node.js dependencies already installed"
  fi

  cd "$REPO_ROOT"
}

# ── Step: PostgreSQL ─────────────────────────────────────────
setup_postgres() {
  step "PostgreSQL database"

  load_env

  if ! is_postgres_url; then
    warn "DATABASE_URL is not PostgreSQL: ${DATABASE_URL:-unset}"
    warn "Skipping PostgreSQL setup because the app is configured for another database."
    return
  fi

  if ! command -v psql &>/dev/null; then
    for candidate in /opt/homebrew/bin/psql /usr/local/bin/psql /opt/homebrew/opt/postgresql@16/bin/psql /usr/local/opt/postgresql@16/bin/psql; do
      if [[ -x "$candidate" ]]; then
        export PATH="$(dirname "$candidate"):$PATH"
        break
      fi
    done
  fi

  if ! command -v psql &>/dev/null; then
    fatal "PostgreSQL not found. Install it with: brew install postgresql@16"
  fi

  success "psql $(psql --version | awk '{print $3}')"

  if pg_isready -q 2>/dev/null; then
    success "PostgreSQL is already running"
  else
    info "Starting PostgreSQL via Homebrew services..."

    if command -v brew &>/dev/null; then
      if brew services start postgresql@16 2>/dev/null; then
        success "Started postgresql@16"
      elif brew services start postgresql 2>/dev/null; then
        success "Started postgresql"
      else
        warn "Could not start PostgreSQL via brew services."
        warn "Try manually: brew services start postgresql@16"
      fi
    else
      warn "Homebrew not found. Start PostgreSQL manually."
    fi

    for i in $(seq 1 8); do
      sleep 1
      if pg_isready -q 2>/dev/null; then
        success "PostgreSQL is ready"
        break
      fi

      if [[ "$i" -eq 8 ]]; then
        fatal "PostgreSQL is not ready. Start it manually and rerun this script."
      fi
    done
  fi

  local db_name
  db_name="$(get_db_name_from_database_url)"

  if [[ -z "$db_name" ]]; then
    fatal "Could not parse database name from DATABASE_URL=$DATABASE_URL"
  fi

  if psql -lqt 2>/dev/null | cut -d '|' -f1 | tr -d ' ' | grep -qx "$db_name"; then
    success "Database '$db_name' exists"
  else
    info "Creating database '$db_name'..."

    if createdb "$db_name" 2>/dev/null; then
      success "Database '$db_name' created"
    else
      fatal "Could not create database '$db_name'. Try manually: createdb $db_name"
    fi
  fi
}

# ── Step: DB Migrations ──────────────────────────────────────
run_migrations() {
  step "Database migrations"

  local api_dir="$API_DIR"
  local venv="$VENV"

  if [[ ! -f "$api_dir/alembic.ini" ]]; then
    info "No alembic.ini found — startup will use SQLAlchemy create_all if configured."
    return
  fi

  if [[ ! -d "$venv" ]]; then
    fatal "Virtual environment not found at $venv"
  fi

  # shellcheck disable=SC1091
  source "$venv/bin/activate"

  # Critical fix: load root .env before Alembic.
  load_env

  if [[ -z "${DATABASE_URL:-}" ]]; then
    deactivate 2>/dev/null || true
    fatal "DATABASE_URL is not set before migrations. Check $ENV_FILE"
  fi

  info "Alembic DATABASE_URL: $DATABASE_URL"

  cd "$api_dir"

  info "Running: alembic upgrade head"

  if alembic upgrade head 2>&1; then
    success "Migrations applied"
  else
    deactivate 2>/dev/null || true
    cd "$REPO_ROOT"
    fatal "Migration failed. Fix the migration error above before starting the app."
  fi

  deactivate 2>/dev/null || true
  cd "$REPO_ROOT"
}

# ── Step: Ollama ─────────────────────────────────────────────
setup_ollama() {
  step "Ollama AI engine"

  cd "$REPO_ROOT"

  OLLAMA_MODEL="${OLLAMA_MODEL:-$DEFAULT_MODEL}"

  if ! command -v ollama &>/dev/null; then
    warn "Ollama is not installed. AI features will be unavailable."

    if [[ "$(uname)" == "Darwin" ]]; then
      info "Install Ollama from https://ollama.ai/download"
    else
      info "Install Ollama with: curl -fsSL https://ollama.ai/install.sh | sh"
    fi

    return
  fi

  if curl -sf http://localhost:11434/api/tags &>/dev/null; then
    success "Ollama already running"
  else
    info "Starting Ollama server..."
    nohup ollama serve > /tmp/jarvis-ollama.log 2>&1 &

    OLLAMA_PID=$!

    for i in $(seq 1 8); do
      sleep 1

      if curl -sf http://localhost:11434/api/tags &>/dev/null; then
        success "Ollama server started, pid $OLLAMA_PID"
        break
      fi

      if [[ "$i" -eq 8 ]]; then
        warn "Ollama did not become ready. Check /tmp/jarvis-ollama.log"
      fi
    done
  fi
}

# ── Step: Pull model ─────────────────────────────────────────
pull_model() {
  step "Ollama model"

  OLLAMA_MODEL="${OLLAMA_MODEL:-$DEFAULT_MODEL}"

  if command -v ollama &>/dev/null && curl -sf http://localhost:11434/api/tags &>/dev/null; then
    if ! ollama list 2>/dev/null | grep -q "^${OLLAMA_MODEL}"; then
      info "Model '${OLLAMA_MODEL}' not found locally. Pulling..."
      if ollama pull "$OLLAMA_MODEL"; then
        success "Model '${OLLAMA_MODEL}' ready"
      else
        warn "Could not pull '${OLLAMA_MODEL}'. Pull it manually: ollama pull ${OLLAMA_MODEL}"
      fi
    else
      success "Model '${OLLAMA_MODEL}' available"
    fi
  else
    warn "Skipping model check because Ollama is not running."
  fi
}

# ── Cleanup trap ─────────────────────────────────────────────
cleanup() {
  echo ""
  info "Shutting down Jarvis..."

  # Step 1: ask the API to flush in-flight AgentRun records to the DB
  # before we kill the process so no work is lost.
  if [[ -n "${API_PID:-}" ]] && kill -0 "${API_PID}" 2>/dev/null; then
    info "Persisting in-flight work to database..."
    if curl -sf -X POST "http://127.0.0.1:${API_PORT}/system/persist" \
        -H "Content-Type: application/json" --max-time 5 &>/dev/null; then
      success "Database flushed — all work saved"
    else
      warn "Could not reach API for graceful persist (data committed per-request is safe)"
    fi
    sleep 0.3
  fi

  # Step 2: stop API
  if [[ -n "${API_PID:-}" ]]; then
    kill "${API_PID}" 2>/dev/null || true
    wait "${API_PID}" 2>/dev/null || true
    info "API stopped (pid ${API_PID})"
  fi

  # Step 3: stop frontend
  if [[ -n "${WEB_PID:-}" ]]; then
    kill "${WEB_PID}" 2>/dev/null || true
    wait "${WEB_PID}" 2>/dev/null || true
    info "Frontend stopped (pid ${WEB_PID})"
  fi

  # Step 4: clean up PID file
  rm -f "$PID_FILE" 2>/dev/null || true

  echo ""
  success "Jarvis stopped. All work persisted. Goodbye."
}

# ── Wait helper ──────────────────────────────────────────────
wait_for_url() {
  local url="$1"
  local timeout_s="$2"
  local label="$3"
  local i=0

  printf "  Waiting for %-12s" "$label"

  while [[ "$i" -lt "$timeout_s" ]]; do
    if curl -sf "$url" &>/dev/null; then
      echo " ready"
      return 0
    fi

    sleep 1
    i=$((i + 1))
    printf "."
  done

  echo " timeout"
  return 1
}

# ── Step: Start services ─────────────────────────────────────
start_services() {
  step "Starting services"

  trap cleanup EXIT INT TERM

  load_env

  # API
  info "Starting API on port $API_PORT..."

  (
    source "$VENV/bin/activate"
    load_env
    cd "$API_DIR"
    exec uvicorn app.main:app --port "$API_PORT" --host 127.0.0.1 >> /tmp/jarvis-api.log 2>&1
  ) &

  API_PID=$!

  # Frontend
  info "Starting frontend on port $WEB_PORT..."

  (
    cd "$WEB_DIR"
    export NEXT_PUBLIC_API_URL="http://127.0.0.1:${API_PORT}"
    exec npm run dev -- --port "$WEB_PORT" >> /tmp/jarvis-web.log 2>&1
  ) &

  WEB_PID=$!

  # Write the launcher's PID so the cleanup trap and the already-running
  # check can reliably stop this exact process.
  echo "$$" > "$PID_FILE"

  if ! wait_for_url "http://127.0.0.1:${API_PORT}/health" 30 "API"; then
    warn "API did not start in 30 seconds. Last lines of /tmp/jarvis-api.log:"
    tail -30 /tmp/jarvis-api.log 2>/dev/null || true
  fi

  if ! wait_for_url "http://127.0.0.1:${WEB_PORT}" 60 "Frontend"; then
    warn "Frontend did not start in 60 seconds. Last lines of /tmp/jarvis-web.log:"
    tail -30 /tmp/jarvis-web.log 2>/dev/null || true
  fi

  echo ""
  echo -e "${BOLD}${GREEN}  Jarvis is running!${NC}"
  echo -e "  ${CYAN}UI:${NC}       http://localhost:${WEB_PORT}"
  echo -e "  ${CYAN}API:${NC}      http://localhost:${API_PORT}"
  echo -e "  ${CYAN}API docs:${NC} http://localhost:${API_PORT}/docs"
  echo -e "  ${CYAN}Logs:${NC}     /tmp/jarvis-api.log | /tmp/jarvis-web.log"
  echo ""
  info "Press Ctrl+C to stop all services."

  # macOS system notification — fires once Jarvis is fully ready.
  if [[ "$(uname)" == "Darwin" ]] && command -v osascript &>/dev/null; then
    osascript -e "display notification \"Jarvis is ready — http://localhost:${WEB_PORT}\" with title \"Jarvis Command Center\" sound name \"Glass\"" 2>/dev/null || true
  fi

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

  wait "$API_PID" "$WEB_PID" 2>/dev/null || true
}

# ── Main ─────────────────────────────────────────────────────
main() {
  parse_args "$@"
  check_already_running

  check_requirements
  setup_repo

  # Critical order:
  # .env must exist and be loaded before Postgres setup and Alembic migrations.
  setup_env

  setup_python
  setup_node
  setup_postgres
  run_migrations
  setup_ollama
  pull_model
  start_services
}

main "$@"
