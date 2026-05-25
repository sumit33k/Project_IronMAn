#!/usr/bin/env python3
"""Generate a new agent stub from a template.

Usage:
  python generate_agent_stub.py <agent_name> <agent_type> [risk_level]

Examples:
  python generate_agent_stub.py document_summarizer document low
  python generate_agent_stub.py research_agent research medium
  python generate_agent_stub.py slack_poster communication high
"""
import sys
import textwrap
from pathlib import Path

TEMPLATE = '''\
from sqlalchemy.orm import Session
from app.agents.base import BaseAgent


class {class_name}(BaseAgent):
    id = "{agent_id}"
    name = "{agent_name}"
    agent_type = "{agent_type}"
    description = "{description}"
    risk_level = "{risk_level}"
    requires_approval_for: list[str] = {approval_list}

    async def run(self, input_data: dict, db: Session) -> dict:
        text = input_data.get("text", input_data.get("title", ""))

        prompt = f"""You are the {agent_name} for a personal AI command center.

Task: "{{text}}"

Return JSON only:
{{{{
  "result": "main output",
  "summary": "brief summary",
  "next_steps": [],
  "requires_review": {requires_review},
  "confidence": 0.8
}}}}"""

        result = await self.ollama.classify_json(prompt)
        if not result:
            return {{
                "result": f"Unable to process: {{text}}",
                "summary": "Ollama may be unavailable",
                "next_steps": [],
                "requires_review": {requires_review},
                "confidence": 0.0,
            }}
        return result
'''

REGISTRATION = """
# ─── Add to apps/api/app/main.py ───────────────────────────────────────
from app.agents.{module_name} import {class_name}

# In the agent registration loop:
{class_name}(),
# ───────────────────────────────────────────────────────────────────────
"""


def to_class_name(name: str) -> str:
    return "".join(w.capitalize() for w in name.replace("-", "_").split("_")) + "Agent"


def to_module_name(name: str) -> str:
    return name.lower().replace(" ", "_").replace("-", "_")


def generate(name: str, agent_type: str, risk_level: str = "low") -> Path:
    module_name = to_module_name(name)
    class_name = to_class_name(name)
    agent_id = f"{module_name}_agent"
    description = f"{name.replace('_', ' ').title()} agent"
    approval_list = '["send_email", "delete_file"]' if risk_level == "high" else "[]"
    requires_review = "True" if risk_level == "high" else "False"

    stub = TEMPLATE.format(
        class_name=class_name,
        agent_id=agent_id,
        agent_name=name.replace("_", " ").title(),
        agent_type=agent_type,
        description=description,
        risk_level=risk_level,
        approval_list=approval_list,
        requires_review=requires_review,
    )

    output_path = Path(f"apps/api/app/agents/{module_name}.py")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(stub)

    print(f"✅ Created: {output_path}")
    print(REGISTRATION.format(module_name=module_name, class_name=class_name))
    return output_path


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    agent_name = sys.argv[1]
    agent_type = sys.argv[2]
    risk = sys.argv[3] if len(sys.argv) > 3 else "low"

    generate(name=agent_name, agent_type=agent_type, risk_level=risk)
