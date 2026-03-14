from __future__ import annotations

# Gevent monkey patching must happen before any other imports
import gevent.monkey
gevent.monkey.patch_all()

import math
import random
import time
import uuid
import json
import urllib.request
import urllib.error
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Set, Tuple

from flask import Flask, jsonify, render_template, request
from flask_socketio import SocketIO, emit

app = Flask(__name__)
app.config["SECRET_KEY"] = "hackathon-offline-secret"
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="gevent")


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
active_flash_targets: Set[str] = set()
expo_push_tokens: Set[str] = set()


def as_float_or_none(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def normalize_expo_push_token(value) -> Optional[str]:
    if not isinstance(value, str):
        return None
    token = value.strip()
    if token.startswith("ExponentPushToken[") and token.endswith("]"):
        return token
    return None


def normalize_supplies(value) -> List[str]:
    if not isinstance(value, list):
        return []
    out: List[str] = []
    for item in value:
        if not isinstance(item, str):
            continue
        text = item.strip()
        if not text:
            continue
        if text not in out:
            out.append(text)
    return out[:20]


def send_expo_push_notifications(payload: dict) -> None:
    tokens = sorted(expo_push_tokens)
    if not tokens:
        return

    messages = [
        {
            "to": token,
            "title": "Disaster Alert",
            "body": f"{payload.get('type', 'Emergency')} alert. {payload.get('countdown_s', 20)}s countdown started.",
            "sound": "default",
            "priority": "high",
            "channelId": "disaster-alerts",
            "data": payload,
        }
        for token in tokens
    ]

    try:
        req = urllib.request.Request(
            "https://exp.host/--/api/v2/push/send",
            data=json.dumps(messages).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=8):
            pass
    except (urllib.error.URLError, TimeoutError, ValueError):
        # Keep socket broadcast working even when push API is unreachable.
        return


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
    # Generate a random safe point within 4km of the user.
    earth_radius_m = 6_371_000
    distance_m = random.uniform(250, 3_950)
    bearing_rad = random.uniform(0, 2 * math.pi)

    lat1 = math.radians(lat)
    lon1 = math.radians(lon)
    angular_distance = distance_m / earth_radius_m

    lat2 = math.asin(
        math.sin(lat1) * math.cos(angular_distance)
        + math.cos(lat1) * math.sin(angular_distance) * math.cos(bearing_rad)
    )
    lon2 = lon1 + math.atan2(
        math.sin(bearing_rad) * math.sin(angular_distance) * math.cos(lat1),
        math.cos(angular_distance) - math.sin(lat1) * math.sin(lat2),
    )

    lon2 = (lon2 + 3 * math.pi) % (2 * math.pi) - math.pi

    return {
        "id": f"rand-sz-{uuid.uuid4().hex[:8]}",
        "name": "Dynamic Safe Zone",
        "lat": round(math.degrees(lat2), 6),
        "lon": round(math.degrees(lon2), 6),
        "distance_m": round(distance_m, 1),
    }


def serialize_chat_links() -> List[dict]:
    return [{"a": a, "b": b} for a, b in sorted(chat_links)]


def public_user_view(user: dict) -> dict:
    return {
        "user_id": user["user_id"],
        "name": user["name"],
        "role": user["role"],
        "lat": user.get("lat"),
        "lon": user.get("lon"),
        "supplies": normalize_supplies(user.get("supplies", [])),
        "arrived": user.get("arrived", False),
        "connected": True,
        "last_seen": user.get("last_seen"),
    }


def broadcast_presence() -> None:
    users = [public_user_view(u) for u in users_by_id.values()]
    socketio.emit("presence_update", {"users": users})


def broadcast_flashlight_status() -> None:
    socketio.emit("flashlight_status", {"active_target_user_ids": sorted(active_flash_targets)})


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
    send_expo_push_notifications(payload)
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

    if uid in active_flash_targets:
        active_flash_targets.discard(uid)
        broadcast_flashlight_status()

    broadcast_presence()


@socketio.on("register_user")
def on_register_user(data):
    user_id = data.get("user_id") or str(uuid.uuid4())
    expo_push_token = normalize_expo_push_token(data.get("expo_push_token"))
    user = {
        "user_id": user_id,
        "name": data.get("name", f"User-{user_id[:5]}"),
        "role": data.get("role", "survivor"),
        "lat": as_float_or_none(data.get("lat")),
        "lon": as_float_or_none(data.get("lon")),
        "supplies": normalize_supplies(data.get("supplies", [])),
        "arrived": data.get("arrived", False),
        "expo_push_token": expo_push_token,
        "connected": True,
        "sid": request.sid,
        "last_seen": int(time.time()),
    }

    if expo_push_token:
        expo_push_tokens.add(expo_push_token)

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
            "active_flash_targets": sorted(active_flash_targets),
            "safe_zones": [asdict(z) for z in SAFE_ZONES],
        },
    )
    broadcast_presence()


