from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class BriefingOut(BaseModel):
    id: str
    date: str
    summary: str
    top_priorities: list[str] = []
    meetings_to_prepare: list[str] = []
    urgent_followups: list[str] = []
    tasks_to_delegate: list[str] = []
    risks: list[str] = []
    recommended_schedule: list[str] = []
    focus_score: int = 75
    created_at: datetime

    class Config:
        from_attributes = True


class GenerateBriefingInput(BaseModel):
    upcoming_meetings: list[str] = []
    pending_follow_ups: list[str] = []
    date: Optional[str] = None
