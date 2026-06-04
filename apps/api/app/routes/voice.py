import json
import time
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import Response as FastAPIResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session
import httpx
from app.core.config import settings
from app.db.database import SessionLocal
from app.db.models import AppSettings, Command
from app.schemas.voice_config import VoiceConfig
from app.services.voice import config_store
from app.services.voice.health import check_providers
from app.services.command_executor import CommandExecutor
from app.services.voice_session_manager import VoiceSessionManager

router = APIRouter(prefix="/voice", tags=["voice"])

# ---------------------------------------------------------------------------
# Legacy simple settings (kept for backward compat with voice page toggles)
# ---------------------------------------------------------------------------

VOICE_DEFAULTS = {
    "wake_phrase": "hey jarvis",
    "push_to_talk_enabled": True,
    "wake_word_enabled": False,
    "tts_enabled": True,
    "stt_provider": "browser",
}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class VoiceSettings(BaseModel):
    wake_phrase: str = "hey jarvis"
    push_to_talk_enabled: bool = True
    wake_word_enabled: bool = False
    tts_enabled: bool = True
    stt_provider: str = "browser"


class VoiceCommand(BaseModel):
    transcript: str
    auto_execute: bool = True
    voice_session_id: str | None = None


def _load_voice_settings(db: Session) -> dict:
    result = dict(VOICE_DEFAULTS)
    for key in VOICE_DEFAULTS:
        row = db.get(AppSettings, f"voice_{key}")
        if row:
            try:
                result[key] = json.loads(row.value)
            except Exception:
                result[key] = row.value
    return result


@router.get("/settings")
def get_voice_settings(db: Session = Depends(get_db)):
    return _load_voice_settings(db)


@router.patch("/settings")
def update_voice_settings(payload: dict, db: Session = Depends(get_db)):
    current = _load_voice_settings(db)
    current.update(payload)
    validated = VoiceSettings(**current)
    for key, value in validated.model_dump().items():
        db_key = f"voice_{key}"
        existing = db.get(AppSettings, db_key)
        if existing:
            existing.value = json.dumps(value)
        else:
            db.add(AppSettings(key=db_key, value=json.dumps(value)))
    db.commit()
    return validated.model_dump()


# ---------------------------------------------------------------------------
# Phase 3: Voice provider registry
# ---------------------------------------------------------------------------

@router.get("/config")
def get_voice_config(db: Session = Depends(get_db)):
    """Get the structured voice provider configuration."""
    return config_store.load(db).model_dump()


@router.patch("/config")
def update_voice_config(payload: dict, db: Session = Depends(get_db)):
    """Merge partial config updates into the stored voice configuration."""
    current = config_store.load(db)
    # Deep-merge payload into current config
    current_dict = current.model_dump()
    _deep_merge(current_dict, payload)
    try:
        updated = VoiceConfig.model_validate(current_dict)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    config_store.save(updated, db)
    return updated.model_dump()


@router.get("/providers/health")
async def providers_health(db: Session = Depends(get_db)):
    """Check availability of all configured voice providers."""
    config = config_store.load(db)
    health = await check_providers(config)
    return health.model_dump()


@router.post("/providers/validate")
async def validate_providers(db: Session = Depends(get_db)):
    """Run health checks and return actionable setup guidance."""
    config = config_store.load(db)
    health = await check_providers(config)
    issues = []
    if health.ollama.status != "available":
        issues.append("Ollama is not running. Start it with: ollama serve")
    if config.stt.provider == "whisper_cpp" and health.whisper_cpp.status != "available":
        issues.append(f"whisper.cpp not reachable at {health.whisper_cpp.url}")
    if config.tts.provider == "piper" and health.piper.status != "available":
        issues.append(f"Piper TTS not reachable at {health.piper.url}")
    if config.transport.enabled and health.livekit.status != "available":
        issues.append(f"LiveKit not reachable at {health.livekit.url}")
    return {
        "overall": health.overall,
        "providers": health.model_dump(),
        "issues": issues,
        "ready_for_production": health.overall == "ok" and len(issues) == 0,
    }


# ---------------------------------------------------------------------------
# Transcription
# ---------------------------------------------------------------------------

