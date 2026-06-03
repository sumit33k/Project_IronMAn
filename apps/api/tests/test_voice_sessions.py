"""Tests for Phase 5: Voice session lifecycle APIs."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.database import SessionLocal
from app.db.models import VoiceSession, VoiceTurn

client = TestClient(app)


# ---------------------------------------------------------------------------
# Session CRUD
# ---------------------------------------------------------------------------

def test_create_voice_session():
    resp = client.post("/voice/sessions", json={
        "stt_provider": "browser",
        "tts_provider": "browser",
        "transport_provider": "browser",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] is not None
    assert data["status"] == "created"
    assert data["stt_provider"] == "browser"
    assert data["turn_count"] == 0


def test_list_sessions_returns_list():
    resp = client.get("/voice/sessions")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_get_session_includes_turns():
    create = client.post("/voice/sessions", json={})
    session_id = create.json()["id"]

    client.post(f"/voice/sessions/{session_id}/turns", json={
        "role": "user",
        "transcript": "Show me today's tasks",
    })

    resp = client.get(f"/voice/sessions/{session_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == session_id
    assert "turns" in data
    assert len(data["turns"]) == 1
    assert data["turns"][0]["transcript"] == "Show me today's tasks"


def test_update_session_status():
    create = client.post("/voice/sessions", json={})
    session_id = create.json()["id"]

    resp = client.patch(f"/voice/sessions/{session_id}", json={"status": "listening"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "listening"


def test_update_session_invalid_status():
    create = client.post("/voice/sessions", json={})
    session_id = create.json()["id"]

    resp = client.patch(f"/voice/sessions/{session_id}", json={"status": "invalid_status"})
    assert resp.status_code == 400


def test_end_session():
    create = client.post("/voice/sessions", json={})
    session_id = create.json()["id"]

    resp = client.delete(f"/voice/sessions/{session_id}")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ended"


def test_get_nonexistent_session():
    resp = client.get("/voice/sessions/does-not-exist")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Turns
# ---------------------------------------------------------------------------

def test_add_turn_increments_count():
    create = client.post("/voice/sessions", json={})
    session_id = create.json()["id"]

    resp = client.post(f"/voice/sessions/{session_id}/turns", json={
        "role": "user",
        "transcript": "Create a task to review contracts",
        "stt_latency_ms": 250,
    })
    assert resp.status_code == 200
    turn = resp.json()
    assert turn["transcript"] == "Create a task to review contracts"
    assert turn["turn_number"] == 1
    assert turn["stt_latency_ms"] == 250

    # Session turn_count should be incremented
    session = client.get(f"/voice/sessions/{session_id}").json()
    assert session["turn_count"] == 1


def test_add_turn_with_command_id_increments_command_count():
    create = client.post("/voice/sessions", json={})
    session_id = create.json()["id"]

    client.post(f"/voice/sessions/{session_id}/turns", json={
        "role": "user",
        "transcript": "show today",
        "command_id": "test-cmd-001",
    })

    session = client.get(f"/voice/sessions/{session_id}").json()
    assert session["command_count"] == 1


def test_multiple_turns_get_sequential_numbers():
    create = client.post("/voice/sessions", json={})
    session_id = create.json()["id"]

    for i in range(3):
        resp = client.post(f"/voice/sessions/{session_id}/turns", json={
            "role": "user" if i % 2 == 0 else "assistant",
            "transcript": f"Turn {i+1}",
        })
        assert resp.json()["turn_number"] == i + 1


# ---------------------------------------------------------------------------
# Phase 3: Voice provider config
# ---------------------------------------------------------------------------

def test_get_voice_config_returns_defaults():
    resp = client.get("/voice/config")
    assert resp.status_code == 200
    data = resp.json()
    assert "stt" in data
    assert "tts" in data
    assert "wake_word" in data
    assert data["stt"]["provider"] == "browser"
    assert data["wake_word"]["enabled"] is False


def test_patch_voice_config_deep_merge():
    # Reset to defaults first
    client.patch("/voice/config", json={"stt": {"provider": "browser"}})

    resp = client.patch("/voice/config", json={"stt": {"provider": "whisper_cpp"}})
    assert resp.status_code == 200
    data = resp.json()
    assert data["stt"]["provider"] == "whisper_cpp"
    # Other fields should still exist (deep merge)
    assert "base_url" in data["stt"]

    # Reset
    client.patch("/voice/config", json={"stt": {"provider": "browser"}})


def test_providers_health_returns_all_providers():
    resp = client.get("/voice/providers/health")
    assert resp.status_code == 200
    data = resp.json()
    assert "livekit" in data
    assert "whisper_cpp" in data
    assert "piper" in data
    assert "ollama" in data
    assert "browser_stt" in data
    assert "wake_word" in data
    assert "overall" in data
    assert data["browser_stt"]["status"] == "available"


def test_validate_providers_returns_issues():
    resp = client.post("/voice/providers/validate")
    assert resp.status_code == 200
    data = resp.json()
    assert "issues" in data
    assert "overall" in data
    assert "ready_for_production" in data
