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
    const { full_name, address, contact_number, household_number } = req.body;
    
    if (!full_name) {
      return res.status(400).json({ error: 'Full name is required' });
    }
    
    const [result] = await pool.query(
      'INSERT INTO residents (full_name, address, contact_number, household_number) VALUES (?, ?, ?, ?)',
      [full_name, address, contact_number, household_number]
    );
    
    await pool.query(
      'INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)',
      [req.user.id, 'REGISTER_RESIDENT', `Registered resident: ${full_name}`]
    );
    
    res.status(201).json({
      message: 'Resident registered successfully',
      residentId: result.insertId
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
    
    await pool.query(
      'UPDATE residents SET full_name = ?, address = ?, contact_number = ?, household_number = ?, status = ? WHERE resident_id = ?',
      [
        full_name || existing[0].full_name,
        address || existing[0].address,
        contact_number || existing[0].contact_number,
        household_number || existing[0].household_number,
        status || existing[0].status,
        req.params.id
      ]
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
    
    await pool.query('DELETE FROM residents WHERE resident_id = ?', [req.params.id]);
    
    await pool.query(
      'INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)',
      [req.user.id, 'DELETE_RESIDENT', `Deleted resident ID: ${req.params.id}`]
    );
    
    res.json({ message: 'Resident deleted successfully' });
  } catch (error) {
    console.error('Error deleting resident:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
