const crypto = require('crypto');
const express = require('express');
const { pool, query } = require('../db/pool');
const { ensureAppSchema } = require('../db/app');
const { ROLE_PERMISSIONS } = require('../utils/rbac');

const router = express.Router();

function mapUser(row) {
  const role = String(row.role || 'staff');
  return {
    id: String(row.id),
    username: row.username,
    email: row.email || '',
    fullName: row.full_name || '',
    role,
    permissions: ROLE_PERMISSIONS[role] || [],
    active: Boolean(row.is_active),
    lastLogin: row.last_login,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeUserPayload(body) {
  return {
    username: String(body.username || '').trim(),
    email: String(body.email || '').trim(),
    fullName: String(body.fullName || '').trim(),
    role: String(body.role || 'staff').trim(),
    active: body.active === undefined ? true : Boolean(body.active),
    password: String(body.password || '').trim(),
  };
}

router.get('/roles', async (req, res) => {
  res.json(
    Object.entries(ROLE_PERMISSIONS).map(([role, permissions]) => ({
      role,
      permissions,
    }))
  );
});

router.get('/', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const tenantId = req.tenantId;
    const rows = await query(
      `
        SELECT id, username, email, full_name, role, is_active, last_login, created_at, updated_at
        FROM users
        WHERE tenant_id = ?
        ORDER BY is_active DESC, username ASC
      `,
      [tenantId]
    );
    res.json(rows.map(mapUser));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await ensureAppSchema();
    const tenantId = req.tenantId;
    const payload = normalizeUserPayload(req.body);

    if (!payload.username || !payload.fullName || !payload.password) {
      return res.status(400).json({ message: 'Username, full name, and password are required' });
    }
    if (!ROLE_PERMISSIONS[payload.role]) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    // Check for duplicate within tenant
    const existing = await query('SELECT id FROM users WHERE tenant_id = ? AND username = ? LIMIT 1', [tenantId, payload.username]);
    if (existing[0]) {
      return res.status(409).json({ message: 'Username already exists' });
    }

    const passwordHash = crypto.createHash('sha256').update(payload.password).digest('hex');

    await connection.beginTransaction();
    const [result] = await connection.execute(
      `
        INSERT INTO users (tenant_id, username, password_hash, email, full_name, role, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [tenantId, payload.username, passwordHash, payload.email || null, payload.fullName, payload.role, payload.active ? 1 : 0]
    );
    await connection.commit();

    const rows = await query(
      `SELECT id, username, email, full_name, role, is_active, last_login, created_at, updated_at FROM users WHERE id = ?`,
      [result.insertId]
    );
    res.status(201).json(mapUser(rows[0]));
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

router.put('/:id', async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await ensureAppSchema();
    const payload = normalizeUserPayload(req.body);
    if (!payload.username || !payload.fullName) {
      return res.status(400).json({ message: 'Username and full name are required' });
    }
    if (!ROLE_PERMISSIONS[payload.role]) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const current = await query('SELECT id FROM users WHERE id = ? LIMIT 1', [req.params.id]);
    if (!current[0]) {
      return res.status(404).json({ message: 'User not found' });
    }

    const duplicate = await query('SELECT id FROM users WHERE username = ? AND id <> ? LIMIT 1', [payload.username, req.params.id]);
    if (duplicate[0]) {
      return res.status(409).json({ message: 'Username already exists' });
    }

    const params = [payload.username, payload.email || null, payload.fullName, payload.role, payload.active ? 1 : 0];
    let passwordSql = '';
    if (payload.password) {
      const passwordHash = crypto.createHash('sha256').update(payload.password).digest('hex');
      passwordSql = ', password_hash = ?';
      params.push(passwordHash);
    }
    params.push(req.params.id);

    await connection.beginTransaction();
    await connection.execute(
      `
        UPDATE users
        SET username = ?, email = ?, full_name = ?, role = ?, is_active = ?${passwordSql}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      params
    );
    await connection.commit();

    const rows = await query(
      `SELECT id, username, email, full_name, role, is_active, last_login, created_at, updated_at FROM users WHERE id = ?`,
      [req.params.id]
    );
    res.json(mapUser(rows[0]));
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const current = await query('SELECT id, username FROM users WHERE id = ? LIMIT 1', [req.params.id]);
    if (!current[0]) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (current[0].username === 'admin') {
      return res.status(400).json({ message: 'Default admin cannot be deleted' });
    }

    await query('UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
