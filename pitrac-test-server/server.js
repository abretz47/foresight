#!/usr/bin/env node
/**
 * PiTrac Web-Server Simulator
 * ============================
 * Mimics the subset of the PiTrac web-server API used by the Foresight app:
 *
 *   GET  /health          – health-check endpoint (used for network discovery)
 *   GET  /api/shot        – most-recent shot as JSON
 *   WS   /ws              – real-time shot broadcast (JSON)
 *   POST /api/simulate    – inject a synthetic shot (for manual testing)
 *
 * Run:  node server.js [--port 8080] [--interval 0]
 *
 *   --port      TCP port to listen on (default 8080)
 *   --interval  If > 0, automatically send a random shot every N seconds
 *
 * Environment variables:
 *   PORT      overrides the default port
 *   INTERVAL  overrides the automatic-shot interval (seconds, 0 = disabled)
 */

'use strict';

const http = require('http');
const { WebSocketServer } = require('ws');
const { URL } = require('url');

// ── CLI / env config ──────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const PORT = parseInt(getArg('--port') ?? process.env.PORT ?? '8080', 10);
const HOST = getArg('--host') ?? process.env.HOST ?? '127.0.0.1';
const INTERVAL_S = parseFloat(getArg('--interval') ?? process.env.INTERVAL ?? '0');

// ── Shot factory ──────────────────────────────────────────────────────────

/**
 * Returns a realistic-looking shot payload.
 * carry is in metres (PiTrac's native unit).
 * side_angle is in degrees (negative = left).
 */
function makeShotData(overrides = {}) {
  const carryMetres = overrides.carry ?? (100 + Math.random() * 100);      // 100–200 m
  const sideAngleDeg = overrides.side_angle ?? ((Math.random() - 0.5) * 10); // ±5°
  const speedMph = overrides.speed ?? (80 + Math.random() * 60);           // 80–140 mph
  const launchAngle = overrides.launch_angle ?? (8 + Math.random() * 12);  // 8–20°
  const backSpin = overrides.back_spin ?? Math.round(2500 + Math.random() * 2000);
  const sideSpin = overrides.side_spin ?? Math.round((Math.random() - 0.5) * 1000);

  return {
    speed: Math.round(speedMph * 10) / 10,
    carry: Math.round(carryMetres * 10) / 10,
    launch_angle: Math.round(launchAngle * 10) / 10,
    side_angle: Math.round(sideAngleDeg * 10) / 10,
    back_spin: backSpin,
    side_spin: sideSpin,
    result_type: 'Hit',
    message: '',
    timestamp: new Date().toISOString(),
    images: [],
  };
}

function makeStatusData(resultType, message) {
  return {
    speed: 0,
    carry: 0,
    launch_angle: 0,
    side_angle: 0,
    back_spin: 0,
    side_spin: 0,
    result_type: resultType,
    message: message ?? '',
    timestamp: new Date().toISOString(),
    images: [],
  };
}

// ── State ─────────────────────────────────────────────────────────────────

let currentShot = makeStatusData('Waiting For Ball', '');
let shotHistory = [];
let shotCount = 0;

// ── HTTP server ───────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url, `http://localhost`);

  if (req.method === 'GET' && reqUrl.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      activemq_connected: false,
      activemq_running: false,
      pitrac_running: true,
      websocket_clients: wss.clients.size,
      listener_stats: { connected: false, messages_processed: shotCount, errors: 0 },
    }));
    return;
  }

  if (req.method === 'GET' && reqUrl.pathname === '/api/shot') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(currentShot));
    return;
  }

  if (req.method === 'GET' && reqUrl.pathname === '/api/history') {
    const limit = Math.min(parseInt(reqUrl.searchParams.get('limit') ?? '10', 10), 100);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(shotHistory.slice(-limit)));
    return;
  }

  if (req.method === 'POST' && reqUrl.pathname === '/api/simulate') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      let overrides = {};
      try { overrides = JSON.parse(body); } catch { /* use defaults */ }
      const shot = makeShotData(overrides);
      broadcastShot(shot);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'sent', shot }));
    });
    return;
  }

  if (req.method === 'POST' && reqUrl.pathname === '/api/reset') {
    currentShot = makeStatusData('Waiting For Ball', '');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'reset', timestamp: new Date().toISOString() }));
    return;
  }

  // Simple HTML dashboard
  if (req.method === 'GET' && reqUrl.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(dashboard());
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

// ── WebSocket server ──────────────────────────────────────────────────────

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const reqUrl = new URL(request.url, `http://localhost`);
  if (reqUrl.pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws) => {
  console.log(`[WS] Client connected (total: ${wss.clients.size})`);
  // Send current state immediately on connect
  ws.send(JSON.stringify(currentShot));

  ws.on('close', () => {
    console.log(`[WS] Client disconnected (total: ${wss.clients.size})`);
  });
});