@router.post("/transcribe")
async def transcribe_audio(audio: UploadFile = File(...), db: Session = Depends(get_db)):
    voice_settings = _load_voice_settings(db)
    provider = voice_settings.get("stt_provider", "browser")

    if provider == "groq":
        if not settings.groq_api_key:
            raise HTTPException(
                status_code=400,
                detail="GROQ_API_KEY not configured. Add it to .env and set stt_provider=groq.",
            )
        audio_bytes = await audio.read()
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                files={
                    "file": (
                        audio.filename or "audio.webm",
                        audio_bytes,
                        audio.content_type or "audio/webm",
                    )
                },
                data={"model": "whisper-large-v3-turbo", "language": "en", "response_format": "json"},
            )
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Groq transcription failed: {resp.text}")
        return {"transcript": resp.json().get("text", ""), "confidence": 1.0, "provider": "groq"}

    if provider == "deepgram":
        raise HTTPException(
            status_code=501,
            detail="Deepgram provider: set DEEPGRAM_API_KEY and update voice route.",
        )

    # Check whisper_cpp via config (uses onerahmet/openai-whisper-asr-webservice)
    config = config_store.load(db)
    if config.stt.provider == "whisper_cpp" and config.stt.base_url:
        audio_bytes = await audio.read()
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(
                    f"{config.stt.base_url}/asr",
                    params={"encode": "true", "task": "transcribe", "language": "en", "output": "json"},
                    files={"audio_file": (audio.filename or "audio.webm", audio_bytes, audio.content_type or "audio/webm")},
                )
            if resp.status_code == 200:
                text = resp.json().get("text", "").strip()
                return {"transcript": text, "confidence": 1.0, "provider": "whisper_cpp"}
        except Exception:
            pass

    return {
        "transcript": "",
        "confidence": 0.0,
        "provider": "browser",
        "note": "Set stt_provider=groq or configure whisper_cpp in /voice/config.",
    }


# ---------------------------------------------------------------------------
# Process (uses CommandExecutor)
# ---------------------------------------------------------------------------

@router.post("/process")
async def process_voice_command(cmd: VoiceCommand, db: Session = Depends(get_db)):
    """Route and optionally execute a voice transcript through CommandExecutor.

    Always returns a `spoken_response` field suitable for text-to-speech playback.
    Logs user + assistant turns to the VoiceSession when a session_id is provided.
    """
    session_manager = VoiceSessionManager(db)
    executor = CommandExecutor()
    turn_start_ms = int(time.time() * 1000)

    # Ensure session exists if a session_id was provided
    if cmd.voice_session_id:
        session_manager.get_or_create(cmd.voice_session_id)
        session_manager.set_status(cmd.voice_session_id, "transcribing")

    try:
        if cmd.auto_execute:
            command = await executor.preview(
                raw_input=cmd.transcript,
                input_mode="voice",
                context={},
                db=db,
                voice_session_id=cmd.voice_session_id,
            )
            if cmd.voice_session_id:
                session_manager.set_status(cmd.voice_session_id, "routing")
            if not command.requires_confirmation:
                if cmd.voice_session_id:
                    session_manager.set_status(cmd.voice_session_id, "executing")
                command = await executor.execute(command.id, db, confirmation_method="auto")
        else:
            command = await executor.preview(
                raw_input=cmd.transcript,
                input_mode="voice",
                context={},
                db=db,
                voice_session_id=cmd.voice_session_id,
            )

        payload: dict = {}
        try:
            payload = json.loads(command.payload or "{}")
        except Exception:
            pass

        exec_result: dict | None = None
        try:
            if command.execution_result:
                exec_result = json.loads(command.execution_result)
        except Exception:
            pass

        # Derive spoken_response: prefer what the executor returned, else build one
        spoken_response: str = ""
        if exec_result and isinstance(exec_result, dict):
            spoken_response = exec_result.get("spoken_response", "")
        if not spoken_response:
            if command.requires_confirmation:
                spoken_response = (
                    payload.get("confirmation_message")
                    or f"Please confirm: {payload.get('user_visible_summary', 'your request')}."
                )
            elif command.status == "completed":
                spoken_response = exec_result.get("spoken_response", "Done.") if exec_result else "Done."
            elif command.status == "failed":
                err = command.error_message or "Unknown error."
                spoken_response = f"Something went wrong. {err}"
            else:
                spoken_response = payload.get("user_visible_summary", "Request received.")

        total_latency = int(time.time() * 1000) - turn_start_ms

        # Log turns into the voice session
        if cmd.voice_session_id:
            try:
                session_manager.record_user_turn(
                    cmd.voice_session_id,
                    transcript=cmd.transcript,
                    command_id=command.id,
                    stt_latency_ms=None,
                )
                if command.status in ("completed", "failed", "awaiting_confirmation"):
                    session_manager.record_assistant_turn(
                        cmd.voice_session_id,
                        spoken_response=spoken_response,
                        command_id=command.id,
                        total_latency_ms=total_latency,
                    )
                    session_manager.set_status(
                        cmd.voice_session_id,
                        "speaking" if command.status == "completed" else "listening",
                    )
            except Exception:
                pass  # Turn logging must never break the main response

        return {
            "command_id": command.id,
            "transcript": cmd.transcript,
            "intent": command.interpreted_intent or payload.get("intent"),
            "confidence": payload.get("confidence", 0),
            "requires_confirmation": command.requires_confirmation,
            "confirmation_message": payload.get("confirmation_message"),
            "user_visible_summary": payload.get("user_visible_summary", ""),
            "status": command.status,
            "execution_result": exec_result,
            "auto_executed": command.status == "completed",
            "target_agent": payload.get("target_agent"),
            "task_id": payload.get("task_id") or command.target_resource_id,
            "parameters": payload.get("parameters", {}),
            "spoken_response": spoken_response,
            "total_latency_ms": total_latency,
        }
    except Exception as exc:
        return {
            "error": str(exc),
            "transcript": cmd.transcript,
            "spoken_response": "Sorry, I had trouble processing that.",
        }


