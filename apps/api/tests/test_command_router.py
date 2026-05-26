from app.services.command_router import CommandRouter


def test_normalizes_nested_intent_object() -> None:
    router = CommandRouter()

    result = router._normalize_result(
        {
            "intent": {
                "intent": "show_today",
                "confidence": 0.91,
                "target_agent": None,
                "task_id": None,
                "parameters": {},
                "requires_confirmation": False,
                "confirmation_message": None,
                "user_visible_summary": "Showing today's priorities",
            }
        },
        "what should I focus on today",
    )

    assert result["intent"] == "show_today"
    assert result["confidence"] == 0.91
    assert result["user_visible_summary"] == "Showing today's priorities"


def test_normalizes_object_summary_to_text() -> None:
    router = CommandRouter()

    result = router._normalize_result(
        {
            "intent": "show_today",
            "confidence": "0.8",
            "user_visible_summary": {
                "intent": "show_today",
                "user_visible_summary": "Showing today's priorities",
            },
        },
        "today",
    )

    assert result["intent"] == "show_today"
    assert result["confidence"] == 0.8
    assert result["user_visible_summary"] == "Showing today's priorities"
