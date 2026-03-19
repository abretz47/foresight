# PiTrac Test Server

A lightweight Node.js server that simulates the PiTrac launch-monitor web-server so you can develop and test the Foresight PiTrac integration **without a physical device**.

## What it emulates

| Endpoint | Method | Description |
|---|---|---|
| `/` | GET | HTML dashboard with shot controls |
| `/health` | GET | Health-check – used by Foresight for network discovery |
| `/ws` | WebSocket | Real-time shot broadcast |
| `/api/shot` | GET | Most-recent shot as JSON |
| `/api/history` | GET | Shot history (`?limit=N`) |
| `/api/simulate` | POST | Inject a synthetic shot |
| `/api/reset` | POST | Reset current shot to "Waiting For Ball" |

Shot payloads emitted over WebSocket match the real PiTrac JSON schema:

```json
{
  "speed": 98.5,
  "carry": 147.3,
  "launch_angle": 12.1,
  "side_angle": -1.8,
  "back_spin": 3200,
  "side_spin": 120,
  "result_type": "Hit",
  "message": "",
  "timestamp": "2025-09-03T14:30:45.123Z",
  "images": []
}
```

> `carry` is in **metres** (PiTrac's native unit); Foresight converts it to yards internally.  
> `side_angle` is in degrees; negative = left, positive = right.

---

## Setup

```bash
cd pitrac-test-server
npm install
```

---

## Running

### Basic (manual shots only)

```bash
npm start
# or
node server.js
```

The server binds to `127.0.0.1` (loopback only) by default.
Open `http://localhost:8080` in a browser – use the dashboard to send shots
or trigger them via curl (see below).

### Custom port

```bash
node server.js --port 9000
# or
PORT=9000 node server.js
```

### Expose on the LAN (to test with a physical mobile device)

> ⚠️ **Security note**: binding to `0.0.0.0` makes the server reachable from
> any device on your network. Only do this on a trusted LAN.

```bash
node server.js --host 0.0.0.0
# or
HOST=0.0.0.0 node server.js
```

### Auto-send random shots every N seconds

```bash
node server.js --interval 10
# Sends a new random shot every 10 seconds
```

---

## Connecting Foresight to the test server

Foresight probes `pitrac.local:8080` by default for network discovery.  
When running the test server on the **same machine** as the Expo dev server (or a device on the same LAN), use the machine's LAN IP:

1. Find your machine's IP, e.g. `192.168.1.42`
2. In the Foresight app → **Home screen** → **PiTrac** section:
   - If the server isn't auto-detected, tap **Enter URL**
   - Enter `ws://192.168.1.42:8080/ws`
   - Tap **Save**
3. Tap **Connect**

The **PiTrac Live** badge will appear in the Record screen header once the WebSocket is open.

> **Expo Go / local dev**: if both the app and the server run on the same machine,
> you can often use `ws://localhost:8080/ws` (web) or the LAN IP (mobile device).

---

## Sending test shots

### Browser dashboard

Navigate to `http://localhost:8080` and use the form or buttons.

### curl

```bash
# Random shot (server picks realistic values)
curl -X POST http://localhost:8080/api/simulate

# Specific shot: 150 m carry, 2° right, 105 mph
curl -X POST http://localhost:8080/api/simulate \
  -H 'Content-Type: application/json' \
  -d '{"carry": 150, "side_angle": 2.0, "speed": 105}'

# Status message (not a real shot – Foresight ignores these)
curl -X POST http://localhost:8080/api/simulate \
  -H 'Content-Type: application/json' \
  -d '{"result_type": "Waiting For Ball"}'
```

### Accepted simulate body fields

| Field | Type | Default | Notes |
|---|---|---|---|
| `carry` | number | 100–200 (random) | Metres |
| `side_angle` | number | ±5° (random) | Degrees; +right, −left |
| `speed` | number | 80–140 (random) | mph |
| `launch_angle` | number | 8–20 (random) | Degrees |
| `back_spin` | number | 2500–4500 (random) | RPM |
| `side_spin` | number | ±500 (random) | RPM |

All fields are optional – omitted fields get realistic random defaults.

---

## Simulating real PiTrac carry distances

PiTrac reports carry in **metres**. Foresight's shot profiles use **yards**.  
Use this reference to pick sensible `carry` values for your shot profiles:

| Yards | Metres |
|---|---|
| 100 yd | ~91 m |
| 150 yd | ~137 m |
| 200 yd | ~183 m |
| 250 yd | ~229 m |
