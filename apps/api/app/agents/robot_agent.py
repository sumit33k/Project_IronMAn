import json
from sqlalchemy.orm import Session
from app.agents.base import BaseAgent
from app.db.models import IoTDevice


class RobotAgent(BaseAgent):
    id = "robot_agent"
    name = "Robot Agent"
    agent_type = "iot_control"
    description = "Controls iRobot and Roborock vacuums — start/stop/dock, interpret status, create cleaning schedules"
    risk_level = "low"
    requires_approval_for = []

    async def run(self, input_data: dict, db: Session) -> dict:
        command = input_data.get("command", "status")
        robot_name = input_data.get("robot_name", "")
        context = input_data.get("context", "")

        robots = db.query(IoTDevice).all()
        robot_summaries = [
            {"name": r.name, "type": r.device_type, "status": r.status,
             "last_state": json.loads(r.last_state or "{}")}
            for r in robots
        ]

        prompt = f"""You are a smart home robot assistant managing vacuum cleaners.

Available robots:
{json.dumps(robot_summaries, indent=2)}

User request: "{command}"
Robot name filter: "{robot_name or 'any'}"
Context: "{context}"

Interpret the request and return JSON:
{{
  "action": "clean|stop|dock|pause|find|status|schedule",
  "target_robot": "robot name or null for all",
  "reasoning": "why this action",
  "schedule_suggestion": "if scheduling: cron expression or natural language time",
  "response_message": "friendly confirmation message to user",
  "follow_up_tasks": ["any tasks to create as follow-up"]
}}"""

        result = await self.ollama.classify_json(prompt)
        if not result:
            return {
                "action": command if command in ("clean", "stop", "dock", "pause", "find") else "status",
                "target_robot": robot_name or None,
                "reasoning": "Executing requested action",
                "schedule_suggestion": None,
                "response_message": f"Sending {command} command to {robot_name or 'all robots'}",
                "follow_up_tasks": [],
            }
        return result
