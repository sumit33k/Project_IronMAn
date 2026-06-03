"""HTTP client to the main IronMan FastAPI backend."""
import httpx
from voice_agent.config import settings


class CommandClient:
    def __init__(self):
        self.base = settings.api_base_url
        self.timeout = settings.api_timeout_s

    async def execute_command(
        self, transcript: str, voice_session_id: str | None = None
    ) -> dict:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base}/commands/execute",
                json={
                    "raw_input": transcript,
                    "input_mode": "voice",
                    "context": {},
                    "voice_session_id": voice_session_id,
                },
            )
            resp.raise_for_status()
            return resp.json()

    async def confirm_command(
        self, command_id: str, confirmation_method: str = "voice"
    ) -> dict:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base}/commands/{command_id}/confirm",
                json={"confirmation_method": confirmation_method},
            )
            resp.raise_for_status()
            return resp.json()

    async def cancel_command(self, command_id: str) -> dict:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(f"{self.base}/commands/{command_id}/cancel")
            resp.raise_for_status()
            return resp.json()

    async def create_session(
        self,
        stt_provider: str,
        tts_provider: str,
        transport_provider: str,
    ) -> dict:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base}/voice/sessions",
                json={
                    "stt_provider": stt_provider,
                    "tts_provider": tts_provider,
                    "transport_provider": transport_provider,
                },
            )
            resp.raise_for_status()
            return resp.json()

    async def add_turn(self, session_id: str, turn: dict) -> dict:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base}/voice/sessions/{session_id}/turns",
                json=turn,
            )
            resp.raise_for_status()
            return resp.json()

    async def end_session(self, session_id: str) -> dict:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.delete(f"{self.base}/voice/sessions/{session_id}")
            resp.raise_for_status()
            return resp.json()
