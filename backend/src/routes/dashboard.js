const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

const overviewHandler = async (req, res) => {
  try {
    const [totalResidents] = await pool.query('SELECT COUNT(*) as count FROM residents');
    const [activeResidents] = await pool.query("SELECT COUNT(*) as count FROM residents WHERE status = 'Active'");
    const [totalFingerprints] = await pool.query('SELECT COUNT(*) as count FROM fingerprint_data');
    const [totalDevices] = await pool.query('SELECT COUNT(*) as count FROM devices');
    const [todayAccess] = await pool.query(
      'SELECT COUNT(*) as count FROM access_logs WHERE DATE(log_time) = CURDATE()'
    );
    const [todayEntries] = await pool.query(
      "SELECT COUNT(*) as count FROM access_logs WHERE DATE(log_time) = CURDATE() AND direction = 'Entry'"
    );
    const [todayExits] = await pool.query(
      "SELECT COUNT(*) as count FROM access_logs WHERE DATE(log_time) = CURDATE() AND direction = 'Exit'"
    );
    const [recentLogs] = await pool.query(`
      SELECT al.*, r.full_name 
      FROM access_logs al 
      LEFT JOIN residents r ON al.resident_id = r.resident_id 
      ORDER BY al.log_time DESC 
      LIMIT 10
    `);
    
    res.json({
      residents: {
        total: totalResidents[0].count,
        active: activeResidents[0].count
      },
      fingerprints: totalFingerprints[0].count,
      devices: totalDevices[0].count,
      todayAccess: todayAccess[0].count,
      todayEntries: todayEntries[0].count,
      todayExits: todayExits[0].count,
      recentLogs
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

router.get('/', overviewHandler);
router.get('/overview', overviewHandler);

router.get('/hourly', async (req, res) => {
  try {
    const [hourlyData] = await pool.query(`
      SELECT 
        HOUR(log_time) as hour,
        SUM(CASE WHEN status = 'Granted' THEN 1 ELSE 0 END) as granted,
        SUM(CASE WHEN status = 'Denied' THEN 1 ELSE 0 END) as denied
      FROM access_logs 
      WHERE DATE(log_time) = CURDATE()
      GROUP BY HOUR(log_time)
      ORDER BY hour
    `);
    res.json(hourlyData);
  } catch (error) {
    console.error('Error fetching hourly data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
