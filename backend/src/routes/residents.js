const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const [residents] = await pool.query(
      'SELECT * FROM residents ORDER BY date_registered DESC'
    );
    res.json(residents);
  } catch (error) {
    console.error('Error fetching residents:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [residents] = await pool.query(
      'SELECT * FROM residents WHERE resident_id = ?',
      [req.params.id]
    );
    
    if (residents.length === 0) {
      return res.status(404).json({ error: 'Resident not found' });
    }
    
    res.json(residents[0]);
  } catch (error) {
    console.error('Error fetching resident:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireRole(['Super']), async (req, res) => {
  try {
    const {
      full_name,
      address,
      contact_number,
      household_number,
      fingerprint_encoding,
      enroll_zk = false
    } = req.body;
    
    if (!full_name) {
      return res.status(400).json({ error: 'Full name is required' });
    }
    
    const [result] = await pool.query(
      'INSERT INTO residents (full_name, address, contact_number, household_number) VALUES (?, ?, ?, ?)',
      [full_name, address, contact_number, household_number]
    );
    const newResidentId = result.insertId;

    let fingerprintSaved = false;
    if (fingerprint_encoding) {
      const encStr = typeof fingerprint_encoding === 'string'
        ? fingerprint_encoding
        : JSON.stringify(fingerprint_encoding);
      await pool.query(
        'INSERT INTO fingerprint_data (resident_id, encoding) VALUES (?, ?)',
        [newResidentId, encStr]
      );
      fingerprintSaved = true;
    }

    // Auto-sync new resident to ZKTeco terminal if configured
    let zkSynced = false;
    let zkEnrollPrompted = false;
    try {
      const zk = require('../services/zkteco');
      const { getDeviceConfig } = require('../services/zkLogImporter');
      const cfg = await getDeviceConfig();
      const uid = (newResidentId > 65535) ? ((newResidentId % 65000) + 1) : newResidentId;
      if (cfg && cfg.ip) {
        await zk.writeUser(cfg.ip, cfg.port, {
          uid,
          role: 0,
          password: '1234',
          name: full_name,
          cardno: 0,
          userId: String(newResidentId),
          group: 1
        });
        zkSynced = true;

        if (enroll_zk) {
          await zk.startEnrollment(cfg.ip, cfg.port, String(newResidentId), 0);
          zkEnrollPrompted = true;
        }
      }
    } catch (zkErr) {
      console.warn('[ZK auto-sync on registration]', zkErr.message);
    }
    
    await pool.query(
      'INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)',
      [req.user.id, 'REGISTER_RESIDENT', `Registered resident: ${full_name}${fingerprintSaved ? ' (with fingerprint)' : ''}`]
    );
    
    res.status(201).json({
      message: zkEnrollPrompted
        ? 'Resident registered! Terminal LCD prompted for 3 finger touches.'
        : 'Resident registered successfully' + (fingerprintSaved ? ' with fingerprint.' : '.'),
      residentId: newResidentId,
      fingerprintSaved,
      zkSynced,
      zkEnrollPrompted
    });
  } catch (error) {
    console.error('Error registering resident:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', requireRole(['Super']), async (req, res) => {
  try {
    const { full_name, address, contact_number, household_number, status } = req.body;
    
    const [existing] = await pool.query(
      'SELECT * FROM residents WHERE resident_id = ?',
      [req.params.id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Resident not found' });
    }
    
    const targetFullName = full_name || existing[0].full_name;
    const targetAddress = address !== undefined ? address : existing[0].address;
    const targetContact = contact_number !== undefined ? contact_number : existing[0].contact_number;
    const targetHousehold = household_number !== undefined ? household_number : existing[0].household_number;
    const targetStatus = status || existing[0].status;

    await pool.query(
      'UPDATE residents SET full_name = ?, address = ?, contact_number = ?, household_number = ?, status = ? WHERE resident_id = ?',
      [
        targetFullName,
        targetAddress,
        targetContact,
        targetHousehold,
        targetStatus,
        req.params.id
      ]
    );
    
    // ZKTeco sync on update: if Inactive, remove from terminal so relay won't trigger; if Active, write/refresh
    try {
      const zk = require('../services/zkteco');
      const { getDeviceConfig } = require('../services/zkLogImporter');
      const cfg = await getDeviceConfig();
      if (cfg && cfg.ip) {
        const residentIdNum = Number(req.params.id);
        const uid = (residentIdNum > 65535) ? ((residentIdNum % 65000) + 1) : residentIdNum;
        if (targetStatus === 'Inactive') {
          await zk.deleteUser(cfg.ip, cfg.port, uid);
        } else {
          await zk.writeUser(cfg.ip, cfg.port, {
            uid,
            role: 0,
            password: '1234',
            name: targetFullName,
            cardno: 0,
            userId: String(req.params.id),
            group: 1
          });
        }
      }
    } catch (zkErr) {
      console.warn('[ZK sync on update]', zkErr.message);
    }

    await pool.query(
      'INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)',
      [req.user.id, 'UPDATE_RESIDENT', `Updated resident ID ${req.params.id}: ${targetFullName} (${targetStatus})`]
    );

    res.json({ message: 'Resident updated successfully' });
  } catch (error) {
    console.error('Error updating resident:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireRole(['Super']), async (req, res) => {
  try {
    const [existing] = await pool.query(
      'SELECT * FROM residents WHERE resident_id = ?',
      [req.params.id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Resident not found' });
    }
    
    // 1. Delete user and their fingerprint templates from ZKTeco terminal
    try {
      const zk = require('../services/zkteco');
      const { getDeviceConfig } = require('../services/zkLogImporter');
      const cfg = await getDeviceConfig();
      if (cfg && cfg.ip) {
        const residentIdNum = Number(req.params.id);
        const uid = (residentIdNum > 65535) ? ((residentIdNum % 65000) + 1) : residentIdNum;
        await zk.deleteUser(cfg.ip, cfg.port, uid);
      }
    } catch (zkErr) {
      console.warn('[ZK sync on delete]', zkErr.message);
    }

    // 2. Clean up DB records
    await pool.query('DELETE FROM fingerprint_data WHERE resident_id = ?', [req.params.id]);
    await pool.query('DELETE FROM residents WHERE resident_id = ?', [req.params.id]);
    
    await pool.query(
      'INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)',
      [req.user.id, 'DELETE_RESIDENT', `Deleted resident ID: ${req.params.id} (${existing[0].full_name})`]
    );
    
    res.json({ message: 'Resident deleted successfully' });
  } catch (error) {
    console.error('Error deleting resident:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
