# ironman-command-center-builder

**Version:** 1.0.0  
**Type:** Full-stack AI product skill

## Description

Use this skill when implementing, extending, reviewing, or planning features for **Project Iron Man / Jarvis Command Center** — a local-first AI productivity cockpit with:

- Task management (CRUD, Today Queue, Kanban Board)
- Daily AI briefing via Ollama
- Modular AI agent framework (Task Classifier, Daily Briefing, Presentation, Email Draft, Follow-up, Calendar Prep)
- Natural language command bar + push-to-talk voice
- "Hey Jarvis" wake-word architecture (Phase 4)
- Privacy-first, open-source-first, local-first design

## When to activate

- Building new features for the command center
- Adding or modifying AI agents
- Extending API routes or data models
- Reviewing frontend components or state management
- Planning new phases of development
- Debugging agent runs, command routing, or Ollama integration
- Integrating new data sources (Gmail, Calendar, files)

---

## Core Product Loop

```
Capture → Understand → Prioritize → Visualize → Act → Delegate → Review
```

---

## Invariants — never violate

1. **Local-first**: All data stays on device. No cloud AI calls without explicit user opt-in.
2. **Open-source-first**: Prefer OSS tools. Document any exceptions clearly.
3. **Human approval for irreversible actions**: Email sends, file deletes, calendar changes, contacting people — always require confirmation before executing.
4. **Agents are modular**: Each agent has clear `id`, `name`, `agent_type`, `description`, `risk_level`, `requires_approval_for`, and structured JSON `output`. No god agents.
5. **Command router is universal**: All voice and text commands route through `POST /commands/route`. No direct agent calls from voice.
6. **Structured outputs**: Agent `run()` always returns a dict with defined keys. Never return free-form text.
7. **No silent removal**: Never remove existing functionality without documenting why.
8. **Incremental building**: Follow the phase plan. Don't skip phases without user agreement.
9. **Log every agent run**: All runs are stored in `agent_runs` table with input, output, status, timestamps.
10. **Test the golden path**: Always verify core flows before adding features.

---

## Tech Stack

| Layer         | Choice                                   | Notes                         |
|---------------|------------------------------------------|-------------------------------|
| Frontend      | Next.js 14 (App Router), TypeScript      | `/apps/web/`                  |
| Styling       | Tailwind CSS, dark-mode-first            | `glass-card` utility class    |
| State         | Zustand + TanStack Query                 | `stores/useStore.ts`          |
| Backend       | FastAPI + Python 3.11+                   | `/apps/api/`                  |
| Database      | SQLite (default), PostgreSQL (optional)  | SQLAlchemy ORM                |
| Local AI      | Ollama (`llama3.1` default)              | Abstract provider layer       |
| Agent runtime | Custom modular framework                 | `apps/api/app/agents/`        |
| Voice (MVP)   | Browser SpeechRecognition                | Push-to-talk only             |
| Voice (P4)    | openWakeWord + whisper.cpp               | Planned, not yet implemented  |

---

## Key File Paths

```
apps/
  api/
    app/
      main.py                    ← FastAPI app, router registration, agent registry
      core/config.py             ← Settings (Ollama URL, model, DB URL)
      db/models.py               ← All SQLAlchemy models
      schemas/                   ← Pydantic request/response schemas
      routes/                    ← One file per resource (tasks, agents, commands…)
      services/
        ollama_client.py         ← Ollama API wrapper
        command_router.py        ← Natural language → intent JSON
      agents/
        base.py                  ← BaseAgent abstract class
        registry.py              ← AgentRegistry singleton
        *.py                     ← Individual agent implementations
      prompts/                   ← LLM prompt files (.md)
      seed.py                    ← Demo data seeder

  web/
    app/
      page.tsx                   ← Dashboard (main screen)
      today/page.tsx             ← Today Queue
      board/page.tsx             ← Kanban Board
      agents/page.tsx            ← Agent Hub
      briefing/page.tsx          ← Daily Briefing
      voice/page.tsx             ← Voice Interface
      settings/page.tsx          ← Settings
    components/
      layout/Sidebar.tsx         ← Navigation sidebar
      command/CommandBar.tsx     ← ⌘K command bar
      dashboard/                 ← Dashboard panel components
    stores/useStore.ts           ← Zustand global store
    lib/api.ts                   ← Typed API client
```

---

## Adding a New Agent

1. Create `apps/api/app/agents/{name}.py` extending `BaseAgent`
2. Set class attributes: `id`, `name`, `agent_type`, `description`, `risk_level`, `requires_approval_for`
3. Implement `async run(self, input_data: dict, db: Session) -> dict`
4. Import and register in `apps/api/app/main.py`
5. Document in `skills/ironman-command-center-builder/references/agent-design.md`

Use the generator: `python skills/ironman-command-center-builder/scripts/generate_agent_stub.py <name> <type>`

---

## Adding a New API Route

1. Create `apps/api/app/routes/{name}.py` with `APIRouter(prefix="/{name}")`
2. Add Pydantic schemas in `apps/api/app/schemas/{name}.py`
3. Add SQLAlchemy model to `apps/api/app/db/models.py` if needed (run `Base.metadata.create_all`)
4. `app.include_router({name}.router)` in `apps/api/app/main.py`
5. Add typed function to `apps/web/lib/api.ts`

---

## Adding a New Frontend Screen

1. Create `apps/web/app/{screen}/page.tsx` with `'use client'`
2. Add nav entry in `apps/web/components/layout/Sidebar.tsx`
3. Fetch data via `apps/web/lib/api.ts`
4. Use `glass-card` CSS class for card containers
5. Follow dark theme: `bg-[#131720]` cards, `border-[#1e2847]` borders, `text-slate-300` body text

---

## Agent Safety Checklist

Before shipping any agent capability, verify:

- [ ] Is the action reversible? If not → `requires_approval_for`
- [ ] Does it affect external systems (email, calendar, files)? → `risk_level = "high"`
- [ ] Is `requires_approval_for` list populated for risky operations?
- [ ] Does the output schema include `requires_review: true` for drafts?
- [ ] Is every run logged to `agent_runs` table?
- [ ] Does the UI show the approval confirmation before execution?

---

## References

| File | Content |
|------|---------|
| `references/architecture.md` | System design, data flow, module structure |
| `references/agent-design.md` | Agent patterns, safety, all agents |
| `references/api-contract.md` | All endpoints with request/response schemas |
| `references/voice-design.md` | Voice architecture, state machine, roadmap |
| `references/ui-design.md`    | Design tokens, component patterns |
| `references/security-rules.md` | Privacy, safety, approval gates |
| `references/implementation-roadmap.md` | Phase-by-phase plan |
