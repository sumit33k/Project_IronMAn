import json
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.db.models import Command
from app.schemas.command import CommandInput
from app.services.command_router import CommandRouter

router = APIRouter(prefix="/commands", tags=["commands"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/route", response_model=dict)
async def route_command(payload: CommandInput, db: Session = Depends(get_db)):
    cr = CommandRouter()
    result = await cr.route(payload.raw_input, payload.context)

    cmd = Command(
        id=str(uuid.uuid4()),
        raw_input=payload.raw_input,
        input_mode=payload.input_mode,
        interpreted_intent=result.get("intent"),
        payload=json.dumps(result),
        requires_confirmation=result.get("requires_confirmation", False),
        status="pending",
        created_at=datetime.now(timezone.utc)
    )
    db.add(cmd)
    db.commit()

    result["command_id"] = cmd.id
    return result


@router.get("/history", response_model=list[dict])
def command_history(limit: int = 50, db: Session = Depends(get_db)):
    cmds = db.scalars(select(Command).order_by(Command.created_at.desc()).limit(limit)).all()
    return [
        {
            "id": c.id,
            "raw_input": c.raw_input,
            "input_mode": c.input_mode,
            "interpreted_intent": c.interpreted_intent,
            "requires_confirmation": c.requires_confirmation,
            "status": c.status,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in cmds
    ]
