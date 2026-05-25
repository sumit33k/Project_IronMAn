from __future__ import annotations

import json
from typing import Any

import httpx
from app.core.config import settings


class OllamaUnavailableError(Exception):
    """Raised when Ollama cannot be reached or returns an invalid response."""


class OllamaClient:
    def __init__(self):
        self.base_url = settings.ollama_base_url
        self.model = settings.ollama_model
        self.timeout = settings.ollama_timeout

    def _candidate_urls(self) -> list[str]:
        """Return base URLs to try, adding a 127.0.0.1 variant when base uses localhost."""
        urls = [self.base_url]
        if "localhost" in self.base_url:
            urls.append(self.base_url.replace("localhost", "127.0.0.1"))
        return urls

    async def health_check(self) -> bool:
        """Check reachability via Ollama's root endpoint ('Ollama is running')."""
        async with httpx.AsyncClient(timeout=5) as client:
            for url in self._candidate_urls():
                try:
                    r = await client.get(url)
                    if r.status_code == 200:
                        return True
                except Exception:
                    continue
        return False

    async def list_models(self) -> list[str]:
        async with httpx.AsyncClient(timeout=10) as client:
            for url in self._candidate_urls():
                try:
                    r = await client.get(f"{url}/api/tags")
                    r.raise_for_status()
                    data = r.json()
                    return [m["name"] for m in data.get("models", [])]
                except Exception:
                    continue
        return []

    async def generate(self, prompt: str, model: str | None = None) -> str:
        payload = {
            "model": model or self.model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": settings.ollama_temperature},
        }
        last_err: Exception = OllamaUnavailableError("Ollama is not running. Start it with: ollama serve")
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for url in self._candidate_urls():
                try:
                    r = await client.post(f"{url}/api/generate", json=payload)
                    r.raise_for_status()
                    return r.json().get("response", "")
                except (httpx.ConnectError, httpx.ConnectTimeout):
                    continue
                except Exception as e:
                    last_err = OllamaUnavailableError(f"Ollama error: {e}")
                    break
        raise last_err

    async def chat(self, messages: list[dict], model: str | None = None) -> str:
        payload = {
            "model": model or self.model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": settings.ollama_temperature},
        }
        last_err: Exception = OllamaUnavailableError("Ollama is not running. Start it with: ollama serve")
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for url in self._candidate_urls():
                try:
                    r = await client.post(f"{url}/api/chat", json=payload)
                    r.raise_for_status()
                    return r.json().get("message", {}).get("content", "")
                except (httpx.ConnectError, httpx.ConnectTimeout):
                    continue
                except Exception as e:
                    last_err = OllamaUnavailableError(f"Ollama error: {e}")
                    break
        raise last_err

    async def classify_json(self, prompt: str, schema_hint: str = "") -> dict:
        full_prompt = f"{prompt}\n\nRespond with valid JSON only. No markdown, no explanation."
        if schema_hint:
            full_prompt += f"\n\nExpected schema: {schema_hint}"
        try:
            response = await self.generate(full_prompt)
            start = response.find("{")
            end = response.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(response[start:end])
            return {}
        except json.JSONDecodeError:
            return {}

    async def generate_daily_brief(self, context: dict) -> dict:
        prompt = f"""You are a daily briefing AI for a personal command center.

Given this context, create a structured daily brief.

Context:
- Today's tasks: {context.get('todays_tasks', [])}
- Overdue tasks: {context.get('overdue_tasks', [])}
- Upcoming meetings: {context.get('upcoming_meetings', [])}
- Pending follow-ups: {context.get('pending_follow_ups', [])}

Return JSON only:
{{
  "summary": "2-3 sentence overview of the day",
  "top_priorities": ["list of top 3-5 priority items"],
  "risks": ["potential blockers or risks"],
  "suggested_schedule": ["time-blocked suggestions"],
  "follow_ups": ["items needing follow-up"],
  "recommended_deferrals": ["items that can be deferred"],
  "focus_score": 75
}}"""
        result = await self.classify_json(prompt)
        if not result:
            return {
                "summary": "Unable to generate brief - Ollama may be unavailable.",
                "top_priorities": context.get("todays_tasks", [])[:3],
                "risks": context.get("overdue_tasks", [])[:2],
                "suggested_schedule": [],
                "follow_ups": context.get("pending_follow_ups", []),
                "recommended_deferrals": [],
                "focus_score": 70,
            }
        return result
