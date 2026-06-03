FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml .
RUN pip install --no-cache-dir -e ".[livekit]" || pip install --no-cache-dir -e .

COPY voice_agent/ ./voice_agent/

CMD ["voice-agent", "--transport", "browser"]
