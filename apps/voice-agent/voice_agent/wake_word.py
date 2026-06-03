"""
Wake word detection (Phase 8).

Uses openWakeWord (https://github.com/dscripka/openWakeWord) to detect
a configurable trigger phrase before activating the microphone pipeline.

Disabled by default — requires explicit user opt-in via voice config:
  PATCH /voice/config  { "wake_word": { "enabled": true } }

Requirements (optional dependency):
  pip install 'ironman-voice-agent[wake-word]'
  # Model downloaded automatically by openWakeWord on first run
"""
import asyncio
import logging
from voice_agent.config import settings

logger = logging.getLogger(__name__)


class WakeWordDetector:
    """Listens for a wake phrase on a raw PCM audio stream.

    Usage:
        detector = WakeWordDetector()
        await detector.load()
        async for frame in audio_frames:
            if detector.process_frame(frame):
                # Wake word triggered!
                break
    """

    def __init__(self, phrase: str = "hey jarvis", threshold: float = 0.5):
        self.phrase = phrase
        self.threshold = threshold
        self._model = None

    async def load(self) -> None:
        """Load the openWakeWord model (downloads on first run)."""
        try:
            import openwakeword  # type: ignore
            from openwakeword.model import Model  # type: ignore

            logger.info("Loading openWakeWord model for phrase: %r", self.phrase)
            self._model = Model(wakeword_models=["hey_jarvis"], inference_framework="onnx")
            logger.info("openWakeWord model loaded")
        except ImportError:
            logger.warning(
                "openWakeWord not installed. "
                "Install with: pip install 'ironman-voice-agent[wake-word]'"
            )
            self._model = None

    def process_frame(self, audio_bytes: bytes) -> bool:
        """Return True if the wake word was detected in this audio frame.

        audio_bytes: raw PCM int16 at 16 kHz mono
        """
        if self._model is None:
            return False
        try:
            import numpy as np  # type: ignore

            samples = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
            predictions = self._model.predict(samples)
            score = max(predictions.values(), default=0.0)
            if score >= self.threshold:
                logger.info("Wake word detected (score=%.3f)", score)
                return True
        except Exception as exc:
            logger.debug("Wake word inference error: %s", exc)
        return False

    @property
    def available(self) -> bool:
        return self._model is not None


class WakeWordDisabled:
    """No-op detector used when wake word is disabled in config."""

    async def load(self) -> None:
        pass

    def process_frame(self, audio_bytes: bytes) -> bool:
        return False

    @property
    def available(self) -> bool:
        return False


def get_wake_word_detector():
    """Return the appropriate detector based on config."""
    if settings.wake_word_enabled:
        return WakeWordDetector(
            phrase=settings.wake_word_phrase,
        )
    return WakeWordDisabled()
