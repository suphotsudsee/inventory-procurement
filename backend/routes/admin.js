/**
 * Admin Routes - Tenant Management
 * Only accessible by admin/superadmin users
 */

const express = require('express');
const { pool, query } = require('../db/pool');
const { ensureAppSchema } = require('../db/app');
const { hasPermission } = require('../middleware/auth');
const { logSensitiveOperation } = require('../utils/audit-log');

const router = express.Router();

// All admin routes require admin permission
router.use(hasPermission('admin'));

/**
 * GET /api/admin/tenants
 * List all tenants with optional filters
 */
router.get('/tenants', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const { status, type, plan, search, page, limit } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    if (status) {
      where += ' AND status = ?';
      params.push(status);
    }

    if (type) {
      where += ' AND tenant_type = ?';
      params.push(type);
    }

    if (plan) {
      where += ' AND subscription_plan = ?';
      params.push(plan);
    }

    if (search) {
      where += ' AND (tenant_code LIKE ? OR tenant_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const parsedPage = Math.max(Number(page) || 1, 1);
    const parsedLimit = Math.min(Math.max(Number(limit) || 0, 0), 100);
    const usePagination = parsedLimit > 0;

    if (!usePagination) {
      const rows = await query(
        `SELECT * FROM tenants ${where} ORDER BY created_at DESC`,
        params
      );
      return res.json(rows);
    }

    const offset = (parsedPage - 1) * parsedLimit;
    const [countRow] = await query(`SELECT COUNT(*) AS total FROM tenants ${where}`, params);
    const rows = await query(
      `SELECT * FROM tenants ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parsedLimit, offset]
    );

    res.json({
      items: rows,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total: Number(countRow.total || 0),
        totalPages: Math.ceil(Number(countRow.total || 0) / parsedLimit),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/tenants/:id
 * Get tenant details with usage stats
 */
router.get('/tenants/:id', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const tenantId = req.params.id;

    const rows = await query('SELECT * FROM tenants WHERE id = ? LIMIT 1', [tenantId]);
    
    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    const tenant = rows[0];

    // Get usage stats
    const stats = await query(
      `
        SELECT 
          (SELECT COUNT(*) FROM products WHERE tenant_id = ? AND is_active = TRUE) AS product_count,
          (SELECT COUNT(*) FROM users WHERE tenant_id = ? AND is_active = TRUE) AS user_count,
          (SELECT COALESCE(SUM(quantity), 0) FROM invp_stock_lots WHERE tenant_id = ? AND quantity > 0) AS stock_items,
          (SELECT COUNT(*) FROM purchase_orders WHERE tenant_id = ?) AS total_pos,
          (SELECT COUNT(*) FROM purchase_orders WHERE tenant_id = ? AND status = 'pending') AS pending_pos
      `,
      [tenantId, tenantId, tenantId, tenantId, tenantId]
    );

    res.json({
      ...tenant,
      usage: stats[0],
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/tenants
 * Create new tenant
 */
router.post('/tenants', async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await ensureAppSchema();
    const {
      tenant_code,
      tenant_name,
      tenant_type = 'hospital',
      subscription_plan = 'basic',
      max_users = 10,
      max_products = 5000,
      trial_days = 30,
    } = req.body;

    if (!tenant_code || !tenant_name) {
      return res.status(400).json({ message: 'tenant_code and tenant_name are required' });
    }

    await connection.beginTransaction();

    // Check for duplicate code
    const existing = await query('SELECT id FROM tenants WHERE tenant_code = ? LIMIT 1', [tenant_code]);
    if (existing && existing.length > 0) {
      return res.status(409).json({ message: 'Tenant code already exists' });
    }

    const [result] = await connection.execute(
      `
        INSERT INTO tenants (
          tenant_code,
          tenant_name,
          tenant_type,
          subscription_plan,
          max_users,
          max_products,
          status,
          trial_ends_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'trial', DATE_ADD(CURDATE(), INTERVAL ? DAY))
      `,
      [tenant_code, tenant_name, tenant_type, subscription_plan, max_users, max_products, trial_days]
    );

    // Create default admin user for the tenant
    const defaultAdminUsername = `admin_${tenant_code.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const defaultPasswordHash = '$2b$10$DEFAULT_HASH_REPLACE_ON_FIRST_LOGIN'; // Force password reset

    await connection.execute(
      `
        INSERT INTO users (
          tenant_id,
          username,
          password_hash,
          full_name,
          email,
          role,
          is_active
        ) VALUES (?, ?, ?, ?, ?, 'admin', TRUE)
      `,
      [result.insertId, defaultAdminUsername, defaultPasswordHash, 'Tenant Administrator', '']
    );

    // Set default configurations
    await connection.execute(
      `
        INSERT INTO tenant_configs (tenant_id, config_key, config_value, config_type, description) VALUES
        (?, 'timezone', 'Asia/Bangkok', 'string', 'Tenant timezone'),
        (?, 'currency', 'THB', 'string', 'Default currency'),
        (?, 'date_format', 'YYYY-MM-DD', 'string', 'Date display format'),
        (?, 'low_stock_threshold', '20', 'number', 'Days before expiry to warn')
      `,
      [result.insertId, result.insertId, result.insertId, result.insertId]
    );

    await connection.commit();

    // Log sensitive operation
    logSensitiveOperation({
      tenant_id: result.insertId,
      user_id: req.user?.userId,
      operation: 'create_tenant',
      details: JSON.stringify({ tenant_code, tenant_name }),
    });

    res.status(201).json({
      id: result.insertId,
      tenant_code,
      tenant_name,
      message: 'Tenant created successfully. Default admin user created with username: ' + defaultAdminUsername,
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

/**
 * PUT /api/admin/tenants/:id
 * Update tenant
 */
router.put('/tenants/:id', async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await ensureAppSchema();
    const tenantId = req.params.id;
    const {
      tenant_name,
      tenant_type,
      subscription_plan,
      max_users,
      max_products,
      status,
      subscription_starts_at,
      subscription_ends_at,
    } = req.body;

    // Check tenant exists
    const existing = await query('SELECT id FROM tenants WHERE id = ? LIMIT 1', [tenantId]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    await connection.beginTransaction();

    const updates = [];
    const params = [];

    if (tenant_name !== undefined) {
      updates.push('tenant_name = ?');
      params.push(tenant_name);
    }
    if (tenant_type !== undefined) {
      updates.push('tenant_type = ?');
      params.push(tenant_type);
    }
    if (subscription_plan !== undefined) {
      updates.push('subscription_plan = ?');
      params.push(subscription_plan);
    }
    if (max_users !== undefined) {
      updates.push('max_users = ?');
      params.push(max_users);
    }
    if (max_products !== undefined) {
      updates.push('max_products = ?');
      params.push(max_products);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    if (subscription_starts_at !== undefined) {
      updates.push('subscription_starts_at = ?');
      params.push(subscription_starts_at);
    }
    if (subscription_ends_at !== undefined) {
      updates.push('subscription_ends_at = ?');
      params.push(subscription_ends_at);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(tenantId);

    await connection.execute(
      `UPDATE tenants SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    await connection.commit();

    // Log sensitive operation
    logSensitiveOperation({
      tenant_id: parseInt(tenantId),
      user_id: req.user?.userId,
      operation: 'update_tenant',
      details: JSON.stringify(req.body),
    });

    res.json({ message: 'Tenant updated successfully' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

/**
 * DELETE /api/admin/tenants/:id
 * Soft delete (suspend) tenant
 */
router.delete('/tenants/:id', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const tenantId = req.params.id;

    // Check tenant exists
    const existing = await query('SELECT id FROM tenants WHERE id = ? LIMIT 1', [tenantId]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    // Soft delete: set status to cancelled
    await query(
      'UPDATE tenants SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['cancelled', tenantId]
    );

    // Log sensitive operation
    logSensitiveOperation({
      tenant_id: parseInt(tenantId),
      user_id: req.user?.userId,
      operation: 'delete_tenant',
      details: JSON.stringify({ action: 'soft_delete' }),
    });

    res.json({ message: 'Tenant suspended successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/tenants/:id/usage
 * Get detailed usage statistics for a tenant
 */
router.get('/tenants/:id/usage', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const tenantId = req.params.id;

    const usage = await query(
      `
        SELECT 
          -- Products
          (SELECT COUNT(*) FROM products WHERE tenant_id = ? AND is_active = TRUE) AS product_count,
          (SELECT COUNT(*) FROM products WHERE tenant_id = ? AND is_active = FALSE) AS deleted_products,
          
          -- Stock
          (SELECT COUNT(*) FROM invp_stock_lots WHERE tenant_id = ? AND quantity > 0) AS active_batches,
          (SELECT COALESCE(SUM(quantity), 0) FROM invp_stock_lots WHERE tenant_id = ? AND quantity > 0) AS total_stock_items,
          (SELECT COUNT(DISTINCT product_code) FROM invp_stock_lots WHERE tenant_id = ? AND quantity > 0) AS unique_products,
          
          -- Users
          (SELECT COUNT(*) FROM users WHERE tenant_id = ? AND is_active = TRUE) AS active_users,
          (SELECT COUNT(*) FROM users WHERE tenant_id = ? AND is_active = FALSE) AS deleted_users,
          
          -- Purchase Orders
          (SELECT COUNT(*) FROM purchase_orders WHERE tenant_id = ?) AS total_pos,
          (SELECT COUNT(*) FROM purchase_orders WHERE tenant_id = ? AND status = 'pending') AS pending_pos,
          (SELECT COUNT(*) FROM purchase_orders WHERE tenant_id = ? AND status = 'approved') AS approved_pos,
          (SELECT COALESCE(SUM(total_amount), 0) FROM purchase_orders WHERE tenant_id = ?) AS total_po_value,
          
          -- Stock Movements (last 30 days)
          (SELECT COUNT(*) FROM invp_stock_movements WHERE tenant_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS movements_30d,
          
          -- Storage
          (SELECT SUM(LENGTH(product_name) + LENGTH(COALESCE(description, ''))) FROM products WHERE tenant_id = ?) AS products_storage_bytes
      `,
      [
        tenantId, tenantId,
        tenantId, tenantId, tenantId,
        tenantId, tenantId,
        tenantId, tenantId, tenantId, tenantId,
        tenantId,
        tenantId
      ]
    );

    // Get tenant limits
    const tenant = await query('SELECT max_products, max_users, subscription_plan FROM tenants WHERE id = ?', [tenantId]);

    res.json({
      tenant_id: tenantId,
      subscription_plan: tenant[0]?.subscription_plan || 'unknown',
      limits: {
        max_products: tenant[0]?.max_products || 5000,
        max_users: tenant[0]?.max_users || 10,
      },
      usage: usage[0],
      quota_utilization: {
        products: `${((usage[0].product_count / (tenant[0]?.max_products || 5000)) * 100).toFixed(1)}%`,
        users: `${((usage[0].active_users / (tenant[0]?.max_users || 10)) * 100).toFixed(1)}%`,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/tenants/:id/audit
 * Get audit log for a tenant
 */
router.get('/tenants/:id/audit', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const tenantId = req.params.id;
    const { limit = 100, action, success } = req.query;

    let where = 'WHERE tenant_id = ?';
    const params = [tenantId];

    if (action) {
      where += ' AND action LIKE ?';
      params.push(`%${action}%`);
    }

    if (success !== undefined) {
      where += ' AND success = ?';
      params.push(success === 'true');
    }

    const rows = await query(
      `
        SELECT 
          id,
          user_id,
          action,
          resource_type,
          resource_id,
          accessed_tenant_id,
          success,
          reason,
          ip_address,
          created_at
        FROM tenant_access_audit
        ${where}
        ORDER BY created_at DESC
        LIMIT ?
      `,
      [...params, Math.min(Number(limit) || 100, 1000)]
    );

    res.json(rows);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
