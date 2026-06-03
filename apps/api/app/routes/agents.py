import csv
import io
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.db.models import Agent, AgentRun
from app.agents.registry import get_registry
from app.services.agent_manifest_loader import (
    load_all as load_manifests,
    get_manifest,
    validate_manifest,
    sync_manifest_to_db,
    set_agent_enabled,
)

router = APIRouter(prefix="/agents", tags=["agents"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class AgentEnablePayload(BaseModel):
    enabled: bool


# ---------------------------------------------------------------------------
# Static-path routes FIRST (before /{agent_id})
# ---------------------------------------------------------------------------

@router.get("", response_model=list[dict])
def list_agents(db: Session = Depends(get_db)):
    registry = get_registry()
    agents = registry.all_agents()
    manifests_by_id = {m["id"]: m for m in load_manifests()}
    result = []
    for a in agents:
        manifest = manifests_by_id.get(a.id, {})
        db_agent = db.get(Agent, a.id)
        result.append({
            "id": a.id,
            "name": a.name,
            "agent_type": a.agent_type,
            "description": a.description,
            "risk_level": a.risk_level,
            "requires_approval_for": a.requires_approval_for,
            "enabled": db_agent.enabled if db_agent else True,
            "has_manifest": bool(manifest),
            "manifest_version": manifest.get("version"),
            "tools_allowed": manifest.get("tools_allowed", []),
            "voice_enabled": manifest.get("voice", {}).get("enabled", True),
        })
    return result


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


@router.get("/runs/export")
def export_runs(format: str = "json", limit: int = 500, db: Session = Depends(get_db)):
    runs = db.scalars(select(AgentRun).order_by(AgentRun.created_at.desc()).limit(limit)).all()
    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["id", "agent_id", "task_id", "status", "created_at", "completed_at", "error_message"])
        for r in runs:
            writer.writerow([
                r.id, r.agent_id, r.task_id, r.status,
                r.created_at.isoformat() if r.created_at else None,
                r.completed_at.isoformat() if r.completed_at else None,
                r.error_message,
            ])
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=agent_runs.csv"},
        )
    data = [
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
    return JSONResponse(content=data, headers={"Content-Disposition": "attachment; filename=agent_runs.json"})


@router.get("/manifests", response_model=list[dict])
def list_manifests():
    """Return all agent manifests from agents/manifests/*.yaml."""
    manifests = load_manifests()
    validated = []
    for m in manifests:
        errors = validate_manifest(m)
        validated.append({**m, "_errors": errors, "_valid": len(errors) == 0})
    return validated


@router.post("/manifests/sync")
def sync_manifests(db: Session = Depends(get_db)):
    """Sync all valid manifests to the Agent DB table."""
    manifests = load_manifests()
    synced, skipped = [], []
    for m in manifests:
        errors = validate_manifest(m)
        if errors:
            skipped.append({"id": m.get("id"), "errors": errors})
            continue
        agent = sync_manifest_to_db(m, db)
        synced.append(agent.id)
    return {"synced": synced, "skipped": skipped}


# ---------------------------------------------------------------------------
# Parameterized routes — MUST come after all static paths
# ---------------------------------------------------------------------------

@router.get("/{agent_id}", response_model=dict)
def get_agent(agent_id: str, db: Session = Depends(get_db)):
    registry = get_registry()
    agent = registry.get(agent_id)
    manifest = get_manifest(agent_id) or {}
    db_agent = db.get(Agent, agent_id)
    if not agent and not db_agent:
        raise HTTPException(404, "Agent not found")
    name = (agent.name if agent else None) or (db_agent.name if db_agent else agent_id)
    return {
        "id": agent_id,
        "name": name,
        "agent_type": agent.agent_type if agent else "unknown",
        "description": agent.description if agent else (db_agent.description if db_agent else ""),
        "risk_level": agent.risk_level if agent else "medium",
        "requires_approval_for": agent.requires_approval_for if agent else [],
        "enabled": db_agent.enabled if db_agent else True,
        "manifest": manifest,
    }


@router.get("/{agent_id}/manifest", response_model=dict)
def get_agent_manifest(agent_id: str):
    manifest = get_manifest(agent_id)
    if not manifest:
        raise HTTPException(404, f"No manifest found for agent '{agent_id}'")
    errors = validate_manifest(manifest)
    return {**manifest, "_errors": errors, "_valid": len(errors) == 0}


@router.patch("/{agent_id}/enabled", response_model=dict)
def toggle_agent(agent_id: str, payload: AgentEnablePayload, db: Session = Depends(get_db)):
    """Enable or disable an agent at runtime."""
    agent = set_agent_enabled(agent_id, payload.enabled, db)
    registry = get_registry()
    reg_agent = registry.get(agent_id)
    return {
        "id": agent_id,
        "enabled": agent.enabled,
        "name": reg_agent.name if reg_agent else agent.name,
    }


@router.post("/{agent_id}/run", response_model=dict)
async def run_agent(agent_id: str, input_data: dict, task_id: str | None = None, db: Session = Depends(get_db)):
    # Check if agent is disabled
    db_agent = db.get(Agent, agent_id)
    if db_agent and not db_agent.enabled:
        raise HTTPException(403, f"Agent '{agent_id}' is disabled")

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
