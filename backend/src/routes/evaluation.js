const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/accuracy', async (req, res) => {
  try {
    const [totalAttempts] = await pool.query('SELECT COUNT(*) as count FROM access_logs');
    const [grantedAttempts] = await pool.query("SELECT COUNT(*) as count FROM access_logs WHERE status = 'Granted'");
    const [deniedAttempts] = await pool.query("SELECT COUNT(*) as count FROM access_logs WHERE status = 'Denied'");
    
    const [genuineAttempts] = await pool.query('SELECT COUNT(*) as count FROM access_logs WHERE is_genuine = 1');
    const [impostorAttempts] = await pool.query('SELECT COUNT(*) as count FROM access_logs WHERE is_genuine = 0');
    
    const [truePositives] = await pool.query("SELECT COUNT(*) as count FROM access_logs WHERE status = 'Granted' AND is_genuine = 1");
    const [falsePositives] = await pool.query("SELECT COUNT(*) as count FROM access_logs WHERE status = 'Granted' AND is_genuine = 0");
    const [trueNegatives] = await pool.query("SELECT COUNT(*) as count FROM access_logs WHERE status = 'Denied' AND is_genuine = 0");
    const [falseNegatives] = await pool.query("SELECT COUNT(*) as count FROM access_logs WHERE status = 'Denied' AND is_genuine = 1");
    
    const genuine = genuineAttempts[0].count;
    const impostor = impostorAttempts[0].count;
    const tp = truePositives[0].count;
    const fp = falsePositives[0].count;
    const tn = trueNegatives[0].count;
    const fn = falseNegatives[0].count;
    
    const far = impostor > 0 ? (fp / impostor) * 100 : 0;
    const frr = genuine > 0 ? (fn / genuine) * 100 : 0;
    const accuracy = (totalAttempts[0].count > 0) ? ((tp + tn) / totalAttempts[0].count) * 100 : 0;
    
    const [avgSpeed] = await pool.query('SELECT AVG(verification_duration_ms) as avg_ms FROM access_logs WHERE verification_duration_ms > 0');
    const [minSpeed] = await pool.query('SELECT MIN(verification_duration_ms) as min_ms FROM access_logs WHERE verification_duration_ms > 0');
    const [maxSpeed] = await pool.query('SELECT MAX(verification_duration_ms) as max_ms FROM access_logs WHERE verification_duration_ms > 0');
    
    const [avgConfidence] = await pool.query('SELECT AVG(confidence_score) as avg_score FROM access_logs WHERE confidence_score > 0');
    
    res.json({
      total: totalAttempts[0].count,
      genuine: genuine,
      impostor: impostor,
      truePositives: tp,
      falsePositives: fp,
      trueNegatives: tn,
      falseNegatives: fn,
      far: far.toFixed(2),
      frr: frr.toFixed(2),
      accuracy: accuracy.toFixed(2),
      avgSpeed: avgSpeed[0].avg_ms || 0,
      minSpeed: minSpeed[0].min_ms || 0,
      maxSpeed: maxSpeed[0].max_ms || 0,
      avgConfidence: (avgConfidence[0].avg_score || 0).toFixed(2)
    });
  } catch (error) {
    console.error('Error fetching accuracy metrics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/by-threshold', async (req, res) => {
  try {
    const [logs] = await pool.query(`
      SELECT confidence_score, is_genuine 
      FROM access_logs 
      WHERE is_genuine IS NOT NULL
    `);
    
    const thresholds = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
    const results = [];
    
    for (const threshold of thresholds) {
      let tp = 0, fp = 0, tn = 0, fn = 0;
      
      for (const log of logs) {
        const predicted = log.confidence_score >= threshold ? 1 : 0;
        const actual = log.is_genuine;
        
        if (predicted === 1 && actual === 1) tp++;
        else if (predicted === 1 && actual === 0) fp++;
        else if (predicted === 0 && actual === 0) tn++;
        else if (predicted === 0 && actual === 1) fn++;
      }
      
      const genuine = tp + fn;
      const impostor = fp + tn;
      
      results.push({
        threshold,
        far: impostor > 0 ? ((fp / impostor) * 100).toFixed(2) : 0,
        frr: genuine > 0 ? ((fn / genuine) * 100).toFixed(2) : 0,
        accuracy: logs.length > 0 ? (((tp + tn) / logs.length) * 100).toFixed(2) : 0
      });
    }
    
    res.json(results);
  } catch (error) {
    console.error('Error fetching threshold analysis:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/by-device', async (req, res) => {
  try {
    const [results] = await pool.query(`
      SELECT 
        d.device_id,
        d.location,
        COUNT(al.log_id) as total_attempts,
        SUM(CASE WHEN al.status = 'Granted' THEN 1 ELSE 0 END) as granted,
        SUM(CASE WHEN al.status = 'Denied' THEN 1 ELSE 0 END) as denied,
        AVG(al.verification_duration_ms) as avg_speed,
        AVG(al.confidence_score) as avg_confidence
      FROM access_logs al
      LEFT JOIN devices d ON al.device_id = d.device_id
      GROUP BY d.device_id, d.location
    `);
    
    res.json(results);
  } catch (error) {
    console.error('Error fetching device analysis:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/timeline', async (req, res) => {
  try {
    const [results] = await pool.query(`
      SELECT 
        DATE(log_time) as date,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Granted' THEN 1 ELSE 0 END) as granted,
        SUM(CASE WHEN status = 'Denied' THEN 1 ELSE 0 END) as denied,
        AVG(verification_duration_ms) as avg_speed
      FROM access_logs
      WHERE log_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(log_time)
      ORDER BY date DESC
    `);
    
    res.json(results);
  } catch (error) {
    console.error('Error fetching timeline:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
