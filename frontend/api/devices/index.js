const { getPool } = require('../_lib/db');
const { authenticateToken, requireRole, corsHeaders } = require('../_lib/auth');

module.exports = async function handler(req, res) {
  const headers = corsHeaders(req.headers?.origin);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(204).end();

  const auth = authenticateToken(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  try {
    const pool = getPool();

    if (req.method === 'GET') {
      const [devices] = await pool.query('SELECT * FROM devices ORDER BY device_id');
      return res.json(devices);
    }

    if (req.method === 'POST') {
      const roleCheck = requireRole(auth.user, ['Super']);
      if (roleCheck.error) return res.status(roleCheck.status).json({ error: roleCheck.error });

      const { location, scanner_model, usb_port } = req.body;
      if (!location) return res.status(400).json({ error: 'Location is required' });

      const [result] = await pool.query(
        'INSERT INTO devices (location, scanner_model, usb_port) VALUES (?, ?, ?)',
        [location, scanner_model, usb_port]
      );

      return res.status(201).json({ message: 'Device added successfully', deviceId: result.insertId });
    }

    if (req.method === 'PUT') {
      const roleCheck = requireRole(auth.user, ['Super']);
      if (roleCheck.error) return res.status(roleCheck.status).json({ error: roleCheck.error });

      const { id } = req.query;
      const { location, device_status, scanner_model, usb_port } = req.body;

      const [existing] = await pool.query('SELECT * FROM devices WHERE device_id = ?', [id]);
      if (existing.length === 0) return res.status(404).json({ error: 'Device not found' });

      await pool.query(
        'UPDATE devices SET location = ?, device_status = ?, scanner_model = ?, usb_port = ? WHERE device_id = ?',
        [
          location || existing[0].location,
          device_status || existing[0].device_status,
          scanner_model || existing[0].scanner_model,
          usb_port || existing[0].usb_port,
          id
        ]
      );

      return res.json({ message: 'Device updated successfully' });
    }

    if (req.method === 'DELETE') {
      const roleCheck = requireRole(auth.user, ['Super']);
      if (roleCheck.error) return res.status(roleCheck.status).json({ error: roleCheck.error });

      const { id } = req.query;
      const [existing] = await pool.query('SELECT * FROM devices WHERE device_id = ?', [id]);
      if (existing.length === 0) return res.status(404).json({ error: 'Device not found' });

      await pool.query('DELETE FROM devices WHERE device_id = ?', [id]);
      return res.json({ message: 'Device deleted successfully' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Devices error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
