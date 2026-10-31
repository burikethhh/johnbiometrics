const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const { start_date, end_date, status, direction, resident_name, limit = 100 } = req.query;
    
    let query = `
      SELECT al.*, r.full_name 
      FROM access_logs al 
      LEFT JOIN residents r ON al.resident_id = r.resident_id 
      WHERE 1=1
    `;
    const params = [];
    
    if (start_date) {
      query += ' AND al.log_time >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND al.log_time <= ?';
      params.push(end_date);
    }
    if (status) {
      query += ' AND al.status = ?';
      params.push(status);
    }
    if (direction) {
      query += ' AND al.direction = ?';
      params.push(direction);
    }
    if (resident_name) {
      query += ' AND r.full_name LIKE ?';
      params.push(`%${resident_name}%`);
    }
    
    query += ' ORDER BY al.log_time DESC LIMIT ?';
    params.push(parseInt(limit));
    
    const [logs] = await pool.query(query, params);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching access logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const [totalLogs] = await pool.query('SELECT COUNT(*) as count FROM access_logs');
    const [granted] = await pool.query("SELECT COUNT(*) as count FROM access_logs WHERE status = 'Granted'");
    const [denied] = await pool.query("SELECT COUNT(*) as count FROM access_logs WHERE status = 'Denied'");
    const [todayLogs] = await pool.query(
      'SELECT COUNT(*) as count FROM access_logs WHERE DATE(log_time) = CURDATE()'
    );
    const [avgConfidence] = await pool.query(
      'SELECT AVG(confidence_score) as avg_score FROM access_logs WHERE confidence_score > 0'
    );
    const [entries] = await pool.query("SELECT COUNT(*) as count FROM access_logs WHERE direction = 'Entry'");
    const [exits] = await pool.query("SELECT COUNT(*) as count FROM access_logs WHERE direction = 'Exit'");
    const [avgSpeed] = await pool.query('SELECT AVG(verification_duration_ms) as avg_ms FROM access_logs WHERE verification_duration_ms > 0');
    
    res.json({
      total: totalLogs[0].count,
      granted: granted[0].count,
      denied: denied[0].count,
      today: todayLogs[0].count,
      avgConfidence: avgConfidence[0].avg_score || 0,
      entries: entries[0].count,
      exits: exits[0].count,
      avgSpeed: Math.round(avgSpeed[0].avg_ms || 0)
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/recent', async (req, res) => {
  try {
    const [logs] = await pool.query(`
      SELECT al.*, r.full_name 
      FROM access_logs al 
      LEFT JOIN residents r ON al.resident_id = r.resident_id 
      ORDER BY al.log_time DESC 
      LIMIT 20
    `);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching recent logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/throughput', async (req, res) => {
  try {
    const [hourlyThroughput] = await pool.query(`
      SELECT 
        HOUR(log_time) as hour,
        COUNT(*) as total,
        SUM(CASE WHEN direction = 'Entry' THEN 1 ELSE 0 END) as entries,
        SUM(CASE WHEN direction = 'Exit' THEN 1 ELSE 0 END) as exits,
        AVG(verification_duration_ms) as avg_speed
      FROM access_logs 
      WHERE DATE(log_time) = CURDATE()
      GROUP BY HOUR(log_time)
      ORDER BY hour
    `);
    
    const [peakHour] = await pool.query(`
      SELECT HOUR(log_time) as hour, COUNT(*) as count
      FROM access_logs 
      WHERE DATE(log_time) = CURDATE()
      GROUP BY HOUR(log_time)
      ORDER BY count DESC
      LIMIT 1
    `);
    
    const [totalToday] = await pool.query(
      'SELECT COUNT(*) as count FROM access_logs WHERE DATE(log_time) = CURDATE()'
    );
    
    res.json({
      hourly: hourlyThroughput,
      peakHour: peakHour[0] || null,
      totalToday: totalToday[0].count
    });
  } catch (error) {
    console.error('Error fetching throughput:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
