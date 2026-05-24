from sqlalchemy.orm import Session
from app.agents.base import BaseAgent


class RoutineAgent(BaseAgent):
    id = "routine_agent"
    name = "Routine Agent"
    agent_type = "routine_manager"
    description = "Manages recurring habits and personal routines, suggests optimizations"
    risk_level = "low"
    requires_approval_for = []

    async def run(self, input_data: dict, db: Session) -> dict:
        routines = input_data.get("routines", [])
        completed_today = input_data.get("completed_today", [])
        current_time = input_data.get("current_time", "")
        day_of_week = input_data.get("day_of_week", "")
        completed_count = len(completed_today)
        total = len(routines)

        prompt = f"""Analyze the following daily routines and provide optimization recommendations.

Current time: {current_time}
Day: {day_of_week}
Routines: {routines}
Completed today: {completed_today}

Return JSON only:
{{
  "pending_routines": [
    {{
      "name": "routine name",
      "target_time": "HH:MM",
      "urgency": "low|medium|high"
    }}
  ],
  "completed_count": {completed_count},
  "completion_rate": 0.0,
  "suggested_schedule": [
    {{
      "time": "HH:MM",
      "activity": "activity name",
      "duration_minutes": 30
    }}
  ],
  "optimization_tips": ["tip 1", "tip 2"],
  "streak_at_risk": ["routine name"],
  "focus_recommendation": "single actionable focus recommendation"
}}"""
        result = await self.ollama.classify_json(prompt)
        if not result:
            return {
                "pending_routines": [],
                "completed_count": 0,
                "completion_rate": 0.0,
                "suggested_schedule": [],
                "optimization_tips": ["Set up your daily routines to get started"],
                "streak_at_risk": [],
                "focus_recommendation": "Add some routines to track your habits"
            }
        return result
