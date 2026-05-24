import json
import uuid
from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.db.models import DailyBriefing, Task
from app.schemas.briefing import GenerateBriefingInput
from app.agents.daily_briefing import DailyBriefingAgent

router = APIRouter(prefix="/briefings", tags=["briefings"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def briefing_to_dict(b: DailyBriefing) -> dict:
    return {
        "id": b.id,
        "date": b.date,
        "summary": b.summary,
        "top_priorities": json.loads(b.top_priorities or "[]"),
        "meetings_to_prepare": json.loads(b.meetings_to_prepare or "[]"),
        "urgent_followups": json.loads(b.urgent_followups or "[]"),
        "tasks_to_delegate": json.loads(b.tasks_to_delegate or "[]"),
        "risks": json.loads(b.risks or "[]"),
        "recommended_schedule": json.loads(b.recommended_schedule or "[]"),
        "focus_score": b.focus_score,
        "created_at": b.created_at.isoformat() if b.created_at else None,
    }


@router.get("/today", response_model=dict | None)
def get_today_briefing(db: Session = Depends(get_db)):
    today = date.today().isoformat()
    briefing = db.scalars(select(DailyBriefing).where(DailyBriefing.date == today).order_by(DailyBriefing.created_at.desc())).first()
    if not briefing:
        return None
    return briefing_to_dict(briefing)


@router.post("/generate", response_model=dict)
async def generate_briefing(payload: GenerateBriefingInput, db: Session = Depends(get_db)):
    agent = DailyBriefingAgent()
    run = await agent.execute({
        "upcoming_meetings": payload.upcoming_meetings,
        "pending_follow_ups": payload.pending_follow_ups,
    }, db)

    if run.status == "failed":
        raise HTTPException(503, f"Briefing generation failed: {run.error_message}")

    output = json.loads(run.output_data or "{}")
    today = payload.date or date.today().isoformat()

    briefing = DailyBriefing(
        id=str(uuid.uuid4()),
        date=today,
        summary=output.get("summary", ""),
        top_priorities=json.dumps(output.get("top_priorities", [])),
        meetings_to_prepare=json.dumps(output.get("meetings_to_prepare", output.get("meetings_to_prepare_for", []))),
        urgent_followups=json.dumps(output.get("follow_ups", output.get("urgent_followups", []))),
        tasks_to_delegate=json.dumps(output.get("tasks_to_delegate", [])),
        risks=json.dumps(output.get("risks", [])),
        recommended_schedule=json.dumps(output.get("suggested_schedule", output.get("recommended_schedule", []))),
        focus_score=output.get("focus_score", 75),
        created_at=datetime.now(timezone.utc),
    )
    db.add(briefing)
    db.commit()
    db.refresh(briefing)
    return briefing_to_dict(briefing)
