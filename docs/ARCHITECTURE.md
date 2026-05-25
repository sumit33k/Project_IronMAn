# Architecture — Jarvis Command Center

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Jarvis Command Center                         │
│                                                                  │
│  ┌───────────────┐   HTTP/JSON    ┌──────────────────────────┐  │
│  │  Next.js 14   │ ─────────────> │       FastAPI            │  │
│  │  React/TS     │               │   SQLite (SQLAlchemy)     │  │
│  │  Tailwind     │               │   Agent Framework        │  │
│  │  Zustand      │ <─────────────│   Command Router         │  │
│  └───────────────┘               └──────────┬───────────────┘  │
│                                             │ HTTP              │
│                                   ┌─────────▼──────────┐       │
│                                   │      Ollama         │       │
│                                   │   llama3.1 (local) │       │
│                                   │   (configurable)   │       │
│                                   └────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

## Core Product Loop

```
  User Input (text/voice)
        │
        ▼
  Command Bar / Voice
        │
        ▼
  POST /commands/route
        │
  ┌─────┴─────────────────────────┐
  │       Command Router          │
  │  (Ollama + rule-based fallback│
  └─────┬─────────────────────────┘
        │ intent JSON
        ▼
  ┌─────────────┐    ┌─────────────────────┐
  │  Safe act   │    │  Risky act          │
  │ (execute)   │    │ (show confirmation) │
  └─────────────┘    └─────────────────────┘
        │                    │
        ▼                    ▼ (user confirms)
  Task CRUD / Agent Run / Screen Navigation
```

## Backend Module Structure

```
apps/api/app/
├── main.py           FastAPI app, CORS, router registration, agent boot
├── core/
│   └── config.py     Pydantic Settings (env vars, Ollama config, DB URL)
├── db/
│   ├── database.py   SQLAlchemy engine, SessionLocal, Base
│   └── models.py     All ORM models (Task, Agent, AgentRun, Command, etc.)
├── schemas/          Pydantic request/response schemas (one file per entity)
├── routes/           FastAPI routers (one file per resource group)
│   ├── tasks.py      /tasks — full CRUD + actions
│   ├── agents.py     /agents — list, get, run, run history
│   ├── commands.py   /commands — route + history
│   ├── briefings.py  /briefings — today + generate
│   ├── ai.py         /ai — health, classify, recommend
│   ├── voice.py      /voice — settings + transcribe stub
│   └── settings.py   /settings — get + patch
├── services/
│   ├── ollama_client.py   Async Ollama HTTP wrapper
│   └── command_router.py  NL → intent classifier
├── agents/
│   ├── base.py        BaseAgent ABC with execute() lifecycle
│   ├── registry.py    AgentRegistry singleton
│   └── *.py           Individual agent implementations
├── prompts/           LLM prompt templates (.md files)
└── seed.py            Demo data seeder
```

## Frontend Architecture

```
apps/web/
├── app/               Next.js App Router pages
│   ├── page.tsx       Dashboard (main cockpit)
│   ├── today/         Today Queue
│   ├── board/         Kanban Board
│   ├── agents/        Agent Hub
│   ├── briefing/      Daily Briefing
│   ├── voice/         Voice Interface
│   └── settings/      Settings
├── components/
│   ├── layout/
│   │   └── Sidebar.tsx    Navigation, integrations, quick actions
│   ├── command/
│   │   └── CommandBar.tsx ⌘K natural language input
│   └── dashboard/         All dashboard panel components
├── stores/
│   └── useStore.ts    Zustand global state (tasks, agents, briefing, AI status)
└── lib/
    └── api.ts         Typed fetch wrapper for all backend endpoints
```

## State Management

```
useStore (Zustand)
├── tasks[]           All tasks
├── todayTasks[]      Today's queue
├── overdueTasks[]    Overdue items
├── agents[]          Registered agents
├── briefing          Today's briefing (or null)
├── ollamaAvailable   Boolean health status
├── commandResult     Last command routing result
└── Actions:
    loadTasks()       GET /tasks + /tasks/today + /tasks/overdue
    completeTask(id)  POST /tasks/{id}/complete
    routeCommand(txt) POST /commands/route
    checkAI()         GET /ai/health
    ...
```

## Data Models

```
Task                  — Core work item
AgentRun              — Audit log for every agent execution  
Command               — History of all text/voice commands
DailyBriefing         — AI-generated daily command briefing
Integration           — External service connection config
AppSettings           — Key-value settings store
```

## Agent Execution Flow

```
User clicks "Run Agent" (or command router delegates)
        │
        ▼
agent.execute(input_data, db, task_id?)
        │
        ├─ Create AgentRun row (status=running)
        │
        ▼
agent.run(input_data, db)  ← implement this in each agent
        │
        ├─ Call ollama.classify_json(prompt)
        │
        ├─ Success: AgentRun.status = "completed", store output_data
        │
        └─ Failure: AgentRun.status = "failed", store error_message
```

## Ollama Integration

All LLM calls go through `OllamaClient`:

- `generate(prompt)` → raw string
- `chat(messages)` → assistant message
- `classify_json(prompt)` → parsed dict (extracts JSON from response)
- `generate_daily_brief(context)` → structured brief dict

If Ollama is unreachable (`ConnectError`), raises `OllamaUnavailableError`.
All routes that depend on Ollama return HTTP 503 with a user-friendly message.

## Database

SQLite by default (`ironman.db` in the API working directory).  
All tables are created via `Base.metadata.create_all(bind=engine)` on startup.  
Foreign keys are not enforced by SQLite by default (intentional for MVP flexibility).

PostgreSQL can be substituted by setting `DATABASE_URL` in environment variables.

## Security Principles

- All data is local (SQLite on disk)
- No cloud AI calls without explicit configuration
- Irreversible actions require confirmation (`requires_confirmation: true` in command router)
- Agent risk levels gate approval requirements
- See `docs/SECURITY.md` for full policy
