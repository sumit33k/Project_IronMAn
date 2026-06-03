"""
Barge-in / interruption handling (Phase 7).

When VAD detects user speech while TTS is playing, this module
signals the pipeline to stop the current TTS stream and begin
processing the new user utterance.
"""
import asyncio


class InterruptionController:
    def __init__(self):
        self._interrupted = asyncio.Event()
        self._tts_task: asyncio.Task | None = None

    def register_tts_task(self, task: asyncio.Task) -> None:
        self._tts_task = task
        self._interrupted.clear()

    def interrupt(self) -> None:
        """Call when VAD detects user speech during TTS playback."""
        self._interrupted.set()
        if self._tts_task and not self._tts_task.done():
            self._tts_task.cancel()

    def is_interrupted(self) -> bool:
        return self._interrupted.is_set()

    def reset(self) -> None:
        self._interrupted.clear()
        self._tts_task = None
