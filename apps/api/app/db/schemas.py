from datetime import datetime
from typing import Literal

from pydantic import BaseModel

TaskStatus = Literal["inbox", "today", "in_progress", "waiting", "deferred", "scheduled", "completed", "archived"]
TaskCategory = Literal["office", "personal", "finance", "health", "errands", "project"]
TaskPriority = Literal["critical", "high", "medium", "low"]


class TaskBase(BaseModel):
    title: str
    description: str | None = None
    category: TaskCategory
    priority: TaskPriority
    status: TaskStatus = "inbox"
    due_date: str | None = None
    source: str | None = None
    assigned_agent: str | None = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    category: TaskCategory | None = None
    priority: TaskPriority | None = None
    status: TaskStatus | None = None
    due_date: str | None = None
    source: str | None = None
    assigned_agent: str | None = None


class TaskOut(TaskBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
