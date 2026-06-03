"""Tests for Phase 9: Runtime agent manifests."""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_list_manifests_returns_all():
    resp = client.get("/agents/manifests")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    # Should load the 6 manifests in agents/manifests/
    assert len(data) >= 6
    ids = [m["id"] for m in data]
    assert "email_draft_agent" in ids
    assert "calendar_prep_agent" in ids
    assert "daily_briefing_agent" in ids


def test_manifests_have_no_validation_errors():
    resp = client.get("/agents/manifests")
    for m in resp.json():
        assert m.get("_valid") is True, f"Manifest {m.get('id')} has errors: {m.get('_errors')}"


def test_get_agent_manifest_by_id():
    resp = client.get("/agents/email_draft_agent/manifest")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == "email_draft_agent"
    assert data["risk_level"] == "high"
    assert "gmail.draft" in data["tools_allowed"]


def test_get_nonexistent_agent_manifest():
    resp = client.get("/agents/nonexistent_agent/manifest")
    assert resp.status_code == 404


def test_sync_manifests_to_db():
    resp = client.post("/agents/manifests/sync")
    assert resp.status_code == 200
    data = resp.json()
    assert "synced" in data
    assert "skipped" in data
    assert len(data["synced"]) >= 1
    assert len(data["skipped"]) == 0


def test_agents_list_includes_manifest_metadata():
    resp = client.get("/agents")
    assert resp.status_code == 200
    agents = resp.json()
    # Agents that have manifests should have has_manifest=True
    for a in agents:
        assert "enabled" in a
        assert "has_manifest" in a
        assert "tools_allowed" in a
        assert "voice_enabled" in a


def test_toggle_agent_enabled():
    # Sync first to ensure DB row exists
    client.post("/agents/manifests/sync")

    resp = client.patch("/agents/email_draft_agent/enabled", json={"enabled": False})
    assert resp.status_code == 200
    data = resp.json()
    assert data["enabled"] is False

    # Re-enable
    resp = client.patch("/agents/email_draft_agent/enabled", json={"enabled": True})
    assert resp.status_code == 200
    assert resp.json()["enabled"] is True


def test_disabled_agent_cannot_be_run():
    # Sync and disable
    client.post("/agents/manifests/sync")
    client.patch("/agents/email_draft_agent/enabled", json={"enabled": False})

    resp = client.post("/agents/email_draft_agent/run", json={})
    assert resp.status_code == 403

    # Re-enable
    client.patch("/agents/email_draft_agent/enabled", json={"enabled": True})


def test_manifest_validation_catches_missing_id():
    from app.services.agent_manifest_loader import validate_manifest
    errors = validate_manifest({"name": "Test Agent"})
    assert any("id" in e for e in errors)


def test_manifest_validation_catches_bad_risk_level():
    from app.services.agent_manifest_loader import validate_manifest
    errors = validate_manifest({"id": "test", "name": "Test", "risk_level": "extreme"})
    assert any("risk_level" in e for e in errors)


def test_manifest_validation_passes_valid():
    from app.services.agent_manifest_loader import validate_manifest
    errors = validate_manifest({
        "id": "test_agent",
        "name": "Test Agent",
        "risk_level": "low",
        "enabled": True,
    })
    assert errors == []
