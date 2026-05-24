import json
from app.services.ollama_client import OllamaClient, OllamaUnavailableError

SUPPORTED_INTENTS = [
    "create_task", "update_task", "complete_task", "defer_task", "prioritize_task",
    "show_today", "show_briefing", "generate_daily_briefing", "generate_end_of_day_review",
    "search_tasks", "delegate_task", "draft_email", "summarize_email", "prepare_meeting",
    "create_presentation_outline", "summarize_document", "mark_waiting",
    "open_screen", "ask_general_question"
]

RISKY_INTENTS = {"draft_email", "delegate_task", "create_presentation_outline"}

INTENT_AGENT_MAP = {
    "draft_email": "email_draft_agent",
    "create_presentation_outline": "presentation_agent",
    "prepare_meeting": "calendar_prep_agent",
    "summarize_document": "document_agent",
}


class CommandRouter:
    def __init__(self):
        self.client = OllamaClient()

    async def route(self, raw_input: str, context: dict = {}) -> dict:
        prompt = f"""You are a command router for a Jarvis-style AI command center.

Given this user command, classify the intent and produce JSON only.

Supported intents: {", ".join(SUPPORTED_INTENTS)}

User command: "{raw_input}"

Return ONLY valid JSON:
{{
  "intent": "one_of_the_supported_intents",
  "confidence": 0.0_to_1.0,
  "target_agent": null_or_agent_name,
  "task_id": null_or_task_id,
  "parameters": {{}},
  "requires_confirmation": false,
  "confirmation_message": null,
  "user_visible_summary": "What I will do in plain English"
}}

Rules:
- confidence < 0.6: use "ask_general_question"
- email/delegation/file-ops: requires_confirmation = true
- For create_task: extract title from the command
- For defer_task: extract date from command
- Always fill user_visible_summary"""

        try:
            result = await self.client.classify_json(prompt)
            if not result or "intent" not in result:
                return self._fallback(raw_input)

            intent = result.get("intent", "ask_general_question")
            if intent in RISKY_INTENTS:
                result["requires_confirmation"] = True
                result["confirmation_message"] = f"Are you sure you want to: {result.get('user_visible_summary', intent)}?"

            if intent in INTENT_AGENT_MAP and not result.get("target_agent"):
                result["target_agent"] = INTENT_AGENT_MAP[intent]

            return result
        except OllamaUnavailableError:
            return self._rule_based(raw_input)

    def _rule_based(self, raw_input: str) -> dict:
        lower = raw_input.lower()
        intent = "ask_general_question"
        summary = f"I'll try to help with: {raw_input}"

        if any(w in lower for w in ["create task", "add task", "new task", "remind me"]):
            intent = "create_task"
            summary = f"Creating a new task: {raw_input}"
        elif any(w in lower for w in ["today", "priorities", "what should i"]):
            intent = "show_today"
            summary = "Showing today's priorities"
        elif any(w in lower for w in ["brief", "briefing", "morning brief"]):
            intent = "show_briefing"
            summary = "Showing your daily brief"
        elif any(w in lower for w in ["defer", "postpone", "later"]):
            intent = "defer_task"
            summary = "Deferring the task"
        elif any(w in lower for w in ["complete", "done", "finished", "mark done"]):
            intent = "complete_task"
            summary = "Marking task as complete"
        elif any(w in lower for w in ["delegate", "assign to agent"]):
            intent = "delegate_task"
            summary = "Delegating to an agent"
        elif any(w in lower for w in ["email", "draft", "reply"]):
            intent = "draft_email"
            summary = "Drafting email"
        elif any(w in lower for w in ["meeting", "prep", "prepare"]):
            intent = "prepare_meeting"
            summary = "Preparing for meeting"

        return {
            "intent": intent,
            "confidence": 0.6,
            "target_agent": INTENT_AGENT_MAP.get(intent),
            "task_id": None,
            "parameters": {"raw": raw_input},
            "requires_confirmation": intent in RISKY_INTENTS,
            "confirmation_message": None,
            "user_visible_summary": summary
        }

    def _fallback(self, raw_input: str) -> dict:
        return {
            "intent": "ask_general_question",
            "confidence": 0.5,
            "target_agent": None,
            "task_id": None,
            "parameters": {"raw": raw_input},
            "requires_confirmation": False,
            "confirmation_message": None,
            "user_visible_summary": f"Processing: {raw_input}"
        }
