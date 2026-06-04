import json
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.db.models import Command
from app.schemas.command import CommandInput
from app.schemas.command_execution import CommandPreviewInput, CommandConfirmInput
from app.services.command_router import CommandRouter
from app.services.command_executor import CommandExecutor

router = APIRouter(prefix="/commands", tags=["commands"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _cmd_to_dict(cmd: Command) -> dict:
    payload: dict = {}
    try:
        payload = json.loads(cmd.payload or "{}")
    except Exception:
        pass

    exec_result = None
    try:
        if cmd.execution_result:
            exec_result = json.loads(cmd.execution_result)
    except Exception:
        pass

    return {
        "id": cmd.id,
        "raw_input": cmd.raw_input,
        "input_mode": cmd.input_mode,
        "interpreted_intent": cmd.interpreted_intent,
        "action_type": cmd.action_type,
        "target_resource_type": cmd.target_resource_type,
        "target_resource_id": cmd.target_resource_id,
        "payload": payload,
        "requires_confirmation": cmd.requires_confirmation,
        "status": cmd.status,
        "execution_result": exec_result,
        "error_message": cmd.error_message,
        "confirmed_at": cmd.confirmed_at.isoformat() if cmd.confirmed_at else None,
        "confirmation_method": cmd.confirmation_method,
        "executed_at": cmd.executed_at.isoformat() if cmd.executed_at else None,
        "completed_at": cmd.completed_at.isoformat() if cmd.completed_at else None,
        "latency_ms": cmd.latency_ms,
        "voice_session_id": cmd.voice_session_id,
        "created_at": cmd.created_at.isoformat() if cmd.created_at else None,
        # Flattened payload fields consumed by frontend normalizeCommandResult
        "command_id": cmd.id,
        "intent": cmd.interpreted_intent or payload.get("intent"),
        "confidence": payload.get("confidence", 0),
        "target_agent": payload.get("target_agent"),
        "task_id": payload.get("task_id") or cmd.target_resource_id,
        "parameters": payload.get("parameters", {}),
        "user_visible_summary": payload.get("user_visible_summary", ""),
        "confirmation_message": payload.get("confirmation_message"),
        # spoken_response: lifted from execution_result so the frontend can drive TTS directly
        "spoken_response": exec_result.get("spoken_response") if exec_result else None,
    }


# ---------------------------------------------------------------------------
# New execution endpoints (Phase 1)
# ---------------------------------------------------------------------------

@router.post("/preview", response_model=dict)
async def preview_command(payload: CommandPreviewInput, db: Session = Depends(get_db)):
    """Route a command and persist a record. Does not execute."""
    executor = CommandExecutor()
    cmd = await executor.preview(
        raw_input=payload.raw_input,
        input_mode=payload.input_mode,
        context=payload.context,
        db=db,
        voice_session_id=payload.voice_session_id,
    )
    return _cmd_to_dict(cmd)


@router.post("/execute", response_model=dict)
async def execute_command(payload: CommandPreviewInput, db: Session = Depends(get_db)):
    """Route a command and immediately execute it if it is low-risk.
    If the intent requires confirmation, returns status=awaiting_confirmation
    and does NOT execute — client must call /{id}/confirm."""
    executor = CommandExecutor()
    cmd = await executor.preview(
        raw_input=payload.raw_input,
        input_mode=payload.input_mode,
        context=payload.context,
        db=db,
        voice_session_id=payload.voice_session_id,
    )
    if not cmd.requires_confirmation:
        cmd = await executor.execute(cmd.id, db, confirmation_method="auto")
    return _cmd_to_dict(cmd)


# ---------------------------------------------------------------------------
# Legacy endpoints — MUST come before /{command_id} to avoid shadowing
# ---------------------------------------------------------------------------

@router.post("/route", response_model=dict)
async def route_command(payload: CommandInput, db: Session = Depends(get_db)):
    """Legacy: route only. No execution. Use /execute for the full flow."""
    cr = CommandRouter()
    result = await cr.route(payload.raw_input, payload.context)

    cmd = Command(
        id=str(uuid.uuid4()),
        raw_input=payload.raw_input,
        input_mode=payload.input_mode,
        interpreted_intent=result.get("intent"),
        payload=json.dumps(result),
        requires_confirmation=result.get("requires_confirmation", False),
        status="pending",
        created_at=datetime.now(timezone.utc),
    )
    db.add(cmd)
    db.commit()

    result["command_id"] = cmd.id
    return result


@router.get("/history", response_model=list[dict])
def command_history(limit: int = 50, db: Session = Depends(get_db)):
    cmds = db.scalars(
        select(Command).order_by(Command.created_at.desc()).limit(limit)
    ).all()
    return [
        {
            "id": c.id,
            "raw_input": c.raw_input,
            "input_mode": c.input_mode,
            "interpreted_intent": c.interpreted_intent,
            "requires_confirmation": c.requires_confirmation,
            "status": c.status,
            "execution_result": (
                json.loads(c.execution_result) if c.execution_result else None
            ),
            "latency_ms": c.latency_ms,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in cmds
    ]


# ---------------------------------------------------------------------------
# Parameterized endpoints — MUST come after all static-path endpoints
# ---------------------------------------------------------------------------

@router.post("/{command_id}/confirm", response_model=dict)
async def confirm_command(
    command_id: str,
    payload: CommandConfirmInput = CommandConfirmInput(),
    db: Session = Depends(get_db),
):
    """Confirm and execute a command that is awaiting_confirmation."""
    executor = CommandExecutor()
    try:
        cmd = await executor.confirm(
            command_id, db, confirmation_method=payload.confirmation_method
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return _cmd_to_dict(cmd)


@router.post("/{command_id}/cancel", response_model=dict)
def cancel_command(command_id: str, db: Session = Depends(get_db)):
    """Cancel a command that is awaiting_confirmation."""
    executor = CommandExecutor()
    try:
        cmd = executor.cancel(command_id, db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return _cmd_to_dict(cmd)


@router.get("/{command_id}", response_model=dict)
def get_command(command_id: str, db: Session = Depends(get_db)):
    """Get a command by ID."""
    cmd = db.get(Command, command_id)
    if not cmd:
        raise HTTPException(404, "Command not found")
    return _cmd_to_dict(cmd)
