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
        override = payload.pop("prompt_override", None)
        template = override or self._load_prompt_template()
        return f"{template}\n\nInput data:\n{json.dumps(payload, ensure_ascii=False, indent=2)}"

    async def generate_json(self, payload: dict[str, Any]) -> dict[str, Any]:
        prompt = self._build_prompt(payload)
        request_body = {"model": self.model, "prompt": prompt, "stream": False, "format": "json"}
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(f"{self.base_url}/api/generate", json=request_body)
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise OllamaUnavailableError("Unable to reach local Ollama service") from exc
        raw_text = response.json().get("response", "")
        try:
            return json.loads(raw_text)
        except json.JSONDecodeError as exc:
            raise OllamaUnavailableError("Ollama returned non-JSON output") from exc

    async def generate_daily_brief(self, payload: dict[str, Any]) -> dict[str, list[str]]:
        parsed = await self.generate_json(payload)
        keys = ["top_priorities", "risks", "suggested_schedule", "follow_ups", "recommended_deferrals"]
        return {k: [str(x) for x in (parsed.get(k, []) if isinstance(parsed.get(k, []), list) else [parsed.get(k, "")])] for k in keys}
