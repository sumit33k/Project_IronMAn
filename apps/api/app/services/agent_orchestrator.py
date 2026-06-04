"""
AgentOrchestrator — the missing coordination layer between CommandExecutor
and the agent registry.

Responsibilities:
  1. Resolve intent → agent_id using FULL_INTENT_AGENT_MAP (superset of
     CommandRouter's INTENT_AGENT_MAP)
  2. Look up agent in registry; if missing, delegate to AgentFactory
  3. Execute via agent.execute() (preserves AgentRun audit lifecycle)
  4. Synthesize a spoken_response field for TTS playback
"""
import json
from typing import Optional

from sqlalchemy.orm import Session

from app.agents.registry import get_registry
from app.services.agent_factory import AgentFactory

# Full intent → registered agent_id mapping
# Superset of command_router.INTENT_AGENT_MAP
FULL_INTENT_AGENT_MAP: dict[str, str] = {
    "draft_email": "email_draft_agent",
    "summarize_email": "email_draft_agent",
    "create_presentation_outline": "presentation_agent",
    "prepare_meeting": "calendar_prep_agent",
    "summarize_document": "document_agent",
    "delegate_task": "orchestrator_agent",
    "generate_daily_briefing": "daily_briefing_agent",
    "generate_end_of_day_review": "daily_briefing_agent",
    "search_tasks": "task_classifier_agent",
    "ask_general_question": "research_agent",
}


def _spoken_from_direct_result(intent: str, result: dict) -> str:
    """Build a TTS-friendly response for intents handled directly (no agent)."""
    if intent == "create_task":
        title = result.get("title", "your task")
        return f"Done. Created: {title}."
    if intent == "complete_task":
        return f"Marked complete: {result.get('title', 'task')}."
    if intent == "defer_task":
        title = result.get("title", "task")
        until = result.get("defer_until")
        return f"Deferred {title}" + (f" until {until}." if until else ".")
    if intent == "mark_waiting":
        return f"Set to waiting: {result.get('title', 'task')}."
    if intent == "prioritize_task":
        return f"Priority updated to {result.get('priority', 'high')}."
    if intent == "show_today":
        count = result.get("count", 0)
        return f"You have {count} task{'s' if count != 1 else ''} today."
    if intent == "show_briefing":
        summary = result.get("summary", "")
        return (summary[:200] + "…") if len(summary) > 200 else (summary or "Your briefing is ready.")
    if result.get("status") == "error":
        msg = result.get("message", "")
        return f"Something went wrong. {msg}".strip() if msg else "Sorry, I couldn't complete that."
    return "Done."


def _spoken_from_agent_result(intent: str, result: dict) -> str:
    """Build a TTS-friendly response for intents handled by agents."""
    if result.get("status") == "error":
        msg = result.get("message", "")
        return f"The agent encountered an error. {msg}".strip() if msg else "The agent failed."

    # Agent may embed its own spoken_response in output
    output = result.get("output", {})
    spoken = output.get("spoken_response") or result.get("spoken_response", "")
    if spoken:
        return spoken

    # Friendly per-intent fallbacks
    labels = {
        "draft_email": "email draft",
        "summarize_email": "email summary",
        "create_presentation_outline": "presentation outline",
        "prepare_meeting": "meeting prep",
        "summarize_document": "document summary",
        "delegate_task": "task delegation",
        "generate_daily_briefing": "daily briefing",
        "generate_end_of_day_review": "end-of-day review",
        "search_tasks": "task search",
        "ask_general_question": "answer",
    }
    label = labels.get(intent, intent.replace("_", " "))
    created = result.get("agent_created", False)
    agent_note = " (new agent created)" if created else ""
    return f"Done. Your {label} is ready{agent_note}."


class AgentOrchestrator:
    """
    Single entry point for running agent-backed intents.

    Usage in CommandExecutor:
        orchestrator = AgentOrchestrator()
        result = await orchestrator.resolve_and_run(intent, params, agent_id, db)
    """

    async def resolve_and_run(
        self,
        intent: str,
        params: dict,
        agent_id: Optional[str],
        db: Session,
        task_id: Optional[str] = None,
    ) -> dict:
        """
        Resolve the right agent, create it if missing, run it, and return a
        result dict that always includes a `spoken_response` key.
        """
        resolved_id = agent_id or FULL_INTENT_AGENT_MAP.get(intent)

        if not resolved_id:
            return {
                "status": "acknowledged",
                "intent": intent,
                "message": f"No agent configured for intent '{intent}'.",
                "spoken_response": (
                    f"I understood your request but no agent is configured "
                    f"for {intent.replace('_', ' ')}."
                ),
            }

        # Resolve from registry; fall back to factory
        registry = get_registry()
        agent = registry.get(resolved_id)
        agent_created = False

        if not agent:
            agent = AgentFactory.register_if_missing(resolved_id, db)
            agent_created = bool(agent)

        if not agent:
            return {
                "status": "error",
                "message": f"Agent '{resolved_id}' could not be resolved or created.",
                "spoken_response": "I couldn't find or create the agent needed for this task.",
            }

        try:
            run = await agent.execute(params, db, task_id=task_id)
            output: dict = json.loads(run.output_data) if run.output_data else {}
            result = {
                "status": run.status,
                "run_id": run.id,
                "agent_id": resolved_id,
                "agent_created": agent_created,
                "output": output,
                "error": run.error_message,
            }
            result["spoken_response"] = _spoken_from_agent_result(intent, result)
            return result
        except Exception as exc:
            return {
                "status": "error",
                "agent_id": resolved_id,
                "message": str(exc),
                "spoken_response": "Something went wrong while running the agent.",
            }
