from typing import Optional
from pydantic import BaseModel


class TransportConfig(BaseModel):
    provider: str = "browser"  # browser | livekit_local
    enabled: bool = False
    base_url: Optional[str] = None


class STTConfig(BaseModel):
    provider: str = "whisper_cpp"  # whisper_cpp | browser | groq | deepgram
    base_url: Optional[str] = "http://localhost:8178"


class TTSConfig(BaseModel):
    provider: str = "piper"  # piper | browser
    base_url: Optional[str] = "http://localhost:5002"
    voice: str = "en_US-lessac-medium"


class VADConfig(BaseModel):
    provider: str = "browser"  # browser | silero


class TurnDetectionConfig(BaseModel):
    provider: str = "vad_endpointing"  # vad_endpointing | livekit_multilingual
    fallback: str = "vad_endpointing"
    min_silence_ms: int = 500
    endpoint_delay_ms: int = 200


class WakeWordConfig(BaseModel):
    provider: str = "openwakeword"
    enabled: bool = False
    phrase: str = "hey jarvis"


class LLMConfig(BaseModel):
    provider: str = "ollama"
    model: str = "llama3.1"
    base_url: Optional[str] = None


class ReplyStyleConfig(BaseModel):
    max_tokens: int = 80
    voice_first: bool = True
    barge_in_enabled: bool = False


class VoiceConfig(BaseModel):
    transport: TransportConfig = TransportConfig()
    stt: STTConfig = STTConfig()
    tts: TTSConfig = TTSConfig()
    vad: VADConfig = VADConfig()
    turn_detection: TurnDetectionConfig = TurnDetectionConfig()
    wake_word: WakeWordConfig = WakeWordConfig()
    llm: LLMConfig = LLMConfig()
    reply_style: ReplyStyleConfig = ReplyStyleConfig()


class ProviderStatus(BaseModel):
    name: str
    status: str  # available | unavailable | disabled | unconfigured
    message: Optional[str] = None
    url: Optional[str] = None


class ProvidersHealth(BaseModel):
    livekit: ProviderStatus
    whisper_cpp: ProviderStatus
    piper: ProviderStatus
    ollama: ProviderStatus
    browser_stt: ProviderStatus
    wake_word: ProviderStatus
    overall: str  # ok | degraded | minimal
