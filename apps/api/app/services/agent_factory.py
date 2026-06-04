"""
AgentFactory — creates agent instances from manifests or generates runtime stubs
when a requested agent_id is not present in the registry.

Resolution order:
  1. YAML manifest from agents/manifests/<id>.yaml
  2. Agent DB record (config-only agents registered via admin UI)
  3. Auto-generated minimal stub (always succeeds for any non-empty id)
"""
import json
from typing import Optional

from sqlalchemy.orm import Session

from app.agents.base import BaseAgent
from app.db.models import Agent as AgentModel
from app.services.agent_manifest_loader import get_manifest, validate_manifest


class DynamicAgent(BaseAgent):
    """A runtime-configured agent built from a manifest dict or sensible defaults."""

    def __init__(self, agent_id: str, manifest: dict):
        super().__init__()
        self.id = agent_id
        self.name = manifest.get("name", agent_id.replace("_", " ").title())
        self.agent_type = manifest.get("agent_type", agent_id)
        self.description = manifest.get("description", f"Dynamically created agent for {agent_id}")
        self.risk_level = manifest.get("risk_level", "medium")
        self.requires_approval_for = manifest.get("requires_approval_for", [])
        self._prompt_template: str = manifest.get("prompt_template", "")
        self._tools_allowed: list = manifest.get("tools_allowed", [])

    async def run(self, input_data: dict, db: Session) -> dict:
        raw = input_data.get("raw", "") or str(input_data)

        if self._prompt_template:
            try:
                prompt = self._prompt_template.format(
                    **{k: str(v) for k, v in input_data.items()}
                )
            except KeyError:
                prompt = self._prompt_template
        else:
            prompt = f"""You are {self.name}. {self.description}

Process this request and return structured JSON.
Request: {raw}
Input data: {json.dumps(input_data, default=str)}

Return JSON only:
{{
  "status": "completed",
  "result": "description of what was done or produced",
  "details": {{}},
  "requires_review": false,
  "spoken_response": "one sentence summary for text-to-speech"
}}"""

        result = await self.ollama.classify_json(prompt)
        if not result:
            return {
                "status": "completed",
                "result": f"Processed request via {self.name}",
                "details": input_data,
                "requires_review": self.risk_level in ("medium", "high"),
                "spoken_response": f"Done. I processed your {self.name.lower()} request.",
            }
        if "requires_review" not in result:
            result["requires_review"] = self.risk_level in ("medium", "high")
        return result


class AgentFactory:
    """Creates and optionally registers agent instances on demand."""

    @staticmethod
    def create(agent_id: str, db: Optional[Session] = None) -> Optional["BaseAgent"]:
        """
        Build an agent instance for the given id.
        Returns None only if agent_id is empty.
        """
        if not agent_id:
            return None

        # 1. YAML manifest
        manifest = get_manifest(agent_id)
        if manifest:
            errors = validate_manifest(manifest)
            if not errors:
                return DynamicAgent(agent_id, manifest)

        # 2. DB record (config-only agent saved via admin UI)
        if db:
            db_agent = db.get(AgentModel, agent_id)
            if db_agent:
                stub_manifest = {
                    "id": db_agent.id,
                    "name": db_agent.name,
                    "agent_type": db_agent.agent_type,
                    "description": db_agent.description or "",
                    "risk_level": "medium",
                    "tools_allowed": json.loads(db_agent.tools_allowed or "[]"),
                    "requires_approval_for": json.loads(db_agent.requires_approval_for or "[]"),
                }
                return DynamicAgent(agent_id, stub_manifest)

        # 3. Auto-generated minimal stub — always succeeds
        stub_manifest = {
            "id": agent_id,
            "name": agent_id.replace("_", " ").title(),
            "description": f"Auto-generated agent stub for '{agent_id}'",
            "risk_level": "medium",
        }
        return DynamicAgent(agent_id, stub_manifest)

    @staticmethod
    def register_if_missing(
        agent_id: str, db: Optional[Session] = None
    ) -> Optional["BaseAgent"]:
        """Create agent and register in the global registry if not already there."""
        from app.agents.registry import get_registry

        registry = get_registry()
        existing = registry.get(agent_id)
        if existing:
            return existing

        agent = AgentFactory.create(agent_id, db)
        if agent:
            registry.register(agent)
        return agent
