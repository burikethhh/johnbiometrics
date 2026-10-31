const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const zk = require('../services/zkteco');
const { importLogs, getDeviceConfig } = require('../services/zkLogImporter');
const zkRealtime = require('../services/zkRealtime');

router.use(authenticateToken);

async function audit(adminId, action, details) {
  try {
    await pool.query('INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)', [adminId, action, details]);
  } catch (e) {
    console.error('audit_log write failed:', e.message);
  }
}

router.get('/scan', async (req, res) => {
  try {
    // Escalate timeout: full-network sweep can take ~10-20s
    const result = await zk.scanNetwork({});
    res.json(result);
  } catch (error) {
    console.error('Error scanning for terminals:', error);
    res.status(500).json({ error: 'Scan failed' });
  }
});

router.post('/connect', async (req, res) => {
  try {
    const { ip, port = 4370, location = 'Main Gate', device_id } = req.body || {};
    if (!ip) return res.status(400).json({ error: 'IP address is required' });

    const targetIp = String(ip).trim();
    const targetPort = Number(port) || 4370;

    // Verify connectivity and get device info
    const info = await zk.getInfo(targetIp, targetPort);

    // Save or update in devices table
    const endpoint = `${targetIp}:${targetPort}`;
    let targetId = device_id;

    if (!targetId) {
      const [existing] = await pool.query(
        "SELECT device_id FROM devices WHERE scanner_model LIKE '%ZKTeco%' LIMIT 1"
      );
      if (existing.length > 0) targetId = existing[0].device_id;
    }

    if (targetId) {
      await pool.query(
        "UPDATE devices SET usb_port = ?, device_status = 'Active', calibration_date = NOW() WHERE device_id = ?",
        [endpoint, targetId]
      );
    } else {
      const [ins] = await pool.query(
        "INSERT INTO devices (location, device_status, scanner_model, usb_port, calibration_date) VALUES (?, 'Active', 'ZKTeco Terminal (LAN)', ?, NOW())",
        [location, endpoint]
      );
      targetId = ins.insertId;
    }

    await audit(req.user?.id || 1, 'ZK_CONNECT', `Connected & bound ZKTeco terminal to ${endpoint}`);

    // Switch real-time push stream to the newly connected endpoint immediately
    zkRealtime.switchDeviceEndpoint(targetIp, targetPort, targetId).catch(err => {
      console.warn('zkRealtime switch error:', err.message);
    });

    res.json({
      success: true,
      message: `Successfully connected to ZKTeco terminal at ${endpoint}`,
      deviceId: targetId,
      endpoint,
      info
    });
  } catch (error) {
    console.error('Error connecting to ZKTeco:', error);
    res.status(500).json({ error: error.message || 'Failed to connect to ZKTeco terminal' });
  }
});

router.get('/status', async (req, res) => {
  try {
    const cfg = await getDeviceConfig(req.query.device_id);
    const info = await zk.getInfo(cfg.ip, cfg.port);
    res.json(info);
  } catch (error) {
    if (error.terminalOffline) {
      return res.status(503).json({ online: false, error: error.message });
    }
    console.error('Error fetching ZK status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const cfg = await getDeviceConfig(req.query.device_id);
    const users = await zk.getUsers(cfg.ip, cfg.port);
    res.json(users);
  } catch (error) {
    if (error.terminalOffline) {
      return res.status(503).json({ error: error.message });
    }
    console.error('Error fetching ZK users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/pull-logs', async (req, res) => {
  try {
    const { device_id, minutes_back } = req.body || {};
    const sinceMs = minutes_back ? Date.now() - minutes_back * 60 * 1000 : null;
    const stats = await importLogs({
      deviceId: device_id,
      sinceMs,
      adminId: req.user.id,
      io: req.app.get('io')
    });
    res.json(stats);
  } catch (error) {
    if (error.terminalOffline) {
      return res.status(503).json({ error: error.message });
    }
    if (error.status === 404) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Error pulling ZK logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/sync-residents', requireRole(['Super']), async (req, res) => {
  try {
    const { device_id, clean = false, default_pin = '1234' } = req.body || {};
    const cfg = await getDeviceConfig(device_id);
    const [residents] = await pool.query('SELECT resident_id, full_name FROM residents ORDER BY resident_id');
    if (residents.length === 0) {
      return res.status(400).json({ error: 'No residents enrolled in the database yet' });
    }

    if (clean) {
      const deleted = await zk.deleteAllUsers(cfg.ip, cfg.port);
      await audit(req.user.id, 'ZK_CLEAN', `Removed ${deleted.deleted} terminal users from ${cfg.ip}`);
    }

    let synced = 0;
    for (const r of residents) {
      if (r.resident_id > 65535) continue;
      await zk.writeUser(cfg.ip, cfg.port, {
        uid: r.resident_id,
        role: 0,
        password: default_pin,
        name: r.full_name,
        cardno: 0,
        userId: String(r.resident_id),
        group: 1
      });
      synced++;
    }

    await audit(req.user.id, 'ZK_SYNC', `Synced ${synced} residents to terminal ${cfg.ip}`);
    res.json({ synced, deviceIp: cfg.ip });
  } catch (error) {
    if (error.terminalOffline) {
      return res.status(503).json({ error: error.message });
    }
    console.error('Error syncing residents to ZK:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/enroll', async (req, res) => {
  try {
    const { resident_id, finger_index = 0, ensure_user = true } = req.body || {};
    if (!resident_id) {
      return res.status(400).json({ error: 'resident_id is required' });
    }

    const [residentRows] = await pool.query('SELECT * FROM residents WHERE resident_id = ?', [resident_id]);
    if (residentRows.length === 0) {
      return res.status(404).json({ error: 'Resident not found' });
    }
    const resident = residentRows[0];

    const cfg = await getDeviceConfig(req.body.device_id);
    const users = await zk.getUsers(cfg.ip, cfg.port);
    const exists = users.find(u => String(u.userId) === String(resident_id));
    if (!exists) {
      if (!ensure_user) {
        return res.status(404).json({ error: `Terminal user ${resident_id} not found. Sync residents first (POST /api/zkteco/sync-residents).` });
      }
      if (resident_id > 65535) {
        return res.status(400).json({ error: 'Resident ID exceeds terminal UID limit' });
      }
      await zk.writeUser(cfg.ip, cfg.port, {
        uid: resident_id,
        role: 0,
        password: '1234',
        name: resident.full_name,
        cardno: 0,
        userId: String(resident_id),
        group: 1
      });
    }

    await zk.startEnrollment(cfg.ip, cfg.port, String(resident_id), finger_index);
    await audit(req.user.id, 'ZK_ENROLL', `Started terminal enrollment for resident ${resident_id} (${resident.full_name}) on ${cfg.ip}`);
    res.json({
      message: 'Enrollment started on the terminal. The resident should place a finger on the device sensor 3 times.',
      resident: { id: resident.resident_id, name: resident.full_name },
      deviceIp: cfg.ip
    });
  } catch (error) {
    if (error.terminalOffline) {
      return res.status(503).json({ error: error.message });
    }
    if (error.status === 404) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Error starting ZK enrollment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
