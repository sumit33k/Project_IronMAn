from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class CommandPreviewInput(BaseModel):
    raw_input: str
    input_mode: str = "text"
    context: dict = {}
    voice_session_id: Optional[str] = None


class CommandConfirmInput(BaseModel):
    confirmation_method: str = "button"


class CommandExecutionOut(BaseModel):
    id: str
    raw_input: str
    input_mode: str
    interpreted_intent: Optional[str] = None
    action_type: Optional[str] = None
    target_resource_type: Optional[str] = None
    target_resource_id: Optional[str] = None
    requires_confirmation: bool
    status: str
    execution_result: Optional[dict] = None
    error_message: Optional[str] = None
    # flattened from payload for client convenience
    intent: Optional[str] = None
    confidence: float = 0.0
    user_visible_summary: str = ""
    confirmation_message: Optional[str] = None
    target_agent: Optional[str] = None
    task_id: Optional[str] = None
    parameters: dict = {}
    # timing
    confirmed_at: Optional[datetime] = None
    confirmation_method: Optional[str] = None
    executed_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    latency_ms: Optional[int] = None
    voice_session_id: Optional[str] = None
    created_at: Optional[datetime] = None
    # legacy alias consumed by frontend normalizeCommandResult
    command_id: Optional[str] = None
