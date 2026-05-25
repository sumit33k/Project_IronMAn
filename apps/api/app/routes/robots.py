import json
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.db.models import IoTDevice, Task
from app.services import robot_hub

router = APIRouter(prefix="/robots", tags=["robots"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _device_out(d: IoTDevice) -> dict:
    creds = json.loads(d.credentials or "{}")
    last_state = json.loads(d.last_state or "{}")
    return {
        "id": d.id,
        "device_type": d.device_type,
        "name": d.name,
        "ip_address": d.ip_address,
        "status": d.status,
        "last_state": last_state,
        "last_seen_at": d.last_seen_at.isoformat() if d.last_seen_at else None,
        "created_at": d.created_at.isoformat(),
        "configured": bool(d.ip_address and creds),
    }


@router.get("")
def list_robots(db: Session = Depends(get_db)):
    return [_device_out(d) for d in db.query(IoTDevice).all()]


@router.post("")
def add_robot(payload: dict, db: Session = Depends(get_db)):
    device_type = payload.get("device_type", "")
    if device_type not in ("irobot", "roborock"):
        raise HTTPException(400, "device_type must be 'irobot' or 'roborock'")

    credentials: dict = {}
    if device_type == "irobot":
        credentials = {
            "blid": payload.get("blid", ""),
            "password": payload.get("password", ""),
        }
    elif device_type == "roborock":
        credentials = {"token": payload.get("token", "")}

    d = IoTDevice(
        id=str(uuid.uuid4()),
        device_type=device_type,
        name=payload.get("name", f"My {device_type.title()}"),
        ip_address=payload.get("ip_address", ""),
        credentials=json.dumps(credentials),
        status="unknown",
        last_state="{}",
        created_at=datetime.now(timezone.utc),
    )
    db.add(d)
    db.commit()
    db.refresh(d)
    return _device_out(d)


@router.delete("/{robot_id}")
def remove_robot(robot_id: str, db: Session = Depends(get_db)):
    d = db.get(IoTDevice, robot_id)
    if not d:
        raise HTTPException(404, "Robot not found")
    db.delete(d)
    db.commit()
    return {"status": "deleted"}


@router.get("/{robot_id}/status")
async def get_robot_status(robot_id: str, db: Session = Depends(get_db)):
    d = db.get(IoTDevice, robot_id)
    if not d:
        raise HTTPException(404, "Robot not found")

    creds = json.loads(d.credentials or "{}")
    ip = d.ip_address or ""

    if not ip:
        return {**_device_out(d), "live": {"error": "No IP address configured"}}

    if d.device_type == "roborock":
        token = creds.get("token", "")
        if not token:
            return {**_device_out(d), "live": {"error": "Token not configured"}}
        live = await robot_hub.roborock_status(ip, token)
    elif d.device_type == "irobot":
        blid = creds.get("blid", "")
        pwd = creds.get("password", "")
        if not blid or not pwd:
            return {**_device_out(d), "live": {"error": "BLID or password not configured"}}
        live = await robot_hub.irobot_status(ip, blid, pwd)
    else:
        live = {"error": "Unknown device type"}

    if "error" not in live:
        d.status = live.get("state", "unknown")
        d.last_state = json.dumps(live)
        d.last_seen_at = datetime.now(timezone.utc)
        db.commit()

    return {**_device_out(d), "live": live}


@router.post("/{robot_id}/{command}")
async def send_command(
    robot_id: str,
    command: str,
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks = None,
):
    valid_commands = {"clean", "stop", "dock", "pause", "find", "fan_quiet", "fan_max"}
    if command not in valid_commands:
        raise HTTPException(400, f"Unknown command. Valid: {sorted(valid_commands)}")

    d = db.get(IoTDevice, robot_id)
    if not d:
        raise HTTPException(404, "Robot not found")

    ip = d.ip_address or ""
    creds = json.loads(d.credentials or "{}")

    if not ip:
        raise HTTPException(400, "No IP address configured for this robot")

    if d.device_type == "roborock":
        token = creds.get("token", "")
        if not token:
            raise HTTPException(400, "Token not configured")
        result = await robot_hub.roborock_command(ip, token, command)
    elif d.device_type == "irobot":
        blid = creds.get("blid", "")
        pwd = creds.get("password", "")
        if not blid or not pwd:
            raise HTTPException(400, "BLID or password not configured")
        result = await robot_hub.irobot_command(ip, blid, pwd, command)
    else:
        raise HTTPException(400, "Unknown device type")

    if "error" not in result:
        status_map = {
            "clean": "cleaning", "stop": "stopped",
            "dock": "returning_dock", "pause": "paused",
        }
        if command in status_map:
            d.status = status_map[command]
            db.commit()

        # Create a task record for cleaning sessions
        if command == "clean":
            task = Task(
                id=str(uuid.uuid4()),
                title=f"{d.name} — cleaning session started",
                status="done",
                priority="low",
                source="iot",
                source_reference=f"robot:{d.id}",
                category="iot",
                personal_or_work="personal",
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            db.add(task)
            db.commit()

    return {"robot": _device_out(d), "result": result}


@router.post("/scan/network")
async def scan_network():
    """Scan the local network for iRobot (port 8883) and Roborock (port 54321) devices."""
    found = await robot_hub.scan_local_network(timeout=0.8)
    return {"found": found, "count": len(found)}


# ──────────────────────────────────────────────
# Apple Watch / Siri Shortcuts brief endpoint
# ──────────────────────────────────────────────

@router.get("/watch/brief")  # mounted under /robots but also accessible as /robots/watch/brief
def watch_brief_robots(db: Session = Depends(get_db)):
    """Minimal robot status summary for Apple Watch / Siri Shortcuts."""
    robots = db.query(IoTDevice).all()
    summaries = []
    for r in robots:
        state = json.loads(r.last_state or "{}")
        summaries.append({
            "name": r.name,
            "status": r.status,
            "battery": state.get("battery"),
        })
    return {"robots": summaries, "count": len(robots)}
