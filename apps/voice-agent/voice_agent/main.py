"""
Voice agent entry point.

Production mode (--transport livekit):
  Connects to LiveKit room, runs STT/TTS pipeline with Silero VAD.
  Requires: LiveKit server, whisper.cpp, Piper running locally.

Debug mode (--transport browser, default):
  Receives transcripts via HTTP from the frontend push-to-talk page.
  No audio processing server-side — browser handles STT/TTS.
"""
import argparse
import asyncio
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("voice-agent")


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
        from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli, llm
        from livekit.agents.voice_assistant import VoiceAssistant
        from livekit.plugins import silero
    except ImportError:
        logger.error(
            "LiveKit agent SDK not installed. "
            "Install with: pip install 'ironman-voice-agent[livekit]'"
        )
        return

    from voice_agent.pipeline import VoicePipeline
    from voice_agent.config import settings

    logger.info("Starting LiveKit voice agent for room: %s", room_name)
    pipeline = VoicePipeline()

    async def entrypoint(ctx: JobContext) -> None:
        await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
        session_id = await pipeline.start_session()
        logger.info("Connected to LiveKit room, session=%s", session_id)

        # LiveKit agent integration would hook into pipeline.handle_transcript here
        # This is a scaffold — full integration in Phase 6/7

    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            api_key=settings.livekit_api_key,
            api_secret=settings.livekit_api_secret,
            ws_url=settings.livekit_url,
        )
    )


if __name__ == "__main__":
    main()
