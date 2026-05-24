from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.database import Base, engine
from app.routes import tasks, agents, commands, briefings, ai, voice, settings
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
]:
    registry.register(agent)

app = FastAPI(
    title="Project IronMAn — Jarvis Command Center API",
    version="1.0.0",
    description="Local-first AI productivity command center",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000"],
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


@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0", "service": "Jarvis Command Center API"}
