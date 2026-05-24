# Agent Design

## Overview

The agent framework is a lightweight, modular system designed to:
- Keep agents independent and testable
- Log every run for auditability
- Enforce safety via risk levels and approval gates
- Return structured JSON (never free-form text)
- Work with Ollama by default, with a pluggable provider layer

---

## BaseAgent

Every agent extends `BaseAgent` (`apps/api/app/agents/base.py`):

```python
class BaseAgent(ABC):
    id: str              # Unique identifier (used as FK in agent_runs)
    name: str            # Display name
    agent_type: str      # Category (task_classifier, email_draft, etc.)
    description: str     # What this agent does
    risk_level: str      # "low" | "medium" | "high"
    requires_approval_for: list[str]  # Actions that need human confirmation

    @abstractmethod
    async def run(self, input_data: dict, db: Session) -> dict:
        """Core agent logic. Must return a dict (JSON-serializable)."""
        pass

    async def execute(self, input_data, db, task_id=None) -> AgentRun:
        """Wraps run() with logging. Call this from outside."""
        # Creates AgentRun record → calls run() → updates status
```

**Never call `run()` directly from routes.** Always call `execute()` which handles the AgentRun lifecycle.

---

## AgentRegistry

`apps/api/app/agents/registry.py` — a singleton that maps agent IDs to instances.

```python
registry = get_registry()
registry.register(MyAgent())
agent = registry.get("my_agent_id")
```

All agents are registered at startup in `apps/api/app/main.py`.

---

## Agent Run Lifecycle

```
execute() called
    │
    ├─ INSERT agent_runs (status="running")
    │
    ├─ run(input_data, db)
    │      │
    │      ├─ Call ollama.classify_json(prompt)
    │      └─ Return output dict
    │
    ├─ SUCCESS: UPDATE status="completed", output_data=JSON
    └─ FAILURE: UPDATE status="failed", error_message=str(e)
```

All runs are visible in the Agent Hub (`/agents`) and via `GET /agents/runs/all`.

---

## Current Agents

### task_classifier_agent
- **Purpose:** Classify any text into a structured task (priority, category, due date, next action)
- **Risk:** Low
- **Input:** `{"text": "Review the proposal by Friday"}`
- **Output:** `{"title", "priority", "category", "personal_or_work", "due_date", "next_action", "recommended_status", "should_delegate", "confidence_score"}`

### daily_briefing_agent
- **Purpose:** Generate morning command briefing from task context
- **Risk:** Low
- **Input:** `{"upcoming_meetings": [], "pending_follow_ups": []}`
- **Output:** `{"summary", "top_priorities", "meetings_to_prepare", "urgent_followups", "risks", "recommended_schedule", "focus_score"}`
- **Note:** Automatically fetches today/overdue tasks from DB

### presentation_agent
- **Purpose:** Create slide outlines and presentation structures
- **Risk:** Low
- **Input:** `{"topic": "Q3 Roadmap", "context": "For board meeting"}`
- **Output:** `{"title", "objective", "audience", "slides": [{slide_number, title, key_points, notes}], "data_needed", "next_steps"}`

### email_draft_agent
- **Purpose:** Draft email replies and compose emails
- **Risk:** High (never sends without approval)
- **Input:** `{"subject", "recipient", "context", "thread_summary", "tone"}`
- **Output:** `{"subject", "to", "tone", "draft_body", "key_points_covered", "requires_review": true}`
- **Safety:** `requires_review` is always `true`. Never sends without explicit user confirmation.

### follow_up_agent
- **Purpose:** Surface stale/waiting tasks and recommend follow-up actions
- **Risk:** Low
- **Input:** `{}`
- **Output:** `{"waiting_tasks", "stale_tasks", "recommendations", "total_waiting", "total_stale"}`

### calendar_prep_agent
- **Purpose:** Create meeting prep checklists and summaries
- **Risk:** Medium (never moves events without approval)
- **Input:** `{"meeting_title", "attendees": [], "agenda": ""}`
- **Output:** `{"meeting_title", "prep_checklist", "key_questions", "materials_needed", "pre_meeting_tasks", "suggested_agenda", "follow_up_template"}`

---

## Adding a New Agent

1. Create `apps/api/app/agents/{name}.py`
2. Extend `BaseAgent`, set all class attributes
3. Implement `async run(self, input_data: dict, db: Session) -> dict`
4. Register in `apps/api/app/main.py`

Or use the generator:
```bash
python skills/ironman-command-center-builder/scripts/generate_agent_stub.py research_agent research low
```

---

## Safety Rules

| Risk Level | Characteristics | Examples |
|------------|----------------|---------|
| `low`      | Read-only, reversible, no external side effects | Classify task, generate briefing, create outline |
| `medium`   | Writes to local DB, no external calls without approval | Calendar prep, follow-up draft |
| `high`     | Affects external systems; always requires human approval | Email draft, file operations |

**High-risk actions always get `requires_review: true` in output.**

**No agent should:**
- Send an email without `requires_review: true` in output
- Delete files autonomously
- Move or create calendar events without approval
- Contact anyone without approval
- Call external APIs not in `tools_allowed`

---

## Command Router → Agent Delegation

When the command router detects an intent that maps to an agent:

```json
{
  "intent": "create_presentation_outline",
  "target_agent": "presentation_agent",
  "parameters": {"topic": "Q3 board presentation"},
  "requires_confirmation": true
}
```

The frontend shows a confirmation if `requires_confirmation: true`.  
On confirm, it calls `POST /agents/presentation_agent/run` with the parameters.

---

## Future Agents (Planned)

| Agent | Phase | Purpose |
|-------|-------|---------|
| `document_agent` | 5 | Summarize documents, extract tasks from PDFs |
| `research_agent` | 5 | Gather context from local files, web (opt-in) |
| `routine_agent` | 6 | Manage recurring habits and personal routines |
| `orchestrator_agent` | 6 | Break complex requests into multi-agent pipelines |
