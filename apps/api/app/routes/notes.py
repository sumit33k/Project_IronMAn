from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, desc
from pydantic import BaseModel
from typing import Optional
from app.db.database import get_db
from app.db.models import Note
import json

router = APIRouter(prefix="/notes", tags=["notes"])

class NoteCreate(BaseModel):
    title: str
    body: str = ""
    linked_task_id: Optional[str] = None
    tags: list[str] = []
    pinned: bool = False

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    linked_task_id: Optional[str] = None
    tags: Optional[list[str]] = None
    pinned: Optional[bool] = None

def note_to_dict(n: Note) -> dict:
    return {
        "id": n.id,
        "title": n.title,
        "body": n.body,
        "linked_task_id": n.linked_task_id,
        "tags": json.loads(n.tags or "[]"),
        "pinned": n.pinned,
        "created_at": n.created_at.isoformat() if n.created_at else None,
        "updated_at": n.updated_at.isoformat() if n.updated_at else None,
    }

@router.get("")
def list_notes(search: str = "", db: Session = Depends(get_db)):
    q = select(Note).order_by(Note.pinned.desc(), desc(Note.updated_at))
    notes = list(db.scalars(q).all())
    if search:
        notes = [n for n in notes if search.lower() in n.title.lower() or search.lower() in n.body.lower()]
    return [note_to_dict(n) for n in notes]

@router.post("")
def create_note(data: NoteCreate, db: Session = Depends(get_db)):
    note = Note(title=data.title, body=data.body, linked_task_id=data.linked_task_id,
                tags=json.dumps(data.tags), pinned=data.pinned)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note_to_dict(note)

@router.get("/{note_id}")
def get_note(note_id: str, db: Session = Depends(get_db)):
    note = db.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note_to_dict(note)

@router.patch("/{note_id}")
def update_note(note_id: str, data: NoteUpdate, db: Session = Depends(get_db)):
    note = db.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    if data.title is not None: note.title = data.title
    if data.body is not None: note.body = data.body
    if data.linked_task_id is not None: note.linked_task_id = data.linked_task_id
    if data.tags is not None: note.tags = json.dumps(data.tags)
    if data.pinned is not None: note.pinned = data.pinned
    db.commit()
    db.refresh(note)
    return note_to_dict(note)

@router.delete("/{note_id}")
def delete_note(note_id: str, db: Session = Depends(get_db)):
    note = db.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    db.delete(note)
    db.commit()
    return {"ok": True}
