import json
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
        request = input_data.get("request", "") or input_data.get("raw", "")
        context = input_data.get("context", "")

        # Populate available_agents from the live registry if caller didn't provide them
        from app.agents.registry import get_registry
        registry = get_registry()
        available_agents = (
            input_data.get("available_agents")
            or [a.id for a in registry.all_agents()]
        )

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
                "fallback_plan": "Process request manually",
                "executed": False,
                "spoken_response": "I couldn't plan the steps for that request.",
            }

        pipeline = result.get("pipeline", [])
        has_high_risk = any(step.get("risk_level") == "high" for step in pipeline)

        if has_high_risk:
            result["requires_confirmation"] = True
            result["executed"] = False
            high_count = sum(1 for s in pipeline if s.get("risk_level") == "high")
            result["spoken_response"] = (
                f"This plan has {high_count} high-risk step(s) that need your approval. "
                "Please review and confirm."
            )
            return result

        # No high-risk steps — execute the pipeline immediately
        result["requires_confirmation"] = False
        step_results = []
        context_carry: dict = {}

        for step in sorted(pipeline, key=lambda s: s.get("step", 0)):
            step_num = step.get("step", "?")
            step_agent_id = step.get("agent_id", "")

            if not step_agent_id:
                step_results.append({
                    "step": step_num, "status": "skipped", "reason": "no agent_id",
                })
                continue

            # Resolve agent: registry first, then factory
            agent = registry.get(step_agent_id)
            if not agent:
                from app.services.agent_factory import AgentFactory
                agent = AgentFactory.register_if_missing(step_agent_id, db)

            if not agent:
                step_results.append({
                    "step": step_num,
                    "agent_id": step_agent_id,
                    "status": "skipped",
                    "reason": f"Agent '{step_agent_id}' not found or could not be created",
                })
                continue

            step_input = {**step.get("input_template", {}), **context_carry}
            if not step_input.get("raw") and request:
                step_input["raw"] = request

            try:
                run = await agent.execute(step_input, db)
                output = json.loads(run.output_data) if run.output_data else {}
                step_results.append({
                    "step": step_num,
                    "agent_id": step_agent_id,
                    "status": run.status,
                    "output": output,
                })
                # Pass this step's output as context to the next step
                context_carry[f"step_{step_num}_output"] = output
            except Exception as exc:
                step_results.append({
                    "step": step_num,
                    "agent_id": step_agent_id,
                    "status": "failed",
                    "error": str(exc),
                })

        completed = sum(1 for s in step_results if s.get("status") == "completed")
        failed = sum(1 for s in step_results if s.get("status") == "failed")

        result["step_results"] = step_results
        result["executed"] = True
        result["spoken_response"] = (
            f"Pipeline complete. {completed} of {len(step_results)} step(s) succeeded."
            + (f" {failed} step(s) failed." if failed else "")
        )
        return result
