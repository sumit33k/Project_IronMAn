"""Unit tests for VoicePipeline command routing and response building."""
import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

# Patch settings before importing pipeline modules
import sys
sys.path.insert(0, ".")


# ── Fixtures ──────────────────────────────────────────────────────────────────

def make_result(status="completed", intent="create_task", summary="Done.", exec_result=None, confirmation_msg=None):
    return {
        "id": "cmd-test-001",
        "status": status,
        "intent": intent,
        "user_visible_summary": summary,
        "confirmation_message": confirmation_msg,
        "execution_result": exec_result or {},
        "latency_ms": 42,
    }


@pytest.fixture
def mock_pipeline():
    with patch("voice_agent.pipeline.get_stt") as mock_stt, \
         patch("voice_agent.pipeline.get_tts") as mock_tts:

        mock_stt.return_value = MagicMock()
        mock_tts.return_value = MagicMock()

        from voice_agent.pipeline import VoicePipeline
        pipeline = VoicePipeline()
        pipeline.client = AsyncMock()
        pipeline._session_id = "test-session-id"
        return pipeline


# ── build_spoken_response ─────────────────────────────────────────────────────

def test_build_response_completed_with_title(mock_pipeline):
    result = make_result(status="completed", exec_result={"title": "Review contracts"})
    assert "Review contracts" in mock_pipeline.build_spoken_response(result)


def test_build_response_completed_task_done(mock_pipeline):
    result = make_result(status="completed", exec_result={"status": "completed"})
    text = mock_pipeline.build_spoken_response(result)
    assert "completed" in text.lower() or "done" in text.lower()


def test_build_response_completed_count(mock_pipeline):
    result = make_result(status="completed", exec_result={"count": 5})
    assert "5" in mock_pipeline.build_spoken_response(result)


def test_build_response_awaiting_confirmation(mock_pipeline):
    result = make_result(
        status="awaiting_confirmation",
        confirmation_msg="Send email to John?",
    )
    assert "Send email to John?" in mock_pipeline.build_spoken_response(result)


def test_build_response_awaiting_no_message_falls_back_to_summary(mock_pipeline):
    result = make_result(status="awaiting_confirmation", summary="Confirm this action?")
    result["confirmation_message"] = None
    text = mock_pipeline.build_spoken_response(result)
    assert text  # not empty


def test_build_response_failed(mock_pipeline):
    result = make_result(status="failed")
    result["error_message"] = "Task not found"
    text = mock_pipeline.build_spoken_response(result)
    assert "wrong" in text.lower() or "failed" in text.lower() or "Task not found" in text


def test_build_response_fallback_to_summary(mock_pipeline):
    result = make_result(status="completed", summary="Showing today's tasks.", exec_result={})
    text = mock_pipeline.build_spoken_response(result)
    assert text  # non-empty


# ── handle_transcript: direct command ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_handle_transcript_low_risk(mock_pipeline):
    mock_pipeline.client.execute_command.return_value = make_result()
    mock_pipeline.client.add_turn = AsyncMock()

    result = await mock_pipeline.handle_transcript("create task review contracts")
    assert result["status"] == "completed"
    mock_pipeline.client.execute_command.assert_awaited_once()


@pytest.mark.asyncio
async def test_handle_transcript_stores_pending_when_awaiting_confirmation(mock_pipeline):
    pending = make_result(status="awaiting_confirmation")
    mock_pipeline.client.execute_command.return_value = pending
    mock_pipeline.client.add_turn = AsyncMock()

    await mock_pipeline.handle_transcript("draft email to team")
    assert mock_pipeline._pending_command is not None
    assert mock_pipeline._pending_command["id"] == "cmd-test-001"


@pytest.mark.asyncio
async def test_handle_transcript_clears_pending_when_completed(mock_pipeline):
    completed = make_result(status="completed")
    mock_pipeline.client.execute_command.return_value = completed
    mock_pipeline.client.add_turn = AsyncMock()
    mock_pipeline._pending_command = make_result(status="awaiting_confirmation")

    await mock_pipeline.handle_transcript("create task")
    # Old pending was cancelled before new command processed
    mock_pipeline.client.cancel_command.assert_awaited_once()


