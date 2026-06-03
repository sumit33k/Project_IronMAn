"""Persist VoiceConfig as a single JSON blob in AppSettings."""
import json
from sqlalchemy.orm import Session
from app.db.models import AppSettings
from app.schemas.voice_config import VoiceConfig

_SETTINGS_KEY = "voice_config_v2"


def load(db: Session) -> VoiceConfig:
    row = db.get(AppSettings, _SETTINGS_KEY)
    if not row:
        return VoiceConfig()
    try:
        return VoiceConfig.model_validate(json.loads(row.value))
    except Exception:
        return VoiceConfig()


def save(config: VoiceConfig, db: Session) -> VoiceConfig:
    row = db.get(AppSettings, _SETTINGS_KEY)
    serialized = config.model_dump_json()
    if row:
        row.value = serialized
    else:
        db.add(AppSettings(key=_SETTINGS_KEY, value=serialized))
    db.commit()
    return config
