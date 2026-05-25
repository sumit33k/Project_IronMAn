# Project IronMAn — Local-First AI Personal Command Center

An open-source, local-first monorepo scaffold for a private AI command center to manage office work, personal tasks, reminders, routines, and delegated agent workflows.

## Stack

- **Frontend:** Next.js + React + Tailwind CSS (+ shadcn/ui-ready structure)
- **Backend:** FastAPI
- **Database:** PostgreSQL
- **Cache/Queue:** Redis
- **Local AI Runtime:** Ollama
- **Vector DB:** Qdrant
- **Automation:** n8n-ready integration path
- **Auth:** local dev auth placeholder (Keycloak-ready)
- **Containerization:** Docker Compose

## Monorepo Structure

- `apps/web` — Next.js web application + Daily Brief panel
- `apps/api` — FastAPI backend service + local Ollama integration
- `packages/shared` — shared TypeScript types
- `infra/docker-compose.yml` — local infra services
- `.github/workflows/ci.yml` — CI checks

## Prerequisites

- Node.js 20+
- npm 10+
- Python 3.11+
- Docker + Docker Compose

## 1) Start infrastructure services

```bash
cd infra
docker compose up -d
```

This starts:

- Postgres (`localhost:5432`)
- Redis (`localhost:6379`)
- Qdrant (`localhost:6333`)
- Ollama placeholder (`localhost:11434`)

## 2) Run the API (FastAPI)
# Project IronMAn — Jarvis Command Center

> **"Hey Jarvis, what should I focus on today?"**

A local-first, open-source AI productivity command center. Your personal Jarvis for managing office work, personal tasks, email follow-ups, meetings, presentations, and delegated agent workflows — all running privately on your machine.

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14 · React · TypeScript · Tailwind CSS |
| State | Zustand · TanStack Query |
| Backend | FastAPI · Python 3.11+ · SQLAlchemy |
| Database | SQLite (default) · PostgreSQL (optional) |
| Local AI | Ollama (llama3.1 default) |
| Agents | Custom modular agent framework |
| Voice | Browser SpeechRecognition (MVP) · openWakeWord (Phase 4) |

---

## Quick Start

