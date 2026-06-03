from typing import Optional
from pydantic_settings import BaseSettings


class VoiceAgentSettings(BaseSettings):
    # API connection
    api_base_url: str = "http://localhost:8000"
    api_timeout_s: float = 10.0

    # LiveKit
    livekit_url: str = "ws://localhost:7880"
    livekit_api_key: str = "devkey"
    livekit_api_secret: str = "secret"

    # STT
    stt_provider: str = "browser"  # browser | whisper_cpp
    whisper_cpp_url: str = "http://localhost:8178"
    whisper_model: str = "base.en"

    # TTS
    tts_provider: str = "browser"  # browser | piper
    piper_url: str = "http://localhost:5002"
    piper_voice: str = "en_US-lessac-medium"

    # VAD
    vad_provider: str = "browser"  # browser | silero

    # Turn detection
    min_silence_ms: int = 500
    endpoint_delay_ms: int = 200
    barge_in_enabled: bool = False

    # Reply style
    max_reply_tokens: int = 80

    # Wake word
    wake_word_enabled: bool = False
    wake_word_phrase: str = "hey jarvis"
    wake_word_provider: str = "openwakeword"

    class Config:
        env_prefix = "VOICE_"
        env_file = ".env"


settings = VoiceAgentSettings()
