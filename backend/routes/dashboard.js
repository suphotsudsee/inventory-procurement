const express = require('express');
const { query } = require('../db/pool');
const { ensureAppSchema } = require('../db/app');
const { lotBalanceJoin, currentStockExpr } = require('../utils/stock-balance');
const { unitJoin, unitNameExpr } = require('../utils/unit-name');

const router = express.Router();

router.get('/summary', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const tenantId = req.tenantId;
    const [inventory] = await query(`
      SELECT
        COUNT(*) AS total_products,
        SUM(CASE WHEN ${currentStockExpr} > 0 THEN 1 ELSE 0 END) AS products_in_stock,
        COALESCE(SUM(${currentStockExpr} * COALESCE(NULLIF(p.unit_cost, 0), p.cost_price, 0)), 0) AS total_stock_value,
        SUM(CASE WHEN ${currentStockExpr} <= COALESCE(sl.reorder_point, p.reorder_point, 0) THEN 1 ELSE 0 END) AS low_stock_count
      FROM products p
      LEFT JOIN stock_levels sl ON sl.product_id = p.id
      ${lotBalanceJoin}
      WHERE p.tenant_id = ? AND p.is_active = 1
    `, [tenantId]);
    const [suppliers] = await query('SELECT COUNT(*) AS total_suppliers FROM suppliers WHERE tenant_id = ? AND is_active = 1', [tenantId]);
    const [orders] = await query('SELECT COUNT(*) AS pending_approvals FROM purchase_orders WHERE tenant_id = ? AND status = "pending_approval"', [tenantId]);
    const [transactions] = await query('SELECT COUNT(*) AS recent_transactions FROM invp_stock_movements WHERE tenant_id = ? AND DATE(created_at) = CURDATE()', [tenantId]);
    const [expiry] = await query(`
      SELECT COUNT(*) AS expiring_soon
      FROM invp_stock_lots
      WHERE tenant_id = ? AND quantity > 0 AND expiry_date IS NOT NULL AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)
    `, [tenantId]);

    res.json({
      totalStockValue: Number(inventory.total_stock_value || 0),
      expiringSoon: Number(expiry.expiring_soon || 0),
      lowStockCount: Number(inventory.low_stock_count || 0),
      pendingApprovals: Number(orders.pending_approvals || 0),
      recentTransactions: Number(transactions.recent_transactions || 0),
      totalProducts: Number(inventory.total_products || 0),
      productsInStock: Number(inventory.products_in_stock || 0),
      totalSuppliers: Number(suppliers.total_suppliers || 0),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/expiry-alerts', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const tenantId = req.tenantId;
    const days = Number(req.query.days || 90);
    const rows = await query(
      `
        SELECT
          l.id,
          l.product_code,
          p.product_name,
          l.lot_number,
          l.expiry_date,
          l.quantity,
          ${unitNameExpr} AS unit,
          l.location,
          DATEDIFF(l.expiry_date, CURDATE()) AS days_until_expiry
        FROM invp_stock_lots l
        JOIN products p ON p.product_code = l.product_code AND p.tenant_id = l.tenant_id
        ${unitJoin}
        WHERE l.tenant_id = ? AND l.quantity > 0
          AND l.expiry_date IS NOT NULL
          AND l.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
        ORDER BY l.expiry_date ASC
        LIMIT 200
      `,
      [tenantId, days]
    );

    res.json(
      rows.map((row) => ({
        id: String(row.id),
        productId: row.product_code,
        productName: row.product_name,
        lotNumber: row.lot_number,
        expiryDate: row.expiry_date,
        quantity: Number(row.quantity || 0),
        unit: row.unit || '',
        status: Number(row.days_until_expiry) <= 30 ? 'critical' : Number(row.days_until_expiry) <= 60 ? 'warning' : 'normal',
        daysUntilExpiry: Number(row.days_until_expiry || 0),
        location: row.location || 'MAIN',
      }))
    );
  } catch (error) {
    next(error);
  }
});

router.get('/low-stock', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const tenantId = req.tenantId;
    const rows = await query(`
      SELECT
        p.product_code AS id,
        p.product_code AS code,
        p.product_name AS name,
        p.generic_name AS generic_name,
        COALESCE(c.category_name, 'ไม่ระบุหมวด') AS category,
        ${unitNameExpr} AS unit,
        ${currentStockExpr} AS current_stock,
        COALESCE(sl.min_level, p.min_stock_level, 0) AS min_level,
        COALESCE(sl.max_level, p.max_stock_level, 0) AS max_level,
        COALESCE(NULLIF(p.unit_cost, 0), p.cost_price, 0) AS unit_cost
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      ${unitJoin}
      LEFT JOIN stock_levels sl ON sl.product_id = p.id
      ${lotBalanceJoin}
      WHERE p.tenant_id = ? AND p.is_active = 1
        AND ${currentStockExpr} <= COALESCE(sl.reorder_point, p.reorder_point, 0)
      ORDER BY ${currentStockExpr} ASC
      LIMIT 100
    `, [tenantId]);

    res.json(
      rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        genericName: row.generic_name || '',
        category: row.category || 'ไม่ระบุหมวด',
        unit: row.unit || '',
        minLevel: Number(row.min_level || 0),
        maxLevel: Number(row.max_level || 0),
        currentStock: Number(row.current_stock || 0),
        reorderPoint: Number(row.min_level || 0),
        unitCost: Number(row.unit_cost || 0),
        barcode: row.code,
        createdAt: null,
        updatedAt: null,
      }))
    );
  } catch (error) {
    next(error);
  }
});

module.exports = router;
