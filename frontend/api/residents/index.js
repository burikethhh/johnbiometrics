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
      const id = req.query.id;

      if (id) {
        const [residents] = await pool.query('SELECT * FROM residents WHERE resident_id = ?', [id]);
        if (residents.length === 0) return res.status(404).json({ error: 'Resident not found' });
        return res.json(residents[0]);
      }

      const [residents] = await pool.query('SELECT * FROM residents ORDER BY date_registered DESC');
      return res.json(residents);
    }

    if (req.method === 'POST') {
      const roleCheck = requireRole(auth.user, ['Super']);
      if (roleCheck.error) return res.status(roleCheck.status).json({ error: roleCheck.error });

      const { full_name, address, contact_number, household_number } = req.body;
      if (!full_name) return res.status(400).json({ error: 'Full name is required' });

      const [result] = await pool.query(
        'INSERT INTO residents (full_name, address, contact_number, household_number) VALUES (?, ?, ?, ?)',
        [full_name, address, contact_number, household_number]
      );

      await pool.query(
        'INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)',
        [auth.user.id, 'REGISTER_RESIDENT', `Registered resident: ${full_name}`]
      );

      return res.status(201).json({ message: 'Resident registered successfully', residentId: result.insertId });
    }

    if (req.method === 'PUT') {
      const roleCheck = requireRole(auth.user, ['Super']);
      if (roleCheck.error) return res.status(roleCheck.status).json({ error: roleCheck.error });

      const { id } = req.query;
      const { full_name, address, contact_number, household_number, status } = req.body;

      const [existing] = await pool.query('SELECT * FROM residents WHERE resident_id = ?', [id]);
      if (existing.length === 0) return res.status(404).json({ error: 'Resident not found' });

      await pool.query(
        'UPDATE residents SET full_name = ?, address = ?, contact_number = ?, household_number = ?, status = ? WHERE resident_id = ?',
        [
          full_name || existing[0].full_name,
          address || existing[0].address,
          contact_number || existing[0].contact_number,
          household_number || existing[0].household_number,
          status || existing[0].status,
          id
        ]
      );

      return res.json({ message: 'Resident updated successfully' });
    }

    if (req.method === 'DELETE') {
      const roleCheck = requireRole(auth.user, ['Super']);
      if (roleCheck.error) return res.status(roleCheck.status).json({ error: roleCheck.error });

      const { id } = req.query;
      const [existing] = await pool.query('SELECT * FROM residents WHERE resident_id = ?', [id]);
      if (existing.length === 0) return res.status(404).json({ error: 'Resident not found' });

      await pool.query('DELETE FROM residents WHERE resident_id = ?', [id]);

      await pool.query(
        'INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)',
        [auth.user.id, 'DELETE_RESIDENT', `Deleted resident ID: ${id}`]
      );

      return res.json({ message: 'Resident deleted successfully' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Residents error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
