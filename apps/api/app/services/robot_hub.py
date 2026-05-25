"""
Robot Hub — unified local-network client for iRobot (Roomba) and Roborock vacuums.

iRobot setup:
  1. Hold HOME button on Roomba for 2 seconds until it beeps
  2. Run: pip install irobotpy && python -m irobotpy.password <robot_ip>
  3. Copy BLID and PASSWORD to .env

Roborock setup:
  1. Get device IP from your router or Roborock app
  2. Get 32-char token: run `python -m miio discover` on same network
     OR from Home Assistant → Xiaomi Miio integration
  3. Copy IP and TOKEN to .env
"""

import asyncio
import json
import socket
from datetime import datetime, timezone
from typing import Optional

# Optional: python-miio for Roborock
try:
    from miio import RoborockVacuum
    from miio.exceptions import DeviceException
    MIIO_AVAILABLE = True
except ImportError:
    MIIO_AVAILABLE = False

# Optional: irobotpy for Roomba
try:
    from irobotpy import Roomba
    IROBOT_AVAILABLE = True
except ImportError:
    IROBOT_AVAILABLE = False


def _run_sync(fn, *args, **kwargs):
    """Run a blocking call in a thread so it doesn't block the async event loop."""
    loop = asyncio.get_event_loop()
    return loop.run_in_executor(None, lambda: fn(*args, **kwargs))


# ──────────────────────────────────────────────
# Roborock
# ──────────────────────────────────────────────

ROBOROCK_STATES = {
    1: "initiating", 2: "sleeping", 3: "idle", 4: "remote_control",
    5: "cleaning", 6: "returning_dock", 7: "manual_mode", 8: "charging",
    9: "charging_error", 10: "paused", 11: "spot_cleaning", 12: "error",
    13: "shutting_down", 14: "updating", 15: "docking", 16: "going_to_target",
    17: "zone_cleaning", 18: "room_cleaning", 22: "emptying_dust_bin",
    23: "washing_mop", 26: "going_to_wash_mop", 28: "in_call",
    29: "mapping", 100: "fully_charged",
}

ROBOROCK_ERRORS = {
    0: "none", 1: "laser_sensor_fault", 2: "collision_sensor_fault",
    3: "wheel_floating", 4: "cliff_sensor_fault", 5: "main_brush_blocked",
    6: "side_brush_blocked", 7: "wheel_blocked", 8: "device_stuck",
    9: "dust_bin_missing", 10: "filter_blocked", 11: "magnetic_field_detected",
    12: "low_battery", 13: "charging_fault", 14: "battery_fault",
    15: "wall_sensor_fault", 16: "uneven_surface", 17: "side_brush_fault",
    18: "suction_fan_fault", 19: "charging_station_fault",
}

ROBOROCK_FAN_MODES = {
    101: "quiet", 102: "balanced", 103: "turbo", 104: "max", 105: "off",
}


