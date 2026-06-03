"""Tests for CommandExecutor and confirmation policy (Phase 1)."""
import json
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.database import SessionLocal
from app.db.models import Command, Task

client = TestClient(app)


def _db():
    """Get a direct DB session using the same engine as the app."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# confirmation_policy unit tests
# ---------------------------------------------------------------------------

def test_risk_levels():
    from app.services.confirmation_policy import get_risk_level, requires_confirmation

    assert get_risk_level("create_task") == "low"
    assert get_risk_level("draft_email") == "high"
    assert get_risk_level("delegate_task") == "high"
    assert get_risk_level("show_today") == "low"
    assert requires_confirmation("draft_email") is True
    assert requires_confirmation("create_task") is False


def test_confirmation_message_contains_intent():
    from app.services.confirmation_policy import confirmation_message_for

    msg = confirmation_message_for("draft_email", "Draft email to Raj")
    assert "draft" in msg.lower() or "email" in msg.lower()


# ---------------------------------------------------------------------------
# Route: GET /commands/history (must not be shadowed by /{command_id})
# ---------------------------------------------------------------------------

def test_history_endpoint_accessible():
    resp = client.get("/commands/history")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


# ---------------------------------------------------------------------------
# Route: POST /commands/preview
# ---------------------------------------------------------------------------

def test_preview_does_not_execute():
    resp = client.post("/commands/preview", json={
        "raw_input": "show today priorities",
        "input_mode": "text",
    })
    assert resp.status_code == 200
    data = resp.json()
    # Preview should never auto-execute
    assert data["status"] in ("routed", "awaiting_confirmation")
    assert data.get("execution_result") is None


# ---------------------------------------------------------------------------
# Route: POST /commands/execute
# ---------------------------------------------------------------------------

def test_execute_low_risk_command_routes_and_completes():
    resp = client.post("/commands/execute", json={
        "raw_input": "show today",
        "input_mode": "text",
    })
    assert resp.status_code == 200
    data = resp.json()
    # Ollama is unavailable in tests → rule-based routing → show_today
    assert data["interpreted_intent"] in ("show_today", "ask_general_question")
    # If routed to show_today it should complete; otherwise acknowledged
    assert data["status"] in ("completed", "routed", "failed")
    assert data["id"] is not None


def test_execute_voice_mode_sets_input_mode():
    resp = client.post("/commands/execute", json={
        "raw_input": "create task: test voice task",
        "input_mode": "voice",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["input_mode"] == "voice"


# ---------------------------------------------------------------------------
# Route: POST /commands/{id}/cancel
# ---------------------------------------------------------------------------

def test_cancel_awaiting_command():
    db = SessionLocal()
    try:
        cmd = Command(
            id="test-cancel-001",
            raw_input="draft email to Raj",
            input_mode="text",
            interpreted_intent="draft_email",
            action_type="draft_email",
            payload=json.dumps({
                "intent": "draft_email",
                "requires_confirmation": True,
                "user_visible_summary": "Drafting email to Raj",
            }),
            requires_confirmation=True,
            status="awaiting_confirmation",
        )
        # Upsert to avoid duplicate-key errors across test runs
        existing = db.get(Command, "test-cancel-001")
        if existing:
            existing.status = "awaiting_confirmation"
            existing.completed_at = None
        else:
            db.add(cmd)
        db.commit()
    finally:
        db.close()

    resp = client.post("/commands/test-cancel-001/cancel")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "cancelled"
    assert data["completed_at"] is not None


def test_cancel_unknown_command_returns_400():
    resp = client.post("/commands/nonexistent-uuid-9999/cancel")
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Route: POST /commands/{id}/confirm
# ---------------------------------------------------------------------------

def test_confirm_awaiting_command():
    db = SessionLocal()
    try:
        existing = db.get(Command, "test-confirm-001")
        if existing:
            existing.status = "awaiting_confirmation"
            existing.confirmed_at = None
            existing.executed_at = None
            existing.completed_at = None
            existing.execution_result = None
        else:
            cmd = Command(
                id="test-confirm-001",
                raw_input="prepare meeting for tomorrow",
                input_mode="text",
                interpreted_intent="prepare_meeting",
                action_type="prepare_meeting",
                payload=json.dumps({
                    "intent": "prepare_meeting",
                    "requires_confirmation": True,
                    "user_visible_summary": "Preparing for tomorrow's meeting",
                    "parameters": {},
                }),
                requires_confirmation=True,
                status="awaiting_confirmation",
            )
            db.add(cmd)
        db.commit()
    finally:
        db.close()

    resp = client.post("/commands/test-confirm-001/confirm", json={"confirmation_method": "button"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["confirmation_method"] == "button"
    assert data["confirmed_at"] is not None
    assert data["status"] in ("completed", "failed")


def test_confirm_already_completed_returns_400():
    db = SessionLocal()
    try:
        existing = db.get(Command, "test-already-done")
        if existing:
            existing.status = "completed"
        else:
            cmd = Command(
                id="test-already-done",
                raw_input="show today",
                input_mode="text",
                interpreted_intent="show_today",
                action_type="show_today",
                payload=json.dumps({}),
                requires_confirmation=False,
                status="completed",
            )
            db.add(cmd)
        db.commit()
    finally:
        db.close()

    resp = client.post("/commands/test-already-done/confirm", json={})
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Route: GET /commands/{id}
# ---------------------------------------------------------------------------

def test_get_command_by_id():
    db = SessionLocal()
    try:
        existing = db.get(Command, "test-get-001")
        if not existing:
            cmd = Command(
                id="test-get-001",
                raw_input="show briefing",
                input_mode="text",
                interpreted_intent="show_briefing",
                status="routed",
                payload=json.dumps({"intent": "show_briefing", "confidence": 0.9}),
                requires_confirmation=False,
            )
            db.add(cmd)
            db.commit()
    finally:
        db.close()

    resp = client.get("/commands/test-get-001")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == "test-get-001"


def test_get_nonexistent_command_returns_404():
    resp = client.get("/commands/does-not-exist-xyz")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# CommandExecutor unit tests (direct, no HTTP)
# ---------------------------------------------------------------------------

def test_executor_create_task_directly():
    from app.services.command_executor import CommandExecutor

    db = SessionLocal()
    try:
        executor = CommandExecutor()
        result = executor._create_task({"title": "Write release notes"}, "text", db)
        assert result["status"] == "created"
        assert result["title"] == "Write release notes"

        task = db.get(Task, result["task_id"])
        assert task is not None
        assert task.title == "Write release notes"
        assert task.source == "manual"
    finally:
        db.close()


def test_executor_create_task_voice_sets_source():
    from app.services.command_executor import CommandExecutor

    db = SessionLocal()
    try:
        executor = CommandExecutor()
        result = executor._create_task({"title": "Call the dentist"}, "voice", db)
        task = db.get(Task, result["task_id"])
        assert task.source == "voice"
    finally:
        db.close()


def test_executor_create_task_without_title_returns_error():
    from app.services.command_executor import CommandExecutor

    db = SessionLocal()
    try:
        executor = CommandExecutor()
        result = executor._create_task({}, "text", db)
        assert result["status"] == "error"
    finally:
        db.close()


def test_executor_complete_task_without_id_returns_error():
    from app.services.command_executor import CommandExecutor

    db = SessionLocal()
    try:
        executor = CommandExecutor()
        result = executor._complete_task(None, db)
        assert result["status"] == "error"
    finally:
        db.close()


def test_executor_show_today_returns_dict():
    from app.services.command_executor import CommandExecutor

    db = SessionLocal()
    try:
        executor = CommandExecutor()
        result = executor._show_today(db)
        assert result["status"] == "ok"
        assert "tasks" in result
        assert "count" in result
    finally:
        db.close()
