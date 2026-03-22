/**
 * PiTrac WebSocket Service
 *
 * Manages the lifecycle of a WebSocket connection to a PiTrac launch-monitor
 * web-server (https://github.com/PiTracLM/PiTrac).
 *
 * The PiTrac server broadcasts shot data as JSON over its /ws endpoint.
 * Only messages with result_type === "Hit" carry real shot measurements.
 *
 * Usage
 * -----
 *   import * as PiTracService from '../lib/piTracService';
 *
 *   // Try to auto-detect and connect
 *   const found = await PiTracService.probe();
 *   if (found) PiTracService.connect();
 *
 *   // Or connect to a specific URL
 *   PiTracService.connect('ws://192.168.1.50:8080/ws');
 *
 *   // Subscribe to events
 *   const unsub = PiTracService.addShotListener((shot) => { ... });
 *   const unsubStatus = PiTracService.addConnectionListener((connected) => { ... });
 *
 *   // Clean up
 *   unsub();
 *   unsubStatus();
 *   PiTracService.disconnect();
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Types ──────────────────────────────────────────────────────────────────

export interface PiTracShot {
  /** Ball speed in mph */
  speed: number;
  /** Carry distance in metres (convert to yards: × 1.09361) */
  carry: number;
  /** Launch angle in degrees */
  launch_angle: number;
  /** Side angle in degrees; negative = left, positive = right */
  side_angle: number;
  /** Back spin in RPM */
  back_spin: number;
  /** Side spin in RPM */
  side_spin: number;
  /** Human-readable result type, e.g. "Hit" | "Waiting For Ball" */
  result_type: string;
  /** Free-form status message */
  message: string;
  /** ISO 8601 timestamp */
  timestamp: string;
}

export type ShotListener = (shot: PiTracShot) => void;
export type ConnectionListener = (connected: boolean) => void;

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_HOST = 'pitrac.local';
const DEFAULT_PORT = 8080;
const WS_PATH = '/ws';
const HEALTH_PATH = '/health';
const STORAGE_URL_KEY = '@foresight/pitrac_ws_url';
/** result_type value that indicates a real ball-hit measurement */
const HIT_RESULT_TYPE = 'Hit';
/** Probe / reconnect timeout in ms */
const PROBE_TIMEOUT_MS = 3000;
const RECONNECT_DELAY_MS = 5000;

// ── Internal state ─────────────────────────────────────────────────────────

let _ws: WebSocket | null = null;
let _connected = false;
let _currentWsUrl: string | null = null;
let _shotListeners: ShotListener[] = [];
let _connectionListeners: ConnectionListener[] = [];
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let _intentionalClose = false;

// ── Private helpers ────────────────────────────────────────────────────────

function _notifyConnection(connected: boolean) {
  _connected = connected;
  _connectionListeners.forEach((cb) => {
    try { cb(connected); } catch { /* ignore listener errors */ }
  });
}

function _notifyShot(shot: PiTracShot) {
  _shotListeners.forEach((cb) => {
    try { cb(shot); } catch { /* ignore listener errors */ }
  });
}

function _cancelReconnect() {
  if (_reconnectTimer !== null) {
    clearTimeout(_reconnectTimer);
    _reconnectTimer = null;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Returns the stored WebSocket URL, or null if none has been saved.
 */
export async function getStoredUrl(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_URL_KEY);
  } catch {
    return null;
  }
}

/**
 * Persists a WebSocket URL for future sessions.
 */
export async function setStoredUrl(url: string): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_URL_KEY, url);
  } catch { /* best-effort */ }
}

/**
 * Removes the stored WebSocket URL (reverts to auto-discovery).
 */
export async function clearStoredUrl(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_URL_KEY);
  } catch { /* best-effort */ }
}

/**
 * Returns the default WebSocket URL for the given host / port.
 */
export function buildWsUrl(host: string, port = DEFAULT_PORT): string {
  return `ws://${host}:${port}${WS_PATH}`;
}

/**
 * Probes whether a PiTrac HTTP health endpoint is reachable.
 * Returns true if the server responded with a 2xx status within the timeout.
 *
 * @param host  Hostname or IP (default: 'pitrac.local')
 * @param port  Port number   (default: 8080)
 */
