const express = require('express');
const { query } = require('../db/pool');
const { ensureAppSchema } = require('../db/app');
const { lotBalanceJoin, currentStockExpr } = require('../utils/stock-balance');
const { unitJoin, unitNameExpr } = require('../utils/unit-name');

const router = express.Router();

function sendCsv(res, filename, headers, rows) {
  const content = [
    headers.join(','),
    ...rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(content);
}

router.get('/inventory-valuation', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const rows = await query(`
      SELECT
        COALESCE(c.category_name, 'ไม่ระบุหมวด') AS category,
        COUNT(*) AS item_count,
        COALESCE(SUM(${currentStockExpr}), 0) AS total_quantity,
        COALESCE(SUM(${currentStockExpr} * COALESCE(NULLIF(p.unit_cost, 0), p.cost_price, 0)), 0) AS total_value
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN stock_levels sl ON sl.product_id = p.id
      ${lotBalanceJoin}
      WHERE p.is_active = 1
      GROUP BY COALESCE(c.category_name, 'ไม่ระบุหมวด')
      ORDER BY total_value DESC
    `);
    const grandTotal = rows.reduce((sum, row) => sum + Number(row.total_value || 0), 0);

    res.json(
      rows.map((row) => ({
        category: row.category,
        itemCount: Number(row.item_count || 0),
        totalQuantity: Number(row.total_quantity || 0),
        totalValue: Number(row.total_value || 0),
        percentage: grandTotal > 0 ? (Number(row.total_value || 0) / grandTotal) * 100 : 0,
      }))
    );
  } catch (error) {
    next(error);
  }
});

router.get('/inventory-valuation/export', async (req, res, next) => {
  try {
    const rows = await query(`
      SELECT
        COALESCE(c.category_name, 'ไม่ระบุหมวด') AS category,
        COUNT(*) AS item_count,
        COALESCE(SUM(${currentStockExpr}), 0) AS total_quantity,
        COALESCE(SUM(${currentStockExpr} * COALESCE(NULLIF(p.unit_cost, 0), p.cost_price, 0)), 0) AS total_value
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN stock_levels sl ON sl.product_id = p.id
      ${lotBalanceJoin}
      WHERE p.is_active = 1
      GROUP BY COALESCE(c.category_name, 'ไม่ระบุหมวด')
      ORDER BY total_value DESC
    `);
    sendCsv(
      res,
      'inventory-valuation.csv',
      ['Category', 'Item Count', 'Total Quantity', 'Total Value'],
      rows.map((row) => [row.category, row.item_count, row.total_quantity, row.total_value])
    );
  } catch (error) {
    next(error);
  }
});

router.get('/stock-movements', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const { startDate, endDate } = req.query;
    const params = [];
    let where = 'WHERE 1=1';
    if (startDate) {
      where += ' AND DATE(m.created_at) >= ?';
      params.push(startDate);
    }
    if (endDate) {
      where += ' AND DATE(m.created_at) <= ?';
      params.push(endDate);
    }

    const rows = await query(
      `
        SELECT m.*, p.product_name, ${unitNameExpr} AS unit
        FROM invp_stock_movements m
        JOIN products p ON p.product_code = m.product_code
        ${unitJoin}
        ${where}
        ORDER BY m.created_at DESC
        LIMIT 500
      `,
      params
    );

    res.json(
      rows.map((row) => ({
        id: String(row.id),
        date: row.created_at,
        productId: row.product_code,
        productName: row.product_name,
        lotNumber: row.lot_number || '',
        movementType: row.movement_type,
        quantity: Number(row.quantity || 0),
        unit: row.unit || '',
        reference: row.reference || '',
        performedBy: row.performed_by || 'admin',
        notes: row.notes || '',
      }))
    );
  } catch (error) {
    next(error);
  }
});

router.get('/stock-movements/export', async (req, res, next) => {
  try {
    const rows = await query(`
      SELECT created_at, movement_type, product_code, lot_number, quantity, reference, performed_by, notes
      FROM invp_stock_movements
      ORDER BY created_at DESC
      LIMIT 500
    `);
    sendCsv(
      res,
      'stock-movements.csv',
      ['Date', 'Type', 'Product Code', 'Lot Number', 'Quantity', 'Reference', 'Performed By', 'Notes'],
      rows.map((row) => [row.created_at, row.movement_type, row.product_code, row.lot_number, row.quantity, row.reference, row.performed_by, row.notes])
    );
  } catch (error) {
    next(error);
  }
});

router.get('/expiry', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const rows = await query(`
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
      JOIN products p ON p.product_code = l.product_code
      ${unitJoin}
      WHERE l.quantity > 0 AND l.expiry_date IS NOT NULL
      ORDER BY l.expiry_date ASC
      LIMIT 500
    `);

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

router.get('/supplier-performance', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const rows = await query(`
      SELECT
        s.id AS supplier_id,
        s.name_th AS supplier_name,
        COUNT(po.id) AS total_orders,
        COALESCE(SUM(CASE WHEN po.status IN ('approved', 'sent', 'partially_received', 'completed') THEN 1 ELSE 0 END), 0) AS on_time_delivery,
        COALESCE(AVG(s.rating), 0) AS quality_score,
        COALESCE(AVG(DATEDIFF(po.expected_delivery_date, po.order_date)), 0) AS avg_lead_time,
        COALESCE(SUM(po.total_amount), 0) AS total_spend,
        MAX(po.order_date) AS last_order_date,
        COALESCE(SUM(CASE WHEN po.status = 'cancelled' THEN 1 ELSE 0 END), 0) AS issues
      FROM suppliers s
      LEFT JOIN purchase_orders po ON po.supplier_id = s.id
      GROUP BY s.id, s.name_th, s.rating
      ORDER BY total_spend DESC, s.name_th ASC
    `);

    res.json(
      rows.map((row) => ({
        supplierId: String(row.supplier_id),
        supplierName: row.supplier_name,
        totalOrders: Number(row.total_orders || 0),
        onTimeDelivery: Number(row.on_time_delivery || 0),
        qualityScore: Number(row.quality_score || 0),
        avgLeadTime: Number(row.avg_lead_time || 0),
        totalSpend: Number(row.total_spend || 0),
        lastOrderDate: row.last_order_date || null,
        issues: Number(row.issues || 0),
      }))
    );
  } catch (error) {
    next(error);
  }
});

module.exports = router;
