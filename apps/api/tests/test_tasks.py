from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_task_crud_flow() -> None:
    created = client.post(
        "/tasks",
        json={
            "title": "Pay invoice",
            "description": "Vendor payment",
            "category": "finance",
            "priority": "high",
            "status": "today",
            "due_date": "2026-05-22",
            "source": "email",
            "assigned_agent": "agent-1",
        },
    )
    assert created.status_code == 200
    task = created.json()
    task_id = task["id"]

    listed = client.get("/tasks")
    assert listed.status_code == 200
    assert any(item["id"] == task_id for item in listed.json())

    updated = client.patch(f"/tasks/{task_id}", json={"status": "completed"})
    assert updated.status_code == 200
    assert updated.json()["status"] == "completed"

    deleted = client.delete(f"/tasks/{task_id}")
    assert deleted.status_code == 200
