from fastapi.testclient import TestClient

from app.agents.registry import get_registry
from app.db.database import SessionLocal
from app.db.models import Agent, AgentRun
from app.main import app

client = TestClient(app)


def test_run_registered_agent_syncs_definition_before_creating_run(monkeypatch) -> None:
    db = SessionLocal()
    try:
        db.query(AgentRun).filter_by(agent_id="task_classifier_agent").delete()
        db.query(Agent).filter_by(id="task_classifier_agent").delete()
        db.commit()
    finally:
        db.close()

    agent = get_registry().get("task_classifier_agent")
    assert agent is not None

    async def fake_run(input_data: dict, db) -> dict:
        return {
            "title": input_data["text"],
            "priority": "medium",
            "confidence_score": 1.0,
        }

    monkeypatch.setattr(agent, "run", fake_run)

    response = client.post("/agents/task_classifier_agent/run", json={"text": "Call the bank"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["agent_id"] == "task_classifier_agent"
    assert payload["status"] == "completed"
    assert payload["output_data"]["title"] == "Call the bank"

    db = SessionLocal()
    try:
        db_agent = db.get(Agent, "task_classifier_agent")
        assert db_agent is not None
        assert db_agent.name == "Task Classifier"
        assert db_agent.agent_type == "task_classifier"
    finally:
        db.close()
