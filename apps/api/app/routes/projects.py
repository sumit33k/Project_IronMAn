from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, desc, func
from pydantic import BaseModel
from typing import Optional
from app.db.database import get_db
from app.db.models import Project, Task

router = APIRouter(prefix="/projects", tags=["projects"])

class ProjectCreate(BaseModel):
    title: str
    description: str = ""
    color: str = "#6366f1"
    due_date: Optional[str] = None

class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    color: Optional[str] = None
    due_date: Optional[str] = None

def project_to_dict(p: Project, db: Session) -> dict:
    total = db.scalar(select(func.count()).select_from(Task).where(Task.project_id == p.id)) or 0
    done = db.scalar(select(func.count()).select_from(Task).where(Task.project_id == p.id, Task.status == "done")) or 0
    return {
        "id": p.id,
        "title": p.title,
        "description": p.description,
        "status": p.status,
        "color": p.color,
        "due_date": p.due_date,
        "task_count": total,
        "completed_count": done,
        "progress": round((done / total * 100) if total > 0 else 0),
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }

@router.get("")
def list_projects(db: Session = Depends(get_db)):
    projects = list(db.scalars(select(Project).order_by(desc(Project.updated_at))).all())
    return [project_to_dict(p, db) for p in projects]

@router.post("")
def create_project(data: ProjectCreate, db: Session = Depends(get_db)):
    project = Project(title=data.title, description=data.description,
                      color=data.color, due_date=data.due_date)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project_to_dict(project, db)

@router.get("/{project_id}")
def get_project(project_id: str, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project_to_dict(project, db)

@router.get("/{project_id}/tasks")
def get_project_tasks(project_id: str, db: Session = Depends(get_db)):
    tasks = list(db.scalars(select(Task).where(Task.project_id == project_id)).all())
    return [{"id": t.id, "title": t.title, "status": t.status, "priority": t.priority,
             "due_date": t.due_date, "category": t.category} for t in tasks]

@router.patch("/{project_id}")
def update_project(project_id: str, data: ProjectUpdate, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if data.title is not None: project.title = data.title
    if data.description is not None: project.description = data.description
    if data.status is not None: project.status = data.status
    if data.color is not None: project.color = data.color
    if data.due_date is not None: project.due_date = data.due_date
    db.commit()
    db.refresh(project)
    return project_to_dict(project, db)

@router.delete("/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()
    return {"ok": True}
