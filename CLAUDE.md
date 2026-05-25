# Project Iron Man — Jarvis Command Center

Local-first AI productivity cockpit. FastAPI backend + Next.js 14 frontend + PostgreSQL + Ollama + Tauri desktop app.

## Stack

- **Backend**: Python 3.11+, FastAPI, SQLAlchemy, PostgreSQL (Homebrew), Alembic migrations, Ollama HTTP client
- **Frontend**: Next.js 14 App Router, TypeScript, Tailwind CSS, Zustand
- **Desktop**: Tauri v2 — system tray, hide-to-tray, macOS auto-start (LaunchAgent)
- **AI**: Ollama (local, default model `llama3.1` — 16 GB RAM), configurable via `OLLAMA_MODEL` env var
- **Integrations**: Google Calendar + Gmail via OAuth2 (read-only), iRobot Roomba (optional)

## Key Paths

```
apps/api/app/
  main.py                  FastAPI entry — CORS locked to localhost:3000, router + agent registration
  core/config.py           Pydantic Settings (env vars)
  db/models.py             ORM models: Task, Agent, AgentRun, Command, DailyBriefing, Integration, AppSettings
  db/database.py           SQLAlchemy engine (conditional connect_args for SQLite vs PostgreSQL)
  routes/
    tasks.py               CRUD + /overdue/count + /stats/today
    ai.py                  /classify-task, /recommend-next-action, /suggestions (Ollama + rule-based fallback)
    integrations.py        /calendar/events, /gmail/inbox, /google/auth+callback, sync, disconnect
    presentations.py       /download — streams .pptx from base64
    voice.py               GET/PATCH voice settings persisted to AppSettings DB
    settings.py            App settings (display_name default: "Sumit")
    agents.py, briefings.py, commands.py
  services/
    ollama_client.py       Async Ollama HTTP wrapper (single class, settings-based)
    command_router.py      NL → intent JSON classifier
  agents/
    base.py                BaseAgent ABC — always call execute(), never run() directly
    registry.py            AgentRegistry singleton
    presentation.py        Generates outline + pptx_base64 via python-pptx
    *.py                   Other agent implementations
  prompts/                 LLM prompt templates (.md files)
  seed.py                  Demo data seeder (15 tasks)

apps/web/
  app/                     Next.js App Router pages
  components/dashboard/    All widgets wired to live API data (zero mock data)
    AISuggestions.tsx      /ai/suggestions → Ollama or rule-based fallback
    TodaySchedule.tsx      /integrations/calendar/events → today's meetings
    UpcomingAgenda.tsx     /integrations/calendar/events → upcoming week
    InboxCaptures.tsx      /integrations/gmail/inbox → email tasks
    DailyProgress.tsx      /tasks/stats/today → real stats
    TodayPriorities.tsx    Live today/in_progress tasks
    FollowUps.tsx          Live waiting tasks
  components/layout/Sidebar.tsx
  components/command/CommandBar.tsx
  stores/useStore.ts       Zustand state — displayName, overdueCount, taskStats, calendarEvents, inboxData, aiSuggestions
  lib/api.ts               Typed fetch wrapper for all backend endpoints
  app/page.tsx             Dynamic displayName, overdue bell badge

apps/desktop/
  src-tauri/src/lib.rs     System tray (Show/Hide/Start on Login/Quit), hide-to-tray on close
  src-tauri/Cargo.toml     tauri v2 + tauri-plugin-autostart
  src-tauri/tauri.conf.json
  src-tauri/capabilities/main.json

start.sh                   One-shot startup: git pull, PostgreSQL setup, Alembic migrations, API + frontend
.env.example               All required env vars documented
```

## Commands

```bash
# One-shot start (Mac)
chmod +x start.sh && ./start.sh

# Backend (manual)
cd apps/api && source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
python -m app.seed          # seed 15 demo tasks

# Frontend (manual)
cd apps/web && npm run dev   # http://localhost:3000

# Desktop (Tauri)
cd apps/desktop && npm run tauri dev

# Migrations
cd apps/api && alembic upgrade head

# Agent stub generator
python skills/ironman-command-center-builder/scripts/generate_agent_stub.py <name> <type> <risk>
```

