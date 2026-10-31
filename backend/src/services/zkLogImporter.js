const pool = require('../config/db');
const zk = require('./zkteco');
const { EventEmitter } = require('events');

// Local event bus: SSE endpoint and Socket.io both feed off this.
const bus = module.exports.bus = new EventEmitter();
const EXIT_STATES = new Set([1, 2, 5]);

async function getDeviceConfig(deviceId) {
  if (!deviceId) {
    return { ip: zk.DEFAULT_IP, port: zk.DEFAULT_PORT, deviceId: null };
  }
  const [rows] = await pool.query('SELECT * FROM devices WHERE device_id = ?', [deviceId]);
  if (rows.length === 0) {
    throw Object.assign(new Error(`Device ${deviceId} not found`), { status: 404 });
  }
  const d = rows[0];
  const raw = String(d.usb_port || '').trim();
  const m = raw.match(/^([\w.\-]+):(\d+)$/);
  return {
    ip: m ? m[1] : zk.DEFAULT_IP,
    port: m ? Number(m[2]) : zk.DEFAULT_PORT,
    deviceId: d.device_id
  };
}

async function importLogs(options) {
  const { deviceId, ip, port, sinceMs = null, adminId = null, io = null } = options || {};
  const cfg = ip ? { ip, port: port || zk.DEFAULT_PORT, deviceId: deviceId || null } : await getDeviceConfig(deviceId);

  const [seenRows] = await pool.query(
    'SELECT source_ref FROM access_logs WHERE device_ip = ? AND source_ref IS NOT NULL',
    [cfg.ip]
  );
  const seen = new Set(seenRows.map(r => r.source_ref));

  const terminalUsers = await zk.getUsers(cfg.ip, cfg.port);
  const byUserId = new Map(terminalUsers.map(u => [String(u.userId), u]));

  const numericIds = [...byUserId.keys()].filter(k => /^\d+$/.test(k));
  const residentMap = new Map();
  if (numericIds.length > 0) {
    const [resRows] = await pool.query(
      'SELECT resident_id, full_name, status FROM residents WHERE resident_id IN (?)',
      [numericIds.map(Number)]
    );
    for (const r of resRows) residentMap.set(String(r.resident_id), r);
  }

  const records = await zk.getAttendances(cfg.ip, cfg.port);
  let scanned = 0, skippedDuplicate = 0, skippedUnknown = 0, skippedOld = 0, imported = 0;
  const residentsTouched = new Map();
  const seenThisPull = new Set();
  const inserts = [];

  for (const rec of records) {
    scanned++;
    if (rec.timestamp === null || rec.timestamp === undefined) { skippedOld++; continue; }
    if (sinceMs !== null && rec.timestamp < sinceMs) { skippedOld++; continue; }
    const sourceRef = `${cfg.ip}:${rec.uid}:${rec.timestamp}`;
    if (seen.has(sourceRef) || seenThisPull.has(sourceRef)) { skippedDuplicate++; continue; }
    seenThisPull.add(sourceRef);

    const resident = residentMap.get(rec.uid);
    if (!resident || resident.status !== 'Active') { skippedUnknown++; continue; }

    inserts.push([resident.resident_id, 'Granted', EXIT_STATES.has(rec.state) ? 'Exit' : 'Entry', 1.0, cfg.deviceId || 1, 1.0, 0, 1, rec.uid, cfg.ip, sourceRef, new Date(rec.timestamp)]);
    residentsTouched.set(rec.uid, resident);
  }

  if (inserts.length > 0) {
    await pool.query(
      `INSERT INTO access_logs
        (resident_id, status, direction, accuracy, device_id, confidence_score, verification_duration_ms, is_genuine, terminal_user_id, device_ip, source_ref, log_time)
       VALUES ?`,
      [inserts]
    );
    imported = inserts.length;

    await pool.query(
      'INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)',
      [adminId, 'ZK_IMPORT', `Imported ${imported} terminal access events from ${cfg.ip}`]
    );

    const last = Math.max(0, inserts.length - 20);
    for (let i = last; i < inserts.length; i++) {
      const row = inserts[i];
      const resident = residentsTouched.get(row[8]);
      const payload = {
        source: 'ZKTeco Terminal',
        terminalUserId: String(row[8]),
        status: 'Granted',
        direction: row[2],
        logTime: row[11] ? row[11].toISOString() : null,
        confidence: row[5],
        resident: resident ? { id: resident.resident_id, name: resident.full_name } : null,
        deviceIp: cfg.ip
      };
      if (io) {
        io.emit('new-verification', payload);
        io.to('dashboard').emit('dashboard-update', payload);
      }
      bus.emit('new-verification', payload);
    }
  }

  return { imported, scanned, skippedDuplicate, skippedUnknown, skippedOld, deviceIp: cfg.ip };
}

// module.exports.bus is set via `const bus = module.exports.bus = ...` above;
// assign the rest so we don't clobber the bus reference.
module.exports.importLogs = importLogs;
module.exports.getDeviceConfig = getDeviceConfig;
