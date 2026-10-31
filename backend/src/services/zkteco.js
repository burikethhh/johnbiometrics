const ZK = require('node-zklib');
const { COMMANDS } = require('node-zklib/constants');

const DEFAULT_IP = process.env.ZK_DEVICE_IP || '192.168.254.106';
const DEFAULT_PORT = Number(process.env.ZK_DEVICE_PORT || 4370);
const DEFAULT_TIMEOUT = Number(process.env.ZK_DEVICE_TIMEOUT_MS || 10000);

let opChain = Promise.resolve();

function createUserBuffer72({ uid, role = 0, password = '', name = '', cardno = 0, userId = '', group = 1 }) {
  const buf = Buffer.alloc(72, 0);
  buf.writeUInt16LE(Number(uid) & 0xffff, 0);
  buf.writeUInt8(Number(role) & 0xff, 2);
  if (password) {
    buf.write(String(password).substring(0, 8), 3, 'ascii');
  }
  const cleanName = String(name || '').replace(/[^\x20-\x7E]/g, '').trim().substring(0, 24);
  buf.write(cleanName, 11, 'ascii');
  buf.writeUInt32LE(Number(cardno) || 0, 35);
  buf.writeUInt8(Number(group) || 1, 39);
  buf.write(String(userId).substring(0, 24), 48, 'ascii');
  return buf;
}

function queue(fn) {
  const run = opChain.then(fn, fn);
  opChain = run.catch(() => {});
  return run;
}

async function withDevice(ip = DEFAULT_IP, port = DEFAULT_PORT, fn, timeoutMs = DEFAULT_TIMEOUT) {
  return queue(async () => {
    const zk = new ZK(ip, port, timeoutMs, 4000);
    try {
      try { await zk.createSocket(); } catch (e) { throw Object.assign(new Error(`Terminal unreachable at ${ip}:${port} (${e.message || e})`), { terminalOffline: true }); }
      return await fn(zk);
    } finally {
      try { await zk.disconnect(); } catch (e) {}
    }
  });
}

async function getInfo(ip, port) {
  return withDevice(ip, port, async (zk) => {
    const info = await zk.getInfo();
    return {
      online: true,
      ip,
      port,
      userCounts: info.userCounts,
      logCounts: info.logCounts,
      logCapacity: info.logCapacity
    };
  });
}

async function getUsers(ip, port) {
  return withDevice(ip, port, async (zk) => {
    const res = await zk.getUsers();
    const users = (res && res.data) ? res.data : [];
    return users.map(u => ({
      uid: u.uid,
      userId: String(u.userId || ''),
      name: u.name || '',
      role: u.role,
      cardno: u.cardno || 0
    }));
  });
}

async function getAttendances(ip, port) {
  return withDevice(ip, port, async (zk) => {
    const res = await zk.getAttendances();
    const records = (res && res.data) ? res.data : [];
    return records
      .map(r => {
        const ts = r.recordTime ? new Date(r.recordTime) : null;
        const tsValid = ts && !Number.isNaN(ts.getTime()) ? ts.getTime() : null;
        return {
          uid: String(r.deviceUserId !== undefined && r.deviceUserId !== null && r.deviceUserId !== '' ? r.deviceUserId : r.userSn),
          timestamp: tsValid,
          rawTime: tsValid ? ts.toISOString() : null,
          state: 0
        };
      })
      .filter(r => r.timestamp !== null);
  });
}

async function writeUser(ip, port, userData) {
  return withDevice(ip, port, async (zk) => {
    try { await zk.zklibTcp.executeCmd(COMMANDS.CMD_CANCELCAPTURE, ''); } catch (e) {}
    await zk.zklibTcp.executeCmd(COMMANDS.CMD_USER_WRQ, createUserBuffer72(userData));
    await zk.zklibTcp.executeCmd(COMMANDS.CMD_REFRESHDATA, '');
    return { written: true, uid: Number(userData.uid) };
  });
}

async function deleteUser(ip, port, uid) {
  return withDevice(ip, port, async (zk) => {
    const delBuf = Buffer.alloc(2);
    delBuf.writeUInt16LE(Number(uid) & 0xffff, 0);
    await zk.zklibTcp.executeCmd(COMMANDS.CMD_DELETE_USER, delBuf);
    await zk.zklibTcp.executeCmd(COMMANDS.CMD_REFRESHDATA, '');
    return { deleted: true, uid };
  });
}

