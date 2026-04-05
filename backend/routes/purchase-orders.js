const express = require('express');
const { query } = require('../db/pool');
const { ensureAppSchema, getSupplierById } = require('../db/app');
const { lotBalanceJoin, currentStockExpr } = require('../utils/stock-balance');
const { unitJoin, unitNameExpr } = require('../utils/unit-name');

const router = express.Router();
const DEFAULT_USER_ID = 1;

function mapStatus(status) {
  switch (status) {
    case 'sent':
      return 'ordered';
    case 'partially_received':
      return 'partial';
    case 'completed':
      return 'received';
    default:
      return status;
  }
}

async function loadOrders(where = '', params = [], tenantId) {
  const normalizedWhere = String(where || '').trim().replace(/^AND\s+/i, '');
  const orders = await query(
    `
      SELECT
        po.*,
        s.name_th AS supplier_name
      FROM purchase_orders po
      JOIN suppliers s ON s.id = po.supplier_id
      WHERE po.tenant_id = ?
      ${normalizedWhere ? 'AND ' + normalizedWhere : ''}
      ORDER BY po.created_at DESC
    `,
    [tenantId, ...params]
  );

  if (!orders.length) {
    return [];
  }

  const items = await query(
    `
      SELECT
        poi.*,
        p.product_code,
        p.name,
        ${unitNameExpr} AS unit
      FROM purchase_order_items poi
      JOIN products p ON p.id = poi.product_id AND p.tenant_id = poi.tenant_id
      ${unitJoin}
      WHERE poi.tenant_id = ? AND poi.po_id IN (${orders.map(() => '?').join(',')})
      ORDER BY poi.id ASC
    `,
    [tenantId, ...orders.map((order) => order.id)]
  );

  const itemsByOrder = items.reduce((acc, item) => {
    const key = String(item.po_id);
    acc[key] = acc[key] || [];
    acc[key].push({
      productId: item.product_code,
      productName: item.product_name,
      quantity: Number(item.quantity_ordered || 0),
      unit: item.unit || '',
      unitPrice: Number(item.unit_price || 0),
      totalPrice: Number(item.total_price || 0),
      notes: '',
    });
    return acc;
  }, {});

  return orders.map((order) => ({
    id: String(order.id),
    poNumber: order.po_number,
    supplierId: String(order.supplier_id),
    supplierName: order.supplier_name,
    orderDate: order.order_date,
    expectedDate: order.expected_delivery_date,
    status: mapStatus(order.status),
    items: itemsByOrder[String(order.id)] || [],
    totalAmount: Number(order.total_amount || 0),
    notes: order.notes || '',
    approvedBy: order.approved_by ? String(order.approved_by) : '',
    approvedDate: order.approved_at,
    createdAt: order.created_at,
  }));
}

async function createOrder({ tenantId, supplierId = '', expectedDate, items = [], notes = '' }) {
  const supplier = supplierId ? await getSupplierById(supplierId) : null;
  if (!supplier) {
    throw new Error('Supplier not found');
  }

  const [{ total }] = await query('SELECT COUNT(*) AS total FROM purchase_orders WHERE tenant_id = ? AND DATE(created_at) = CURDATE()', [tenantId]);
  const poNumber = `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Number(total || 0) + 1).padStart(4, '0')}`;
  const totalAmount = items.reduce((sum, item) => sum + Number(item.totalPrice || item.quantity * item.unitPrice || 0), 0);

  const result = await query(
    `
      INSERT INTO purchase_orders (
        tenant_id, po_number, supplier_id, order_date, expected_delivery_date, status, total_amount, notes, created_by
      ) VALUES (?, ?, ?, CURDATE(), ?, 'pending_approval', ?, ?, ?)
    `,
    [tenantId, poNumber, Number(supplierId), expectedDate, totalAmount, notes, DEFAULT_USER_ID]
  );

  for (const item of items) {
    const [product] = await query(
      `
        SELECT id, product_code
        FROM products
        WHERE tenant_id = ? AND (product_code = ? OR id = ?)
        LIMIT 1
      `,
      [tenantId, item.productId, Number(item.productId) || 0]
    );
    if (!product) {
      throw new Error(`Product not found: ${item.productId}`);
    }

    await query(
      `
        INSERT INTO purchase_order_items (
          tenant_id, po_id, product_id, product_code, quantity_ordered, quantity_received, unit_price, total_price
        ) VALUES (?, ?, ?, ?, ?, 0, ?, ?)
      `,
      [
        tenantId,
        result.insertId,
        product.id,
        product.product_code,
        item.quantity,
        item.unitPrice,
        item.totalPrice || item.quantity * item.unitPrice,
      ]
    );
  }

  await query(
    `
      INSERT INTO po_approvals (po_id, approver_id, approval_level, status)
      VALUES (?, ?, 1, 'pending')
    `,
    [result.insertId, DEFAULT_USER_ID]
  );

  const orders = await loadOrders('po.id = ?', [result.insertId], tenantId);
  return orders[0];
}

