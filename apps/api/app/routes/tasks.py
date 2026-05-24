import json
from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.db.models import Task
from app.schemas.task import TaskCreate, TaskOut, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["tasks"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def task_to_out(task: Task) -> dict:
    d = {c.key: getattr(task, c.key) for c in task.__table__.columns}
    try:
        d["tags"] = json.loads(d.get("tags") or "[]")
    except Exception:
        d["tags"] = []
    return d


@router.get("", response_model=list[dict])
def list_tasks(status: str | None = None, priority: str | None = None, db: Session = Depends(get_db)):
    q = select(Task).order_by(Task.created_at.desc())
    if status:
        q = q.where(Task.status == status)
    if priority:
        q = q.where(Task.priority == priority)
    return [task_to_out(t) for t in db.scalars(q).all()]


@router.post("", response_model=dict)
def create_task(payload: TaskCreate, db: Session = Depends(get_db)):
    import uuid
    data = payload.model_dump()
    tags = data.pop("tags", [])
    task = Task(**data, id=str(uuid.uuid4()), tags=json.dumps(tags))
    db.add(task)
    db.commit()
    db.refresh(task)
    return task_to_out(task)


@router.get("/today", response_model=list[dict])
def today_tasks(db: Session = Depends(get_db)):
    today = date.today().isoformat()
    tasks = db.scalars(select(Task).where(
        (Task.status == "today") | (Task.status == "in_progress") | (Task.due_date == today)
    ).order_by(Task.priority.desc())).all()
    return [task_to_out(t) for t in tasks]


@router.get("/overdue", response_model=list[dict])
def overdue_tasks(db: Session = Depends(get_db)):
    today = date.today().isoformat()
    tasks = db.scalars(select(Task).where(
        Task.due_date < today,
        Task.status.notin_(["completed", "archived", "deferred"])
    )).all()
    return [task_to_out(t) for t in tasks]


@router.get("/{task_id}", response_model=dict)
def get_task(task_id: str, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    return task_to_out(task)


@router.patch("/{task_id}", response_model=dict)
def update_task(task_id: str, payload: TaskUpdate, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    data = payload.model_dump(exclude_none=True)
    if "tags" in data:
        data["tags"] = json.dumps(data["tags"])
    for k, v in data.items():
        setattr(task, k, v)
    db.commit()
    db.refresh(task)
    return task_to_out(task)


@router.delete("/{task_id}")
def delete_task(task_id: str, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    db.delete(task)
    db.commit()
    return {"status": "deleted"}


@router.post("/{task_id}/complete", response_model=dict)
def complete_task(task_id: str, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    task.status = "completed"
    task.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(task)
    return task_to_out(task)


@router.post("/{task_id}/defer", response_model=dict)
def defer_task(task_id: str, defer_until: str | None = None, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    task.status = "deferred"
    if defer_until:
        task.deferred_until = defer_until
    db.commit()
    db.refresh(task)
    return task_to_out(task)


@router.post("/{task_id}/mark-waiting", response_model=dict)
def mark_waiting(task_id: str, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    task.status = "waiting"
    db.commit()
    db.refresh(task)
    return task_to_out(task)


@router.post("/{task_id}/delegate", response_model=dict)
def delegate_task(task_id: str, agent_id: str, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    task.agent_id = agent_id
    task.agent_status = "delegated"
    db.commit()
    db.refresh(task)
    return task_to_out(task)
