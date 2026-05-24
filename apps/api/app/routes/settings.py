import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.db.models import AppSettings

router = APIRouter(prefix="/settings", tags=["settings"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


DEFAULT_SETTINGS = {
    "ollama_base_url": "http://localhost:11434",
    "ollama_model": "llama3.1",
    "wake_phrase": "hey jarvis",
    "voice_enabled": False,
    "tts_enabled": False,
    "user_name": "Sumit",
    "theme": "dark",
    "approval_policy": "always_for_risky",
    "cloud_provider_enabled": False,
    "cloud_provider": "none",
    "cloud_api_key": "",
    "cloud_model": "",
    "data_sharing_acknowledged": False,
}


@router.get("")
def get_settings(db: Session = Depends(get_db)):
    result = dict(DEFAULT_SETTINGS)
    rows = db.query(AppSettings).all()
    for row in rows:
        try:
            result[row.key] = json.loads(row.value)
        except Exception:
            result[row.key] = row.value
    return result


@router.patch("")
def update_settings(payload: dict, db: Session = Depends(get_db)):
    for key, value in payload.items():
        existing = db.get(AppSettings, key)
        if existing:
            existing.value = json.dumps(value)
        else:
            db.add(AppSettings(key=key, value=json.dumps(value)))
    db.commit()
    return get_settings(db)
