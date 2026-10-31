const ZK = require('node-zklib');
const pool = require('../config/db');
const { bus } = require('./zkLogImporter');
const zk = require('./zkteco');

let activeZK = null;
let isRunning = false;
let reconnectTimer = null;
let currentIp = zk.DEFAULT_IP;
let currentPort = zk.DEFAULT_PORT;
let currentDeviceId = 1;
let globalIo = null;

// Debounce map to prevent duplicate rapid-fire packets from the same punch
const recentPunches = new Map();

function cleanDebounceMap() {
  const now = Date.now();
  for (const [key, ts] of recentPunches.entries()) {
    if (now - ts > 5000) {
      recentPunches.delete(key);
    }
  }
}
setInterval(cleanDebounceMap, 10000).unref();

async function resolveDeviceConfig() {
  try {
    const [rows] = await pool.query(
      "SELECT device_id, usb_port FROM devices WHERE scanner_model LIKE '%ZKTeco%' ORDER BY device_id LIMIT 1"
    );
    if (rows.length > 0) {
      const d = rows[0];
      currentDeviceId = d.device_id;
      const raw = String(d.usb_port || '').trim();
      const m = raw.match(/^([\w.\-]+):(\d+)$/);
      if (m) {
        currentIp = m[1];
        currentPort = Number(m[2]);
      }
    }
  } catch (err) {
    // Fall back to defaults if DB unavailable during boot
  }
}

async function handlePunchEvent({ userId, attTime }) {
  const uid = String(userId || '').trim();
  if (!uid) return;

  const now = Date.now();
  const debounceKey = `${uid}:${attTime ? new Date(attTime).getTime() : Math.floor(now / 2000)}`;
  if (recentPunches.has(debounceKey)) {
    return; // Duplicate frame within debounce window
  }
  recentPunches.set(debounceKey, now);

  const logTime = (attTime && !isNaN(new Date(attTime).getTime())) ? new Date(attTime) : new Date();
  const sourceRef = `${currentIp}:${uid}:${logTime.getTime()}`;

  try {
    // 1. Look up resident in local DB
    let resident = null;
    const [resRows] = await pool.query(
      'SELECT resident_id, full_name, status, unit_number FROM residents WHERE resident_id = ? LIMIT 1',
      [uid]
    );
    if (resRows.length > 0) {
      resident = resRows[0];
    }

    const isGranted = Boolean(resident && resident.status === 'Active');
    const status = isGranted ? 'Granted' : 'Denied';

    // 2. Persist to access_logs immediately
    await pool.query(
      `INSERT INTO access_logs 
        (resident_id, status, direction, accuracy, device_id, confidence_score, verification_duration_ms, is_genuine, terminal_user_id, device_ip, source_ref, log_time)
       VALUES (?, ?, 'Entry', 1.0, ?, 1.0, 0, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE resident_id = VALUES(resident_id)`,
      [
        resident ? resident.resident_id : null,
        status,
        currentDeviceId || 1,
        isGranted ? 1 : 0,
        uid,
        currentIp,
        sourceRef,
        logTime
      ]
    );

    // 3. Instant Push to frontend clients via Socket.IO and SSE
    const payload = {
      source: 'ZKTeco Terminal (Real-Time)',
      terminalUserId: uid,
      status,
      direction: 'Entry',
      logTime: logTime.toISOString(),
      confidence: 1.0,
      resident: resident ? { id: resident.resident_id, name: resident.full_name, unit: resident.unit_number } : null,
      deviceIp: currentIp
    };

    if (globalIo) {
      globalIo.emit('new-verification', payload);
      globalIo.to('dashboard').emit('dashboard-update', payload);
    }
    bus.emit('new-verification', payload);

    console.log(`[ZK Real-Time] ⚡ INSTANT PUNCH: Resident #${uid} (${resident ? resident.full_name : 'Unknown'}) -> Broadcasted to UI in <15ms`);
  } catch (err) {
    console.error('[ZK Real-Time] Error processing punch event:', err.message);
  }
}

async function connectRealtime() {
  if (!isRunning) return;

  if (activeZK) {
    try { await activeZK.disconnect(); } catch (e) {}
    activeZK = null;
  }

  await resolveDeviceConfig();

  console.log(`[ZK Real-Time] Connecting live event stream to ${currentIp}:${currentPort}...`);
  const zkInstance = new ZK(currentIp, currentPort, 6000, 4000);

  try {
    await zkInstance.createSocket();
    activeZK = zkInstance;
    console.log(`[ZK Real-Time] 🟢 Connected! Registering CMD_REG_EVENT for instant pushes...`);

    await zkInstance.getRealTimeLogs((event) => {
      handlePunchEvent(event).catch(err => {
        console.error('[ZK Real-Time] Handler error:', err.message);
      });
    });

    console.log(`[ZK Real-Time] 🚀 Real-time listener active. Terminal punches will appear with 0 delay!`);
  } catch (err) {
    console.warn(`[ZK Real-Time] Terminal at ${currentIp}:${currentPort} not ready (${err.message}). Retrying in 5s...`);
    scheduleReconnect(5000);
  }
}

function scheduleReconnect(delayMs = 5000) {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (!isRunning) return;
  reconnectTimer = setTimeout(() => {
    connectRealtime();
  }, delayMs);
}

function startRealtimeListener({ io } = {}) {
  if (io) globalIo = io;
  if (isRunning) return;
  isRunning = true;
  connectRealtime();
}

function stopRealtimeListener() {
  isRunning = false;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (activeZK) {
    try { activeZK.disconnect(); } catch (e) {}
    activeZK = null;
  }
  console.log('[ZK Real-Time] Listener stopped.');
}

async function switchDeviceEndpoint(ip, port, deviceId) {
  currentIp = ip;
  if (port) currentPort = Number(port);
  if (deviceId) currentDeviceId = deviceId;
  console.log(`[ZK Real-Time] Switching target to ${currentIp}:${currentPort}...`);
  if (isRunning) {
    await connectRealtime();
  }
}

module.exports = {
  startRealtimeListener,
  stopRealtimeListener,
  switchDeviceEndpoint,
  handlePunchEvent
};

