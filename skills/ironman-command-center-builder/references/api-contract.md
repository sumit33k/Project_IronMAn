# API Contract Reference

Base URL: `http://localhost:8000`  
Docs: `http://localhost:8000/docs` (Swagger UI)

---

## Health

| Method | Path      | Description        |
|--------|-----------|--------------------|
| GET    | `/health` | Service health check |

**Response:** `{"status": "ok", "version": "1.0.0"}`

---

## Tasks — `/tasks`

| Method | Path                       | Description              |
|--------|----------------------------|--------------------------|
| GET    | `/tasks`                   | List all tasks (filter: `?status=today&priority=high`) |
| POST   | `/tasks`                   | Create task              |
| GET    | `/tasks/today`             | Today's tasks            |
| GET    | `/tasks/overdue`           | Overdue tasks            |
| GET    | `/tasks/{id}`              | Get single task          |
| PATCH  | `/tasks/{id}`              | Update task fields       |
| DELETE | `/tasks/{id}`              | Delete task              |
| POST   | `/tasks/{id}/complete`     | Mark as completed        |
| POST   | `/tasks/{id}/defer`        | Defer (`?defer_until=YYYY-MM-DD`) |
| POST   | `/tasks/{id}/mark-waiting` | Mark as waiting          |
| POST   | `/tasks/{id}/delegate`     | Delegate to agent (`?agent_id=xxx`) |

**Task schema (response):**
```json
{
  "id": "uuid",
  "title": "string",
  "description": "string|null",
  "source": "manual|email|agent|...",
  "status": "inbox|today|in_progress|waiting|deferred|completed|archived",
  "priority": "low|medium|high|urgent",
  "due_date": "YYYY-MM-DD|null",
  "category": "string",
  "tags": ["string"],
  "personal_or_work": "work|personal",
  "next_action": "string|null",
  "agent_id": "uuid|null",
  "agent_status": "string|null",
  "created_at": "ISO8601",
  "updated_at": "ISO8601",
  "completed_at": "ISO8601|null"
}
```

**Create task body:**
```json
{
  "title": "string (required)",
  "description": "string",
  "priority": "medium",
  "status": "inbox",
  "due_date": "YYYY-MM-DD",
  "category": "general",
  "tags": [],
  "personal_or_work": "work"
}
```

---

## Agents — `/agents`

| Method | Path                  | Description          |
|--------|-----------------------|----------------------|
| GET    | `/agents`             | List all agents      |
| GET    | `/agents/runs/all`    | All agent run history |
| GET    | `/agents/{id}`        | Get agent details    |
| POST   | `/agents/{id}/run`    | Run an agent         |

**Run agent body:** `{ "input_key": "value" }` (agent-specific)

**Agent run response:**
```json
{
  "id": "uuid",
  "agent_id": "task_classifier_agent",
  "task_id": "uuid|null",
  "status": "completed|failed|running",
  "input_data": {},
  "output_data": {},
  "error_message": "string|null",
  "created_at": "ISO8601",
  "completed_at": "ISO8601|null"
}
```

---

## Commands — `/commands`

| Method | Path                | Description              |
|--------|---------------------|--------------------------|
| POST   | `/commands/route`   | Route a natural language command |
| GET    | `/commands/history` | Recent command history   |

**Route command body:**
```json
{ "raw_input": "show me my priorities", "input_mode": "text", "context": {} }
```

**Route command response:**
```json
{
  "intent": "show_today",
  "confidence": 0.92,
  "target_agent": null,
  "task_id": null,
  "parameters": {},
  "requires_confirmation": false,
  "confirmation_message": null,
  "user_visible_summary": "Showing today's priorities",
  "command_id": "uuid"
}
```

**Supported intents:** `create_task`, `update_task`, `complete_task`, `defer_task`, `prioritize_task`, `show_today`, `show_briefing`, `generate_daily_briefing`, `generate_end_of_day_review`, `search_tasks`, `delegate_task`, `draft_email`, `summarize_email`, `prepare_meeting`, `create_presentation_outline`, `summarize_document`, `mark_waiting`, `open_screen`, `ask_general_question`

---

## Briefings — `/briefings`

| Method | Path                   | Description                    |
|--------|------------------------|--------------------------------|
| GET    | `/briefings/today`     | Today's briefing (null if none) |
| POST   | `/briefings/generate`  | Generate a new briefing        |

**Generate briefing body:**
```json
{
  "upcoming_meetings": ["10:00 Product Sync"],
  "pending_follow_ups": ["Reply to Raj"],
  "date": "YYYY-MM-DD"
}
```

**Briefing response:**
```json
{
  "id": "uuid",
  "date": "YYYY-MM-DD",
  "summary": "string",
  "top_priorities": ["string"],
  "meetings_to_prepare": ["string"],
  "urgent_followups": ["string"],
  "tasks_to_delegate": ["string"],
  "risks": ["string"],
  "recommended_schedule": ["string"],
  "focus_score": 75,
  "created_at": "ISO8601"
}
```

---

## AI — `/ai`

| Method | Path                        | Description              |
|--------|-----------------------------|--------------------------|
| GET    | `/ai/health`                | Ollama availability      |
| POST   | `/ai/classify-task`         | Classify a task with AI  |
| POST   | `/ai/recommend-next-action` | Get next action for task |

**AI health response:** `{"ollama_available": true, "models": ["llama3.1"]}`

---

## Voice — `/voice`

| Method | Path                | Description          |
|--------|---------------------|----------------------|
| GET    | `/voice/settings`   | Voice configuration  |
| PATCH  | `/voice/settings`   | Update voice settings |
| POST   | `/voice/transcribe` | Transcribe audio (stub in MVP) |

---

## Settings — `/settings`

| Method | Path        | Description        |
|--------|-------------|--------------------|
| GET    | `/settings` | All app settings   |
| PATCH  | `/settings` | Update settings    |

**Settings keys:** `ollama_base_url`, `ollama_model`, `wake_phrase`, `voice_enabled`, `tts_enabled`, `user_name`, `theme`, `approval_policy`

---

## Error Responses

| Code | Meaning                          |
|------|----------------------------------|
| 404  | Resource not found               |
| 503  | Ollama unavailable               |
| 422  | Validation error (body schema)   |
| 500  | Unexpected server error          |

```json
{ "detail": "Task not found" }
```
