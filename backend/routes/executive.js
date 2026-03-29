/**
 * Executive Routes - Cross-Tenant Aggregation
 * Only accessible by admin/executive users
 */

const express = require('express');
const { pool, query } = require('../db/pool');
const { ensureAppSchema } = require('../db/app');
const { hasPermission } = require('../middleware/auth');

const router = express.Router();

// Executive routes require admin permission
router.use(hasPermission('admin'));

/**
 * GET /api/executive/summary
 * Aggregated summary across all tenants
 */
router.get('/summary', async (req, res, next) => {
  try {
    await ensureAppSchema();

    const summary = await query(
      `
        SELECT 
          -- Tenant counts
          (SELECT COUNT(*) FROM tenants WHERE status = 'active') AS active_tenants,
          (SELECT COUNT(*) FROM tenants WHERE status = 'trial') AS trial_tenants,
          (SELECT COUNT(*) FROM tenants WHERE status = 'suspended') AS suspended_tenants,
          (SELECT COUNT(*) FROM tenants WHERE status = 'cancelled') AS cancelled_tenants,
          
          -- Aggregate product stats
          (SELECT COUNT(*) FROM products WHERE is_active = TRUE) AS total_products,
          (SELECT COUNT(DISTINCT tenant_id) FROM products WHERE is_active = TRUE) AS tenants_with_products,
          
          -- Aggregate stock stats
          (SELECT COALESCE(SUM(quantity), 0) FROM invp_stock_lots WHERE quantity > 0) AS total_stock_items,
          (SELECT COUNT(DISTINCT CONCAT(tenant_id, '-', product_code)) FROM invp_stock_lots WHERE quantity > 0) AS unique_product_batches,
          
          -- Aggregate PO stats
          (SELECT COUNT(*) FROM purchase_orders) AS total_pos,
          (SELECT COUNT(*) FROM purchase_orders WHERE status = 'pending') AS pending_pos,
          (SELECT COUNT(*) FROM purchase_orders WHERE status = 'approved') AS approved_pos,
          (SELECT COALESCE(SUM(total_amount), 0) FROM purchase_orders) AS total_po_value,
          
          -- User stats
          (SELECT COUNT(*) FROM users WHERE is_active = TRUE) AS total_active_users,
          
          -- Alert stats
          (SELECT COUNT(*) FROM invp_stock_lots WHERE quantity > 0 AND expiry_date < CURDATE()) AS expired_items,
          (SELECT COUNT(*) FROM invp_stock_lots WHERE quantity > 0 AND expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)) AS expiring_7d,
          (SELECT COUNT(*) FROM invp_stock_lots WHERE quantity > 0 AND expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)) AS expiring_30d
      `
    );

    // Get tenant breakdown by plan
    const planBreakdown = await query(
      `
        SELECT 
          subscription_plan,
          COUNT(*) AS tenant_count,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_count
        FROM tenants
        GROUP BY subscription_plan
      `
    );

    // Get recent activity (last 24 hours)
    const recentActivity = await query(
      `
        SELECT 
          (SELECT COUNT(*) FROM purchase_orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) AS pos_created_24h,
          (SELECT COUNT(*) FROM invp_stock_movements WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) AS stock_movements_24h,
          (SELECT COUNT(*) FROM users WHERE last_login >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) AS active_users_24h
      `
    );

    res.json({
      overview: summary[0],
      plan_breakdown: planBreakdown,
      recent_activity: recentActivity[0],
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/executive/alerts
 * Critical alerts across all tenants
 */
router.get('/alerts', async (req, res, next) => {
  try {
    await ensureAppSchema();

    const [expiredStock, criticalStock, lowStock, pendingPOs, suspendedTenants] = await Promise.all([
      // Expired stock
      query(
        `
          SELECT 
            t.tenant_code,
            t.tenant_name,
            l.product_code,
            p.product_name,
            l.lot_number,
            l.quantity,
            l.expiry_date,
            DATEDIFF(CURDATE(), l.expiry_date) AS days_expired
          FROM invp_stock_lots l
          JOIN tenants t ON t.id = l.tenant_id
          JOIN products p ON p.product_code = l.product_code AND p.tenant_id = l.tenant_id
          WHERE l.quantity > 0 AND l.expiry_date < CURDATE()
          ORDER BY l.expiry_date ASC
          LIMIT 100
        `
      ),
      // Critical expiry (< 7 days)
      query(
        `
          SELECT 
            t.tenant_code,
            t.tenant_name,
            l.product_code,
            p.product_name,
            l.lot_number,
            l.quantity,
            l.expiry_date,
            DATEDIFF(l.expiry_date, CURDATE()) AS days_remaining
          FROM invp_stock_lots l
          JOIN tenants t ON t.id = l.tenant_id
          JOIN products p ON p.product_code = l.product_code AND p.tenant_id = l.tenant_id
          WHERE l.quantity > 0 
            AND l.expiry_date >= CURDATE()
            AND l.expiry_date < DATE_ADD(CURDATE(), INTERVAL 7 DAY)
          ORDER BY l.expiry_date ASC
          LIMIT 100
        `
      ),
      // Low stock
      query(
        `
          SELECT 
            t.tenant_code,
            t.tenant_name,
            p.product_code,
            p.product_name,
            COALESCE(SUM(l.quantity), 0) AS current_stock,
            COALESCE(sl.min_level, p.min_stock_level, 0) AS min_level,
            (COALESCE(sl.min_level, p.min_stock_level, 0) - COALESCE(SUM(l.quantity), 0)) AS shortage
          FROM products p
          JOIN tenants t ON t.id = p.tenant_id
          LEFT JOIN invp_stock_lots l ON l.product_code = p.product_code AND l.tenant_id = p.tenant_id AND l.quantity > 0
          LEFT JOIN stock_levels sl ON sl.product_id = p.id
          WHERE p.is_active = TRUE
          GROUP BY p.id, t.id
          HAVING current_stock < min_level
          ORDER BY shortage DESC
          LIMIT 100
        `
      ),
      // Pending POs > 7 days
      query(
        `
          SELECT 
            t.tenant_code,
            t.tenant_name,
            po.order_number,
            po.supplier_name,
            po.total_amount,
            po.order_date,
            DATEDIFF(CURDATE(), po.order_date) AS days_pending
          FROM purchase_orders po
          JOIN tenants t ON t.id = po.tenant_id
          WHERE po.status = 'pending'
            AND po.order_date < DATE_SUB(CURDATE(), INTERVAL 7 DAY)
          ORDER BY po.order_date ASC
          LIMIT 100
        `
      ),
      // Suspended tenants with recent activity
      query(
        `
          SELECT 
            t.tenant_code,
            t.tenant_name,
            t.status,
            t.subscription_plan,
            (SELECT COUNT(*) FROM users WHERE tenant_id = t.id AND is_active = TRUE) AS active_users
          FROM tenants t
          WHERE t.status IN ('suspended', 'trial')
            AND t.trial_ends_at < DATE_SUB(CURDATE(), INTERVAL 7 DAY)
          ORDER BY t.trial_ends_at ASC
          LIMIT 50
        `
      ),
    ]);

    res.json({
      alerts: {
        expired_stock: {
          count: expiredStock.length,
          items: expiredStock,
        },
        critical_expiry: {
          count: criticalStock.length,
          items: criticalStock,
        },
        low_stock: {
          count: lowStock.length,
          items: lowStock,
        },
        pending_pos: {
          count: pendingPOs.length,
          items: pendingPOs,
        },
        tenant_issues: {
          count: suspendedTenants.length,
          items: suspendedTenants,
        },
      },
      total_alerts: expiredStock.length + criticalStock.length + lowStock.length + pendingPOs.length + suspendedTenants.length,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/executive/tenants
 * List all tenants with summary stats
 */
router.get('/tenants', async (req, res, next) => {
  try {
    await ensureAppSchema();

    const tenants = await query(
      `
        SELECT 
          t.id,
          t.tenant_code,
          t.tenant_name,
          t.tenant_type,
          t.status,
          t.subscription_plan,
          t.trial_ends_at,
          t.subscription_ends_at,
          (SELECT COUNT(*) FROM products WHERE tenant_id = t.id AND is_active = TRUE) AS product_count,
          (SELECT COALESCE(SUM(lb.quantity), 0) FROM invp_stock_lots lb WHERE lb.tenant_id = t.id AND lb.quantity > 0) AS stock_items,
          (SELECT COUNT(*) FROM users WHERE tenant_id = t.id AND is_active = TRUE) AS user_count,
          (SELECT COUNT(*) FROM purchase_orders WHERE tenant_id = t.id AND status = 'pending') AS pending_pos,
          (SELECT COUNT(*) FROM invp_stock_lots l WHERE l.tenant_id = t.id AND l.expiry_date < CURDATE() + INTERVAL 7 DAY AND l.quantity > 0) AS expiring_soon
        FROM tenants t
        ORDER BY t.created_at DESC
      `
    );

    res.json(tenants);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/executive/comparison
 * Compare tenants by metrics
 */
router.get('/comparison', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const { metric = 'stock_value', limit = 20 } = req.query;

    let selectClause = '';
    let orderByClause = '';

    switch (metric) {
      case 'stock_value':
        selectClause = `
          COALESCE(SUM(lb.quantity * p.unit_cost), 0) AS metric_value
        `;
        orderByClause = 'metric_value DESC';
        break;
      case 'product_count':
        selectClause = `
          COUNT(DISTINCT p.id) AS metric_value
        `;
        orderByClause = 'metric_value DESC';
        break;
      case 'po_count':
        selectClause = `
          COUNT(DISTINCT po.id) AS metric_value
        `;
        orderByClause = 'metric_value DESC';
        break;
      case 'user_count':
        selectClause = `
          (SELECT COUNT(*) FROM users WHERE tenant_id = t.id AND is_active = TRUE) AS metric_value
        `;
        orderByClause = 'metric_value DESC';
        break;
      default:
        selectClause = `
          COALESCE(SUM(lb.quantity), 0) AS metric_value
        `;
        orderByClause = 'metric_value DESC';
    }

    const rows = await query(
      `
        SELECT 
          t.id,
          t.tenant_code,
          t.tenant_name,
          t.tenant_type,
          t.subscription_plan,
          ${selectClause}
        FROM tenants t
        LEFT JOIN products p ON p.tenant_id = t.id AND p.is_active = TRUE
        LEFT JOIN invp_stock_lots lb ON lb.tenant_id = t.id AND lb.product_code = p.product_code
        ${metric === 'po_count' ? 'LEFT JOIN purchase_orders po ON po.tenant_id = t.id' : ''}
        WHERE t.status = 'active'
        GROUP BY t.id
        ORDER BY ${orderByClause}
        LIMIT ?
      `,
      [Number(limit) || 20]
    );

    res.json(rows);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/executive/exports
 * Generate bulk export of all tenant data (admin only)
 */
router.get('/exports', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const { format = 'json' } = req.query;

    // This is a simplified version - in production, this would generate CSV/Excel
    const exportData = await query(
      `
        SELECT 
          t.tenant_code,
          t.tenant_name,
          t.status,
          COUNT(DISTINCT p.id) AS products,
          COALESCE(SUM(lb.quantity), 0) AS stock_items,
          (SELECT COUNT(*) FROM purchase_orders WHERE tenant_id = t.id) AS purchase_orders,
          (SELECT COUNT(*) FROM users WHERE tenant_id = t.id AND is_active = TRUE) AS users
        FROM tenants t
        LEFT JOIN products p ON p.tenant_id = t.id AND p.is_active = TRUE
        LEFT JOIN invp_stock_lots lb ON lb.tenant_id = t.id
        GROUP BY t.id
      `
    );

    if (format === 'csv') {
      const headers = ['tenant_code', 'tenant_name', 'status', 'products', 'stock_items', 'purchase_orders', 'users'];
      const csvRows = exportData.map(row => 
        headers.map(h => `"${row[h]}"`).join(',')
      );
      const csv = [headers.join(','), ...csvRows].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="executive_export.csv"');
      return res.send(csv);
    }

    res.json({
      export_date: new Date().toISOString(),
      tenant_count: exportData.length,
      data: exportData,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/executive/trends
 * Get trends over time (last 30 days)
 */
router.get('/trends', async (req, res, next) => {
  try {
    await ensureAppSchema();

    const trends = await query(
      `
        SELECT 
          DATE(created_at) AS date,
          COUNT(*) AS new_tenants
        FROM tenants
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `
    );

    const poTrends = await query(
      `
        SELECT 
          DATE(order_date) AS date,
          COUNT(*) AS pos_created,
          COALESCE(SUM(total_amount), 0) AS total_value
        FROM purchase_orders
        WHERE order_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP BY DATE(order_date)
        ORDER BY date ASC
      `
    );

    res.json({
      tenant_growth: trends,
      purchase_orders: poTrends,
      period: 'last_30_days',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