async def roborock_status(ip: str, token: str) -> dict:
    if not MIIO_AVAILABLE:
        return {"error": "python-miio not installed. Run: pip install python-miio"}
    try:
        def _get():
            vac = RoborockVacuum(ip, token)
            s = vac.status()
            return {
                "state": ROBOROCK_STATES.get(s.state_code, str(s.state_code)),
                "state_code": s.state_code,
                "battery": s.battery,
                "clean_time_seconds": s.clean_time,
                "clean_area_m2": round(s.clean_area / 10000, 2) if s.clean_area else 0,
                "error": ROBOROCK_ERRORS.get(s.error_code, f"error_{s.error_code}"),
                "error_code": s.error_code,
                "fan_speed": ROBOROCK_FAN_MODES.get(s.fanspeed, str(s.fanspeed)),
                "map_present": s.map_present,
                "in_cleaning": s.is_on,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        return await asyncio.get_event_loop().run_in_executor(None, _get)
    except Exception as e:
        return {"error": str(e), "timestamp": datetime.now(timezone.utc).isoformat()}


async def roborock_command(ip: str, token: str, command: str) -> dict:
    if not MIIO_AVAILABLE:
        return {"error": "python-miio not installed. Run: pip install python-miio"}
    try:
        def _run():
            vac = RoborockVacuum(ip, token)
            if command == "clean":
                vac.start()
            elif command == "stop":
                vac.stop()
            elif command == "dock":
                vac.home()
            elif command == "pause":
                vac.pause()
            elif command == "find":
                vac.find()
            elif command == "fan_quiet":
                vac.set_fan_speed(101)
            elif command == "fan_max":
                vac.set_fan_speed(104)
            else:
                raise ValueError(f"Unknown command: {command}")
            return {"ok": True, "command": command}
        return await asyncio.get_event_loop().run_in_executor(None, _run)
    except Exception as e:
        return {"error": str(e), "command": command}


# ──────────────────────────────────────────────
# iRobot (Roomba)
# ──────────────────────────────────────────────

IROBOT_PHASES = {
    "charge": "charging", "run": "cleaning", "hmUsrDock": "returning_dock",
    "hmMidMsn": "returning_dock", "hmPostMsn": "returning_dock",
    "dock": "docked", "dockend": "docked", "stop": "stopped",
    "pause": "paused", "evac": "emptying_bin", "stuck": "stuck",
    "n/a": "idle",
}

IROBOT_STATES = {
    "Run": "cleaning", "Charge": "charging", "Stop": "stopped",
    "Dock": "docking", "hmUsrDock": "returning_dock", "idle": "idle",
}


async def irobot_status(ip: str, blid: str, password: str) -> dict:
    if not IROBOT_AVAILABLE:
        return {"error": "irobotpy not installed. Run: pip install irobotpy"}
    try:
        def _get():
            roomba = Roomba(ip, blid, password)
            roomba.connect()
            import time; time.sleep(2)  # allow state to populate
            state = roomba.master_state
            roomba.disconnect()

            pose = state.get("pose", {})
            clean_mission = state.get("cleanMissionStatus", {})
            battery = state.get("batPct", 0)
            phase = clean_mission.get("phase", "n/a")
            error = clean_mission.get("error", 0)
            n_missions = clean_mission.get("nMssn", 0)

            return {
                "state": IROBOT_PHASES.get(phase, phase),
                "phase": phase,
                "battery": battery,
                "bin_full": state.get("bin", {}).get("full", False),
                "bin_present": state.get("bin", {}).get("present", True),
                "error_code": error,
                "error": "none" if error == 0 else f"error_{error}",
                "missions_count": n_missions,
                "x": pose.get("point", {}).get("x", 0),
                "y": pose.get("point", {}).get("y", 0),
                "map_present": state.get("pmaps", []) != [],
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        return await asyncio.get_event_loop().run_in_executor(None, _get)
    except Exception as e:
        return {"error": str(e), "timestamp": datetime.now(timezone.utc).isoformat()}


async def irobot_command(ip: str, blid: str, password: str, command: str) -> dict:
    if not IROBOT_AVAILABLE:
        return {"error": "irobotpy not installed. Run: pip install irobotpy"}
    try:
        def _run():
            roomba = Roomba(ip, blid, password)
            roomba.connect()
            import time; time.sleep(1)
            if command == "clean":
                roomba.start()
            elif command == "stop":
                roomba.stop()
            elif command == "dock":
                roomba.dock()
            elif command == "pause":
                roomba.pause()
            elif command == "find":
                roomba.find()
            else:
                raise ValueError(f"Unknown command: {command}")
            time.sleep(0.5)
            roomba.disconnect()
            return {"ok": True, "command": command}
        return await asyncio.get_event_loop().run_in_executor(None, _run)
    except Exception as e:
        return {"error": str(e), "command": command}


# ──────────────────────────────────────────────
# Network discovery
# ──────────────────────────────────────────────

async def scan_local_network(timeout: float = 1.0) -> list[dict]:
    """
    Quick scan for devices responding on robot-specific ports:
    - 8883 (iRobot MQTT)
    - 54321 (Roborock Miio)
    Returns list of {ip, port, brand} found.
    """
    import ipaddress

    local_ip = _get_local_ip()
    if not local_ip:
        return []

    network = ipaddress.IPv4Network(f"{local_ip}/24", strict=False)
    hosts = list(network.hosts())

    ports_brands = {8883: "irobot", 54321: "roborock"}
    found = []

    async def probe(ip: str, port: int, brand: str):
        try:
            _, writer = await asyncio.wait_for(
                asyncio.open_connection(str(ip), port), timeout=timeout
            )
            writer.close()
            await writer.wait_closed()
            found.append({"ip": str(ip), "port": port, "brand": brand})
        except Exception:
            pass

    tasks = [
        probe(str(ip), port, brand)
        for ip in hosts
        for port, brand in ports_brands.items()
    ]
    await asyncio.gather(*tasks, return_exceptions=True)
    return found


def _get_local_ip() -> Optional[str]:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return None
