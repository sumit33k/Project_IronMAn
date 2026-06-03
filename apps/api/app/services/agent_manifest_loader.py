"""
Loads agent manifests from agents/manifests/*.yaml.
Manifests can override in-memory agent settings and expose config to the admin UI.
"""
import json
import os
from pathlib import Path
from typing import Optional

try:
    import yaml
    _YAML_AVAILABLE = True
except ImportError:
    _YAML_AVAILABLE = False

from sqlalchemy.orm import Session
from app.db.models import Agent

MANIFEST_DIR = Path(__file__).parents[4] / "agents" / "manifests"

MANIFEST_SCHEMA_KEYS = {
    "id", "name", "version", "enabled", "risk_level", "description",
    "tools_allowed", "requires_approval_for", "confirmation_policy",
    "voice", "input_schema", "output_schema",
}


def _load_yaml(path: Path) -> Optional[dict]:
    if not _YAML_AVAILABLE:
        return None
    try:
        with open(path) as f:
            return yaml.safe_load(f)
    except Exception:
        return None


def load_all() -> list[dict]:
    """Return all valid manifests from the manifests directory."""
    if not MANIFEST_DIR.exists():
        return []
    manifests = []
    for path in sorted(MANIFEST_DIR.glob("*.yaml")):
        data = _load_yaml(path)
        if data and "id" in data:
            data["_source"] = str(path.name)
            manifests.append(data)
    return manifests


def get_manifest(agent_id: str) -> Optional[dict]:
    for m in load_all():
        if m.get("id") == agent_id:
            return m
    return None


def validate_manifest(data: dict) -> list[str]:
    """Return a list of validation errors (empty = valid)."""
    errors = []
    if not data.get("id"):
        errors.append("'id' is required")
    if not data.get("name"):
        errors.append("'name' is required")
    risk = data.get("risk_level", "")
    if risk and risk not in ("low", "medium", "high"):
        errors.append(f"'risk_level' must be low|medium|high, got '{risk}'")
    return errors


def sync_manifest_to_db(manifest: dict, db: Session) -> Agent:
    """Persist manifest fields to the Agent DB row (creates if missing)."""
    agent_id = manifest["id"]
    agent = db.get(Agent, agent_id)
    if not agent:
        agent = Agent(id=agent_id)
        db.add(agent)

    agent.name = manifest.get("name", agent_id)
    agent.agent_type = manifest.get("agent_type", agent_id)
    agent.description = manifest.get("description", "")
    agent.enabled = manifest.get("enabled", True)
    agent.tools_allowed = json.dumps(manifest.get("tools_allowed", []))
    agent.requires_approval_for = json.dumps(manifest.get("requires_approval_for", []))
    db.commit()
    db.refresh(agent)
    return agent


def set_agent_enabled(agent_id: str, enabled: bool, db: Session) -> Agent:
    agent = db.get(Agent, agent_id)
    if not agent:
        agent = Agent(id=agent_id, name=agent_id, agent_type=agent_id)
        db.add(agent)
    agent.enabled = enabled
    db.commit()
    db.refresh(agent)
    return agent
