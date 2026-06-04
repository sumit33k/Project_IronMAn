"""
CommandExecutor — the single place where commands are routed AND executed.

Status lifecycle:
  preview:  routed  |  awaiting_confirmation
  execute:  routed/awaiting_confirmation → executing → completed | failed
  confirm:  awaiting_confirmation → executing → completed | failed
  cancel:   awaiting_confirmation → cancelled
"""
import json
import time
import uuid
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.db.models import Command, DailyBriefing, Task
from app.services.command_router import CommandRouter
from app.services.confirmation_policy import (
    confirmation_message_for,
    requires_confirmation,
)
from app.services.agent_orchestrator import AgentOrchestrator, _spoken_from_direct_result


def _infer_resource_type(intent: Optional[str]) -> Optional[str]:
    if not intent:
        return None
    task_intents = {
        "create_task", "complete_task", "defer_task", "mark_waiting",
        "delegate_task", "prioritize_task", "update_task",
    }
    if intent in task_intents:
        return "task"
    if intent in ("show_briefing", "generate_daily_briefing"):
        return "briefing"
    if intent == "draft_email":
        return "email_draft"
    return None


class CommandExecutor:
    def __init__(self):
        self.router = CommandRouter()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def preview(
        self,
        raw_input: str,
        input_mode: str,
        context: dict,
        db: Session,
        voice_session_id: Optional[str] = None,
    ) -> Command:
        """Route a command and persist a Command record. Does not execute."""
        start_ms = int(time.time() * 1000)
        route = await self.router.route(raw_input, context)
        latency = int(time.time() * 1000) - start_ms

        intent = route.get("intent", "ask_general_question")
        needs_confirm = requires_confirmation(intent)
        if needs_confirm:
            route["requires_confirmation"] = True
            route["confirmation_message"] = confirmation_message_for(
                intent, route.get("user_visible_summary", intent)
            )

        params = route.get("parameters", {})
        status = "awaiting_confirmation" if needs_confirm else "routed"

        cmd = Command(
            id=str(uuid.uuid4()),
            raw_input=raw_input,
            input_mode=input_mode,
            interpreted_intent=intent,
            action_type=intent,
            target_resource_type=_infer_resource_type(intent),
            target_resource_id=(
                route.get("task_id")
                or params.get("task_id")
            ),
            payload=json.dumps(route),
            requires_confirmation=needs_confirm,
            status=status,
            latency_ms=latency,
            voice_session_id=voice_session_id,
            created_at=datetime.now(timezone.utc),
        )
        db.add(cmd)
        db.commit()
        db.refresh(cmd)
        return cmd

    async def execute(
        self,
        command_id: str,
        db: Session,
        confirmation_method: str = "auto",
    ) -> Command:
        """Execute a routed or awaiting_confirmation command."""
        cmd = db.get(Command, command_id)
        if not cmd:
            raise ValueError(f"Command {command_id} not found")
        if cmd.status not in ("routed", "awaiting_confirmation", "pending"):
            raise ValueError(
                f"Command {command_id} has status '{cmd.status}', cannot execute"
            )

        if cmd.status == "awaiting_confirmation":
            cmd.confirmed_at = datetime.now(timezone.utc)
            cmd.confirmation_method = confirmation_method

        cmd.status = "executing"
        cmd.executed_at = datetime.now(timezone.utc)
        db.commit()

        try:
            result = await self._run_intent(cmd, db)
            cmd.execution_result = json.dumps(result)
            cmd.status = "completed"
        except Exception as exc:
            cmd.error_message = str(exc)
            cmd.status = "failed"

        cmd.completed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(cmd)
        return cmd

    async def confirm(
        self,
        command_id: str,
        db: Session,
        confirmation_method: str = "button",
    ) -> Command:
        """Confirm and execute a command awaiting confirmation."""
        cmd = db.get(Command, command_id)
        if not cmd:
            raise ValueError(f"Command {command_id} not found")
        if cmd.status != "awaiting_confirmation":
            raise ValueError(
                f"Command {command_id} has status '{cmd.status}', expected awaiting_confirmation"
            )
        return await self.execute(command_id, db, confirmation_method=confirmation_method)

    def cancel(self, command_id: str, db: Session) -> Command:
        """Cancel a command awaiting confirmation."""
        cmd = db.get(Command, command_id)
        if not cmd:
            raise ValueError(f"Command {command_id} not found")
        cmd.status = "cancelled"
        cmd.completed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(cmd)
        return cmd

    # ------------------------------------------------------------------
    # Intent execution handlers
    # ------------------------------------------------------------------

    async def _run_intent(self, cmd: Command, db: Session) -> dict:
        payload = json.loads(cmd.payload or "{}")
        intent = cmd.action_type or payload.get("intent", "ask_general_question")
        params = payload.get("parameters", {})
        task_id = cmd.target_resource_id or payload.get("task_id") or params.get("task_id")
        target_agent = payload.get("target_agent")

        direct_handlers = {
            "create_task": lambda: self._create_task(params, cmd.input_mode, db),
            "complete_task": lambda: self._complete_task(task_id, db),
            "defer_task": lambda: self._defer_task(task_id, params, db),
            "mark_waiting": lambda: self._mark_waiting(task_id, db),
            "prioritize_task": lambda: self._prioritize_task(task_id, params, db),
            "show_today": lambda: self._show_today(db),
            "show_briefing": lambda: self._show_briefing(db),
        }

        if intent in direct_handlers:
            handler = direct_handlers[intent]
            import inspect
            result = await handler() if inspect.iscoroutinefunction(handler) else handler()
            result.setdefault("spoken_response", _spoken_from_direct_result(intent, result))
            return result

        # All other intents go through AgentOrchestrator (resolves + creates agent if needed)
        orchestrator = AgentOrchestrator()
        # For agent-backed intents pass explicit params overrides where needed
        agent_params = dict(params)
        if intent in ("generate_daily_briefing",):
            agent_params.setdefault("type", "morning")
        elif intent in ("generate_end_of_day_review",):
            agent_params.setdefault("type", "eod")
        elif intent == "delegate_task":
            agent_params["task_id"] = task_id

        result = await orchestrator.resolve_and_run(
            intent=intent,
            params=agent_params,
            agent_id=target_agent,
            db=db,
            task_id=task_id,
        )
        return result

    def _create_task(self, params: dict, input_mode: str, db: Session) -> dict:
        title = params.get("title") or params.get("raw", "")
        if not title:
            return {"status": "error", "message": "No title found for task creation."}
        task = Task(
            id=str(uuid.uuid4()),
            title=title,
            priority=params.get("priority", "medium"),
            status=params.get("status", "inbox"),
            due_date=params.get("due_date"),
            category=params.get("category", "general"),
            source="voice" if input_mode == "voice" else "manual",
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        return {"status": "created", "task_id": task.id, "title": task.title}

    def _complete_task(self, task_id: Optional[str], db: Session) -> dict:
        if not task_id:
            return {"status": "error", "message": "No task ID provided for complete_task."}
        task = db.get(Task, task_id)
        if not task:
            return {"status": "error", "message": f"Task {task_id} not found."}
        task.status = "completed"
        task.completed_at = datetime.now(timezone.utc)
        db.commit()
        return {"status": "completed", "task_id": task_id, "title": task.title}

    def _defer_task(self, task_id: Optional[str], params: dict, db: Session) -> dict:
        if not task_id:
            return {"status": "error", "message": "No task ID provided for defer_task."}
        task = db.get(Task, task_id)
        if not task:
            return {"status": "error", "message": f"Task {task_id} not found."}
        task.status = "deferred"
        defer_until = params.get("defer_until") or params.get("date")
        if defer_until:
            task.deferred_until = defer_until
        db.commit()
        return {
            "status": "deferred",
            "task_id": task_id,
            "title": task.title,
            "defer_until": defer_until,
        }

    def _mark_waiting(self, task_id: Optional[str], db: Session) -> dict:
        if not task_id:
            return {"status": "error", "message": "No task ID provided for mark_waiting."}
        task = db.get(Task, task_id)
        if not task:
            return {"status": "error", "message": f"Task {task_id} not found."}
        task.status = "waiting"
        db.commit()
        return {"status": "waiting", "task_id": task_id, "title": task.title}

    def _prioritize_task(self, task_id: Optional[str], params: dict, db: Session) -> dict:
        if not task_id:
            return {"status": "error", "message": "No task ID provided for prioritize_task."}
        task = db.get(Task, task_id)
        if not task:
            return {"status": "error", "message": f"Task {task_id} not found."}
        priority = params.get("priority", "high")
        task.priority = priority
        db.commit()
        return {"status": "prioritized", "task_id": task_id, "priority": priority}

    def _show_today(self, db: Session) -> dict:
        today = date.today().isoformat()
        tasks = (
            db.query(Task)
            .filter(
                (Task.status == "today")
                | (Task.status == "in_progress")
                | (Task.due_date == today)
            )
            .order_by(Task.priority.desc())
            .limit(10)
            .all()
        )
        return {
            "status": "ok",
            "count": len(tasks),
            "tasks": [
                {"id": t.id, "title": t.title, "priority": t.priority, "status": t.status}
                for t in tasks
            ],
        }

    def _show_briefing(self, db: Session) -> dict:
        today = date.today().isoformat()
        briefing = (
            db.query(DailyBriefing)
            .filter(DailyBriefing.date == today)
            .order_by(DailyBriefing.created_at.desc())
            .first()
        )
        if not briefing:
            return {
                "status": "not_found",
                "message": "No briefing for today. Generate one first.",
            }
        return {
            "status": "ok",
            "briefing_id": briefing.id,
            "summary": briefing.summary,
            "focus_score": briefing.focus_score,
        }

