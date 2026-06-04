"""
Minimal HTTP wrapper around the piper TTS binary.

POST /api/tts  form fields: text (required), voice (optional)
GET  /          health check — lists available models

Environment:
  PIPER_BIN       path to piper executable (default: /opt/piper/piper)
  PIPER_MODEL_DIR directory containing .onnx model files (default: /models)
  PIPER_VOICE     default voice name (default: en_US-lessac-medium)
"""
import asyncio
import os
import struct

from fastapi import FastAPI, Form, HTTPException
from fastapi.responses import Response

app = FastAPI()

PIPER_BIN = os.getenv("PIPER_BIN", "/opt/piper/piper")
MODEL_DIR = os.getenv("PIPER_MODEL_DIR", "/models")
DEFAULT_VOICE = os.getenv("PIPER_VOICE", "en_US-lessac-medium")


def _find_model(voice: str) -> str | None:
    path = os.path.join(MODEL_DIR, f"{voice}.onnx")
    if os.path.exists(path):
        return path
    for name in sorted(os.listdir(MODEL_DIR)):
        if name.endswith(".onnx"):
            return os.path.join(MODEL_DIR, name)
    return None


def _pcm_to_wav(pcm: bytes, sample_rate: int = 22050, channels: int = 1, bits: int = 16) -> bytes:
    data_size = len(pcm)
    byte_rate = sample_rate * channels * bits // 8
    block_align = channels * bits // 8
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", 36 + data_size, b"WAVE",
        b"fmt ", 16, 1, channels, sample_rate, byte_rate, block_align, bits,
        b"data", data_size,
    )
    return header + pcm


@app.get("/")
def health():
    try:
        models = [f[:-5] for f in os.listdir(MODEL_DIR) if f.endswith(".onnx")]
    except Exception:
        models = []
    return {"status": "ok", "service": "piper-http", "models": models}


@app.post("/api/tts")
async def synthesize(
    text: str = Form(...),
    voice: str = Form(default=DEFAULT_VOICE),
):
    model_path = _find_model(voice)
    if not model_path:
        raise HTTPException(
            503,
            f"No Piper model found in {MODEL_DIR}. "
            "Download one with the command in infra/docker-compose.voice.yml.",
        )

    proc = await asyncio.create_subprocess_exec(
        PIPER_BIN,
        "--model", model_path,
        "--output_raw",
        "--sentence_silence", "0.1",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )
    pcm_bytes, _ = await proc.communicate(input=text.encode())

    if not pcm_bytes:
        raise HTTPException(500, "Piper returned empty audio. Check model and binary.")

    wav = _pcm_to_wav(pcm_bytes)
    return Response(content=wav, media_type="audio/wav")
