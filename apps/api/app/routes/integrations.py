import json
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.db.models import Integration, Task
from app.core.config import settings

router = APIRouter(prefix="/integrations", tags=["integrations"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("")
def list_integrations(db: Session = Depends(get_db)):
    rows = db.query(Integration).all()
    return [
        {
            "id": r.id,
            "integration_type": r.integration_type,
            "name": r.name,
            "status": r.status,
            "last_sync_at": r.last_sync_at.isoformat() if r.last_sync_at else None,
        }
        for r in rows
    ]


@router.get("/google/auth")
def google_auth_url(scope: str = "gmail"):
    import urllib.parse

    client_id = getattr(settings, "google_client_id", "") or ""
    redirect_uri = (
        getattr(settings, "google_redirect_uri", "http://localhost:8000/integrations/google/callback")
        or "http://localhost:8000/integrations/google/callback"
    )

    if not client_id:
        raise HTTPException(400, "GOOGLE_CLIENT_ID not configured. Add it to your .env file.")

    scopes = {
        "gmail": "https://www.googleapis.com/auth/gmail.readonly",
        "calendar": "https://www.googleapis.com/auth/calendar.readonly",
        "both": "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly",
    }
    scope_str = scopes.get(scope, scopes["gmail"])

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": scope_str,
        "access_type": "offline",
        "prompt": "consent",
    }
    auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)
    return {"auth_url": auth_url, "scope": scope}


@router.get("/google/callback")
async def google_callback(code: str, db: Session = Depends(get_db)):
    import httpx

    client_id = getattr(settings, "google_client_id", "")
    client_secret = getattr(settings, "google_client_secret", "")
    redirect_uri = getattr(
        settings, "google_redirect_uri", "http://localhost:8000/integrations/google/callback"
    )

    if not client_id or not client_secret:
        raise HTTPException(400, "Google OAuth not configured")

    async with httpx.AsyncClient() as client:
        r = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        token_data = r.json()

    if "error" in token_data:
        raise HTTPException(400, f"OAuth error: {token_data.get('error_description', token_data['error'])}")

    for integration_type in ["gmail", "gcalendar"]:
        row = db.query(Integration).filter_by(integration_type=integration_type).first()
        if row:
            row.status = "active"
            row.config = json.dumps(
                {
                    "access_token": token_data.get("access_token"),
                    "refresh_token": token_data.get("refresh_token"),
                    "expires_in": token_data.get("expires_in"),
                }
            )
            row.last_sync_at = datetime.now(timezone.utc)
    db.commit()

    return RedirectResponse(url="http://localhost:3000/integrations?status=connected")


@router.post("/{integration_type}/sync")
async def sync_integration(integration_type: str, db: Session = Depends(get_db)):
    row = db.query(Integration).filter_by(integration_type=integration_type).first()
    if not row:
        raise HTTPException(404, "Integration not found")
    if row.status != "active":
        raise HTTPException(
            400, f"Integration is not active. Connect it first via /integrations/google/auth"
        )

    config = json.loads(row.config or "{}")
    access_token = config.get("access_token", "")

    if integration_type == "gmail":
        items = await _sync_gmail(access_token, db)
    elif integration_type == "gcalendar":
        items = await _sync_calendar(access_token, db)
    else:
        raise HTTPException(400, f"Sync not supported for {integration_type}")

    row.last_sync_at = datetime.now(timezone.utc)
    db.commit()
    return {"status": "ok", "integration_type": integration_type, "items_imported": len(items), "items": items}


@router.post("/{integration_type}/disconnect")
def disconnect_integration(integration_type: str, db: Session = Depends(get_db)):
    row = db.query(Integration).filter_by(integration_type=integration_type).first()
    if not row:
        raise HTTPException(404, "Integration not found")
    row.status = "inactive"
    row.config = None
    db.commit()
    return {"status": "disconnected"}


async def _sync_gmail(access_token: str, db: Session) -> list:
    import httpx

    headers = {"Authorization": f"Bearer {access_token}"}
    tasks_created = []

    async with httpx.AsyncClient() as client:
        r = await client.get(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages",
            headers=headers,
            params={"q": "is:unread", "maxResults": 10},
        )
        if r.status_code != 200:
            return []

        messages = r.json().get("messages", [])

        for msg in messages[:10]:
            r2 = await client.get(
                f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg['id']}",
                headers=headers,
                params={"format": "metadata", "metadataHeaders": ["Subject", "From"]},
            )
            if r2.status_code != 200:
                continue

            msg_data = r2.json()
            headers_list = msg_data.get("payload", {}).get("headers", [])
            subject = next((h["value"] for h in headers_list if h["name"] == "Subject"), "No Subject")
            from_addr = next((h["value"] for h in headers_list if h["name"] == "From"), "Unknown")

            existing = db.query(Task).filter_by(source_reference=msg["id"]).first()
            if existing:
                continue

            task = Task(
                id=str(uuid.uuid4()),
                title=f"Email: {subject[:100]}",
                description=f"From: {from_addr}",
                source="email",
                source_reference=msg["id"],
                status="inbox",
                priority="medium",
                category="email",
                personal_or_work="work",
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            db.add(task)
            tasks_created.append({"title": task.title, "source": "gmail"})

    db.commit()
    return tasks_created


async def _sync_calendar(access_token: str, db: Session) -> list:
    import httpx
    from datetime import date, timedelta

    headers = {"Authorization": f"Bearer {access_token}"}
    today = date.today()
    tomorrow = today + timedelta(days=1)
    tasks_created = []

    async with httpx.AsyncClient() as client:
        r = await client.get(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events",
            headers=headers,
            params={
                "timeMin": f"{today.isoformat()}T00:00:00Z",
                "timeMax": f"{tomorrow.isoformat()}T23:59:59Z",
                "singleEvents": True,
                "orderBy": "startTime",
                "maxResults": 20,
            },
        )
        if r.status_code != 200:
            return []

        events = r.json().get("items", [])

        for event in events:
            event_id = event.get("id", "")
            title = event.get("summary", "Untitled Meeting")
            start = event.get("start", {}).get("dateTime", event.get("start", {}).get("date", ""))

            existing = db.query(Task).filter_by(source_reference=event_id).first()
            if existing:
                continue

            task = Task(
                id=str(uuid.uuid4()),
                title=f"Meeting: {title}",
                description=f"Calendar event starting at {start}",
                source="calendar",
                source_reference=event_id,
                status="today",
                priority="high",
                category="meeting",
                personal_or_work="work",
                due_date=today.isoformat(),
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            db.add(task)
            tasks_created.append({"title": task.title, "source": "gcalendar", "start": start})

        db.commit()

    return tasks_created
