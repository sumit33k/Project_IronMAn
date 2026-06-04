import asyncio
import httpx
from app.schemas.voice_config import ProvidersHealth, ProviderStatus, VoiceConfig

_WAKE_WORD_HOST = "localhost"
_WAKE_WORD_PORT = 10400  # Wyoming protocol TCP port for openWakeWord


async def check_providers(config: VoiceConfig) -> ProvidersHealth:
    livekit_url = config.transport.base_url or "http://localhost:7880"
    whisper_url = config.stt.base_url or "http://localhost:8178"
    piper_url = config.tts.base_url or "http://localhost:5002"
    ollama_url = config.llm.base_url or "http://localhost:11434"

    livekit = await _check_http("livekit", livekit_url, enabled=config.transport.enabled)
    whisper_cpp = await _check_http(
        "whisper_cpp", whisper_url, enabled=config.stt.provider == "whisper_cpp"
    )
    piper = await _check_http("piper", piper_url, enabled=config.tts.provider == "piper")
    ollama = await _check_http("ollama", ollama_url, enabled=True)

    browser_stt = ProviderStatus(
        name="browser_stt",
        status="available",
        message="Web Speech API — Chrome/Edge only",
    )

    if config.wake_word.enabled:
        wake_word_up = await _check_tcp(_WAKE_WORD_HOST, _WAKE_WORD_PORT)
        wake_word = ProviderStatus(
            name="wake_word",
            status="available" if wake_word_up else "unavailable",
            url=f"tcp://{_WAKE_WORD_HOST}:{_WAKE_WORD_PORT}",
            message=(
                "openWakeWord running"
                if wake_word_up
                else (
                    "Not running — start with: "
                    "docker compose -f infra/docker-compose.voice.yml up openwakeword"
                )
            ),
        )
    else:
        wake_word = ProviderStatus(
            name="wake_word",
            status="disabled",
            message="Enable in Settings → Voice → Always-on wake word.",
        )

    statuses = [livekit.status, whisper_cpp.status, piper.status, ollama.status]
    if ollama.status == "available" and all(
        s in ("available", "disabled") for s in statuses
    ):
        overall = "ok"
    elif any(s == "available" for s in statuses):
        overall = "degraded"
    else:
        overall = "minimal"

    return ProvidersHealth(
        livekit=livekit,
        whisper_cpp=whisper_cpp,
        piper=piper,
        ollama=ollama,
        browser_stt=browser_stt,
        wake_word=wake_word,
        overall=overall,
    )


async def _check_http(name: str, url: str, enabled: bool = True) -> ProviderStatus:
    if not enabled:
        return ProviderStatus(name=name, status="disabled", url=url)
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(url)
        if resp.status_code < 500:
            return ProviderStatus(name=name, status="available", url=url)
        return ProviderStatus(
            name=name, status="unavailable", message=f"HTTP {resp.status_code}", url=url
        )
    except Exception as exc:
        return ProviderStatus(
            name=name, status="unavailable", message=str(exc)[:100], url=url
        )


async def _check_tcp(host: str, port: int, timeout: float = 1.5) -> bool:
    """Return True if a TCP connection to host:port succeeds within timeout."""
    try:
        _, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port),
            timeout=timeout,
        )
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass
        return True
    except Exception:
        return False
