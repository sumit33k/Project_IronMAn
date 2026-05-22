from datetime import date

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.database import Base, SessionLocal, engine
from app.db.models import Task
from app.db.schemas import TaskCreate, TaskOut, TaskUpdate
from app.services.ollama_client import OllamaClient, OllamaUnavailableError

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Project IronMAn API", version="0.3.0")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from app.services.ollama_client import OllamaClient, OllamaUnavailableError

app = FastAPI(title="Project IronMAn API", version="0.2.0")


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
from fastapi import FastAPI

app = FastAPI(title="Project IronMAn API", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


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


class DailyBriefFromTasksInput(BaseModel):
    upcoming_meetings: list[str] = Field(default_factory=list)
    pending_follow_ups: list[str] = Field(default_factory=list)


@app.post("/ai/daily-brief/from-tasks", response_model=DailyBriefResponse)
async def daily_brief_from_tasks(
    payload: DailyBriefFromTasksInput,
    db: Session = Depends(get_db),
) -> DailyBriefResponse:
    today_tasks = [f"{t.title} ({t.priority})" for t in list_today_tasks(db)]
    overdue_tasks = [f"{t.title} (due {t.due_date})" for t in list_overdue_tasks(db)]

    payload = {
        "todays_tasks": today_tasks,
        "overdue_tasks": overdue_tasks,
        "upcoming_meetings": payload.upcoming_meetings,
        "pending_follow_ups": payload.pending_follow_ups,
    }
    client = OllamaClient()
    try:
        brief = await client.generate_daily_brief(payload)
    except OllamaUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return DailyBriefResponse(**brief)
