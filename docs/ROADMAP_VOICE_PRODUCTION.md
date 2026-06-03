# Roadmap: Voice Production & Command Execution

Last updated: 2026-06-03

## Status overview

| Area | Status |
|---|---|
| Command routing | ✅ Done |
| Command execution + lifecycle | ✅ Done (Phase 1) |
| Voice ↔ text unified executor | ✅ Done (Phase 2) |
| Voice provider registry | ✅ Done (Phase 3) |
| Local realtime infra (LiveKit, whisper.cpp, Piper) | ✅ Done (Phase 4) |
| Realtime session APIs | ✅ Done (Phase 5) |
| Call-style voice UI | ✅ Done (Phase 6) |
| Barge-in / turn detection | ✅ Done (Phase 7) |
| Wake word (opt-in) | ✅ Done (Phase 8) |
| Runtime agent manifests | ✅ Done (Phase 9) |
| Full test/CI upgrade | ✅ Done (Phase 10) |

---

## Phase 0 — Roadmap and docs ✅

- `docs/ROADMAP_VOICE_PRODUCTION.md` (this file)
- `docs/COMMAND_EXECUTION_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`

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

## Phase 3 — Voice provider registry ✅

### What was built
- `apps/api/app/schemas/voice_config.py` — Pydantic models for all provider configs
- `apps/api/app/services/voice/config_store.py` — persist VoiceConfig to AppSettings DB
- `apps/api/app/services/voice/health.py` — async health check for all providers
- New endpoints:
  - `GET /voice/config` — load persisted config
  - `PATCH /voice/config` — deep-merge partial update
  - `GET /voice/providers/health` — async health check for livekit/whisper_cpp/piper/ollama/browser_stt/wake_word
  - `POST /voice/providers/validate` — actionable setup guidance

Config shape:
```json
{
  "transport": { "provider": "livekit_local", "enabled": true },
  "stt": { "provider": "browser", "base_url": "http://localhost:8178" },
  "tts": { "provider": "browser", "base_url": "http://localhost:5002" },
  "vad": { "provider": "browser" },
  "wake_word": { "provider": "openwakeword", "enabled": false, "phrase": "hey jarvis" },
  "llm": { "provider": "ollama", "model": "llama3.1" },
  "reply_style": { "max_tokens": 80, "voice_first": true, "barge_in_enabled": true }
}
```

---

## Phase 4 — Local realtime infrastructure ✅

### What was built
- `infra/docker-compose.voice.yml` — livekit, whisper.cpp, Piper, voice-agent services with healthchecks
- `infra/livekit.yaml` — LiveKit server config (devkey:secret, port 7880)
- `apps/voice-agent/` — Python package:
  - `voice_agent/config.py` — VoiceAgentSettings (pydantic-settings, VOICE_ prefix)
  - `voice_agent/stt.py` — WhisperCppSTT + BrowserSTTPlaceholder
  - `voice_agent/tts.py` — PiperTTS + BrowserTTSPlaceholder
  - `voice_agent/command_client.py` — HTTP client to main API
  - `voice_agent/interruption.py` — InterruptionController (barge-in)
  - `voice_agent/wake_word.py` — WakeWordDetector (openWakeWord)
  - `voice_agent/pipeline.py` — VoicePipeline orchestrator
  - `voice_agent/main.py` — CLI entry point (browser + livekit modes)

### Starting the voice stack
```bash
# Download models first (one-time)
mkdir -p infra/models/whisper infra/models/piper
# See docker-compose.voice.yml comments for model download commands

# Start everything
docker compose -f infra/docker-compose.voice.yml up

# Or start voice-agent only (browser mode, no external deps)
cd apps/voice-agent && python -m voice_agent.main --transport browser
```

---

## Phase 5 — Realtime voice session APIs ✅

### What was built
- `VoiceSession` + `VoiceTurn` DB models (Alembic migration `c6d7e8f9a0b1`)
- New endpoints under `/voice/sessions`:
  - `POST /voice/sessions` — create session
  - `GET /voice/sessions` — list sessions
  - `GET /voice/sessions/{id}` — get session + turns
  - `PATCH /voice/sessions/{id}` — update status
  - `DELETE /voice/sessions/{id}` — end session
  - `POST /voice/sessions/{id}/turns` — append turn with latency
