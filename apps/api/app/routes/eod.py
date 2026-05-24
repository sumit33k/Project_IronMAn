from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import date, datetime, timezone
from app.db.database import SessionLocal
from app.db.models import Task
from app.services.ollama_client import OllamaClient, OllamaUnavailableError

router = APIRouter(prefix="/eod", tags=["end-of-day"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_eod_data(db: Session) -> dict:
    today = date.today()
    today_str = today.isoformat()

    all_tasks = db.query(Task).all()

    completed_tasks = []
    deferred_tasks = []
    missed_tasks = []
    tomorrow_queue = []

    for t in all_tasks:
        if t.status == "done" and t.completed_at and t.completed_at.date() == today:
            completed_tasks.append({"title": t.title, "priority": t.priority})
        elif t.status == "deferred" and t.updated_at and t.updated_at.date() == today:
            deferred_tasks.append({"title": t.title, "priority": t.priority})
        elif t.due_date == today_str and t.status in ("todo", "inbox", "in_progress", "waiting"):
            missed_tasks.append({"title": t.title, "priority": t.priority, "status": t.status})
        elif t.status in ("todo", "inbox", "in_progress", "waiting") and t.priority in ("high", "critical", "urgent"):
            tomorrow_queue.append({"title": t.title, "priority": t.priority})

    return {
        "completed_tasks": completed_tasks,
        "deferred_tasks": deferred_tasks,
        "missed_tasks": missed_tasks,
        "tomorrow_queue": tomorrow_queue[:10],
    }


async def _build_eod_response(db: Session, notes: str = "") -> dict:
    today_str = date.today().isoformat()
    data = _get_eod_data(db)

    completed_count = len(data["completed_tasks"])
    deferred_count = len(data["deferred_tasks"])
    missed_count = len(data["missed_tasks"])
    fallback_score = completed_count / max(completed_count + missed_count, 1)

    ollama = OllamaClient()

    notes_section = f"\nUser notes: {notes}" if notes else ""

    prompt = f"""You are an end-of-day review AI for a personal command center.

Today's date: {today_str}
Completed tasks ({completed_count}): {data['completed_tasks']}
Deferred tasks ({deferred_count}): {data['deferred_tasks']}
Missed/overdue tasks ({missed_count}): {data['missed_tasks']}
Tomorrow's candidate queue: {data['tomorrow_queue']}{notes_section}

Return JSON only:
{{
  "summary": "2-3 sentence honest review of today's productivity",
  "momentum_score": 0.0_to_1.0,
  "delegation_opportunities": ["tasks that could be delegated"],
  "follow_ups_needed": ["items requiring follow-up tomorrow"],
  "recommended_actions": ["concrete actions to take tomorrow morning"]
}}"""

    try:
        result = await ollama.classify_json(prompt)
    except OllamaUnavailableError:
        result = {}

    if not result:
        return {
            "date": today_str,
            "completed_count": completed_count,
            "completed_tasks": data["completed_tasks"],
            "deferred_count": deferred_count,
            "deferred_tasks": data["deferred_tasks"],
            "missed_count": missed_count,
            "missed_tasks": data["missed_tasks"],
            "tomorrow_queue": data["tomorrow_queue"],
            "delegation_opportunities": [],
            "follow_ups_needed": [],
            "summary": "Ollama unavailable — manual review needed",
            "momentum_score": round(fallback_score, 2),
            "recommended_actions": [],
        }

    return {
        "date": today_str,
        "completed_count": completed_count,
        "completed_tasks": data["completed_tasks"],
        "deferred_count": deferred_count,
        "deferred_tasks": data["deferred_tasks"],
        "missed_count": missed_count,
        "missed_tasks": data["missed_tasks"],
        "tomorrow_queue": data["tomorrow_queue"],
        "delegation_opportunities": result.get("delegation_opportunities", []),
        "follow_ups_needed": result.get("follow_ups_needed", []),
        "summary": result.get("summary", ""),
        "momentum_score": result.get("momentum_score", round(fallback_score, 2)),
        "recommended_actions": result.get("recommended_actions", []),
    }


@router.get("/review")
async def get_eod_review(db: Session = Depends(get_db)):
    return await _build_eod_response(db)


@router.post("/review")
async def post_eod_review(payload: dict = {}, db: Session = Depends(get_db)):
    notes = payload.get("notes", "") if payload else ""
    return await _build_eod_response(db, notes=notes)
