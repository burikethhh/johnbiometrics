const { getPool } = require('./_lib/db');
const { authenticateToken, corsHeaders } = require('./_lib/auth');

module.exports = async function handler(req, res) {
  const headers = corsHeaders(req.headers?.origin);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(204).end();

  const auth = authenticateToken(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  try {
    const pool = getPool();
    const { action } = req.query;

    if (action === 'stats') {
      const [totalLogs] = await pool.query('SELECT COUNT(*) as count FROM access_logs');
      const [granted] = await pool.query("SELECT COUNT(*) as count FROM access_logs WHERE status = 'Granted'");
      const [denied] = await pool.query("SELECT COUNT(*) as count FROM access_logs WHERE status = 'Denied'");
      const [todayLogs] = await pool.query('SELECT COUNT(*) as count FROM access_logs WHERE DATE(log_time) = CURDATE()');
      const [avgConfidence] = await pool.query('SELECT AVG(confidence_score) as avg_score FROM access_logs WHERE confidence_score > 0');
      const [entries] = await pool.query("SELECT COUNT(*) as count FROM access_logs WHERE direction = 'Entry'");
      const [exits] = await pool.query("SELECT COUNT(*) as count FROM access_logs WHERE direction = 'Exit'");
      const [avgSpeed] = await pool.query('SELECT AVG(verification_duration_ms) as avg_ms FROM access_logs WHERE verification_duration_ms > 0');

      return res.json({
        total: totalLogs[0].count,
        granted: granted[0].count,
        denied: denied[0].count,
        today: todayLogs[0].count,
        avgConfidence: avgConfidence[0].avg_score || 0,
        entries: entries[0].count,
        exits: exits[0].count,
        avgSpeed: Math.round(avgSpeed[0].avg_ms || 0)
      });
    }

    // Default: list logs
    const { start_date, end_date, status, direction, resident_name, limit = 500 } = req.query;

    let query = `
      SELECT al.*, r.full_name 
      FROM access_logs al 
      LEFT JOIN residents r ON al.resident_id = r.resident_id 
      WHERE 1=1
    `;
    const params = [];

    if (start_date) { query += ' AND al.log_time >= ?'; params.push(start_date); }
    if (end_date) { query += ' AND al.log_time <= ?'; params.push(end_date); }
    if (status) { query += ' AND al.status = ?'; params.push(status); }
    if (direction) { query += ' AND al.direction = ?'; params.push(direction); }
    if (resident_name) { query += ' AND r.full_name LIKE ?'; params.push(`%${resident_name}%`); }

    query += ' ORDER BY al.log_time DESC LIMIT ?';
    params.push(parseInt(limit));

    const [logs] = await pool.query(query, params);
    return res.json(logs);
  } catch (error) {
    console.error('Access logs error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
