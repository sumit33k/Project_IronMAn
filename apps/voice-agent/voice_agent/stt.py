"""STT abstraction — wraps whisper.cpp HTTP server (or browser fallback)."""
import time
import httpx
from voice_agent.config import settings


class STTResult:
    def __init__(self, text: str, latency_ms: int, provider: str):
        self.text = text
        self.latency_ms = latency_ms
        self.provider = provider


class WhisperCppSTT:
    def __init__(self):
        self.url = settings.whisper_cpp_url

    async def transcribe(self, audio_bytes: bytes, content_type: str = "audio/webm") -> STTResult:
        start = int(time.time() * 1000)
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{self.url}/inference",
                files={"file": ("audio.webm", audio_bytes, content_type)},
            )
            resp.raise_for_status()
        latency = int(time.time() * 1000) - start
        text = resp.json().get("text", "").strip()
        return STTResult(text=text, latency_ms=latency, provider="whisper_cpp")


class BrowserSTTPlaceholder:
    """Browser STT is handled client-side; this is a no-op server-side."""

    async def transcribe(self, audio_bytes: bytes, content_type: str = "audio/webm") -> STTResult:
        return STTResult(text="", latency_ms=0, provider="browser")


def get_stt():
    if settings.stt_provider == "whisper_cpp":
        return WhisperCppSTT()
    return BrowserSTTPlaceholder()
