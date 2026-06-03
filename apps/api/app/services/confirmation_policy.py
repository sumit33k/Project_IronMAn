"""
Defines which intents require human confirmation before execution.

Risk levels:
  low    - auto-execute immediately
  medium - warn but auto-execute (future: configurable)
  high   - always require explicit confirmation
"""
from typing import Literal

RiskLevel = Literal["low", "medium", "high"]

# Intents that modify or create data safely
LOW_RISK_INTENTS: set[str] = {
    "create_task",
    "complete_task",
    "defer_task",
    "mark_waiting",
    "prioritize_task",
    "update_task",
    "show_today",
    "show_briefing",
    "generate_daily_briefing",
    "generate_end_of_day_review",
    "search_tasks",
    "ask_general_question",
    "open_screen",
    "summarize_email",
}

# Intents that trigger external actions or destructive operations
HIGH_RISK_INTENTS: set[str] = {
    "draft_email",
    "delegate_task",
    "create_presentation_outline",
    "prepare_meeting",
    "summarize_document",
}


def get_risk_level(intent: str) -> RiskLevel:
    if intent in HIGH_RISK_INTENTS:
        return "high"
    if intent in LOW_RISK_INTENTS:
        return "low"
    return "medium"


def requires_confirmation(intent: str) -> bool:
    return get_risk_level(intent) == "high"


def confirmation_message_for(intent: str, summary: str) -> str:
    messages: dict[str, str] = {
        "draft_email": f"Ready to draft email: {summary}. Say 'confirm' or click Confirm to proceed.",
        "delegate_task": f"Ready to delegate task: {summary}. Confirm to assign to an agent.",
        "create_presentation_outline": f"Ready to generate presentation outline: {summary}. Confirm to proceed.",
        "prepare_meeting": f"Ready to prepare meeting materials: {summary}. Confirm to proceed.",
        "summarize_document": f"Ready to summarize document: {summary}. Confirm to proceed.",
    }
    return messages.get(intent, f"Ready to execute: {summary}. Confirm to proceed.")
