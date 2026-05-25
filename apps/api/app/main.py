from datetime import date

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.database import Base, SessionLocal, engine
from app.db.models import Task
from app.db.schemas import TaskCreate, TaskOut, TaskUpdate
from app.services.gmail_service import GmailNotConnectedError, GmailService
from app.services.ollama_client import OllamaClient, OllamaUnavailableError

Base.metadata.create_all(bind=engine)
app = FastAPI(title="Project IronMAn API", version="0.5.0")

gmail_service = GmailService()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class BriefInput(BaseModel):
    todays_tasks: list[str] = Field(default_factory=list)
    overdue_tasks: list[str] = Field(default_factory=list)
    upcoming_meetings: list[str] = Field(default_factory=list)
    pending_follow_ups: list[str] = Field(default_factory=list)


class DailyBriefResponse(BaseModel):
    top_priorities: list[str]
    risks: list[str]
    suggested_schedule: list[str]
    follow_ups: list[str]
    recommended_deferrals: list[str]


class GmailConnectPayload(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str | None = "Bearer"
    expires_at: str | None = None


class GmailExtractPayload(BaseModel):
    email_text: str


class GmailDraftPayload(BaseModel):
    email_text: str
    goal: str


class GmailTaskFromActionPayload(BaseModel):
    title: str
    description: str | None = None
    due_date: str | None = None
    source_link: str


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/gmail/oauth/start")
def gmail_oauth_start() -> dict[str, str]:
    return {"auth_url": gmail_service.get_auth_url()}


@app.post("/gmail/connect")
def gmail_connect(payload: GmailConnectPayload, db: Session = Depends(get_db)) -> dict[str, str]:
    gmail_service.store_tokens(db, payload.access_token, payload.refresh_token, payload.token_type, payload.expires_at)
    return {"status": "connected"}


@app.post("/gmail/disconnect")
def gmail_disconnect(db: Session = Depends(get_db)) -> dict[str, str]:
    gmail_service.disconnect(db)
    return {"status": "disconnected"}


@app.get("/gmail/recent")
async def gmail_recent(max_results: int = 10, db: Session = Depends(get_db)):
    try:
        return await gmail_service.recent_emails(db, max_results)
    except GmailNotConnectedError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/gmail/extract")
async def gmail_extract(payload: GmailExtractPayload):
    try:
        return await gmail_service.extract_actions(payload.email_text)
    except OllamaUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/gmail/draft-reply")
async def gmail_draft(payload: GmailDraftPayload):
    try:
        draft = await gmail_service.draft_reply(payload.email_text, payload.goal)
    except OllamaUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"approval_required": True, "auto_send": False, "draft": draft}


@app.post("/tasks/from-email-action", response_model=TaskOut)
def task_from_email_action(payload: GmailTaskFromActionPayload, db: Session = Depends(get_db)) -> Task:
    task = Task(
        title=payload.title,
        description=payload.description,
        category="office",
        priority="medium",
        status="inbox",
        due_date=payload.due_date,
        source=payload.source_link,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@app.post("/tasks", response_model=TaskOut)
def create_task(payload: TaskCreate, db: Session = Depends(get_db)) -> Task:
    task = Task(**payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@app.get("/tasks", response_model=list[TaskOut])
def list_tasks(db: Session = Depends(get_db)) -> list[Task]:
    return list(db.scalars(select(Task).order_by(Task.created_at.desc())).all())


@app.get("/tasks/today", response_model=list[TaskOut])
def list_today_tasks(db: Session = Depends(get_db)) -> list[Task]:
    today = date.today().isoformat()
    return list(db.scalars(select(Task).where((Task.status == "today") | (Task.due_date == today))).all())


@app.get("/tasks/overdue", response_model=list[TaskOut])
def list_overdue_tasks(db: Session = Depends(get_db)) -> list[Task]:
    today = date.today().isoformat()
    return list(db.scalars(select(Task).where(Task.due_date < today, Task.status != "completed", Task.status != "archived")).all())


@app.patch("/tasks/{task_id}", response_model=TaskOut)
def update_task(task_id: int, payload: TaskUpdate, db: Session = Depends(get_db)) -> Task:
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(task, key, value)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@app.delete("/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)) -> dict[str, str]:
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
    return {"status": "deleted"}


@app.post("/ai/daily-brief", response_model=DailyBriefResponse)
async def daily_brief(payload: BriefInput) -> DailyBriefResponse:
    client = OllamaClient()
    try:
        brief = await client.generate_daily_brief(payload.model_dump())
    except OllamaUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return DailyBriefResponse(**brief)
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