async function deleteAllUsers(ip, port) {
  return withDevice(ip, port, async (zk) => {
    const res = await zk.getUsers();
    const users = (res && res.data) ? res.data : [];
    const delBuf = Buffer.alloc(2);
    for (const u of users) {
      delBuf.writeUInt16LE(Number(u.uid) & 0xffff, 0);
      try { await zk.zklibTcp.executeCmd(COMMANDS.CMD_DELETE_USER, delBuf); } catch (e) {}
    }
    await zk.zklibTcp.executeCmd(COMMANDS.CMD_REFRESHDATA, '');
    return { deleted: users.length };
  });
}

async function startEnrollment(ip, port, userId, fingerIndex = 0) {
  return withDevice(ip, port, async (zk) => {
    try { await zk.zklibTcp.executeCmd(COMMANDS.CMD_CANCELCAPTURE, ''); } catch (e) {}
    const enrollBuf = Buffer.alloc(26, 0);
    enrollBuf.write(String(userId).substring(0, 24), 0, 'ascii');
    enrollBuf.writeUInt8(Number(fingerIndex) & 0xff, 24);
    enrollBuf.writeUInt8(1, 25);
    await zk.zklibTcp.executeCmd(COMMANDS.CMD_STARTENROLL, enrollBuf);
    return { enrollStarted: true, userId: String(userId), fingerIndex };
  });
}

// ---- Network discovery ----------------------------------------------------
// Find ZKTeco terminals on whatever network(s) this laptop is attached to.
// Probes every address in each connected IPv4 /24 for an open device port,
// then verifies each hit speaks the ZK protocol.

const os = require('os');
const net = require('net');

function localSubnets() {
  const out = new Set();
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list) {
      if (!ni || ni.family !== 'IPv4' || ni.internal) continue;
      const ip = ni.address;
      if (/^169\.254\./.test(ip)) continue; // APIPA (no DHCP) — cable-only links are handled by static IP
      const o = ip.split('.');
      out.add(`${o[0]}.${o[1]}.${o[2]}`);
    }
  }
  return [...out];
}

function probePort(ip, port, timeoutMs = 600) {
  return new Promise(resolve => {
    const s = net.connect(port, ip);
    s.setTimeout(timeoutMs);
    s.on('connect', () => { s.destroy(); resolve(true); });
    s.on('timeout', () => { s.destroy(); resolve(false); });
    s.on('error', () => resolve(false));
  });
}

async function scanNetwork({ port = DEFAULT_PORT } = {}) {
  const subnets = localSubnets();
  if (subnets.length === 0) {
    return { scanned: 0, subnets, terminals: [] };
  }
  const candidates = [];
  for (const base of subnets) {
    for (let i = 1; i <= 254; i++) candidates.push(`${base}.${i}`);
  }

  const open = [];
  const BATCH = 96;
  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(ip => probePort(ip, port).then(ok => (ok ? ip : null))));
    for (const ip of results) if (ip) open.push(ip);
  }

  // Confirm which open ports actually speak the ZK protocol
  const terminals = [];
  for (const ip of open) {
    try {
      const info = await withDevice(ip, port, async zk => zk.getInfo(), 4000).catch(e => {
        throw e;
      });
      terminals.push({
        ip,
        port,
        isTerminal: true,
        userCounts: info.userCounts,
        logCounts: info.logCounts
      });
    } catch (e) {
      // TCP open but not a ZK terminal (or protocol hiccup) — report as weak hit
      terminals.push({ ip, port, isTerminal: false, userCounts: null, logCounts: null });
    }
  }
  terminals.sort((a, b) => (b.isTerminal ? 1 : 0) - (a.isTerminal ? 1 : 0));
  return { scanned: candidates.length, subnets, terminals };
}

module.exports = {
  DEFAULT_IP,
  DEFAULT_PORT,
  withDevice,
  getInfo,
  getUsers,
  getAttendances,
  writeUser,
  deleteUser,
  deleteAllUsers,
  startEnrollment,
  scanNetwork
};
