from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import date, timedelta
from app.agents.base import BaseAgent
from app.db.models import Task


class FollowUpAgent(BaseAgent):
    id = "follow_up_agent"
    name = "Follow-Up Agent"
    agent_type = "follow_up"
    description = "Finds stale/waiting tasks and recommends follow-up actions"
    risk_level = "low"

    async def run(self, input_data: dict, db: Session) -> dict:
        today = date.today()
        week_ago = (today - timedelta(days=7)).isoformat()

        waiting_tasks = list(db.scalars(select(Task).where(Task.status == "waiting")).all())
        stale_tasks = list(db.scalars(select(Task).where(
            Task.status.in_(["inbox", "today"]),
            Task.updated_at < week_ago
        )).all())

        return {
            "waiting_tasks": [
                {"id": t.id, "title": t.title, "priority": t.priority, "due_date": t.due_date}
                for t in waiting_tasks
            ],
            "stale_tasks": [
                {"id": t.id, "title": t.title, "priority": t.priority}
                for t in stale_tasks[:10]
            ],
            "recommendations": [
                f"Follow up on: {t.title}" for t in waiting_tasks[:5]
            ],
            "total_waiting": len(waiting_tasks),
            "total_stale": len(stale_tasks)
        }
