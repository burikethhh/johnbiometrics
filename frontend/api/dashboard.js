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

    if (action === 'hourly') {
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
      return res.json(hourlyData);
    }

    // Default: overview
    const [totalResidents] = await pool.query('SELECT COUNT(*) as count FROM residents');
    const [activeResidents] = await pool.query("SELECT COUNT(*) as count FROM residents WHERE status = 'Active'");
    const [totalFingerprints] = await pool.query('SELECT COUNT(*) as count FROM fingerprint_data');
    const [totalDevices] = await pool.query('SELECT COUNT(*) as count FROM devices');
    const [todayAccess] = await pool.query('SELECT COUNT(*) as count FROM access_logs WHERE DATE(log_time) = CURDATE()');
    const [todayEntries] = await pool.query("SELECT COUNT(*) as count FROM access_logs WHERE DATE(log_time) = CURDATE() AND direction = 'Entry'");
    const [todayExits] = await pool.query("SELECT COUNT(*) as count FROM access_logs WHERE DATE(log_time) = CURDATE() AND direction = 'Exit'");
    const [recentLogs] = await pool.query(`
      SELECT al.*, r.full_name 
      FROM access_logs al LEFT JOIN residents r ON al.resident_id = r.resident_id 
      ORDER BY al.log_time DESC LIMIT 10
    `);

    return res.json({
      residents: { total: totalResidents[0].count, active: activeResidents[0].count },
      fingerprints: totalFingerprints[0].count,
      devices: totalDevices[0].count,
      todayAccess: todayAccess[0].count,
      todayEntries: todayEntries[0].count,
      todayExits: todayExits[0].count,
      recentLogs
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
