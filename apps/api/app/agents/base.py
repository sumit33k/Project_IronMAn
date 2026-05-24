import json
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Optional
from sqlalchemy.orm import Session
from app.db.models import AgentRun


class BaseAgent(ABC):
    id: str = ""
    name: str = ""
    agent_type: str = ""
    description: str = ""
    risk_level: str = "low"  # low, medium, high
    requires_approval_for: list[str] = []

    def __init__(self):
        from app.services.ollama_client import OllamaClient
        self.ollama = OllamaClient()

    @abstractmethod
    async def run(self, input_data: dict, db: Session) -> dict:
        pass

    async def execute(self, input_data: dict, db: Session, task_id: Optional[str] = None) -> AgentRun:
        run = AgentRun(
            id=str(uuid.uuid4()),
            task_id=task_id,
            agent_id=self.id,
            status="running",
            input_data=json.dumps(input_data),
            created_at=datetime.now(timezone.utc)
        )
        db.add(run)
        db.commit()

        try:
            output = await self.run(input_data, db)
            run.status = "completed"
            run.output_data = json.dumps(output)
            run.completed_at = datetime.now(timezone.utc)
        except Exception as e:
            run.status = "failed"
            run.error_message = str(e)
            run.completed_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(run)
        return run
