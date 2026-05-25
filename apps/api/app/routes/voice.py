import json
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.db.models import Command
from app.services.command_router import CommandRouter

router = APIRouter(prefix="/voice", tags=["voice"])


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


_voice_settings = VoiceSettings()


@router.get("/settings")
def get_voice_settings():
    return _voice_settings.model_dump()


@router.patch("/settings")
def update_voice_settings(payload: dict):
    global _voice_settings
    data = _voice_settings.model_dump()
    data.update(payload)
    _voice_settings = VoiceSettings(**data)
    return _voice_settings.model_dump()


@router.post("/transcribe")
async def transcribe_audio():
    return {
        "transcript": "",
        "confidence": 0.0,
        "provider": "browser",
        "note": "Use browser Web Speech API for transcription in MVP"
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
