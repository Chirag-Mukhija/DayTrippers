# Hackathon Offline - Starter Build

This repository now has two folders:

- `server`: Python Flask-SocketIO real-time backend + admin trigger panel.
- `client`: Expo React Native app scaffold for Android phones.

## Quick Start

### 1) Server

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Server runs on:

- Socket/HTTP: `http://0.0.0.0:8888`
- Admin panel: `http://<laptop-ip>:8888/`
- Health: `http://<laptop-ip>:8888/health`

### 2) Client

1. Open `client/src/config.js` and set `SERVER_URL` to your laptop IP (example: `http://192.168.1.23:8888`).
2. Run:

```bash
cd client
npm install
npm run start
```

3. Launch on Android devices via Expo Go (same WiFi as laptop).

## Implemented Server Events

- `register_user`
- `presence_update`
- `location_update` / `user_moved`
- `request_nearest_safe_zone` / `nearest_safe_zone`
- `simulate_arrival` / `arrival_confirmed`
- `send_chat` / `chat_message` + `chat_link_created`
- `drop_beacon` / `beacon_dropped`
- `flashlight_ping` / `flashlight_command`
- `broadcast_evacuation` / `evacuation_broadcast`
- Admin trigger endpoint emits `disaster_alert`

## Current Build Status

Implemented now:

- In-memory real-time session state (users, movement, links, beacons, evacuation).
- Admin panel with one-click disaster trigger.
- Admin live stats (`/admin/state`) showing users, chat links, beacons.
- Role-based login (survivor/rescuer).
- Disaster alert full-screen flow.
- GPS-enabled location updates (with fallback start coordinates).
- Real map rendering with user markers and chat connection lines.
- Survivor safe-zone map with direct route polyline.
- Rescuer long-press beacon drop on map.
- Rescuer targeted flashlight ping command (visual/vibration fallback in app).
- Rescuer evacuation broadcast point selection from map.
- Offline guide search + local HTML viewing in WebView.

Still pending for full production polish:

- Native flashlight/torch hardware toggle implementation.
- Robust auth and abuse prevention.
- Durable persistence (if session restore is needed).

## Troubleshooting

- If `expo` is not found, run from the client folder with `npm run start` (or `npx expo start`).
- If server import errors show in editor (`flask`, `flask_socketio`), install server deps in a Python venv under `server`.
