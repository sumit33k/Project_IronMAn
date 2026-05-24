"""Initialize system records (integration registry). No task data — users add their own."""
import uuid
from app.db.database import SessionLocal, Base, engine
from app.db.models import Integration

Base.metadata.create_all(bind=engine)

INTEGRATION_TYPES = [
    {"integration_type": "gmail",     "name": "Gmail",            "status": "inactive"},
    {"integration_type": "gcalendar", "name": "Google Calendar",  "status": "inactive"},
    {"integration_type": "notion",    "name": "Notion",           "status": "inactive"},
    {"integration_type": "slack",     "name": "Slack",            "status": "inactive"},
]


def seed_integrations(db=None):
    close = db is None
    if db is None:
        db = SessionLocal()
    try:
        existing = {r.integration_type for r in db.query(Integration).all()}
        added = 0
        for intg in INTEGRATION_TYPES:
            if intg["integration_type"] not in existing:
                db.add(Integration(
                    id=str(uuid.uuid4()),
                    integration_type=intg["integration_type"],
                    name=intg["name"],
                    status=intg["status"],
                ))
                added += 1
        db.commit()
        if added:
            print(f"Initialized {added} integration slots.")
    finally:
        if close:
            db.close()


if __name__ == "__main__":
    seed_integrations()
