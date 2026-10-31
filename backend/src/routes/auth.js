const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_TIME_MS = 15 * 60 * 1000;

function validatePasswordStrength(password) {
  const errors = [];
  if (password.length < 8) errors.push('at least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('one lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('one number');
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push('one special character');
  return errors;
}

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const [admins] = await pool.query(
      'SELECT * FROM system_admins WHERE username = ?',
      [username]
    );

    if (admins.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const admin = admins[0];

    if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
      const remaining = Math.ceil((new Date(admin.locked_until) - new Date()) / 60000);
      return res.status(423).json({ error: `Account locked. Try again in ${remaining} minutes.` });
    }

    const validPassword = await bcrypt.compare(password, admin.password_hash);

    if (!validPassword) {
      const attempts = (admin.failed_attempts || 0) + 1;
      const lockUntil = attempts >= MAX_LOGIN_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_TIME_MS).toISOString().slice(0, 19).replace('T', ' ')
        : null;

      await pool.query(
        'UPDATE system_admins SET failed_attempts = ?, locked_until = ? WHERE admin_id = ?',
        [attempts, lockUntil, admin.admin_id]
      );

      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        return res.status(423).json({ error: 'Account locked due to too many failed attempts. Try again in 15 minutes.' });
      }

      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await pool.query(
      'UPDATE system_admins SET failed_attempts = 0, locked_until = NULL WHERE admin_id = ?',
      [admin.admin_id]
    );

    const token = jwt.sign(
      { id: admin.admin_id, username: admin.username, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    await pool.query(
      'INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)',
      [admin.admin_id, 'LOGIN', `User ${username} logged in`]
    );

    res.json({
      token,
      admin: {
        id: admin.admin_id,
        username: admin.username,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/register', authenticateToken, requireRole(['Super']), async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const passwordErrors = validatePasswordStrength(password);
    if (passwordErrors.length > 0) {
      return res.status(400).json({
        error: `Password must contain: ${passwordErrors.join(', ')}`
      });
    }

    const [existing] = await pool.query(
      'SELECT admin_id FROM system_admins WHERE username = ?',
      [username]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const [result] = await pool.query(
      'INSERT INTO system_admins (username, password_hash, role) VALUES (?, ?, ?)',
      [username, hashedPassword, role || 'Staff']
    );

    await pool.query(
      'INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)',
      [req.user.id, 'CREATE_ADMIN', `Created admin account: ${username}`]
    );

    res.status(201).json({
      message: 'Admin registered successfully',
      adminId: result.insertId
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    const passwordErrors = validatePasswordStrength(newPassword);
    if (passwordErrors.length > 0) {
      return res.status(400).json({
        error: `New password must contain: ${passwordErrors.join(', ')}`
      });
    }

    const [admins] = await pool.query(
      'SELECT * FROM system_admins WHERE admin_id = ?',
      [req.user.id]
    );

    if (admins.length === 0) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    const validPassword = await bcrypt.compare(currentPassword, admins[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await pool.query(
      'UPDATE system_admins SET password_hash = ? WHERE admin_id = ?',
      [hashedPassword, req.user.id]
    );

    await pool.query(
      'INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)',
      [req.user.id, 'CHANGE_PASSWORD', 'Password changed']
    );

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)',
      [req.user.id, 'LOGOUT', `User ${req.user.username} logged out`]
    );

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
