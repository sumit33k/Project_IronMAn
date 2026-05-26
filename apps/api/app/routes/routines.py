from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from datetime import date
from app.db.database import get_db
from app.db.models import Routine

router = APIRouter(prefix="/routines", tags=["routines"])

class RoutineCreate(BaseModel):
    name: str
    description: str = ""
    frequency: str = "daily"
    target_time: Optional[str] = None
    duration_minutes: int = 30
    category: str = "general"

class RoutineUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    frequency: Optional[str] = None
    target_time: Optional[str] = None
    duration_minutes: Optional[int] = None
    category: Optional[str] = None
    active: Optional[bool] = None

def routine_to_dict(r: Routine) -> dict:
    return {
        "id": r.id, "name": r.name, "description": r.description,
        "frequency": r.frequency, "target_time": r.target_time,
        "duration_minutes": r.duration_minutes, "category": r.category,
        "active": r.active, "streak": r.streak, "last_completed": r.last_completed,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }

@router.get("")
def list_routines(db: Session = Depends(get_db)):
    routines = list(db.scalars(select(Routine).where(Routine.active == True)).all())
    return [routine_to_dict(r) for r in routines]

@router.post("")
def create_routine(data: RoutineCreate, db: Session = Depends(get_db)):
    routine = Routine(**data.model_dump())
    db.add(routine)
    db.commit()
    db.refresh(routine)
    return routine_to_dict(routine)

@router.patch("/{routine_id}")
def update_routine(routine_id: str, data: RoutineUpdate, db: Session = Depends(get_db)):
    routine = db.get(Routine, routine_id)
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(routine, k, v)
    db.commit()
    db.refresh(routine)
    return routine_to_dict(routine)

@router.post("/{routine_id}/complete")
def complete_routine(routine_id: str, db: Session = Depends(get_db)):
    routine = db.get(Routine, routine_id)
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")
    today = date.today().isoformat()
    if routine.last_completed == today:
        return {"ok": True, "already_done": True, "streak": routine.streak}
    routine.last_completed = today
    routine.streak = (routine.streak or 0) + 1
    db.commit()
    return {"ok": True, "already_done": False, "streak": routine.streak}

@router.delete("/{routine_id}")
def delete_routine(routine_id: str, db: Session = Depends(get_db)):
    routine = db.get(Routine, routine_id)
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")
    db.delete(routine)
    db.commit()
    return {"ok": True}
