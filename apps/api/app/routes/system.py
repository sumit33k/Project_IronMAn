from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.db.models import AgentRun, AppSettings

router = APIRouter(prefix="/system", tags=["system"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/persist")
def persist_on_shutdown(db: Session = Depends(get_db)):
    """Called by the launcher before process termination to flush in-flight state."""
    now = datetime.now(timezone.utc)

    # Mark any agent runs that are still "running" as interrupted so they
    # aren't stuck in that state on next boot.
    stuck = db.query(AgentRun).filter(AgentRun.status == "running").all()
    for run in stuck:
        run.status = "interrupted"
        run.error_message = "Jarvis shutdown while run was in progress"
        run.completed_at = now

    # Record the shutdown timestamp for diagnostics / next-boot welcome message.
    key = "last_shutdown_at"
    setting = db.get(AppSettings, key)
    if setting:
        setting.value = now.isoformat()
    else:
        db.add(AppSettings(key=key, value=now.isoformat()))

    db.commit()
    return {
        "status": "ok",
        "persisted_runs": len(stuck),
        "shutdown_at": now.isoformat(),
    }


@router.get("/status")
def system_status(db: Session = Depends(get_db)):
    """Returns uptime metadata useful for the dashboard health badge."""
    last_shutdown = db.get(AppSettings, "last_shutdown_at")
    running_count = db.query(AgentRun).filter(AgentRun.status == "running").count()
    return {
        "status": "running",
        "last_shutdown_at": last_shutdown.value if last_shutdown else None,
        "active_agent_runs": running_count,
    }
