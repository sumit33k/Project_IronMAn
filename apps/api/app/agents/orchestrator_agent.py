from sqlalchemy.orm import Session
from app.agents.base import BaseAgent


class OrchestratorAgent(BaseAgent):
    id = "orchestrator_agent"
    name = "Orchestrator Agent"
    agent_type = "orchestrator"
    description = "Breaks complex requests into multi-agent pipelines and coordinates execution"
    risk_level = "high"
    requires_approval_for = ["multi_agent_execution", "external_actions"]

    async def run(self, input_data: dict, db: Session) -> dict:
        request = input_data.get("request", "")
        available_agents = input_data.get("available_agents", [])
        context = input_data.get("context", "")

        prompt = f"""Decompose the following complex request into a multi-agent execution pipeline.

Request: {request}
Context: {context}
Available agent IDs: {available_agents}

Map each step to the most appropriate agent from the available list. Flag any step that involves external actions, data writes, or irreversible operations as high risk.

Return JSON only:
{{
  "pipeline": [
    {{
      "step": 1,
      "agent_id": "agent_id_from_available_list",
      "description": "what this step does",
      "input_template": {{}},
      "depends_on": [],
      "risk_level": "low|medium|high"
    }}
  ],
  "estimated_steps": 0,
  "high_risk_steps": [],
  "requires_confirmation": false,
  "execution_summary": "brief summary of the full pipeline",
  "fallback_plan": "what to do if the pipeline cannot execute"
}}"""
        result = await self.ollama.classify_json(prompt)
        if not result:
            return {
                "pipeline": [],
                "estimated_steps": 0,
                "high_risk_steps": [],
                "requires_confirmation": False,
                "execution_summary": "Unable to decompose request",
                "fallback_plan": "Process request manually"
            }
        # requires_confirmation must be true whenever any step carries high risk
        pipeline = result.get("pipeline", [])
        if any(step.get("risk_level") == "high" for step in pipeline):
            result["requires_confirmation"] = True
        return result
