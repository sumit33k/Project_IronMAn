from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.database import Base, engine
from app.routes import tasks, agents, commands, briefings, ai, voice, settings
from app.routes import eod, integrations as integrations_router, robots as robots_router
from app.agents.registry import get_registry
from app.agents.task_classifier import TaskClassifierAgent
from app.agents.daily_briefing import DailyBriefingAgent
from app.agents.presentation import PresentationAgent
from app.agents.email_draft import EmailDraftAgent
from app.agents.follow_up import FollowUpAgent
from app.agents.calendar_prep import CalendarPrepAgent
from app.agents.document_agent import DocumentAgent
from app.agents.research_agent import ResearchAgent
from app.agents.routine_agent import RoutineAgent
from app.agents.orchestrator_agent import OrchestratorAgent
from app.agents.call_agent import CallAgent
from app.agents.robot_agent import RobotAgent

Base.metadata.create_all(bind=engine)

# Initialize integration registry slots (no user data)
from app.seed import seed_integrations
from app.db.database import SessionLocal as _SL
_db = _SL()
try:
    seed_integrations(_db)
finally:
    _db.close()

registry = get_registry()
for agent in [
    TaskClassifierAgent(),
    DailyBriefingAgent(),
    PresentationAgent(),
    EmailDraftAgent(),
    FollowUpAgent(),
    CalendarPrepAgent(),
    DocumentAgent(),
    ResearchAgent(),
    RoutineAgent(),
    OrchestratorAgent(),
    CallAgent(),
    RobotAgent(),
]:
    registry.register(agent)

app = FastAPI(
    title="Project IronMAn — Jarvis Command Center API",
    version="1.0.0",
    description="Local-first AI productivity command center",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow all origins so iPhone/Watch on same LAN can reach the API
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks.router)
app.include_router(agents.router)
app.include_router(commands.router)
app.include_router(briefings.router)
app.include_router(ai.router)
app.include_router(voice.router)
app.include_router(settings.router)
app.include_router(eod.router)
app.include_router(integrations_router.router)
app.include_router(robots_router.router)


@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0", "service": "Jarvis Command Center API"}


@app.get("/watch/brief")
def watch_brief():
    """
    Siri Shortcut / Apple Watch endpoint — returns a one-sentence spoken summary.
    Example Shortcut: Get Contents of URL → http://YOUR_IP:8000/watch/brief
    → Show Result / Speak Text → use 'spoken_summary' field.
    """
    from app.db.database import SessionLocal as _SL
    from app.db.models import Task, IoTDevice
    import json as _json
    db = _SL()
    try:
        urgent = db.query(Task).filter(Task.status.in_(["today", "in_progress"]), Task.priority.in_(["urgent", "high"])).count()
        total_today = db.query(Task).filter(Task.status == "today").count()
        robots = db.query(IoTDevice).all()
        robot_parts = [f"{r.name} is {r.status}" for r in robots] if robots else []

        parts = []
        if urgent:
            parts.append(f"{urgent} urgent task{'s' if urgent != 1 else ''}")
        if total_today:
            parts.append(f"{total_today} task{'s' if total_today != 1 else ''} in today queue")
        if robot_parts:
            parts.append(", ".join(robot_parts))

        spoken = "Jarvis: " + (". ".join(parts) + "." if parts else "All clear. Nothing urgent.")
        return {
            "spoken_summary": spoken,
            "urgent_count": urgent,
            "today_count": total_today,
            "robots": [{"name": r.name, "status": r.status} for r in robots],
        }
    finally:
        db.close()
