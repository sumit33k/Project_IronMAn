"""Persist VoiceConfig as a single JSON blob in AppSettings."""
import json
from sqlalchemy.orm import Session
from app.db.models import AppSettings
from app.schemas.voice_config import VoiceConfig

_SETTINGS_KEY = "voice_config_v2"

# Old browser defaults — any record still on these gets migrated to local services
_BROWSER_STT = "browser"
_BROWSER_TTS = "browser"


def load(db: Session) -> VoiceConfig:
    row = db.get(AppSettings, _SETTINGS_KEY)
    if not row:
        return VoiceConfig()
    try:
        cfg = VoiceConfig.model_validate(json.loads(row.value))
    except Exception:
        return VoiceConfig()

    # Migrate existing records that are still on the old browser defaults
    changed = False
    if cfg.stt.provider == _BROWSER_STT:
        cfg.stt.provider = "whisper_cpp"
        cfg.stt.base_url = cfg.stt.base_url or "http://localhost:8178"
        changed = True
    if cfg.tts.provider == _BROWSER_TTS:
        cfg.tts.provider = "piper"
        cfg.tts.base_url = cfg.tts.base_url or "http://localhost:5002"
        changed = True
    if changed:
        save(cfg, db)

    return cfg


def save(config: VoiceConfig, db: Session) -> VoiceConfig:
    row = db.get(AppSettings, _SETTINGS_KEY)
    serialized = config.model_dump_json()
    if row:
        row.value = serialized
    else:
        db.add(AppSettings(key=_SETTINGS_KEY, value=serialized))
    db.commit()
    return config
