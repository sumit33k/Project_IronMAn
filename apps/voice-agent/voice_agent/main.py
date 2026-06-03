"""
Voice agent entry point.

Production mode (--transport livekit):
  Connects to LiveKit room, runs VAD → STT → command pipeline → TTS loop.
  Requires: LiveKit server, whisper.cpp, Piper running locally.
  Start infra: docker compose -f infra/docker-compose.voice.yml up

Debug mode (--transport browser, default):
  Receives transcripts via HTTP from the frontend push-to-talk page.
  No audio processing server-side — browser handles STT/TTS.
"""
import argparse
import asyncio
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("voice-agent")

# Chunk constants for TTS audio publication
_TTS_SAMPLE_RATE = 24_000
_TTS_CHANNELS = 1
_TTS_CHUNK_MS = 40  # publish in 40ms frames


def main() -> None:
    parser = argparse.ArgumentParser(description="IronMan Voice Agent")
    parser.add_argument(
        "--transport",
        choices=["browser", "livekit"],
        default="browser",
        help="Transport mode (default: browser)",
    )
    parser.add_argument("--room", default="ironman-voice", help="LiveKit room name")
    args = parser.parse_args()

    if args.transport == "livekit":
        asyncio.run(_run_livekit(args.room))
    else:
        logger.info("Browser transport mode: voice agent running in API-relay mode")
        logger.info("Frontend push-to-talk → POST /commands/execute → CommandExecutor")
        logger.info("No server-side audio processing in browser mode.")


async def _run_livekit(room_name: str) -> None:
    try:
        from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli
        from livekit.plugins import silero
    except ImportError:
        logger.error(
            "LiveKit agent SDK not installed. "
            "Install with: pip install 'ironman-voice-agent[livekit]'"
        )
        return

    from livekit import rtc
    from voice_agent.pipeline import VoicePipeline
    from voice_agent.config import settings as va_settings

    logger.info("Starting LiveKit voice agent for room: %s", room_name)
    pipeline = VoicePipeline()

    async def entrypoint(ctx: JobContext) -> None:
        await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

        session_id = await pipeline.start_session()
        logger.info("Voice session started: %s", session_id)

        # Outbound audio source for publishing TTS back into the room
        audio_source = rtc.AudioSource(
            sample_rate=_TTS_SAMPLE_RATE,
            num_channels=_TTS_CHANNELS,
        )
        tts_track = rtc.LocalAudioTrack.create_audio_track("jarvis-voice", audio_source)
        await ctx.room.local_participant.publish_track(tts_track)

        vad = silero.VAD.load()

        # Wire up already-present audio tracks
        for participant in ctx.room.remote_participants.values():
            for pub in participant.track_publications.values():
                if pub.track and _is_audio(pub.track):
                    asyncio.ensure_future(
                        _handle_audio(pub.track, pipeline, audio_source, vad)
                    )

        # Wire up future audio tracks
        @ctx.room.on("track_subscribed")
        def on_track(track, publication, participant):
            if _is_audio(track):
                asyncio.ensure_future(
                    _handle_audio(track, pipeline, audio_source, vad)
                )

        await ctx.room.run_until_disconnected()

        await pipeline.end_session()
        logger.info("LiveKit room disconnected, session ended.")

    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            api_key=va_settings.livekit_api_key,
            api_secret=va_settings.livekit_api_secret,
            ws_url=va_settings.livekit_url,
        )
    )


def _is_audio(track) -> bool:
    """Return True if track is an audio track (handles both enum and string kind)."""
    try:
        from livekit import rtc
        return track.kind == rtc.TrackKind.KIND_AUDIO
    except Exception:
        return str(getattr(track, "kind", "")).lower() == "audio"


async def _handle_audio(track, pipeline, audio_source, vad) -> None:
    """VAD-gated STT → pipeline → TTS loop for one participant audio track."""
    from livekit import rtc

    vad_stream = vad.stream()
    speech_frames: list[bytes] = []

    async def push_audio() -> None:
        audio_stream = rtc.AudioStream(track, sample_rate=16_000, num_channels=1)
        async for event in audio_stream:
            vad_stream.push_frame(event.frame)
        vad_stream.flush()

    push_task = asyncio.create_task(push_audio())

    try:
        async for vad_event in vad_stream:
            ev_type = str(vad_event.type)

            if "START_OF_SPEECH" in ev_type:
                speech_frames.clear()
                # Interrupt any currently-playing TTS
                pipeline.interruption.interrupt()
                logger.debug("VAD: speech start — TTS interrupted if playing")

            elif "INFERENCE_DONE" in ev_type and hasattr(vad_event, "frames"):
                for frame in vad_event.frames:
                    speech_frames.append(bytes(frame.data))

            elif "END_OF_SPEECH" in ev_type:
                # Some versions provide raw_accumulated_speech directly
                raw = getattr(vad_event, "raw_accumulated_speech", None)
                if raw is None and speech_frames:
                    raw = b"".join(speech_frames)
                speech_frames.clear()

                if raw:
                    asyncio.ensure_future(
                        _process_and_respond(raw, pipeline, audio_source)
                    )
    finally:
        push_task.cancel()
        logger.debug("Audio handler exiting for track %s", getattr(track, "sid", "?"))


async def _process_and_respond(audio_bytes: bytes, pipeline, audio_source) -> None:
    """STT → command execution → TTS publication."""
    pipeline.interruption.reset()

    stt_result = await pipeline.stt.transcribe(audio_bytes, content_type="audio/pcm")
    text = stt_result.text.strip()
    if not text:
        logger.debug("STT returned empty transcript, skipping")
        return

    logger.info("STT: %r (latency=%dms)", text, stt_result.latency_ms)

    result = await pipeline.handle_transcript(text)
    spoken = pipeline.build_spoken_response(result)

    if not spoken:
        return

    tts_result = await pipeline.tts.synthesize(spoken)
    logger.info("TTS: %r → %d bytes (latency=%dms)", spoken, len(tts_result.audio_bytes), tts_result.latency_ms)

    if tts_result.audio_bytes:
        tts_task = asyncio.current_task()
        pipeline.interruption.register_tts_task(tts_task)
        try:
            await _publish_audio(tts_result.audio_bytes, audio_source)
        except asyncio.CancelledError:
            logger.info("TTS playback interrupted by barge-in")


async def _publish_audio(audio_bytes: bytes, audio_source) -> None:
    """Publish raw PCM bytes back into the LiveKit room in real-time-paced frames."""
    from livekit import rtc

    chunk_samples = int(_TTS_SAMPLE_RATE * _TTS_CHUNK_MS / 1000)
    chunk_bytes = chunk_samples * 2  # int16 = 2 bytes per sample

    for offset in range(0, len(audio_bytes), chunk_bytes):
        chunk = audio_bytes[offset : offset + chunk_bytes]
        # Zero-pad final incomplete chunk
        if len(chunk) < chunk_bytes:
            chunk = chunk + b"\x00" * (chunk_bytes - len(chunk))

        frame = rtc.AudioFrame(
            data=bytearray(chunk),
            sample_rate=_TTS_SAMPLE_RATE,
            num_channels=_TTS_CHANNELS,
            samples_per_channel=chunk_samples,
        )
        await audio_source.capture_frame(frame)
        await asyncio.sleep(_TTS_CHUNK_MS / 1000)


if __name__ == "__main__":
    main()
