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
    const { type } = req.query;

    if (type === 'threshold') {
      const [logs] = await pool.query('SELECT confidence_score, is_genuine FROM access_logs WHERE is_genuine IS NOT NULL');
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
      return res.json(results);
    }

    if (type === 'device') {
      const [results] = await pool.query(`
        SELECT d.device_id, d.location, COUNT(al.log_id) as total_attempts,
          SUM(CASE WHEN al.status = 'Granted' THEN 1 ELSE 0 END) as granted,
          SUM(CASE WHEN al.status = 'Denied' THEN 1 ELSE 0 END) as denied,
          AVG(al.verification_duration_ms) as avg_speed,
          AVG(al.confidence_score) as avg_confidence
        FROM access_logs al LEFT JOIN devices d ON al.device_id = d.device_id
        GROUP BY d.device_id, d.location
      `);
      return res.json(results);
    }

    if (type === 'timeline') {
      const [results] = await pool.query(`
        SELECT DATE(log_time) as date, COUNT(*) as total,
          SUM(CASE WHEN status = 'Granted' THEN 1 ELSE 0 END) as granted,
          SUM(CASE WHEN status = 'Denied' THEN 1 ELSE 0 END) as denied,
          AVG(verification_duration_ms) as avg_speed
        FROM access_logs WHERE log_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(log_time) ORDER BY date DESC
      `);
      return res.json(results);
    }

    // Default: aggregate accuracy metrics in one null-safe query.
    const [[metrics]] = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN is_genuine = 1 THEN 1 ELSE 0 END), 0) AS genuine,
        COALESCE(SUM(CASE WHEN is_genuine = 0 THEN 1 ELSE 0 END), 0) AS impostor,
        COALESCE(SUM(CASE WHEN status = 'Granted' AND is_genuine = 1 THEN 1 ELSE 0 END), 0) AS true_positives,
        COALESCE(SUM(CASE WHEN status = 'Granted' AND is_genuine = 0 THEN 1 ELSE 0 END), 0) AS false_positives,
        COALESCE(SUM(CASE WHEN status = 'Denied' AND is_genuine = 0 THEN 1 ELSE 0 END), 0) AS true_negatives,
        COALESCE(SUM(CASE WHEN status = 'Denied' AND is_genuine = 1 THEN 1 ELSE 0 END), 0) AS false_negatives,
        AVG(NULLIF(verification_duration_ms, 0)) AS avg_speed,
        MIN(NULLIF(verification_duration_ms, 0)) AS min_speed,
        MAX(NULLIF(verification_duration_ms, 0)) AS max_speed,
        AVG(NULLIF(confidence_score, 0)) AS avg_confidence
      FROM access_logs
    `);

    const total = Number(metrics.total || 0);
    const genuine = Number(metrics.genuine || 0);
    const impostor = Number(metrics.impostor || 0);
    const tpv = Number(metrics.true_positives || 0);
    const fpv = Number(metrics.false_positives || 0);
    const tnv = Number(metrics.true_negatives || 0);
    const fnv = Number(metrics.false_negatives || 0);

    return res.json({
      total,
      genuine, impostor,
      truePositives: tpv, falsePositives: fpv,
      trueNegatives: tnv, falseNegatives: fnv,
      far: impostor > 0 ? ((fpv / impostor) * 100).toFixed(2) : 0,
      frr: genuine > 0 ? ((fnv / genuine) * 100).toFixed(2) : 0,
      accuracy: total > 0 ? (((tpv + tnv) / total) * 100).toFixed(2) : 0,
      avgSpeed: Number(metrics.avg_speed || 0),
      minSpeed: Number(metrics.min_speed || 0),
      maxSpeed: Number(metrics.max_speed || 0),
      avgConfidence: Number(metrics.avg_confidence || 0).toFixed(2)
    });
  } catch (error) {
    console.error('Evaluation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
