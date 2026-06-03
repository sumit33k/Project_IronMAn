"""
Phase 5: Voice session lifecycle APIs.
Sessions track every voice interaction end-to-end with per-turn latency.
"""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.db.models import VoiceSession, VoiceTurn

router = APIRouter(prefix="/voice/sessions", tags=["voice-sessions"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class SessionCreate(BaseModel):
    stt_provider: str = "browser"
    tts_provider: str = "browser"
    transport_provider: str = "browser"


class SessionUpdate(BaseModel):
    status: str | None = None
    error_message: str | None = None


class TurnCreate(BaseModel):
    role: str = "user"  # user | assistant
    transcript: str | None = None
    partial_transcript: str | None = None
    command_id: str | None = None
    stt_latency_ms: int | None = None
    llm_latency_ms: int | None = None
    tts_latency_ms: int | None = None
    total_latency_ms: int | None = None
    interrupted: bool = False


VALID_STATUSES = {
    "created", "connecting", "listening", "transcribing",
    "routing", "executing", "speaking", "ended", "error",
}


def _session_to_dict(s: VoiceSession, include_turns: bool = False) -> dict:
    d = {
        "id": s.id,
        "status": s.status,
        "stt_provider": s.stt_provider,
        "tts_provider": s.tts_provider,
        "transport_provider": s.transport_provider,
        "turn_count": s.turn_count,
        "command_count": s.command_count,
        "error_message": s.error_message,
        "started_at": s.started_at.isoformat() if s.started_at else None,
        "ended_at": s.ended_at.isoformat() if s.ended_at else None,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }
    if include_turns:
        d["turns"] = [_turn_to_dict(t) for t in (s.turns or [])]
    return d


def _turn_to_dict(t: VoiceTurn) -> dict:
    return {
        "id": t.id,
        "session_id": t.session_id,
        "turn_number": t.turn_number,
        "role": t.role,
        "transcript": t.transcript,
        "partial_transcript": t.partial_transcript,
        "command_id": t.command_id,
        "stt_latency_ms": t.stt_latency_ms,
        "llm_latency_ms": t.llm_latency_ms,
        "tts_latency_ms": t.tts_latency_ms,
        "total_latency_ms": t.total_latency_ms,
        "interrupted": t.interrupted,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "completed_at": t.completed_at.isoformat() if t.completed_at else None,
    }


@router.get("", response_model=list[dict])
def list_sessions(limit: int = 20, db: Session = Depends(get_db)):
    sessions = db.scalars(
        select(VoiceSession).order_by(VoiceSession.created_at.desc()).limit(limit)
    ).all()
    return [_session_to_dict(s) for s in sessions]


@router.post("", response_model=dict)
def create_session(payload: SessionCreate, db: Session = Depends(get_db)):
    session = VoiceSession(
        id=str(uuid.uuid4()),
        status="created",
        stt_provider=payload.stt_provider,
        tts_provider=payload.tts_provider,
        transport_provider=payload.transport_provider,
        started_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return _session_to_dict(session)


@router.get("/{session_id}", response_model=dict)
def get_session(session_id: str, db: Session = Depends(get_db)):
    session = db.get(VoiceSession, session_id)
    if not session:
        raise HTTPException(404, "Voice session not found")
    return _session_to_dict(session, include_turns=True)


@router.patch("/{session_id}", response_model=dict)
def update_session(session_id: str, payload: SessionUpdate, db: Session = Depends(get_db)):
    session = db.get(VoiceSession, session_id)
    if not session:
        raise HTTPException(404, "Voice session not found")
    if payload.status:
        if payload.status not in VALID_STATUSES:
            raise HTTPException(400, f"Invalid status '{payload.status}'")
        session.status = payload.status
        if payload.status == "ended":
            session.ended_at = datetime.now(timezone.utc)
    if payload.error_message is not None:
        session.error_message = payload.error_message
        session.status = "error"
    db.commit()
    db.refresh(session)
    return _session_to_dict(session)


@router.delete("/{session_id}", response_model=dict)
def end_session(session_id: str, db: Session = Depends(get_db)):
    session = db.get(VoiceSession, session_id)
    if not session:
        raise HTTPException(404, "Voice session not found")
    session.status = "ended"
    session.ended_at = datetime.now(timezone.utc)
    db.commit()
    return {"id": session_id, "status": "ended"}


@router.post("/{session_id}/turns", response_model=dict)
def add_turn(session_id: str, payload: TurnCreate, db: Session = Depends(get_db)):
    session = db.get(VoiceSession, session_id)
    if not session:
        raise HTTPException(404, "Voice session not found")

    turn = VoiceTurn(
        id=str(uuid.uuid4()),
        session_id=session_id,
        turn_number=session.turn_count + 1,
        role=payload.role,
        transcript=payload.transcript,
        partial_transcript=payload.partial_transcript,
        command_id=payload.command_id,
        stt_latency_ms=payload.stt_latency_ms,
        llm_latency_ms=payload.llm_latency_ms,
        tts_latency_ms=payload.tts_latency_ms,
        total_latency_ms=payload.total_latency_ms,
        interrupted=payload.interrupted,
        created_at=datetime.now(timezone.utc),
    )
    db.add(turn)

    session.turn_count += 1
    if payload.command_id:
        session.command_count += 1

    db.commit()
    db.refresh(turn)
    return _turn_to_dict(turn)
