# Command Execution Contract

This document defines how all commands — voice or text — flow through the system.

## Core invariant

**Every command goes through `CommandExecutor`.** The voice route and the text command bar both call the same service. There is no special-case execution path.

## Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/commands/execute` | Route + auto-execute (low-risk) or return awaiting_confirmation |
| POST | `/commands/preview` | Route only, do not execute |
| POST | `/commands/{id}/confirm` | Confirm and execute an awaiting command |
| POST | `/commands/{id}/cancel` | Cancel an awaiting command |
| GET | `/commands/{id}` | Fetch command with execution result |
| POST | `/commands/route` | Legacy: route only (backward compat) |

## Status lifecycle

```
                    ┌─────────────────────────┐
                    │                         │
  raw_input ──► routed ──► executing ──► completed
                    │           └──────────► failed
                    │
                    └──► awaiting_confirmation ──► executing ──► completed
                                   │                     └──────► failed
                                   └──► cancelled
```

- `pending` is the legacy status for commands created via `/commands/route`
- New commands via `/commands/execute` or `/commands/preview` start as `routed` or `awaiting_confirmation`

## Risk policy

Defined in `apps/api/app/services/confirmation_policy.py`.

| Risk | Intents | Behavior |
|---|---|---|
| low | create_task, complete_task, defer_task, mark_waiting, show_today, show_briefing, … | Auto-execute |
| high | draft_email, delegate_task, prepare_meeting, create_presentation_outline, … | Return `awaiting_confirmation`; require explicit confirm |

## Execution map

| Intent | Handler | Requirements |
|---|---|---|
| create_task | Create Task in DB | `parameters.title` |
| complete_task | Set task.status = completed | `target_resource_id` (task ID) |
| defer_task | Set task.status = deferred | task ID; optionally `parameters.defer_until` |
| mark_waiting | Set task.status = waiting | task ID |
| prioritize_task | Update task.priority | task ID + `parameters.priority` |
| show_today | Query today tasks | — |
| show_briefing | Query today briefing | — |
| generate_daily_briefing | Run DailyBriefingAgent | — |
| draft_email | Run EmailDraftAgent | Confirmation required |
| prepare_meeting | Run CalendarPrepAgent | Confirmation required |
| create_presentation_outline | Run PresentationAgent | Confirmation required |
| delegate_task | Run OrchestratorAgent | Confirmation required |

## Response shape

`/commands/execute` and all execution endpoints return:

```json
{
  "id": "uuid",
  "raw_input": "string",
  "input_mode": "text | voice",
  "interpreted_intent": "create_task",
  "action_type": "create_task",
  "target_resource_type": "task",
  "target_resource_id": "uuid | null",
  "requires_confirmation": false,
  "status": "completed",
  "execution_result": { "status": "created", "task_id": "uuid", "title": "..." },
  "error_message": null,
  "intent": "create_task",
  "confidence": 0.92,
  "user_visible_summary": "Creating a new task: ...",
  "confirmation_message": null,
  "latency_ms": 312,
  "executed_at": "2026-06-03T...",
  "completed_at": "2026-06-03T...",
  "command_id": "uuid"
}
```

## Audit fields on Command

Every executed command stores:
- `executed_at` — when execution started
- `completed_at` — when it finished
- `latency_ms` — routing latency (not including execution)
- `confirmation_method` — how it was confirmed: `auto | button | voice`
- `confirmed_at` — when confirmation happened
- `voice_session_id` — links to voice session if applicable
- `execution_result` — JSON of what the handler returned
- `error_message` — set if status = failed
