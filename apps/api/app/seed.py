"""Seed the database with demo data. Run: python -m app.seed"""
import uuid
from datetime import date, timedelta
from app.db.database import SessionLocal, Base, engine
from app.db.models import Task, Integration

Base.metadata.create_all(bind=engine)

TODAY = date.today().isoformat()
TOMORROW = (date.today() + timedelta(days=1)).isoformat()
YESTERDAY = (date.today() - timedelta(days=1)).isoformat()

TASKS = [
    {"title": "Review Infoblox proposal", "priority": "high", "status": "today", "category": "office", "due_date": TODAY},
    {"title": "Prepare for client meeting (Acme Corp)", "priority": "high", "status": "today", "category": "office", "due_date": TODAY},
    {"title": "Follow up with Raj (Contract)", "priority": "medium", "status": "today", "category": "office"},
    {"title": "Review project plan with team", "priority": "medium", "status": "today", "category": "office"},
    {"title": "Finalize client status update email", "priority": "high", "status": "today", "category": "office", "due_date": TODAY},
    {"title": "Block time for deep work", "priority": "low", "status": "today", "category": "office"},
    {"title": "Submit expense report", "priority": "high", "status": "inbox", "due_date": YESTERDAY, "category": "finance"},
    {"title": "Schedule Q3 planning session", "priority": "medium", "status": "inbox", "category": "office"},
    {"title": "Update LinkedIn profile", "priority": "low", "status": "deferred", "category": "personal"},
    {"title": "Review vendor contract renewal", "priority": "urgent", "status": "waiting", "category": "office"},
    {"title": "Prepare presentation for board", "priority": "high", "status": "in_progress", "category": "office", "due_date": TOMORROW},
    {"title": "Research new project management tools", "priority": "low", "status": "deferred", "category": "office"},
    {"title": "Gym session", "priority": "medium", "status": "inbox", "category": "health", "personal_or_work": "personal"},
    {"title": "Book flights for client visit", "priority": "high", "status": "inbox", "due_date": TOMORROW, "category": "office"},
    {"title": "Review team performance reports", "priority": "medium", "status": "inbox", "category": "office"},
]

INTEGRATIONS = [
    {"integration_type": "gmail",    "name": "Gmail",           "status": "inactive"},
    {"integration_type": "gcalendar","name": "Google Calendar",  "status": "inactive"},
    {"integration_type": "notion",   "name": "Notion",           "status": "inactive"},
    {"integration_type": "slack",    "name": "Slack",            "status": "inactive"},
]


def seed():
    db = SessionLocal()
    try:
        existing = db.query(Task).count()
        if existing > 0:
            print(f"Database already has {existing} tasks. Skipping seed.")
            return

        for t in TASKS:
            task = Task(
                id=str(uuid.uuid4()),
                title=t["title"],
                priority=t.get("priority", "medium"),
                status=t.get("status", "inbox"),
                category=t.get("category", "general"),
                due_date=t.get("due_date"),
                personal_or_work=t.get("personal_or_work", "work"),
                source="seed",
            )
            db.add(task)

        for intg in INTEGRATIONS:
            db.add(Integration(
                id=str(uuid.uuid4()),
                integration_type=intg["integration_type"],
                name=intg["name"],
                status=intg["status"],
            ))

        db.commit()
        print(f"✅ Seeded {len(TASKS)} tasks and {len(INTEGRATIONS)} integrations.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