- `VoiceTurn` captures: role, transcript, command_id, stt_latency_ms, llm_latency_ms, tts_latency_ms, total_latency_ms, interrupted flag

---

## Phase 6 — Call-style voice UI ✅

### What was built
- `apps/web/app/voice/page.tsx` fully rewritten:
  - Phone/hang-up call controls (Phone icon → starts session, PhoneOff → ends session)
  - Live session header: session ID, elapsed time, turn count, command count
  - Provider health strip (browser_stt / whisper_cpp / piper / ollama / livekit / wake_word dots)
  - Session turn log with per-turn role, transcript, latency, intent, status icon
  - Mic button shows during active call; changes state during listening/processing/speaking

---

## Phase 7 — Barge-in and turn detection ✅

### What was built
**Frontend (browser-side):**
- `speak()` starts a parallel `SpeechRecognition` while TTS plays
- First spoken text cancels TTS and saves to `bargeInTextRef`
- `speakThenMaybeListen()` processes barge-in text immediately after TTS resolves
- `bargeInEnabledRef` (ref, not state) avoids stale closures in `speak()`

**Backend (voice-agent, LiveKit mode):**
- `InterruptionController.interrupt()` cancels the active TTS task
- `_handle_audio()` calls `pipeline.interruption.interrupt()` on `START_OF_SPEECH`
- TTS task catches `asyncio.CancelledError` and logs gracefully

---

## Phase 8 — Wake word (opt-in) ✅

### What was built
- `apps/voice-agent/voice_agent/wake_word.py` — WakeWordDetector (openWakeWord) + WakeWordDisabled no-op
- Settings panel in voice page (`VoiceSettingsPanel` component):
  - Barge-in toggle → PATCH `/voice/config` reply_style.barge_in_enabled
  - Wake word enable/disable toggle → PATCH `/voice/config` wake_word.enabled
  - Wake phrase text input → PATCH `/voice/config` wake_word.phrase
  - Provider health badge (green = detected, amber = not running + docker-compose hint)
  - STT provider dropdown (browser / whisper_cpp / groq)
  - TTS provider dropdown (browser / piper)

---

## Phase 9 — Runtime agent manifests ✅

### What was built
- `agents/manifests/*.yaml` — 6 agent manifests (email_draft, calendar_prep, task_classifier, daily_briefing, presentation, orchestrator)
- `apps/api/app/services/agent_manifest_loader.py` — load/validate/sync/enable-toggle
- New endpoints:
  - `GET /agents/manifests` — list all manifests with validation status
  - `POST /agents/manifests/sync` — sync manifests to DB
  - `GET /agents/{id}/manifest` — get single manifest
  - `PATCH /agents/{id}/enabled` — enable/disable agent
- `POST /agents/{id}/run` returns 403 for disabled agents
- Agents page shows enabled toggle, manifest icon, tools_allowed badges

---

## Phase 10 — Tests and CI upgrade ✅

### What was built
- `apps/api/tests/test_command_executor.py` — 17 tests (preview, execute, confirm, cancel, risk levels)
- `apps/api/tests/test_voice_sessions.py` — 14 tests (session lifecycle, turn logging, provider config)
- `apps/api/tests/test_agent_manifests.py` — 11 tests (manifest loading, validation, sync, enable/disable)
- `apps/voice-agent/tests/test_pipeline.py` — 20 tests (pipeline routing, confirmation flow, STT/TTS adapters, interruption, wake word)
- `.github/workflows/ci.yml` updated with:
  - `api` job: pytest with `DATABASE_URL=sqlite:///./test.db`
  - `voice-agent` job: syntax check all modules + dependency install
  - `infra` job: docker-compose config validation
  - `web` job: lint + build

### Running tests locally
```bash
# API tests (48 tests)
cd apps/api && python -m pytest tests/ -v

# Voice agent tests
cd apps/voice-agent && python -m pytest tests/ -v

# All
cd apps/api && python -m pytest tests/ && cd ../voice-agent && python -m pytest tests/
```
