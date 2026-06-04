"""
VoiceSessionManager — coordinates VoiceSession + VoiceTurn DB lifecycle
across a full voice interaction.

Typical call sequence per turn:
  manager = VoiceSessionManager(db)
  session = manager.get_or_create(session_id)          # once per session
  manager.set_status(session.id, "transcribing")
  user_turn = manager.record_user_turn(session.id, transcript, command_id=cmd.id)
  manager.set_status(session.id, "speaking")
  asst_turn = manager.record_assistant_turn(session.id, spoken_response, command_id=cmd.id)
  # ... repeat for each exchange ...
  manager.end(session.id)                              # when session ends
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.db.models import VoiceSession, VoiceTurn

VALID_STATUSES = {
    "created", "connecting", "listening", "transcribing",
    "routing", "executing", "speaking", "ended", "error",
}


class VoiceSessionManager:
    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------
    # Session lifecycle
    # ------------------------------------------------------------------

    def start(
        self,
        stt_provider: str = "browser",
        tts_provider: str = "browser",
        transport_provider: str = "browser",
        session_id: Optional[str] = None,
    ) -> VoiceSession:
        session = VoiceSession(
            id=session_id or str(uuid.uuid4()),
            status="listening",
            stt_provider=stt_provider,
            tts_provider=tts_provider,
            transport_provider=transport_provider,
            turn_count=0,
            command_count=0,
            started_at=datetime.now(timezone.utc),
            created_at=datetime.now(timezone.utc),
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def get_or_create(
        self,
        session_id: Optional[str],
        stt_provider: str = "browser",
        tts_provider: str = "browser",
    ) -> VoiceSession:
        """Return an existing session or create one."""
        if session_id:
            existing = self.db.get(VoiceSession, session_id)
            if existing:
                return existing
        return self.start(
            stt_provider=stt_provider,
            tts_provider=tts_provider,
            session_id=session_id,
        )

    def set_status(self, session_id: str, status: str) -> None:
        if status not in VALID_STATUSES:
            return
        session = self.db.get(VoiceSession, session_id)
        if session:
            session.status = status
            self.db.commit()

    def end(self, session_id: str) -> VoiceSession:
        session = self.db.get(VoiceSession, session_id)
        if not session:
            raise ValueError(f"Voice session {session_id} not found")
        session.status = "ended"
        session.ended_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(session)
        return session

    # ------------------------------------------------------------------
    # Turn logging
    # ------------------------------------------------------------------

    def record_user_turn(
        self,
        session_id: str,
        transcript: str,
        command_id: Optional[str] = None,
        stt_latency_ms: Optional[int] = None,
    ) -> VoiceTurn:
        session = self.db.get(VoiceSession, session_id)
        if not session:
            raise ValueError(f"Voice session {session_id} not found")

        turn = VoiceTurn(
            id=str(uuid.uuid4()),
            session_id=session_id,
            turn_number=session.turn_count + 1,
            role="user",
            transcript=transcript,
            command_id=command_id,
            stt_latency_ms=stt_latency_ms,
            created_at=datetime.now(timezone.utc),
        )
        self.db.add(turn)
        session.turn_count += 1
        if command_id:
            session.command_count += 1
        session.status = "routing"
        self.db.commit()
        self.db.refresh(turn)
        return turn

    def record_assistant_turn(
        self,
        session_id: str,
        spoken_response: str,
        command_id: Optional[str] = None,
        llm_latency_ms: Optional[int] = None,
        tts_latency_ms: Optional[int] = None,
        total_latency_ms: Optional[int] = None,
    ) -> VoiceTurn:
        session = self.db.get(VoiceSession, session_id)
        if not session:
            raise ValueError(f"Voice session {session_id} not found")

        turn = VoiceTurn(
            id=str(uuid.uuid4()),
            session_id=session_id,
            turn_number=session.turn_count + 1,
            role="assistant",
            transcript=spoken_response,
            command_id=command_id,
            llm_latency_ms=llm_latency_ms,
            tts_latency_ms=tts_latency_ms,
            total_latency_ms=total_latency_ms,
            created_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
        )
        self.db.add(turn)
        session.turn_count += 1
        session.status = "speaking"
        self.db.commit()
        self.db.refresh(turn)
        return turn

    def complete_turn(self, turn_id: str, total_latency_ms: Optional[int] = None) -> None:
        """Mark a turn as completed (used when TTS finishes)."""
        turn = self.db.get(VoiceTurn, turn_id)
        if turn:
            turn.completed_at = datetime.now(timezone.utc)
            if total_latency_ms is not None:
                turn.total_latency_ms = total_latency_ms
            self.db.commit()
