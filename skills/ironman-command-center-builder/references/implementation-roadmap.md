# Implementation Roadmap

## Phase 0 — Architecture ✅
**Goal:** Foundation, repo, contracts.

- [x] Monorepo structure: `apps/web`, `apps/api`, `packages/shared`, `skills/`, `docs/`
- [x] Data model: Task, Agent, AgentRun, Command, DailyBriefing, Integration, AppSettings
- [x] API contract defined
- [x] Tech stack decided (Next.js 14, FastAPI, SQLite, Ollama)
- [x] Skill folder created
- [x] Documentation: PRD, ARCHITECTURE, MVP_PLAN, AGENT_DESIGN

---

## Phase 1 — Core MVP ✅
**Goal:** Working task manager with board and command bar.

- [x] Task CRUD: create, read, update, delete
- [x] Task statuses: inbox, today, in_progress, waiting, deferred, completed, archived
- [x] Task priorities: low, medium, high, urgent
- [x] Today Queue page
- [x] Kanban Board (6 lanes)
- [x] Dashboard with stats, priorities, schedule widgets
- [x] Command bar (⌘K) with natural language routing
- [x] Sidebar navigation
- [x] Dark-mode premium UI

---

## Phase 2 — Local AI ✅
**Goal:** Ollama integration, task classification, daily briefing.

- [x] Ollama client (health check, generate, chat, classify_json)
- [x] Task Classifier Agent (priority, category, next action, due date extraction)
- [x] Daily Briefing generation from task context
- [x] AI health indicator in UI
- [x] Rule-based fallback when Ollama unavailable
- [x] `POST /ai/classify-task` and `POST /ai/recommend-next-action` endpoints

---

## Phase 3 — Agents ✅
**Goal:** Agent framework, delegation hub, 6 agents.

- [x] BaseAgent abstract class with execute() lifecycle
- [x] AgentRegistry singleton
- [x] Agent run logging (agent_runs table)
- [x] TaskClassifierAgent
- [x] DailyBriefingAgent
- [x] PresentationAgent
- [x] EmailDraftAgent (requires_review always true)
- [x] FollowUpAgent
- [x] CalendarPrepAgent
- [x] Agent Hub page (run, view history, see outputs)
- [x] Agent delegation endpoint: `POST /tasks/{id}/delegate`
- [x] Agent safety: risk_level, requires_approval_for
- [x] Command router → agent delegation

---

## Phase 4 — Voice 🔜
**Goal:** Full voice interface including always-on wake word.

### 4a — Push-to-talk (partially done ✅)
- [x] Browser SpeechRecognition API integration
- [x] Voice page UI with mic button, states, transcript display
- [x] Voice → Command Router → Intent → Action flow
- [x] Voice state machine: idle → listening → processing → done/error

### 4b — Local STT 🔜
- [ ] Integrate `faster-whisper` or `whisper.cpp` for offline transcription
- [ ] `POST /voice/transcribe` endpoint with audio file upload
- [ ] Replace browser SpeechRecognition with local STT
- [ ] Audio streaming via WebSocket

### 4c — Wake Word 🔜
- [ ] Integrate `openWakeWord` Python library
- [ ] Default wake phrase: "Hey Jarvis" (configurable)
- [ ] Background listener service (opt-in only)
- [ ] Architecture: `WakeWordListener → STT → CommandRouter → Agent`
- [ ] Always-on toggle in Settings (disabled by default)
- [ ] Voice activity detection

### 4d — Text-to-Speech 🔜
- [ ] Browser `SpeechSynthesis` API as fallback
- [ ] `piper-tts` for local neural TTS
- [ ] Voice response toggle per agent
- [ ] TTS for: briefing summary, command confirmations, agent outputs

---

## Phase 5 — Integrations 🔜
**Goal:** Real data from email, calendar, files.

### 5a — Gmail / IMAP
- [ ] Gmail OAuth or IMAP connection
- [ ] Fetch unread emails → create task cards
- [ ] Email Agent: classify, draft replies, mark handled
- [ ] `POST /integrations/gmail/sync`

### 5b — Google Calendar / CalDAV
- [ ] Calendar OAuth or CalDAV connection
- [ ] Fetch today's events → populate schedule widget
- [ ] Calendar Prep Agent uses real meeting data
- [ ] Conflict detection, focus block suggestions

### 5c — Local Files
- [ ] Watch folder for new documents
- [ ] Document Agent: summarize, extract tasks
- [ ] Drag & drop file capture
- [ ] `POST /integrations/files/import`

### 5d — Notes & Browser Capture
- [ ] Markdown notes storage
- [ ] Browser extension for URL capture (MCP compatible)
- [ ] Clipboard capture shortcut

---

## Phase 6 — Automation & Analytics 🔜
**Goal:** Routines, focus mode, end-of-day review, analytics.

### 6a — Routines
- [ ] Recurring task templates
- [ ] Daily/weekly routine scheduler
- [ ] Personal Routine Agent
- [ ] Routine completion tracking

### 6b — Focus Mode
- [ ] Block distractions UI mode
- [ ] Pomodoro timer integration
- [ ] Focus session logging
- [ ] Calendar focus block creation

### 6c — End-of-Day Review
- [ ] `POST /briefings/end-of-day`
- [ ] Auto-generate review at configurable time
- [ ] What got done, what slipped, what to carry forward
- [ ] Email summary (with approval)

### 6d — Smart Reminders
- [ ] Due-date based reminders
- [ ] Stale task detection (Follow-up Agent triggers)
- [ ] Proactive agent nudges

### 6e — Analytics
- [ ] Task completion rate over time
- [ ] Focus time tracking
- [ ] Agent usage stats
- [ ] Priority accuracy (did classified tasks match actuals?)
- [ ] `/analytics` page with charts

### 6f — Agent Orchestration
- [ ] Orchestrator Agent: break complex requests into subtasks
- [ ] Multi-agent pipeline: Classifier → Briefing → Delegation
- [ ] LangGraph-compatible task graph (opt-in)
- [ ] Approval workflow for multi-step automation

---

## North Star

> "Hey Jarvis, what should I focus on?"
> 
> The system understands tasks, checks calendar, surfaces priorities, identifies stale follow-ups, suggests delegation, creates drafts, and helps close the day — privately, locally, without cloud dependency.
