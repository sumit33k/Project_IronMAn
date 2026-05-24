import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.db.models import Agent, AgentRun
from app.agents.registry import get_registry

router = APIRouter(prefix="/agents", tags=["agents"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("", response_model=list[dict])
def list_agents():
    registry = get_registry()
    agents = registry.all_agents()
    return [
        {
            "id": a.id,
            "name": a.name,
            "agent_type": a.agent_type,
            "description": a.description,
            "risk_level": a.risk_level,
            "requires_approval_for": a.requires_approval_for,
        }
        for a in agents
    ]


@router.get("/runs/all", response_model=list[dict])
def list_runs(limit: int = 50, db: Session = Depends(get_db)):
    runs = db.scalars(select(AgentRun).order_by(AgentRun.created_at.desc()).limit(limit)).all()
    return [
        {
            "id": r.id,
            "agent_id": r.agent_id,
            "task_id": r.task_id,
            "status": r.status,
            "input_data": json.loads(r.input_data) if r.input_data else {},
            "output_data": json.loads(r.output_data) if r.output_data else None,
            "error_message": r.error_message,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        }
        for r in runs
    ]


@router.get("/{agent_id}", response_model=dict)
def get_agent(agent_id: str):
    registry = get_registry()
    agent = registry.get(agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")
    return {
        "id": agent.id,
        "name": agent.name,
        "agent_type": agent.agent_type,
        "description": agent.description,
        "risk_level": agent.risk_level,
        "requires_approval_for": agent.requires_approval_for,
    }


@router.post("/{agent_id}/run", response_model=dict)
async def run_agent(agent_id: str, input_data: dict, task_id: str | None = None, db: Session = Depends(get_db)):
    registry = get_registry()
    agent = registry.get(agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")

    run = await agent.execute(input_data, db, task_id=task_id)
    return {
        "id": run.id,
        "agent_id": run.agent_id,
        "task_id": run.task_id,
        "status": run.status,
        "input_data": json.loads(run.input_data),
        "output_data": json.loads(run.output_data) if run.output_data else None,
        "error_message": run.error_message,
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
    }
