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
