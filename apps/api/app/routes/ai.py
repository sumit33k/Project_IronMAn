from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.ollama_client import OllamaClient, OllamaUnavailableError

router = APIRouter(prefix="/ai", tags=["ai"])


class ClassifyInput(BaseModel):
    text: str


class NextActionInput(BaseModel):
    task_title: str
    task_description: str = ""
    context: str = ""


@router.get("/health")
async def ai_health():
    client = OllamaClient()
    available = await client.health_check()
    models = await client.list_models() if available else []
    return {"ollama_available": available, "models": models}


@router.post("/classify-task")
async def classify_task(payload: ClassifyInput):
    try:
        from app.agents.task_classifier import TaskClassifierAgent
        from app.db.database import SessionLocal
        db = SessionLocal()
        agent = TaskClassifierAgent()
        run = await agent.execute({"text": payload.text}, db)
        import json
        return json.loads(run.output_data or "{}")
    except OllamaUnavailableError as e:
        raise HTTPException(503, str(e))
    finally:
        db.close()


@router.post("/recommend-next-action")
async def recommend_next_action(payload: NextActionInput):
    client = OllamaClient()
    try:
        prompt = f"""For this task, recommend the single most important next action.

Task: {payload.task_title}
Description: {payload.task_description}
Context: {payload.context}

Return JSON: {{"next_action": "specific next action", "rationale": "why this action"}}"""
        return await client.classify_json(prompt)
    except OllamaUnavailableError as e:
        raise HTTPException(503, str(e))


@router.get("/suggestions")
async def get_suggestions():
    from app.db.database import SessionLocal
    from app.db.models import Task
    from datetime import date

    db = SessionLocal()
    try:
        today = date.today().isoformat()
        today_tasks = db.query(Task).filter(
            Task.status.in_(["today", "in_progress"])
        ).limit(10).all()
        overdue_tasks = db.query(Task).filter(
            Task.due_date < today,
            Task.status.notin_(["completed", "archived", "deferred"])
        ).limit(5).all()

        client = OllamaClient()
        try:
            if await client.health_check():
                task_titles = [t.title for t in today_tasks]
                overdue_titles = [t.title for t in overdue_tasks]
                prompt = f"""You are a productivity assistant. Generate 3 specific actionable suggestions.

Today's tasks: {task_titles}
Overdue: {overdue_titles}

Return JSON only:
{{
  "suggestions": [
    {{"text": "specific advice referencing actual task names", "action": "button label", "type": "warning|tip|info", "priority": "high|medium|low"}},
    {{"text": "...", "action": "...", "type": "...", "priority": "..."}},
    {{"text": "...", "action": "...", "type": "...", "priority": "..."}}
  ]
}}"""
                result = await client.classify_json(prompt)
                if result and result.get("suggestions"):
                    return result
        except OllamaUnavailableError:
            pass

        # Rule-based fallback when Ollama is offline
        suggestions = []
        if overdue_tasks:
            suggestions.append({
                "text": f"{len(overdue_tasks)} overdue task(s). '{overdue_tasks[0].title}' needs attention.",
                "action": "View Overdue", "type": "warning", "priority": "high",
            })
        if today_tasks:
            suggestions.append({
                "text": f"Start with '{today_tasks[0].title}' — your top priority today.",
                "action": "Open Task", "type": "tip", "priority": "high",
            })
        if len(today_tasks) > 3:
            suggestions.append({
                "text": f"You have {len(today_tasks)} tasks today. Consider deferring lower-priority items.",
                "action": "Review Tasks", "type": "info", "priority": "medium",
            })
        if not suggestions:
            suggestions.append({
                "text": "No overdue tasks — great! Use this time to plan tomorrow.",
                "action": "Plan Ahead", "type": "info", "priority": "low",
            })
        return {"suggestions": suggestions[:3]}
    finally:
        db.close()
