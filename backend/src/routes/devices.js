const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const [devices] = await pool.query('SELECT * FROM devices ORDER BY device_id');
    res.json(devices);
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireRole(['Super']), async (req, res) => {
  try {
    const { location, scanner_model, usb_port } = req.body;
    
    if (!location) {
      return res.status(400).json({ error: 'Location is required' });
    }
    
    const [result] = await pool.query(
      'INSERT INTO devices (location, scanner_model, usb_port) VALUES (?, ?, ?)',
      [location, scanner_model, usb_port]
    );
    
    res.status(201).json({
      message: 'Device added successfully',
      deviceId: result.insertId
    });
  } catch (error) {
    console.error('Error adding device:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', requireRole(['Super']), async (req, res) => {
  try {
    const { location, device_status, scanner_model, usb_port } = req.body;
    
    const [existing] = await pool.query(
      'SELECT * FROM devices WHERE device_id = ?',
      [req.params.id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    await pool.query(
      'UPDATE devices SET location = ?, device_status = ?, scanner_model = ?, usb_port = ? WHERE device_id = ?',
      [
        location || existing[0].location,
        device_status || existing[0].device_status,
        scanner_model || existing[0].scanner_model,
        usb_port || existing[0].usb_port,
        req.params.id
      ]
    );
    
    res.json({ message: 'Device updated successfully' });
  } catch (error) {
    console.error('Error updating device:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireRole(['Super']), async (req, res) => {
  try {
    const [existing] = await pool.query(
      'SELECT * FROM devices WHERE device_id = ?',
      [req.params.id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    await pool.query('DELETE FROM devices WHERE device_id = ?', [req.params.id]);
    
    res.json({ message: 'Device deleted successfully' });
  } catch (error) {
    console.error('Error deleting device:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
