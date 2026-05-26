import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class OAuthToken(Base):
    __tablename__ = "oauth_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    provider: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    access_token_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_token_encrypted: Mapped[str] = mapped_column(Text, nullable=True)
    token_type: Mapped[str] = mapped_column(String(32), nullable=True)
    expires_at: Mapped[str] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(64), default="manual")
    source_reference: Mapped[str] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="inbox")
    priority: Mapped[str] = mapped_column(String(16), default="medium")
    due_date: Mapped[str] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    deferred_until: Mapped[str] = mapped_column(String(32), nullable=True)
    category: Mapped[str] = mapped_column(String(64), default="general")
    tags: Mapped[str] = mapped_column(Text, default="[]")
    personal_or_work: Mapped[str] = mapped_column(String(16), default="work")
    next_action: Mapped[str] = mapped_column(Text, nullable=True)
    agent_id: Mapped[str] = mapped_column(String(36), nullable=True)
    agent_status: Mapped[str] = mapped_column(String(32), nullable=True)
    context_summary: Mapped[str] = mapped_column(Text, nullable=True)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=True)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), nullable=True)

    agent_runs: Mapped[list["AgentRun"]] = relationship(
        "AgentRun",
        back_populates="task",
        cascade="all, delete-orphan",
    )


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    agent_type: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    tools_allowed: Mapped[str] = mapped_column(Text, default="[]")
    model_provider: Mapped[str] = mapped_column(String(64), default="ollama")
    model_name: Mapped[str] = mapped_column(String(128), default="llama3.1")
    requires_approval_for: Mapped[str] = mapped_column(Text, default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    runs: Mapped[list["AgentRun"]] = relationship("AgentRun", back_populates="agent")


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    task_id: Mapped[str] = mapped_column(String(36), ForeignKey("tasks.id"), nullable=True)
    agent_id: Mapped[str] = mapped_column(String(36), ForeignKey("agents.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="running")
    input_data: Mapped[str] = mapped_column(Text, default="{}")
    output_data: Mapped[str] = mapped_column(Text, nullable=True)
    error_message: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    task: Mapped["Task"] = relationship("Task", back_populates="agent_runs")
    agent: Mapped["Agent"] = relationship("Agent", back_populates="runs")


class Command(Base):
    __tablename__ = "commands"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    raw_input: Mapped[str] = mapped_column(Text, nullable=False)
    input_mode: Mapped[str] = mapped_column(String(32), default="text")
    transcript: Mapped[str] = mapped_column(Text, nullable=True)
    interpreted_intent: Mapped[str] = mapped_column(String(128), nullable=True)
    payload: Mapped[str] = mapped_column(Text, default="{}")
    requires_confirmation: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DailyBriefing(Base):
    __tablename__ = "daily_briefings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    date: Mapped[str] = mapped_column(String(16), nullable=False)
    summary: Mapped[str] = mapped_column(Text, default="")
    top_priorities: Mapped[str] = mapped_column(Text, default="[]")
    meetings_to_prepare: Mapped[str] = mapped_column(Text, default="[]")
    urgent_followups: Mapped[str] = mapped_column(Text, default="[]")
    tasks_to_delegate: Mapped[str] = mapped_column(Text, default="[]")
    risks: Mapped[str] = mapped_column(Text, default="[]")
    recommended_schedule: Mapped[str] = mapped_column(Text, default="[]")
    focus_score: Mapped[int] = mapped_column(Integer, default=75)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Integration(Base):
    __tablename__ = "integrations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    integration_type: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="inactive")
    config: Mapped[str] = mapped_column(Text, default="{}")
    last_sync_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class IoTDevice(Base):
    __tablename__ = "iot_devices"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    device_type: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    ip_address: Mapped[str] = mapped_column(String(64), nullable=True)
    credentials: Mapped[str] = mapped_column(Text, default="{}")
    status: Mapped[str] = mapped_column(String(32), default="unknown")
    last_state: Mapped[str] = mapped_column(Text, default="{}")
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AppSettings(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(255), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Note(Base):
    __tablename__ = "notes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    body: Mapped[str] = mapped_column(Text, default="")
    linked_task_id: Mapped[str] = mapped_column(String(36), ForeignKey("tasks.id"), nullable=True)
    tags: Mapped[str] = mapped_column(Text, default="[]")
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(32), default="active")  # active|completed|archived
    color: Mapped[str] = mapped_column(String(16), default="#6366f1")
    due_date: Mapped[str] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Routine(Base):
    __tablename__ = "routines"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    frequency: Mapped[str] = mapped_column(String(32), default="daily")  # daily|weekly|weekdays|weekends
    target_time: Mapped[str] = mapped_column(String(8), nullable=True)  # HH:MM
    duration_minutes: Mapped[int] = mapped_column(Integer, default=30)
    category: Mapped[str] = mapped_column(String(64), default="general")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    streak: Mapped[int] = mapped_column(Integer, default=0)
    last_completed: Mapped[str] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
