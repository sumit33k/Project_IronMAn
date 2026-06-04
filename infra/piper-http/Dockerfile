FROM python:3.11-slim

RUN apt-get update && apt-get install -y wget ca-certificates && rm -rf /var/lib/apt/lists/*
RUN pip install fastapi uvicorn python-multipart --no-cache-dir

# Install piper binary + shared libraries (date-based release tag, not semver)
ARG PIPER_VERSION=2023.11.14-2
RUN wget -q -O /tmp/piper.tar.gz \
      "https://github.com/rhasspy/piper/releases/download/${PIPER_VERSION}/piper_linux_x86_64.tar.gz" \
    && mkdir -p /opt/piper \
    && tar -xf /tmp/piper.tar.gz -C /opt/piper --strip-components=1 \
    && chmod +x /opt/piper/piper \
    && rm /tmp/piper.tar.gz

ENV PIPER_BIN=/opt/piper/piper
ENV PIPER_MODEL_DIR=/models
# piper shared libs live alongside the binary
ENV LD_LIBRARY_PATH=/opt/piper

WORKDIR /app
COPY server.py .
RUN mkdir -p /models

EXPOSE 5002
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "5002"]