function broadcastShot(shot) {
  currentShot = shot;
  shotHistory.push(shot);
  shotCount++;
  const payload = JSON.stringify(shot);
  wss.clients.forEach((client) => {
    if (client.readyState === 1 /* OPEN */) {
      client.send(payload);
    }
  });
  console.log(
    `[Shot #${shotCount}] carry=${shot.carry}m  speed=${shot.speed}mph` +
    `  side=${shot.side_angle}°  spin=${shot.back_spin}rpm`
  );
}

// ── Auto-shot timer ───────────────────────────────────────────────────────

if (INTERVAL_S > 0) {
  console.log(`[Auto] Sending a random shot every ${INTERVAL_S}s`);
  setInterval(() => broadcastShot(makeShotData()), INTERVAL_S * 1000);
}

// ── Dashboard HTML ────────────────────────────────────────────────────────

function dashboard() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>PiTrac Test Server</title>
  <style>
    body { font-family: monospace; background:#0F2E1E; color:#F5F7F5; padding:20px; }
    h1 { color:#C9A84C; }
    button { background:#2D6A48; color:#fff; border:none; padding:8px 16px; margin:4px;
             border-radius:6px; cursor:pointer; font-size:14px; }
    button:hover { background:#1A3C2A; }
    pre  { background:#1A3C2A; padding:12px; border-radius:8px; overflow:auto; }
    label { display:block; margin-top:8px; font-size:13px; color:#9EAD9E; }
    input { background:#1A3C2A; color:#F5F7F5; border:1px solid #2D6A48;
            padding:6px 10px; border-radius:6px; width:100px; }
  </style>
</head>
<body>
  <h1>📡 PiTrac Test Server</h1>
  <p>WebSocket: <code>ws://localhost:${PORT}/ws</code></p>

  <h2>Send a shot</h2>
  <label>Carry (m) <input id="carry" type="number" value="140" step="1"></label>
  <label>Side angle (°, +right) <input id="side" type="number" value="0" step="0.5"></label>
  <label>Speed (mph) <input id="speed" type="number" value="100" step="1"></label>
  <label>Launch angle (°) <input id="launch" type="number" value="12" step="0.5"></label>
  <button onclick="sendShot()">🏌️ Send Shot</button>
  <button onclick="sendRandom()">🎲 Random Shot</button>
  <button onclick="sendStatus('Waiting For Ball')">⏳ Status: Waiting</button>

  <h2>Last shot</h2>
  <pre id="output">—</pre>

  <script>
    const ws = new WebSocket('ws://' + location.host + '/ws');
    ws.onmessage = (e) => {
      document.getElementById('output').textContent = JSON.stringify(JSON.parse(e.data), null, 2);
    };

    function sendShot() {
      fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carry: parseFloat(document.getElementById('carry').value),
          side_angle: parseFloat(document.getElementById('side').value),
          speed: parseFloat(document.getElementById('speed').value),
          launch_angle: parseFloat(document.getElementById('launch').value),
        }),
      }).then(r => r.json()).then(d => console.log(d));
    }

    function sendRandom() {
      fetch('/api/simulate', { method: 'POST' }).then(r => r.json()).then(d => console.log(d));
    }

    function sendStatus(type) {
      fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result_type: type }),
      }).then(r => r.json()).then(d => console.log(d));
    }
  </script>
</body>
</html>`;
}

// ── Start ─────────────────────────────────────────────────────────────────

server.listen(PORT, HOST, () => {
  console.log(`PiTrac test server listening on http://${HOST}:${PORT}`);
  console.log(`  Dashboard:   http://${HOST}:${PORT}/`);
  console.log(`  Health:      http://${HOST}:${PORT}/health`);
  console.log(`  WebSocket:   ws://${HOST}:${PORT}/ws`);
  console.log(`  Simulate:    curl -X POST http://${HOST}:${PORT}/api/simulate`);
  if (INTERVAL_S > 0) {
    console.log(`  Auto-shots:  every ${INTERVAL_S}s`);
  }
});
