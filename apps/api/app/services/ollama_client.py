from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import httpx

DEFAULT_OLLAMA_URL = "http://localhost:11434"
DEFAULT_OLLAMA_MODEL = "llama3.1"


class OllamaUnavailableError(Exception):
    """Raised when Ollama cannot be reached or returns an invalid response."""


class OllamaClient:
    def __init__(self) -> None:
        self.base_url = os.getenv("OLLAMA_BASE_URL", DEFAULT_OLLAMA_URL).rstrip("/")
        self.model = os.getenv("OLLAMA_MODEL", DEFAULT_OLLAMA_MODEL)
        self.timeout = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "30"))

    def _load_prompt_template(self) -> str:
        prompt_path = Path(__file__).resolve().parent.parent / "prompts" / "daily_brief_v1.txt"
        return prompt_path.read_text(encoding="utf-8")

    def _build_prompt(self, payload: dict[str, Any]) -> str:
        template = self._load_prompt_template()
        return (
            f"{template}\n\n"
            "Input data:\n"
            f"{json.dumps(payload, ensure_ascii=False, indent=2)}"
        )

    async def generate_daily_brief(self, payload: dict[str, Any]) -> dict[str, list[str]]:
        prompt = self._build_prompt(payload)
        request_body = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "format": "json",
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(f"{self.base_url}/api/generate", json=request_body)
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise OllamaUnavailableError("Unable to reach local Ollama service") from exc

        body = response.json()
        raw_text = body.get("response", "")

        try:
            parsed = json.loads(raw_text)
        except json.JSONDecodeError as exc:
            raise OllamaUnavailableError("Ollama returned non-JSON brief output") from exc

        required_keys = [
            "top_priorities",
            "risks",
            "suggested_schedule",
            "follow_ups",
            "recommended_deferrals",
        ]

        normalized: dict[str, list[str]] = {}
        for key in required_keys:
            value = parsed.get(key, [])
            if not isinstance(value, list):
                value = [str(value)]
            normalized[key] = [str(item) for item in value]

        return normalized