## Environment Variables

```
# Required
DATABASE_URL=postgresql://ironman:ironman@localhost:5432/ironman
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.1

# Google OAuth (create at console.cloud.google.com)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:8000/integrations/google/callback

# Optional
ANTHROPIC_API_KEY=       # for services/claude-agent only
DEBUG=false
```

## Invariants — never violate

1. **Local-first**: No data leaves device without explicit opt-in. No cloud AI by default.
2. **Human approval gate**: Email sends, file deletes, calendar writes, contacting people always require `requires_confirmation: true`.
3. **Call `execute()` not `run()`**: `execute()` handles AgentRun lifecycle logging. `run()` is internal only.
4. **Route order matters**: In `routes/agents.py`, `/runs/all` must be declared BEFORE `/{agent_id}`. In `routes/tasks.py`, `/overdue/count` and `/stats/today` must be BEFORE `/{task_id}`.
5. **Structured agent output**: `run()` always returns a dict. Never return free-form text.
6. **Log every agent run**: All runs stored in `agent_runs` table.
7. **Risk levels**: `low` = no confirmation, `medium` = recommended, `high` = always confirm.
8. **No mock data**: All dashboard components read from live API. Never re-add hardcoded constants.
9. **CORS locked**: Only `http://localhost:3000` and `http://127.0.0.1:3000` are allowed origins.
10. **Voice settings in DB**: Voice preferences are persisted to `AppSettings` with `voice_` prefix — no global vars.

## Data Models (SQLAlchemy)

- `Task`: 18 fields — `priority` (critical/high/medium/low), `status` (todo/in_progress/waiting/done/deferred), `source` (email/calendar/manual), `source_reference`, `category`, `agent_id`, `confidence_score`, `tags` (JSON text)
- `AgentRun`: FK to tasks.id, stores input_data/output_data as JSON text, status (running/completed/failed)
- `Command`: NL command history with routing result
- `DailyBriefing`: AI-generated morning brief
- `Integration`: integration_type, status (active/inactive), config (JSON — tokens), last_sync_at
- `AppSettings`: key-value store — `display_name`, `ollama_model`, `voice_*` settings

## Adding a New Agent

1. Create `apps/api/app/agents/{name}.py` extending `BaseAgent`
2. Set `id`, `name`, `agent_type`, `description`, `risk_level`, `requires_approval_for`
3. Implement `async run(self, input_data: dict, db: Session) -> dict`
4. Register in `apps/api/app/main.py` alongside existing agents

## Adding a New API Route

1. Create `apps/api/app/routes/{resource}.py` with `router = APIRouter(prefix="/{resource}", tags=[...])`
2. Add `app.include_router({resource}.router)` in `main.py`
3. Add typed interface + method to `apps/web/lib/api.ts`
4. Add state + action to `apps/web/stores/useStore.ts` if needed
5. Call the action in the component's `useEffect`

## Frontend Conventions

- All interactive components need `'use client'` directive
- Use `@/` path alias (configured in `apps/web/tsconfig.json`)
- Dark theme: CSS vars in `globals.css` — `--bg-base: #0d0f14`, `--bg-card: #131720`
- State lives in Zustand (`useStore`); load data with `useEffect` calling store actions
- API calls go through `apps/web/lib/api.ts` typed wrapper only
- When a Google integration is not connected, show a "Connect → /integrations" CTA — never show hardcoded placeholder data

## Do Not

- Do not call external APIs from agents without listing them in `tools_allowed`
- Do not skip the AgentRun lifecycle (always use `execute()`)
- Do not store secrets in SQLite/PostgreSQL — use env vars
- Do not put timestamps or random values in LLM system prompts (breaks prompt caching)
- Do not add cloud AI calls without explicit user config and a confirmation notice
- Do not hardcode mock/demo data in React components — use empty states or connect CTAs
- Do not use `sqlite:///` DATABASE_URL in production — PostgreSQL only
