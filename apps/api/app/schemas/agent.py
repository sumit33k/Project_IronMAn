from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel


class AgentOut(BaseModel):
    id: str
    name: str
    agent_type: str
    description: str
    enabled: bool
    tools_allowed: list[str] = []
    model_provider: str
    model_name: str
    requires_approval_for: list[str] = []
    created_at: datetime

    class Config:
        from_attributes = True


class AgentRunCreate(BaseModel):
    task_id: Optional[str] = None
    input_data: dict = {}


class AgentRunOut(BaseModel):
    id: str
    task_id: Optional[str]
    agent_id: str
    status: str
    input_data: dict = {}
    output_data: Optional[dict] = None
    error_message: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True
