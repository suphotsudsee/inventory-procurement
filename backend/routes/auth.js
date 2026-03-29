const crypto = require('crypto');
const express = require('express');
const { query } = require('../db/pool');
const { ensureAppSchema } = require('../db/app');
const { signToken } = require('../utils/auth-token');
const { ROLE_PERMISSIONS } = require('../utils/rbac');
const { isAuthenticated } = require('../middleware/auth');

const router = express.Router();

function mapUser(row) {
  const role = String(row.role || 'staff');
  return {
    id: String(row.id),
    username: row.username,
    fullName: row.full_name || '',
    email: row.email || '',
    role,
    permissions: ROLE_PERMISSIONS[role] || [],
    active: Boolean(row.is_active),
  };
}

router.post('/login', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '').trim();

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const rows = await query(
      `
        SELECT id, username, password_hash, email, full_name, role, is_active
        FROM users
        WHERE username = ?
        LIMIT 1
      `,
      [username]
    );

    if (!rows[0] || !rows[0].is_active) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    if (rows[0].password_hash !== passwordHash) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    await query('UPDATE users SET last_login = NOW(), updated_at = CURRENT_TIMESTAMP WHERE id = ?', [rows[0].id]);

    const user = mapUser(rows[0]);
    const token = signToken(user);
    res.json({ token, user });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', isAuthenticated, async (req, res) => {
  res.json({ success: true });
});

router.get('/me', isAuthenticated, async (req, res, next) => {
  try {
    await ensureAppSchema();
    const rows = await query(
      `
        SELECT id, username, email, full_name, role, is_active
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [req.user.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(mapUser(rows[0]));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
