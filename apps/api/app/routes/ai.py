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
