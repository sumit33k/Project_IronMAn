from sqlalchemy.orm import Session
from app.agents.base import BaseAgent


class TaskClassifierAgent(BaseAgent):
    id = "task_classifier_agent"
    name = "Task Classifier"
    agent_type = "task_classifier"
    description = "Classifies tasks, extracts due dates, recommends priority and next actions"
    risk_level = "low"

    async def run(self, input_data: dict, db: Session) -> dict:
        task_text = input_data.get("text", input_data.get("title", ""))
        prompt = f"""Classify this task for a personal AI command center.

Task: "{task_text}"

Return JSON only:
{{
  "title": "clean task title",
  "description": "brief description",
  "category": "office|personal|finance|health|errands|project",
  "personal_or_work": "work|personal",
  "priority": "low|medium|high|urgent",
  "due_date": null_or_"YYYY-MM-DD",
  "next_action": "the single next concrete action",
  "recommended_status": "inbox|today|in_progress|waiting|deferred",
  "should_delegate": false,
  "suggested_agent": null_or_agent_name,
  "confidence_score": 0.0_to_1.0
}}"""
        result = await self.ollama.classify_json(prompt)
        if not result:
            return {
                "title": task_text,
                "description": "",
                "category": "general",
                "personal_or_work": "work",
                "priority": "medium",
                "due_date": None,
                "next_action": "Review and prioritize",
                "recommended_status": "inbox",
                "should_delegate": False,
                "suggested_agent": None,
                "confidence_score": 0.5
            }
        return result
