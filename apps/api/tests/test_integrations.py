import uuid

from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.db.models import Integration
from app.main import app

client = TestClient(app)


def test_disconnect_gmail_clears_config_without_nulling_required_column() -> None:
    db = SessionLocal()
    try:
        gmail = db.query(Integration).filter_by(integration_type="gmail").first()
        if not gmail:
            gmail = Integration(
                id=str(uuid.uuid4()),
                integration_type="gmail",
                name="Gmail",
            )
            db.add(gmail)

        gmail.status = "active"
        gmail.config = '{"access_token":"secret"}'
        db.commit()
    finally:
        db.close()

    response = client.post("/integrations/gmail/disconnect")

    assert response.status_code == 200
    assert response.json() == {"status": "disconnected", "integration_type": "gmail"}

    db = SessionLocal()
    try:
        gmail = db.query(Integration).filter_by(integration_type="gmail").first()
        assert gmail is not None
        assert gmail.status == "inactive"
        assert gmail.config == "{}"
        assert gmail.last_sync_at is None
    finally:
        db.close()
