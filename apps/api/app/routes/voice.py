from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/voice", tags=["voice"])


class VoiceSettings(BaseModel):
    wake_phrase: str = "hey jarvis"
    push_to_talk_enabled: bool = True
    wake_word_enabled: bool = False
    tts_enabled: bool = False
    stt_provider: str = "browser"


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