export async function probe(host = DEFAULT_HOST, port = DEFAULT_PORT): Promise<boolean> {
  const url = `http://${host}:${port}${HEALTH_PATH}`;
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return response.ok;
  } catch {
    return false;
  }
}

function _detachSocket(ws: WebSocket) {
  ws.onopen = null;
  ws.onmessage = null;
  ws.onerror = null;
  ws.onclose = null;
  ws.close();
}

/**
 * Basic runtime guard: returns true only when the parsed JSON looks like a
 * real PiTrac shot message (has numeric speed/carry and a string result_type).
 */
function _isValidShotPayload(data: unknown): data is PiTracShot {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.result_type === 'string' &&
    (typeof d.speed === 'number' || d.speed === undefined) &&
    (typeof d.carry === 'number' || d.carry === undefined)
  );
}

/**
 * Opens a WebSocket connection to the given URL (or the stored/default URL if
 * none is supplied).  Automatically attempts to reconnect unless disconnect()
 * was called explicitly.
 */
export function connect(wsUrl?: string): void {
  // Resolve URL
  const url = wsUrl ?? _currentWsUrl ?? buildWsUrl(DEFAULT_HOST);
  _intentionalClose = false;
  _cancelReconnect();

  // Close any existing socket first
  if (_ws) {
    _detachSocket(_ws);
    _ws = null;
  }

  _currentWsUrl = url;

  const socket = new WebSocket(url);

  socket.onopen = () => {
    _notifyConnection(true);
  };

  socket.onmessage = (event) => {
    try {
      const parsed: unknown = JSON.parse(event.data as string);
      if (!_isValidShotPayload(parsed)) return;
      // Only forward real shot measurements
      if (parsed.result_type === HIT_RESULT_TYPE) {
        // Ensure numeric fields have safe defaults
        const shot: PiTracShot = {
          speed: parsed.speed ?? 0,
          carry: parsed.carry ?? 0,
          launch_angle: (parsed as any).launch_angle ?? 0,
          side_angle: (parsed as any).side_angle ?? 0,
          back_spin: (parsed as any).back_spin ?? 0,
          side_spin: (parsed as any).side_spin ?? 0,
          result_type: parsed.result_type,
          message: (parsed as any).message ?? '',
          timestamp: (parsed as any).timestamp ?? new Date().toISOString(),
        };
        _notifyShot(shot);
      }
    } catch {
      /* ignore malformed messages */
    }
  };

  socket.onerror = () => {
    // onclose will fire immediately after onerror
  };

  socket.onclose = () => {
    _notifyConnection(false);
    if (!_intentionalClose && _currentWsUrl) {
      _reconnectTimer = setTimeout(() => {
        if (!_intentionalClose) {
          connect(_currentWsUrl ?? undefined);
        }
      }, RECONNECT_DELAY_MS);
    }
  };

  _ws = socket;
}

/**
 * Closes the WebSocket connection and cancels any pending reconnect.
 */
export function disconnect(): void {
  _intentionalClose = true;
  _cancelReconnect();
  if (_ws) {
    _detachSocket(_ws);
    _ws = null;
  }
  if (_connected) {
    _notifyConnection(false);
  }
}

/** Returns true if the WebSocket is currently open. */
export function isConnected(): boolean {
  return _connected;
}

/** Returns the current WebSocket URL, or null if not yet set. */
export function getUrl(): string | null {
  return _currentWsUrl;
}

/**
 * Registers a listener that is called whenever a real shot is received.
 * Returns an unsubscribe function.
 */
export function addShotListener(cb: ShotListener): () => void {
  _shotListeners.push(cb);
  return () => {
    _shotListeners = _shotListeners.filter((l) => l !== cb);
  };
}

/**
 * Registers a listener that is called whenever the connection state changes.
 * Returns an unsubscribe function.
 */
export function addConnectionListener(cb: ConnectionListener): () => void {
  _connectionListeners.push(cb);
  return () => {
    _connectionListeners = _connectionListeners.filter((l) => l !== cb);
  };
}