# ── handle_transcript: voice confirmation flow ────────────────────────────────

@pytest.mark.asyncio
async def test_confirm_words_trigger_confirmation(mock_pipeline):
    pending = make_result(status="awaiting_confirmation")
    mock_pipeline._pending_command = pending
    confirmed = make_result(status="completed")
    mock_pipeline.client.confirm_command.return_value = confirmed
    mock_pipeline.client.add_turn = AsyncMock()

    result = await mock_pipeline.handle_transcript("yes go ahead")
    assert result["status"] == "completed"
    mock_pipeline.client.confirm_command.assert_awaited_once_with("cmd-test-001", "voice")


@pytest.mark.asyncio
async def test_cancel_words_trigger_cancellation(mock_pipeline):
    pending = make_result(status="awaiting_confirmation")
    mock_pipeline._pending_command = pending
    mock_pipeline.client.cancel_command.return_value = {"status": "cancelled"}
    mock_pipeline.client.add_turn = AsyncMock()

    result = await mock_pipeline.handle_transcript("cancel that")
    mock_pipeline.client.cancel_command.assert_awaited_once_with("cmd-test-001")
    assert mock_pipeline._pending_command is None


# ── Interruption controller ───────────────────────────────────────────────────

def test_interruption_controller_lifecycle(mock_pipeline):
    ctrl = mock_pipeline.interruption
    assert not ctrl.is_interrupted()

    ctrl.interrupt()
    assert ctrl.is_interrupted()

    ctrl.reset()
    assert not ctrl.is_interrupted()


def test_interruption_cancels_tts_task(mock_pipeline):
    import asyncio

    ctrl = mock_pipeline.interruption
    task = MagicMock(spec=asyncio.Task)
    task.done.return_value = False

    ctrl.register_tts_task(task)
    ctrl.interrupt()

    task.cancel.assert_called_once()


# ── STT adapters ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_browser_stt_returns_empty(mock_pipeline):
    from voice_agent.stt import BrowserSTTPlaceholder
    stt = BrowserSTTPlaceholder()
    result = await stt.transcribe(b"audio data")
    assert result.text == ""
    assert result.provider == "browser"


@pytest.mark.asyncio
async def test_whisper_cpp_stt_sends_request():
    from voice_agent.stt import WhisperCppSTT
    stt = WhisperCppSTT()
    with patch("voice_agent.stt.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=None)
        mock_client.post.return_value = MagicMock(
            json=lambda: {"text": "hello world"},
            raise_for_status=lambda: None,
        )
        result = await stt.transcribe(b"raw audio bytes")
    assert result.text == "hello world"
    assert result.provider == "whisper_cpp"


# ── TTS adapters ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_browser_tts_returns_empty_bytes(mock_pipeline):
    from voice_agent.tts import BrowserTTSPlaceholder
    tts = BrowserTTSPlaceholder()
    result = await tts.synthesize("hello")
    assert result.audio_bytes == b""
    assert result.provider == "browser"


@pytest.mark.asyncio
async def test_piper_tts_sends_request():
    from voice_agent.tts import PiperTTS
    tts = PiperTTS()
    with patch("voice_agent.tts.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=None)
        mock_client.post.return_value = MagicMock(
            content=b"audio data",
            raise_for_status=lambda: None,
        )
        result = await tts.synthesize("hello world")
    assert result.audio_bytes == b"audio data"
    assert result.provider == "piper"


# ── Wake word ─────────────────────────────────────────────────────────────────

def test_wake_word_disabled_never_triggers():
    from voice_agent.wake_word import WakeWordDisabled
    detector = WakeWordDisabled()
    assert not detector.available
    assert not detector.process_frame(b"noise")


def test_wake_word_get_detector_returns_disabled_by_default():
    from voice_agent.wake_word import get_wake_word_detector, WakeWordDisabled
    with patch("voice_agent.wake_word.settings") as mock_settings:
        mock_settings.wake_word_enabled = False
        detector = get_wake_word_detector()
    assert isinstance(detector, WakeWordDisabled)
