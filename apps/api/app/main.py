from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from app.services.ollama_client import OllamaClient, OllamaUnavailableError

app = FastAPI(title="Project IronMAn API", version="0.2.0")


class BriefInput(BaseModel):
    todays_tasks: list[str] = Field(default_factory=list)
    overdue_tasks: list[str] = Field(default_factory=list)
    upcoming_meetings: list[str] = Field(default_factory=list)
    pending_follow_ups: list[str] = Field(default_factory=list)


class DailyBriefResponse(BaseModel):
    top_priorities: list[str]
    risks: list[str]
    suggested_schedule: list[str]
    follow_ups: list[str]
    recommended_deferrals: list[str]
from fastapi import FastAPI

app = FastAPI(title="Project IronMAn API", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/ai/daily-brief", response_model=DailyBriefResponse)
async def daily_brief(payload: BriefInput) -> DailyBriefResponse:
    client = OllamaClient()
    try:
        brief = await client.generate_daily_brief(payload.model_dump())
    except OllamaUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return DailyBriefResponse(**brief)
