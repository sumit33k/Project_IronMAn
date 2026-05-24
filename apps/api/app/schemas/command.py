from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel


class CommandInput(BaseModel):
    raw_input: str
    input_mode: str = "text"
    context: dict = {}


class CommandRouterOutput(BaseModel):
    intent: str
    confidence: float
    target_agent: Optional[str] = None
    task_id: Optional[str] = None
    parameters: dict = {}
    requires_confirmation: bool = False
    confirmation_message: Optional[str] = None
    user_visible_summary: str


class CommandOut(BaseModel):
    id: str
    raw_input: str
    input_mode: str
    interpreted_intent: Optional[str]
    payload: dict = {}
    requires_confirmation: bool
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