# ---------------------------------------------------------------------------
# Piper TTS synthesis proxy
# ---------------------------------------------------------------------------

class TTSRequest(BaseModel):
    text: str
    voice: str | None = None


@router.post("/synthesize")
async def synthesize_speech(request: TTSRequest, db: Session = Depends(get_db)):
    """Proxy text-to-speech synthesis to the configured Piper service.
    Returns audio/wav binary on success.
    Returns 503 if Piper is not configured or unreachable.
    """
    config = config_store.load(db)
    if config.tts.provider != "piper":
        raise HTTPException(
            404,
            "Piper TTS not active. Set tts.provider=piper in PATCH /voice/config.",
        )

    piper_url = (config.tts.base_url or "http://localhost:5002").rstrip("/")
    voice = request.voice or config.tts.voice or "en_US-lessac-medium"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{piper_url}/api/tts",
                data={"text": request.text, "voice": voice},
            )
        if resp.status_code != 200:
            raise HTTPException(502, f"Piper returned HTTP {resp.status_code}: {resp.text[:200]}")
        return FastAPIResponse(content=resp.content, media_type="audio/wav")
    except httpx.ConnectError:
        raise HTTPException(
            503,
            "Piper TTS service not reachable. "
            "Start it with: docker compose -f infra/docker-compose.voice.yml up piper",
        )
    except httpx.TimeoutException:
        raise HTTPException(504, "Piper TTS service timed out.")


# ---------------------------------------------------------------------------
# Voice history
# ---------------------------------------------------------------------------

@router.get("/history")
def get_voice_history(limit: int = 20, db: Session = Depends(get_db)):
    commands = db.scalars(
        select(Command)
        .where(Command.input_mode == "voice")
        .order_by(Command.created_at.desc())
        .limit(limit)
    ).all()
    return [
        {
            "id": c.id,
            "text": c.raw_input,
            "routing_result": json.loads(c.payload) if c.payload else {},
            "status": c.status,
            "execution_result": (
                json.loads(c.execution_result) if c.execution_result else None
            ),
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in commands
    ]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _deep_merge(base: dict, override: dict) -> None:
    for key, value in override.items():
        if key in base and isinstance(base[key], dict) and isinstance(value, dict):
            _deep_merge(base[key], value)
        else:
            base[key] = value
