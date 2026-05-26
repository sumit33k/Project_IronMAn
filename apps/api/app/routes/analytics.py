from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_
from datetime import date, timedelta
from app.db.database import get_db
from app.db.models import Task, AgentRun, Command

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/summary")
def analytics_summary(days: int = 30, db: Session = Depends(get_db)):
    today = date.today()
    start = today - timedelta(days=days)
    start_iso = start.isoformat()

    # Tasks completed per day (last 30 days)
    all_tasks = list(db.scalars(select(Task)).all())

    daily_completed: dict[str, int] = {}
    for t in all_tasks:
        if t.completed_at and t.status == "done":
            day = str(t.completed_at)[:10]
            if day >= start_iso:
                daily_completed[day] = daily_completed.get(day, 0) + 1

    # Fill missing days with 0
    completion_trend = []
    for i in range(days):
        d = (start + timedelta(days=i)).isoformat()
        completion_trend.append({"date": d, "completed": daily_completed.get(d, 0)})

    # Priority breakdown (active tasks only)
    active = [t for t in all_tasks if t.status not in ("done", "deferred")]
    priority_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for t in active:
        p = t.priority if t.priority in priority_counts else "medium"
        priority_counts[p] += 1

    # Status breakdown
    status_counts: dict[str, int] = {}
    for t in all_tasks:
        status_counts[t.status] = status_counts.get(t.status, 0) + 1

    # Category breakdown (active tasks)
    category_counts: dict[str, int] = {}
    for t in active:
        cat = t.category or "general"
        category_counts[cat] = category_counts.get(cat, 0) + 1

    # Agent usage
    runs = list(db.scalars(select(AgentRun)).all())
    agent_usage: dict[str, int] = {}
    for r in runs:
        agent_usage[r.agent_id] = agent_usage.get(r.agent_id, 0) + 1
    top_agents = sorted(agent_usage.items(), key=lambda x: x[1], reverse=True)[:5]

    # Total stats
    total = len(all_tasks)
    done_count = status_counts.get("done", 0)
    completion_rate = round((done_count / total * 100) if total > 0 else 0)

    # Voice / command usage
    commands = list(db.scalars(select(Command)).all())
    voice_commands = sum(1 for c in commands if c.input_mode == "voice")
    text_commands = len(commands) - voice_commands

    return {
        "period_days": days,
        "total_tasks": total,
        "completed_tasks": done_count,
        "completion_rate": completion_rate,
        "active_tasks": len(active),
        "completion_trend": completion_trend,
        "priority_breakdown": [
            {"priority": k, "count": v} for k, v in priority_counts.items()
        ],
        "status_breakdown": [
            {"status": k, "count": v} for k, v in sorted(status_counts.items(), key=lambda x: x[1], reverse=True)
        ],
        "category_breakdown": sorted(
            [{"category": k, "count": v} for k, v in category_counts.items()],
            key=lambda x: x["count"], reverse=True
        )[:8],
        "top_agents": [{"agent_id": a, "runs": c} for a, c in top_agents],
        "command_usage": {"voice": voice_commands, "text": text_commands, "total": len(commands)},
    }
