# Roadmap: Voice Production & Command Execution

Last updated: 2026-06-03

## Status overview

| Area | Status |
|---|---|
| Command routing | ✅ Done |
| Command execution + lifecycle | ✅ Done (Phase 1) |
| Voice ↔ text unified executor | ✅ Done (Phase 2) |
| Voice provider registry | 🔲 Phase 3 |
| Local realtime infra (LiveKit, whisper.cpp, Piper) | 🔲 Phase 4 |
| Realtime session APIs | 🔲 Phase 5 |
| Call-style voice UI | 🔲 Phase 6 |
| Barge-in / turn detection | 🔲 Phase 7 |
| Wake word (opt-in) | 🔲 Phase 8 |
| Runtime agent manifests | 🔲 Phase 9 |
| Full test/CI upgrade | 🔲 Phase 10 |

---

## Phase 0 — Roadmap and docs ✅

- `docs/ROADMAP_VOICE_PRODUCTION.md` (this file)
- `docs/COMMAND_EXECUTION_CONTRACT.md`

---

## Phase 1 — Command execution foundation ✅

**Goal**: Commands actually do things instead of only identifying intent.

### What was built
- `apps/api/app/services/command_executor.py` — `CommandExecutor` class
- `apps/api/app/services/confirmation_policy.py` — risk levels + confirmation rules
- `apps/api/app/schemas/command_execution.py` — Pydantic schemas
- Extended `Command` model with 13 new fields (migration `b5c6d7e8f9a0`)
- New endpoints:
  - `POST /commands/preview` — route only, no execution
  - `POST /commands/execute` — route + auto-execute if low risk
  - `POST /commands/{id}/confirm` — confirm and execute
  - `POST /commands/{id}/cancel` — cancel awaiting command
  - `GET /commands/{id}` — get command with result

### Command status lifecycle
```
preview → routed  |  awaiting_confirmation
                        ↓ confirm()
executing → completed | failed
         ↗
routed → execute()

awaiting_confirmation → cancel() → cancelled
```

### Execution map
| Intent | Behavior |
|---|---|
| create_task | Creates Task if title present |
| complete_task | Marks task done (needs task_id) |
| defer_task | Defers task (needs task_id + optional date) |
| mark_waiting | Sets task to waiting |
| prioritize_task | Updates task priority |
| show_today | Returns today's tasks |
| show_briefing | Returns today's briefing |
| generate_daily_briefing | Runs DailyBriefingAgent |
| draft_email | Requires confirmation → runs EmailDraftAgent |
| prepare_meeting | Requires confirmation → runs CalendarPrepAgent |
| create_presentation_outline | Requires confirmation → runs PresentationAgent |
| delegate_task | Requires confirmation → runs OrchestratorAgent |

---

## Phase 2 — Unified executor for voice + text ✅

**Goal**: Voice and text commands share identical lifecycle.

### What was built
- `CommandBar.tsx` — calls `/commands/execute`; confirm/cancel buttons hit `/commands/{id}/confirm|cancel`
- `voice/page.tsx` — calls `/commands/execute` with `input_mode=voice`; voice confirmation words ("yes", "confirm") call `/commands/{id}/confirm`; "cancel", "no" call `/commands/{id}/cancel`
- `/voice/process` route updated — uses `CommandExecutor` internally

---

## Phase 3 — Voice provider registry 🔲

### Planned
```
GET   /voice/config
PATCH /voice/config
GET   /voice/providers/health
POST  /voice/providers/validate
```

Config shape:
```json
{
  "transport": { "provider": "livekit_local", "enabled": true },
  "stt": { "provider": "whisper_cpp", "base_url": "http://localhost:8178" },
  "tts": { "provider": "piper", "base_url": "http://localhost:5002" },
  "vad": { "provider": "silero" },
  "wake_word": { "provider": "openwakeword", "enabled": false, "phrase": "hey jarvis" },
  "llm": { "provider": "ollama", "model": "llama3.1" },
  "reply_style": { "max_tokens": 80, "voice_first": true }
}
```

---

## Phase 4 — Local realtime infrastructure 🔲

### Planned: `infra/docker-compose.voice.yml`
- livekit/livekit-server
- whisper.cpp HTTP server (port 8178)
- Piper TTS server (port 5002)
- `apps/voice-agent/` — LiveKit agent SDK process

---

## Phase 5 — Realtime voice session APIs 🔲

### Planned endpoints
```
POST   /voice/sessions
GET    /voice/sessions/{id}
POST   /voice/sessions/{id}/confirm
POST   /voice/sessions/{id}/cancel
DELETE /voice/sessions/{id}
GET    /voice/sessions/{id}/events
```

### Planned models
- `VoiceSession` — lifecycle: created → connecting → listening → transcribing → routing → executing → speaking
- `VoiceTranscript` — turn-level transcripts
- `VoiceTurn` — full turn with provider trace and latency

---

## Phase 6 — Call-style voice UI 🔲

Replace push-to-talk page with:
- LiveKit client SDK connection
- Live partial + final transcript panel
- Current command status card
- Confirmation card (voice + button)
- Interrupt/stop button
- Provider health strip
- Latency display

---

## Phase 7 — Barge-in and turn quality 🔲

In `apps/voice-agent/`:
- VAD detects user speech while TTS is active
- TTS stream stops immediately
- Interrupted turn is marked, not re-executed
- Tuning knobs: `min_silence_ms`, `endpoint_delay_ms`, `barge_in_enabled`

---

## Phase 8 — Wake word (opt-in) 🔲

- `apps/voice-agent/voice_agent/wake_word.py` — openWakeWord integration
- Disabled by default; requires explicit user opt-in
- Visible mic-active indicator when always-on is enabled
- `GET/PATCH /voice/wake-word/config`

---

## Phase 9 — Runtime agent manifests 🔲

- YAML manifests in `agents/manifests/`
- `apps/api/app/services/agent_manifest_loader.py`
- Admin UI to enable/disable/configure agents without editing `main.py`

---

## Phase 10 — Tests and CI upgrade 🔲

Planned test files:
- `apps/api/tests/test_command_executor.py`
- `apps/api/tests/test_confirmation_policy.py`
- `apps/api/tests/test_voice_config.py`
- `apps/web/tests/voice-page.spec.ts`

CI jobs to add: pytest, voice-agent lint, provider health mock tests.
