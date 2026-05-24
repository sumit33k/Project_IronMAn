# Security & Privacy

## Principles

1. **Local-first**: All task data, agent outputs, and AI inference stay on your device.
2. **No cloud by default**: Ollama runs locally. No data leaves the machine unless you explicitly configure a cloud provider.
3. **Human-in-the-loop for irreversible actions**: Agents cannot independently send emails, delete files, or modify calendars.
4. **Transparent logging**: Every agent run is logged. Nothing happens silently.

---

## Data Storage

| Data | Location | Encryption |
|------|----------|------------|
| Tasks, commands, briefings | `apps/api/ironman.db` (SQLite) | None (MVP) — add at Phase 6 |
| Agent run history | Same SQLite file | None (MVP) |
| App settings | Same SQLite file | None (MVP) |
| AI model files | Ollama's local cache | OS-level |

**No data is sent to any external service in the default configuration.**

---

## Agent Safety Gates

### Risk Levels

| Level | Policy |
|-------|--------|
| `low` | Execute directly, no confirmation needed |
| `medium` | May execute directly; confirmation recommended for external actions |
| `high` | Always show confirmation dialog before proceeding |

### Actions That Always Require Confirmation

- Sending any email (draft is fine; send is not)
- Deleting a task (or any file)
- Creating or moving calendar events
- Contacting or messaging any person
- Running automation that affects external systems
- Delegating to a high-risk agent

### Command Router Safety

Commands with `requires_confirmation: true` in the router response are never auto-executed.  
The frontend shows a confirmation card before proceeding.

```json
{
  "intent": "draft_email",
  "requires_confirmation": true,
  "confirmation_message": "Are you sure you want to draft an email to Raj?"
}
```

---

## Voice Safety

- **Push-to-talk** (current): User manually triggers — no always-on microphone
- **Wake word** (Phase 4): Always-on listening is **opt-in only**, disabled by default
- Voice commands for irreversible actions still show confirmation dialogs
- Transcripts are processed locally (browser SpeechRecognition → local STT in Phase 4)

---

## What Agents Must Not Do

- Send emails without `requires_review: true` in output
- Delete any file or task without explicit user confirmation
- Move or create calendar events without approval
- Contact, message, or notify any person autonomously
- Call external APIs not in their `tools_allowed` list
- Use cloud AI providers unless explicitly configured
- Expose task data, personal context, or agent outputs to third parties
- Hide or suppress errors

---

## Future Security Improvements (Phase 6)

- **SQLite encryption** using SQLCipher
- **Local authentication** (PIN or biometric on desktop)
- **Agent sandboxing** — limit filesystem/network access per agent
- **Audit log export** — export agent run history as JSON/CSV
- **Cloud provider toggle** — explicit opt-in for OpenAI/Anthropic with data handling notice
