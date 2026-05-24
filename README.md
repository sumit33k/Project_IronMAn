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
