import json
import httpx
from typing import Any
from app.core.config import settings


class OllamaUnavailableError(Exception):
    pass


class OllamaClient:
    def __init__(self):
        self.base_url = settings.ollama_base_url
        self.model = settings.ollama_model
        self.timeout = settings.ollama_timeout

    async def health_check(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(f"{self.base_url}/api/tags")
                return r.status_code == 200
        except Exception:
            return False

    async def list_models(self) -> list[str]:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(f"{self.base_url}/api/tags")
                r.raise_for_status()
                data = r.json()
                return [m["name"] for m in data.get("models", [])]
        except Exception:
            return []

    async def generate(self, prompt: str, model: str | None = None) -> str:
        payload = {
            "model": model or self.model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": settings.ollama_temperature}
        }
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                r = await client.post(f"{self.base_url}/api/generate", json=payload)
                r.raise_for_status()
                return r.json().get("response", "")
        except httpx.ConnectError:
            raise OllamaUnavailableError("Ollama is not running. Start it with: ollama serve")
        except Exception as e:
            raise OllamaUnavailableError(f"Ollama error: {e}")

    async def chat(self, messages: list[dict], model: str | None = None) -> str:
        payload = {
            "model": model or self.model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": settings.ollama_temperature}
        }
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                r = await client.post(f"{self.base_url}/api/chat", json=payload)
                r.raise_for_status()
                return r.json().get("message", {}).get("content", "")
        except httpx.ConnectError:
            raise OllamaUnavailableError("Ollama is not running. Start it with: ollama serve")
        except Exception as e:
            raise OllamaUnavailableError(f"Ollama error: {e}")

    async def classify_json(self, prompt: str, schema_hint: str = "") -> dict:
        full_prompt = f"{prompt}\n\nRespond with valid JSON only. No markdown, no explanation."
        if schema_hint:
            full_prompt += f"\n\nExpected schema: {schema_hint}"
        try:
            response = await self.generate(full_prompt)
            # Extract JSON from response
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
                "top_priorities": context.get('todays_tasks', [])[:3],
                "risks": context.get('overdue_tasks', [])[:2],
                "suggested_schedule": [],
                "follow_ups": context.get('pending_follow_ups', []),
                "recommended_deferrals": [],
                "focus_score": 70
            }
        return result
