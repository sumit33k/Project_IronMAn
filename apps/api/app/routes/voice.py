import json
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session
import httpx
from app.core.config import settings
from app.db.database import SessionLocal
from app.db.models import AppSettings, Command
from app.services.command_router import CommandRouter

router = APIRouter(prefix="/voice", tags=["voice"])

VOICE_DEFAULTS = {
    "wake_phrase": "hey jarvis",
    "push_to_talk_enabled": True,
    "wake_word_enabled": False,
    "tts_enabled": False,
    "stt_provider": "browser",  # options: "browser" | "groq" | "deepgram"
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
    tts_enabled: bool = False
    stt_provider: str = "browser"


class VoiceCommand(BaseModel):
    transcript: str
    auto_execute: bool = False


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


@router.post("/transcribe")
async def transcribe_audio(audio: UploadFile = File(...), db: Session = Depends(get_db)):
    voice_settings = _load_voice_settings(db)
    provider = voice_settings.get("stt_provider", "browser")

    if provider == "groq":
        if not settings.groq_api_key:
            raise HTTPException(status_code=400, detail="GROQ_API_KEY not configured. Add it to .env and set stt_provider=groq in voice settings.")
        audio_bytes = await audio.read()
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                files={"file": (audio.filename or "audio.webm", audio_bytes, audio.content_type or "audio/webm")},
                data={"model": "whisper-large-v3-turbo", "language": "en", "response_format": "json"},
            )
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Groq transcription failed: {resp.text}")
        return {"transcript": resp.json().get("text", ""), "confidence": 1.0, "provider": "groq"}

    if provider == "deepgram":
        raise HTTPException(status_code=501, detail="Deepgram provider: set DEEPGRAM_API_KEY and update voice route.")

    # Default: tell the frontend to use the browser Web Speech API
    return {
        "transcript": "",
        "confidence": 0.0,
        "provider": "browser",
        "note": "Set stt_provider=groq in voice settings for server-side transcription.",
    }


@router.post("/process")
async def process_voice_command(cmd: VoiceCommand):
    db = SessionLocal()
    try:
        router_svc = CommandRouter()
        result = await router_svc.route(cmd.transcript)
        result["transcript"] = cmd.transcript
        result["auto_executed"] = False
        return result
    except Exception as e:
        return {"error": str(e), "transcript": cmd.transcript}
    finally:
        db.close()


@router.get("/history")
def get_voice_history(limit: int = 20, db: Session = Depends(get_db)):
    commands = db.scalars(
        select(Command).order_by(Command.created_at.desc()).limit(limit)
    ).all()
    return [
        {
            "id": c.id,
            "text": c.raw_input,
            "routing_result": json.loads(c.payload) if c.payload else {},
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in commands
    ]
