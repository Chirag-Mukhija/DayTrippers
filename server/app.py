from __future__ import annotations

import math
import time
import uuid
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Set, Tuple

from flask import Flask, jsonify, render_template, request
from flask_socketio import SocketIO, emit

app = Flask(__name__)
app.config["SECRET_KEY"] = "hackathon-offline-secret"
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")


@dataclass
class SafeZone:
    id: str
    name: str
    lat: float
    lon: float


SAFE_ZONES: List[SafeZone] = [
    SafeZone("sz-1", "Demo Safe Zone A", 12.9719, 77.5932),
    SafeZone("sz-2", "Demo Safe Zone B", 12.9732, 77.5991),
    SafeZone("sz-3", "Demo Safe Zone C", 12.9688, 77.5889),
]

# Live in-memory state for the demo session.
users_by_id: Dict[str, dict] = {}
users_by_sid: Dict[str, str] = {}
chat_links: Set[Tuple[str, str]] = set()
beacons: Dict[str, dict] = {}
evacuation_message: Optional[dict] = None


def haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6_371_000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return radius * c


def nearest_safe_zone(lat: float, lon: float) -> dict:
    best = None
    for zone in SAFE_ZONES:
        dist = haversine_meters(lat, lon, zone.lat, zone.lon)
        if best is None or dist < best["distance_m"]:
            best = {
                **asdict(zone),
                "distance_m": round(dist, 1),
            }
    return best or {}


def serialize_chat_links() -> List[dict]:
    return [{"a": a, "b": b} for a, b in sorted(chat_links)]


def public_user_view(user: dict) -> dict:
    return {
        "user_id": user["user_id"],
        "name": user["name"],
        "role": user["role"],
        "lat": user.get("lat"),
        "lon": user.get("lon"),
        "arrived": user.get("arrived", False),
        "connected": True,
        "last_seen": user.get("last_seen"),
    }


def broadcast_presence() -> None:
    users = [public_user_view(u) for u in users_by_id.values()]
    socketio.emit("presence_update", {"users": users})


@app.get("/")
def index():
    return render_template("admin.html")


@app.get("/health")
def health():
    return jsonify({"ok": True, "connected_users": len(users_by_id)})


@app.get("/admin/state")
def admin_state():
    return jsonify(
        {
            "connected_users": len(users_by_id),
            "users": [public_user_view(u) for u in users_by_id.values()],
            "chat_links": serialize_chat_links(),
            "beacons": list(beacons.values()),
            "evacuation": evacuation_message,
        }
    )


@app.post("/admin/trigger")
def trigger_disaster():
    body = request.get_json(silent=True) or {}
    payload = {
        "type": body.get("type", "Earthquake"),
        "countdown_s": int(body.get("countdown_s", 20)),
        "timestamp": int(time.time()),
    }
    socketio.emit("disaster_alert", payload)
    return jsonify({"sent": True, "payload": payload})


@socketio.on("connect")
def on_connect():
    emit("server_ready", {"sid": request.sid, "ts": int(time.time())})


@socketio.on("disconnect")
def on_disconnect():
    uid = users_by_sid.pop(request.sid, None)
    if not uid:
        return

    if uid in users_by_id:
        users_by_id[uid]["connected"] = False
        users_by_id[uid]["last_seen"] = int(time.time())
        del users_by_id[uid]

    broadcast_presence()


@socketio.on("register_user")
def on_register_user(data):
    user_id = data.get("user_id") or str(uuid.uuid4())
    user = {
        "user_id": user_id,
        "name": data.get("name", f"User-{user_id[:5]}"),
        "role": data.get("role", "survivor"),
        "lat": data.get("lat"),
        "lon": data.get("lon"),
        "arrived": data.get("arrived", False),
        "connected": True,
        "sid": request.sid,
        "last_seen": int(time.time()),
    }

    users_by_id[user_id] = user
    users_by_sid[request.sid] = user_id

    emit(
        "bootstrap_state",
        {
            "self": public_user_view(user),
            "users": [public_user_view(u) for u in users_by_id.values()],
            "chat_links": serialize_chat_links(),
            "beacons": list(beacons.values()),
            "evacuation": evacuation_message,
            "safe_zones": [asdict(z) for z in SAFE_ZONES],
        },
    )
    broadcast_presence()


@socketio.on("location_update")
def on_location_update(data):
    uid = data.get("user_id")
    user = users_by_id.get(uid)
    if not user:
        return

    user["lat"] = data.get("lat")
    user["lon"] = data.get("lon")
    user["last_seen"] = int(time.time())

    socketio.emit(
        "user_moved",
        {
            "user_id": uid,
            "lat": user["lat"],
            "lon": user["lon"],
            "ts": user["last_seen"],
        },
        skip_sid=request.sid,
    )


@socketio.on("request_nearest_safe_zone")
def on_request_nearest_safe_zone(data):
    try:
        lat = float(data.get("lat"))
        lon = float(data.get("lon"))
    except (TypeError, ValueError):
        emit("nearest_safe_zone", {})
        return

    zone = nearest_safe_zone(lat, lon)
    emit("nearest_safe_zone", zone)


@socketio.on("simulate_arrival")
def on_simulate_arrival(data):
    uid = data.get("user_id")
    zone_id = data.get("safe_zone_id")
    user = users_by_id.get(uid)
    if not user:
        return

    user["arrived"] = True
    socketio.emit("arrival_confirmed", {"user_id": uid, "safe_zone_id": zone_id})
    broadcast_presence()


@socketio.on("send_chat")
def on_send_chat(data):
    from_user = data.get("from_user_id")
    to_user = data.get("to_user_id")
    text = data.get("text", "")
    ts = int(time.time())

    if not from_user or not to_user or not text:
        return

    message = {
        "from_user_id": from_user,
        "to_user_id": to_user,
        "text": text,
        "ts": ts,
    }

    from_u = users_by_id.get(from_user)
    to_u = users_by_id.get(to_user)
    if not from_u or not to_u:
        return

    emit("chat_message", message, room=from_u["sid"])
    emit("chat_message", message, room=to_u["sid"])

    a, b = sorted([from_user, to_user])
    if (a, b) not in chat_links:
        chat_links.add((a, b))
        socketio.emit("chat_link_created", {"a": a, "b": b})


@socketio.on("drop_beacon")
def on_drop_beacon(data):
    beacon_id = str(uuid.uuid4())
    beacon = {
        "beacon_id": beacon_id,
        "lat": data.get("lat"),
        "lon": data.get("lon"),
        "note": data.get("note", "Supplies dropped here"),
        "dropped_by": data.get("rescuer_id"),
        "ts": int(time.time()),
    }
    beacons[beacon_id] = beacon
    socketio.emit("beacon_dropped", beacon)


@socketio.on("flashlight_ping")
def on_flashlight_ping(data):
    target_user_id = data.get("target_user_id")
    duration_s = int(data.get("duration_s", 3))
    target = users_by_id.get(target_user_id)
    if not target:
        return

    emit(
        "flashlight_command",
        {
            "duration_s": duration_s,
            "from_rescuer_id": data.get("rescuer_id"),
            "target_user_id": target_user_id,
        },
        room=target["sid"],
    )


@socketio.on("broadcast_evacuation")
def on_broadcast_evacuation(data):
    global evacuation_message

    evacuation_message = {
        "lat": data.get("lat"),
        "lon": data.get("lon"),
        "message": data.get("message", "Evacuate immediately"),
        "issued_by": data.get("rescuer_id"),
        "ts": int(time.time()),
    }
    socketio.emit("evacuation_broadcast", evacuation_message)


if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=8888)
