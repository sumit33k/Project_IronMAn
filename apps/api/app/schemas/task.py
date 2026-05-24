from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    source: str = "manual"
    source_reference: Optional[str] = None
    status: str = "inbox"
    priority: str = "medium"
    due_date: Optional[str] = None
    deferred_until: Optional[str] = None
    category: str = "general"
    tags: list[str] = []
    personal_or_work: str = "work"
    next_action: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[str] = None
    deferred_until: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[list[str]] = None
    personal_or_work: Optional[str] = None
    next_action: Optional[str] = None
    agent_status: Optional[str] = None
    context_summary: Optional[str] = None


class TaskOut(BaseModel):
    id: str
    title: str
    description: Optional[str]
    source: str
    source_reference: Optional[str]
    status: str
    priority: str
    due_date: Optional[str]
    deferred_until: Optional[str]
    category: str
    tags: list[str] = []
    personal_or_work: str
    next_action: Optional[str]
    agent_id: Optional[str]
    agent_status: Optional[str]
    context_summary: Optional[str]
    confidence_score: Optional[float]
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True