### Prerequisites
- **Node.js 20+** and npm
- **Python 3.11+**
- **[Ollama](https://ollama.ai)** for local AI

### 1 — Start Ollama

```bash
ollama serve
ollama pull llama3.1      # 4.7 GB — recommended
# or lighter models:
# ollama pull phi3        # 2.3 GB
# ollama pull mistral     # 4.1 GB
```

### 2 — Run the API

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Optional AI env vars:

```bash
export OLLAMA_BASE_URL=http://localhost:11434
export OLLAMA_MODEL=llama3.1
export OLLAMA_TIMEOUT_SECONDS=30
```

Health endpoint:

```bash
curl http://localhost:8000/health
```

Daily brief endpoint:

```bash
curl -X POST http://localhost:8000/ai/daily-brief \
  -H 'Content-Type: application/json' \
  -d '{
    "todays_tasks": ["Draft Q2 roadmap", "Review pull requests"],
    "overdue_tasks": ["Submit expense report"],
    "upcoming_meetings": ["10:00 Product sync", "14:00 1:1 with manager"],
    "pending_follow_ups": ["Reply to vendor quote"]
  }'
```

If Ollama is unavailable, the API returns a graceful `503` error.

## 3) Run the Web app (Next.js)

```bash
cd apps/web
npm install
npm run dev
```

Open: `http://localhost:3000` and use the Daily Brief panel.

## 4) Shared package usage

`packages/shared` includes starter TypeScript types for tasks, routines, reminders, and delegated jobs.

## CI

GitHub Actions workflow (`.github/workflows/ci.yml`) runs:

- Web lint + build
- API syntax/import check

## Notes

- All AI processing is local through Ollama.
- Prompt template is versioned at `apps/api/app/prompts/daily_brief_v1.txt`.
- n8n, Keycloak, and deeper app modules can be added incrementally.


## Task Engine MVP

### API endpoints
- `POST /tasks` create task
- `GET /tasks` list all tasks
- `PATCH /tasks/{id}` edit task fields (including complete/defer via status)
- `DELETE /tasks/{id}` delete task
- `GET /tasks/today` today queue
- `GET /tasks/overdue` overdue tasks

### Task statuses
- `inbox`, `today`, `in_progress`, `waiting`, `deferred`, `scheduled`, `completed`, `archived`

### Task fields
- `id`, `title`, `description`, `category`, `priority`, `status`, `due_date`, `source`, `assigned_agent`, `created_at`, `updated_at`


Generate brief from real task data:

```bash
curl -X POST http://localhost:8000/ai/daily-brief/from-tasks \
  -H 'Content-Type: application/json' \
  -d '{
    "upcoming_meetings": ["10:00 Product sync"],
    "pending_follow_ups": ["Reply to vendor"]
  }'
```


## Gmail Integration
- Start OAuth URL: `GET /gmail/oauth/start`
- Connect token (dev): `POST /gmail/connect`
- Disconnect: `POST /gmail/disconnect`
- Read recent: `GET /gmail/recent`
- Extract actions via local Ollama: `POST /gmail/extract`
- Draft reply via local Ollama: `POST /gmail/draft-reply` (never sends)
- Convert action to task: `POST /tasks/from-email-action` (stores Gmail source link)

Security:
- Never auto-send email.
- Draft replies require approval before any external send path.
- Tokens are encrypted at rest with `TOKEN_ENCRYPTION_KEY`.
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Optional: seed demo data
python -m app.seed
```

Swagger UI: http://localhost:8000/docs  
Health check: `curl http://localhost:8000/health`

### 3 — Run the Frontend

```bash
cd apps/web
npm install
npm run dev
```

Open: **http://localhost:3000**

---

## Features

### ✅ Implemented (MVP — Phases 0–3)

| Feature | Description |
|---------|-------------|
| **Command Center Dashboard** | Priorities, schedule, agents, inbox, follow-ups, AI brief |
| **Today Queue** | Focused task list for the day with complete/defer actions |
| **Kanban Board** | 6-lane visual board (Inbox → Today → In Progress → Waiting → Deferred → Done) |
| **Command Bar** | ⌘K natural language commands, routed through Ollama |
| **Agent Hub** | 6 modular AI agents with run history and output viewer |
| **Daily Briefing** | AI-generated focus score, priorities, risks, schedule |
| **Voice Interface** | Browser push-to-talk with transcript and intent display |
| **Settings** | Ollama config, model selection, wake phrase, user preferences |
| **Local AI** | All inference via Ollama — no cloud calls |
| **Seed Data** | Demo tasks and integrations for quick start |

### 🔜 Planned

| Phase | Feature |
|-------|---------|
| **Phase 4** | "Hey Jarvis" wake word (openWakeWord), local STT (whisper.cpp), Piper TTS |
| **Phase 5** | Gmail, Google Calendar, local files, browser capture integrations |
| **Phase 6** | Routines, focus mode, end-of-day review, analytics, agent orchestration |

---

## Command Examples

```
Hey Jarvis, show me my top priorities today
Hey Jarvis, create a task: Review the Infoblox proposal
Hey Jarvis, defer this to Friday
Hey Jarvis, draft a reply to Raj about the contract
Hey Jarvis, delegate to presentation agent
Hey Jarvis, generate my daily briefing
Hey Jarvis, what should I focus on next?
Hey Jarvis, summarize my calendar
Hey Jarvis, mark this as waiting
```

---

## AI Agents

| Agent | Purpose | Risk |
|-------|---------|------|
| **Task Classifier** | Extract priority, due date, category, next action | Low |
| **Daily Briefing** | Morning command briefing with focus score | Low |
| **Follow-up Agent** | Surface stale/waiting tasks | Low |
| **Presentation Agent** | Create slide outlines and structures | Low |
| **Email Draft Agent** | Draft emails — never sends without approval | High |
| **Calendar Prep Agent** | Meeting prep checklists — never moves events | Medium |

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                 Jarvis Command Center                     │
├─────────────┬───────────────────────┬────────────────────┤
│  Next.js 14 │      FastAPI          │      Ollama        │
│  React/TS   │      SQLite           │   llama3.1         │
│  Tailwind   │   Agent Framework     │  (local, private)  │
│  Zustand    │   Command Router      │                    │
└─────────────┴───────────────────────┴────────────────────┘
       ↓                   ↓
  Command Bar          /commands/route
  Voice Input    →   Intent → Agent → Output
  Sidebar Nav         (logged to DB)
```

**Core product loop:**
```
Capture → Understand → Prioritize → Visualize → Act → Delegate → Review
```

---

## Project Structure

```
apps/
  web/              Next.js frontend
    app/            Pages (dashboard, today, board, agents, voice, settings)
    components/     UI components (layout, dashboard, command, voice)
    stores/         Zustand state management
    lib/api.ts      Typed API client
  api/              FastAPI backend
    app/
      main.py       FastAPI app + agent registration
      core/         Config (Ollama, DB settings)
      db/           SQLAlchemy models + database
      routes/       API route handlers
      schemas/      Pydantic schemas
      services/     Ollama client, command router
      agents/       Modular AI agents
      prompts/      LLM prompt files
      seed.py       Demo data seeder

docs/               Architecture, PRD, API contract, setup guide
skills/             Reusable implementation skill for AI assistants
  ironman-command-center-builder/
    SKILL.md        Skill definition
    references/     Architecture, agents, API, voice, UI, security docs
    scripts/        validate_schema.py, generate_agent_stub.py
```

---

## Development

```bash
# Validate backend schemas and agents
python skills/ironman-command-center-builder/scripts/validate_schema.py

# Generate a new agent stub
python skills/ironman-command-center-builder/scripts/generate_agent_stub.py research_agent research low

# Run API tests
cd apps/api && pytest

# Build frontend
cd apps/web && npm run build
```

---

## Privacy & Security

- **All data stored locally** in SQLite (`apps/api/ironman.db`)
- **All AI inference** runs through local Ollama — no external API calls
- **Irreversible actions** (email send, file delete, calendar changes) require explicit confirmation
- **Agent runs** are fully logged and auditable
- Cloud AI (OpenAI, Anthropic) can be added as optional providers in a future phase

---

## License

MIT — Built with ❤️ for local-first, privacy-respecting productivity.
