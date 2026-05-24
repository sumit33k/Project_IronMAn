# Project Iron Man — Jarvis Command Center

Local-first AI productivity cockpit. FastAPI backend + Next.js 14 frontend + SQLite + Ollama.

## Stack

- **Backend**: Python 3.11+, FastAPI, SQLAlchemy, SQLite (`apps/api/ironman.db`), Ollama HTTP client
- **Frontend**: Next.js 14 App Router, TypeScript, Tailwind CSS, Zustand
- **AI**: Ollama (local, default model `llama3.1`), configurable via `OLLAMA_MODEL` env var

## Key Paths

```
apps/api/app/
  main.py              FastAPI app entry point, CORS, router + agent registration
  core/config.py       Pydantic Settings (env vars)
  db/models.py         All ORM models (Task, Agent, AgentRun, Command, DailyBriefing, Integration, AppSettings)
  db/database.py       SQLAlchemy engine, SessionLocal, Base
  routes/              One file per resource (tasks, agents, commands, briefings, ai, voice, settings)
  services/
    ollama_client.py   Async Ollama HTTP wrapper
    command_router.py  NL → intent JSON classifier
  agents/
    base.py            BaseAgent ABC — always call execute(), never run() directly
    registry.py        AgentRegistry singleton
    *.py               Individual agent implementations
  prompts/             LLM prompt templates (.md files)
  seed.py              Demo data seeder

apps/web/
  app/                 Next.js App Router pages
  components/layout/Sidebar.tsx
  components/command/CommandBar.tsx
  stores/useStore.ts   Zustand global state
  lib/api.ts           Typed fetch wrapper for all backend endpoints

skills/ironman-command-center-builder/
  SKILL.md             Full skill definition and invariants
  agents/claude.yaml   Claude-specific agent config
  scripts/             Code generators

services/claude-agent/ Python Claude API service with prompt caching
docs/                  Architecture, setup, agent design, security docs
```

## Commands

```bash
# Backend
cd apps/api && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
python -m app.seed          # seed 15 demo tasks

# Frontend
cd apps/web && npm install && npm run dev   # http://localhost:3000

# Claude agent service
cd services/claude-agent && pip install -r requirements.txt
python example_usage.py

# Agent stub generator
python skills/ironman-command-center-builder/scripts/generate_agent_stub.py <name> <type> <risk>
```

## Invariants — never violate

1. **Local-first**: No data leaves device without explicit opt-in. No cloud AI by default.
2. **Human approval gate**: Email sends, file deletes, calendar writes, contacting people always require `requires_confirmation: true`.
3. **Call `execute()` not `run()`**: `execute()` handles AgentRun lifecycle logging. `run()` is internal only.
4. **Route order matters**: In `routes/agents.py`, `/runs/all` must be declared BEFORE `/{agent_id}`.
5. **Structured agent output**: `run()` always returns a dict. Never return free-form text.
6. **Log every agent run**: All runs stored in `agent_runs` table.
7. **Risk levels**: `low` = no confirmation, `medium` = recommended, `high` = always confirm.

## Adding a New Agent

1. Create `apps/api/app/agents/{name}.py` extending `BaseAgent`
2. Set `id`, `name`, `agent_type`, `description`, `risk_level`, `requires_approval_for`
3. Implement `async run(self, input_data: dict, db: Session) -> dict`
4. Register in `apps/api/app/main.py` alongside existing agents

Or use the generator: `python skills/ironman-command-center-builder/scripts/generate_agent_stub.py`

## Adding a New API Route

1. Create `apps/api/app/routes/{resource}.py` with `router = APIRouter(prefix="/{resource}", tags=[...])`
2. Add `app.include_router({resource}.router)` in `main.py`
3. Add typed endpoint to `apps/web/lib/api.ts`
4. Add action to `apps/web/stores/useStore.ts` if state is needed

## Data Models (SQLAlchemy)

- `Task`: 18 fields including `priority` (critical/high/medium/low), `status` (todo/in_progress/waiting/done/deferred), `category`, `agent_id`, `confidence_score`, `tags` (JSON text)
- `AgentRun`: FK to tasks.id, stores input_data/output_data as JSON text, status (running/completed/failed)
- `Command`: NL command history with routing result
- `DailyBriefing`: AI-generated morning brief
- `AppSettings`: key-value store for model name, preferences

## Environment Variables

```
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.1
DATABASE_URL=sqlite:///./ironman.db    # or postgresql://...
ANTHROPIC_API_KEY=                     # for services/claude-agent
```

## Frontend Conventions

- All interactive components need `'use client'` directive
- Use `@/` path alias for imports (configured in `apps/web/tsconfig.json`)
- Dark theme: CSS vars in `globals.css` — `--bg-base: #0d0f14`, `--bg-card: #131720`
- State lives in Zustand (`useStore`); load data with `useEffect` calling store actions
- API calls go through `apps/web/lib/api.ts` typed wrapper only

## Do Not

- Do not call external APIs from agents without listing them in `tools_allowed`
- Do not skip the AgentRun lifecycle (always use `execute()`)
- Do not store secrets in SQLite — use env vars
- Do not put timestamps or random values in LLM system prompts (breaks prompt caching)
- Do not add cloud AI calls without explicit user config and a confirmation notice