router.get('/', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const tenantId = req.tenantId;
    const { status, supplierId } = req.query;
    const conditions = [];
    const params = [];

    if (status) {
      const dbStatus =
        status === 'ordered' ? 'sent' :
        status === 'partial' ? 'partially_received' :
        status === 'received' ? 'completed' :
        status;
      conditions.push('po.status = ?');
      params.push(dbStatus);
    }

    if (supplierId) {
      conditions.push('po.supplier_id = ?');
      params.push(supplierId);
    }

    const where = conditions.length ? conditions.join(' AND ') : '';
    res.json(await loadOrders(where, params, tenantId));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const tenantId = req.tenantId;
    const orders = await loadOrders('po.id = ?', [req.params.id], tenantId);
    if (!orders[0]) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }
    res.json(orders[0]);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const tenantId = req.tenantId;
    const { supplierId = '', expectedDate, items = [], notes = '' } = req.body;
    if (!expectedDate || !items.length) {
      return res.status(400).json({ message: 'Expected date and items are required' });
    }

    res.status(201).json(await createOrder({ tenantId, supplierId, expectedDate, items, notes }));
  } catch (error) {
    next(error);
  }
});

router.post('/from-low-stock', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const tenantId = req.tenantId;
    const suppliers = await query('SELECT * FROM suppliers WHERE tenant_id = ? AND is_active = 1 ORDER BY name_th ASC LIMIT 1', [tenantId]);
    const lowStockProducts = await query(`
      SELECT
        p.product_code,
        p.name,
        ${unitNameExpr} AS unit,
        COALESCE(NULLIF(p.unit_cost, 0), p.cost_price, 0) AS unit_cost,
        ${currentStockExpr} AS current_stock,
        COALESCE(sl.max_level, p.max_stock_level, 0) AS max_level,
        COALESCE(sl.reorder_point, p.reorder_point, 0) AS reorder_point
      FROM products p
      ${unitJoin}
      LEFT JOIN stock_levels sl ON sl.product_id = p.id
      ${lotBalanceJoin}
      WHERE p.tenant_id = ? AND p.is_active = 1
        AND ${currentStockExpr} <= COALESCE(sl.reorder_point, p.reorder_point, 0)
      ORDER BY ${currentStockExpr} ASC
      LIMIT 20
    `, [tenantId]);

    if (!lowStockProducts.length) {
      return res.status(400).json({ message: 'No low stock products found' });
    }

    const supplier = suppliers[0];
    if (!supplier) {
      return res.status(400).json({ message: 'No supplier found' });
    }

    const expectedDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const order = await createOrder({
      tenantId,
      supplierId: String(supplier.id),
      expectedDate,
      notes: 'Generated from low stock items',
      items: lowStockProducts.map((product) => {
        const quantity = Math.max(
          Number(product.max_level || 0) - Number(product.current_stock || 0),
          Number(product.reorder_point || 1)
        );
        return {
          productId: product.product_code,
          productName: product.product_name,
          quantity,
          unit: product.unit || '',
          unitPrice: Number(product.unit_cost || 0),
          totalPrice: quantity * Number(product.unit_cost || 0),
        };
      }),
    });

    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const tenantId = req.tenantId;
    const updates = [];
    const params = [];

    if (req.body.expectedDate !== undefined) {
      updates.push('expected_delivery_date = ?');
      params.push(req.body.expectedDate);
    }
    if (req.body.status !== undefined) {
      const dbStatus =
        req.body.status === 'ordered' ? 'sent' :
        req.body.status === 'partial' ? 'partially_received' :
        req.body.status === 'received' ? 'completed' :
        req.body.status;
      updates.push('status = ?');
      params.push(dbStatus);
    }
    if (req.body.notes !== undefined) {
      updates.push('notes = ?');
      params.push(req.body.notes);
    }

    if (!updates.length) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    params.push(req.params.id, tenantId);
    await query(`UPDATE purchase_orders SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, params);
    const orders = await loadOrders('po.id = ?', [req.params.id], tenantId);
    if (!orders[0]) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }
    res.json(orders[0]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