@socketio.on("update_push_token")
def on_update_push_token(data):
    uid = data.get("user_id")
    user = users_by_id.get(uid)
    if not user:
        return

    token = normalize_expo_push_token(data.get("expo_push_token"))
    if not token:
        return

    user["expo_push_token"] = token
    expo_push_tokens.add(token)


@socketio.on("location_update")
def on_location_update(data):
    uid = data.get("user_id")
    user = users_by_id.get(uid)
    if not user:
        return

    user["lat"] = as_float_or_none(data.get("lat"))
    user["lon"] = as_float_or_none(data.get("lon"))
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

    from_u = users_by_id.get(from_user)
    to_u = users_by_id.get(to_user)
    if not from_u or not to_u:
        return

    message = {
        "from_user_id": from_user,
        "from_user_name": from_u.get("name", "Unknown"),
        "to_user_id": to_user,
        "to_user_name": to_u.get("name", "Unknown"),
        "text": text,
        "ts": ts,
    }

    emit("chat_message", message, room=from_u["sid"])
    emit("chat_message", message, room=to_u["sid"])

    a, b = sorted([from_user, to_user])
    if (a, b) not in chat_links:
        chat_links.add((a, b))
        socketio.emit("chat_link_created", {"a": a, "b": b})


@socketio.on("update_supplies")
def on_update_supplies(data):
    user_id = data.get("user_id")
    user = users_by_id.get(user_id)
    if not user:
        return

    # Ensure only the same socket can update this user profile.
    if user.get("sid") != request.sid:
        return

    previous_supplies = normalize_supplies(user.get("supplies", []))
    next_supplies = normalize_supplies(data.get("supplies", []))
    user["supplies"] = next_supplies
    user["last_seen"] = int(time.time())

    added_supplies = [item for item in next_supplies if item not in previous_supplies]
    if added_supplies:
        socketio.emit(
            "supplies_update_broadcast",
            {
                "user_id": user_id,
                "user_name": user.get("name", "Unknown"),
                "added_supplies": added_supplies,
                "supplies": next_supplies,
                "ts": int(time.time()),
            },
        )

    broadcast_presence()


@socketio.on("drop_beacon")
def on_drop_beacon(data):
    beacon_id = str(uuid.uuid4())
    supply_type = str(data.get("supply_type", "Mixed Supplies")).strip() or "Mixed Supplies"
    quantity = str(data.get("quantity", "")).strip()
    note = str(data.get("note", "Supplies dropped here")).strip() or "Supplies dropped here"

    beacon = {
        "beacon_id": beacon_id,
        "lat": data.get("lat"),
        "lon": data.get("lon"),
        "supply_type": supply_type,
        "quantity": quantity,
        "note": note,
        "dropped_by": data.get("rescuer_id"),
        "ts": int(time.time()),
    }
    beacons[beacon_id] = beacon
    socketio.emit("beacon_dropped", beacon)


@socketio.on("flashlight_ping")
def on_flashlight_ping(data):
    rescuer_id = data.get("rescuer_id")
    target_user_id = data.get("target_user_id")
    if not target_user_id or not rescuer_id or target_user_id == rescuer_id:
        return

    rescuer = users_by_id.get(rescuer_id)
    if not rescuer or rescuer.get("role") != "rescuer":
        return

    target = users_by_id.get(target_user_id)
    if not target:
        return

    emit(
        "flashlight_command",
        {
            "command": "start",
            "from_rescuer_id": rescuer_id,
            "target_user_id": target_user_id,
        },
        room=target["sid"],
    )
    active_flash_targets.add(target_user_id)
    broadcast_flashlight_status()


@socketio.on("flashlight_ping_stop")
def on_flashlight_ping_stop(data):
    rescuer_id = data.get("rescuer_id")
    target_user_id = data.get("target_user_id")
    if not target_user_id or not rescuer_id or target_user_id == rescuer_id:
        return

    rescuer = users_by_id.get(rescuer_id)
    if not rescuer or rescuer.get("role") != "rescuer":
        return

    target = users_by_id.get(target_user_id)
    if not target:
        return

    emit(
        "flashlight_command",
        {
            "command": "stop",
            "from_rescuer_id": rescuer_id,
            "target_user_id": target_user_id,
        },
        room=target["sid"],
    )
    active_flash_targets.discard(target_user_id)
    broadcast_flashlight_status()


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
