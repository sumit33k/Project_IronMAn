"""
VoicePipeline — the main coordination class for the voice agent.

Lifecycle per turn:
  1. Wait for user speech (VAD)
  2. Transcribe (STT)
  3. Execute command via CommandClient
  4. Speak response (TTS)
  5. Handle barge-in / interruption

Production path: LiveKit transport + whisper.cpp + Piper + Silero VAD
Debug fallback:  Browser transport (push-to-talk, no server-side audio)
"""
import asyncio
import logging
from voice_agent.command_client import CommandClient
from voice_agent.interruption import InterruptionController
from voice_agent.stt import get_stt
from voice_agent.tts import get_tts
from voice_agent.config import settings

logger = logging.getLogger(__name__)

CONFIRM_WORDS = {"yes", "confirm", "execute", "execute it", "do it", "go ahead", "proceed"}
CANCEL_WORDS = {"cancel", "no", "stop", "nevermind", "abort"}


class VoicePipeline:
    def __init__(self):
        self.stt = get_stt()
        self.tts = get_tts()
        self.client = CommandClient()
        self.interruption = InterruptionController()
        self._pending_command: dict | None = None
        self._session_id: str | None = None

    async def start_session(self) -> str:
        session = await self.client.create_session(
            stt_provider=settings.stt_provider,
            tts_provider=settings.tts_provider,
            transport_provider="livekit" if settings.livekit_url else "browser",
        )
        self._session_id = session["id"]
        logger.info("Voice session started: %s", self._session_id)
        return self._session_id

    async def end_session(self) -> None:
        if self._session_id:
            await self.client.end_session(self._session_id)
            logger.info("Voice session ended: %s", self._session_id)
            self._session_id = None

    async def handle_transcript(self, transcript: str) -> dict:
        """Process a final transcript. Returns the command execution result."""
        lower = transcript.strip().lower()

        # Handle voice confirmation/cancellation for pending commands
        if self._pending_command:
            if any(w in lower for w in CONFIRM_WORDS):
                return await self._confirm_pending("voice")
            if any(w in lower for w in CANCEL_WORDS):
                return await self._cancel_pending("voice")
            # New command — cancel the old one
            await self._cancel_pending("auto")

        result = await self.client.execute_command(
            transcript, voice_session_id=self._session_id
        )

        if result.get("status") == "awaiting_confirmation":
            self._pending_command = result
            logger.info("Command awaiting confirmation: %s", result.get("id"))
        else:
            self._pending_command = None

        await self._log_turn(transcript, result)
        return result

    async def _confirm_pending(self, method: str) -> dict:
        if not self._pending_command:
            return {"status": "error", "message": "No pending command to confirm"}
        cmd_id = self._pending_command["id"]
        result = await self.client.confirm_command(cmd_id, method)
        self._pending_command = None
        await self._log_turn(f"[{method} confirm]", result)
        return result

    async def _cancel_pending(self, method: str) -> dict:
        if not self._pending_command:
            return {"status": "cancelled"}
        cmd_id = self._pending_command["id"]
        result = await self.client.cancel_command(cmd_id)
        self._pending_command = None
        return result

    async def _log_turn(self, transcript: str, result: dict) -> None:
        if not self._session_id:
            return
        try:
            await self.client.add_turn(self._session_id, {
                "role": "user",
                "transcript": transcript,
                "command_id": result.get("id"),
                "total_latency_ms": result.get("latency_ms"),
            })
        except Exception as exc:
            logger.warning("Failed to log turn: %s", exc)

    def build_spoken_response(self, result: dict) -> str:
        """Convert a command result to a short, speech-safe string."""
        status = result.get("status", "")
        exec_result = result.get("execution_result") or {}

        if status == "awaiting_confirmation":
            return result.get("confirmation_message") or result.get("user_visible_summary") or "Confirm?"

        if status == "failed":
            return result.get("error_message") or "Something went wrong."

        if status == "completed":
            if exec_result.get("title"):
                return f"Done. Created task: {exec_result['title']}"
            if exec_result.get("status") == "completed":
                return f"Task completed."
            if exec_result.get("count") is not None:
                return f"Found {exec_result['count']} tasks today."
            return result.get("user_visible_summary") or "Done."

        return result.get("user_visible_summary") or "Got it."
