from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import date
from app.agents.base import BaseAgent
from app.db.models import Task


class DailyBriefingAgent(BaseAgent):
    id = "daily_briefing_agent"
    name = "Daily Briefing Agent"
    agent_type = "daily_briefing"
    description = "Creates your daily command briefing with priorities, risks, and recommendations"
    risk_level = "low"

    async def run(self, input_data: dict, db: Session) -> dict:
        today = date.today().isoformat()

        today_tasks = list(db.scalars(select(Task).where(
            (Task.status == "today") | (Task.status == "in_progress")
        )).all())

        overdue_tasks = list(db.scalars(select(Task).where(
            Task.due_date < today,
            Task.status.notin_(["completed", "archived", "deferred"])
        )).all())

        waiting_tasks = list(db.scalars(select(Task).where(Task.status == "waiting")).all())

        context = {
            "todays_tasks": [f"{t.title} ({t.priority})" for t in today_tasks],
            "overdue_tasks": [f"{t.title} - due {t.due_date}" for t in overdue_tasks],
            "waiting_tasks": [t.title for t in waiting_tasks],
            "upcoming_meetings": input_data.get("upcoming_meetings", []),
            "pending_follow_ups": input_data.get("pending_follow_ups", []),
        }

        result = await self.ollama.generate_daily_brief(context)
        result["date"] = today
        return result
