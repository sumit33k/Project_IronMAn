"""TTS abstraction — wraps Piper HTTP server (or browser fallback)."""
import time
import httpx
from voice_agent.config import settings


class TTSResult:
    def __init__(self, audio_bytes: bytes, latency_ms: int, provider: str):
        self.audio_bytes = audio_bytes
        self.latency_ms = latency_ms
        self.provider = provider


class PiperTTS:
    def __init__(self):
        self.url = settings.piper_url
        self.voice = settings.piper_voice

    async def synthesize(self, text: str) -> TTSResult:
        start = int(time.time() * 1000)
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{self.url}/api/tts",
                json={"text": text, "voice": self.voice},
            )
            resp.raise_for_status()
        latency = int(time.time() * 1000) - start
        return TTSResult(audio_bytes=resp.content, latency_ms=latency, provider="piper")


class BrowserTTSPlaceholder:
    """Browser TTS is handled client-side; server returns text for the client to speak."""

    async def synthesize(self, text: str) -> TTSResult:
        return TTSResult(audio_bytes=b"", latency_ms=0, provider="browser")


def get_tts():
    if settings.tts_provider == "piper":
        return PiperTTS()
    return BrowserTTSPlaceholder()
