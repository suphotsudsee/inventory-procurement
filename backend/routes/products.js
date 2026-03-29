const express = require('express');
const { pool, query } = require('../db/pool');
const { ensureAppSchema } = require('../db/app');
const { lotBalanceJoin, currentStockExpr } = require('../utils/stock-balance');
const { unitJoin, unitNameExpr } = require('../utils/unit-name');
const { scopeToTenant } = require('../middleware/tenant-isolation');

const router = express.Router();

function mapProduct(row) {
  return {
    id: row.code,
    code: row.code,
    name: row.name,
    genericName: row.generic_name || '',
    drugtypeCode: row.drugtype_code || '',
    drugtypeName: row.drugtype_name || 'ไม่ระบุประเภท',
    drugtype: row.drugtype_label || 'ไม่ระบุประเภท',
    category: row.category || 'ไม่ระบุหมวด',
    unit: row.unit || '',
    minLevel: Number(row.min_level || 0),
    maxLevel: Number(row.max_level || 0),
    currentStock: Number(row.current_stock || 0),
    reorderPoint: Number(row.reorder_point || 0),
    unitCost: Number(row.unit_cost || 0),
    supplierId: '',
    barcode: row.barcode || row.code,
    location: '',
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

const baseSelect = `
  SELECT
    p.product_code AS code,
    p.product_name AS name,
    p.generic_name AS generic_name,
    COALESCE(dt.drugtype_code, COALESCE(p.drugtype, '')) AS drugtype_code,
    COALESCE(dt.drugtype_name, 'ไม่ระบุประเภท') AS drugtype_name,
    CASE
      WHEN dt.drugtype_code IS NOT NULL THEN CONCAT(dt.drugtype_code, ' - ', dt.drugtype_name)
      WHEN COALESCE(p.drugtype, '') <> '' THEN p.drugtype
      ELSE 'ไม่ระบุประเภท'
    END AS drugtype_label,
    COALESCE(c.category_name, 'ไม่ระบุหมวด') AS category,
    ${unitNameExpr} AS unit,
    ${currentStockExpr} AS current_stock,
    COALESCE(sl.min_level, p.min_stock_level, 0) AS min_level,
    COALESCE(sl.max_level, p.max_stock_level, 0) AS max_level,
    COALESCE(sl.reorder_point, p.reorder_point, 0) AS reorder_point,
    COALESCE(NULLIF(p.unit_cost, 0), p.cost_price, 0) AS unit_cost,
    p.barcode,
    p.created_at,
    p.updated_at
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN drugtypes dt ON dt.drugtype_code = p.drugtype AND dt.is_active = 1
  ${unitJoin}
  LEFT JOIN stock_levels sl ON sl.product_id = p.id
  ${lotBalanceJoin}
  WHERE p.tenant_id = ?
`;

const baseFrom = `
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN drugtypes dt ON dt.drugtype_code = p.drugtype AND dt.is_active = 1
  ${unitJoin}
  LEFT JOIN stock_levels sl ON sl.product_id = p.id
  ${lotBalanceJoin}
  WHERE p.tenant_id = ?
`;

async function findCategoryId(categoryName) {
  if (!String(categoryName || '').trim()) {
    return null;
  }

  const rows = await query(
    'SELECT id FROM categories WHERE category_name = ? AND is_active = 1 LIMIT 1',
    [String(categoryName).trim()]
  );

  return rows[0] ? Number(rows[0].id) : null;
}

function normalizeProductPayload(body) {
  return {
    code: String(body.code || '').trim(),
    name: String(body.name || '').trim(),
    genericName: String(body.genericName || '').trim(),
    category: String(body.category || '').trim(),
    unit: String(body.unit || '').trim(),
    minLevel: Math.max(Number(body.minLevel) || 0, 0),
    maxLevel: Math.max(Number(body.maxLevel) || 0, 0),
    reorderPoint: Math.max(Number(body.reorderPoint) || 0, 0),
    unitCost: Math.max(Number(body.unitCost) || 0, 0),
    barcode: String(body.barcode || '').trim(),
  };
}

router.get('/', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const tenantId = req.tenantId;
    const { search = '', category = '', drugtype = '', lowStock = 'false', inStock = 'false', page, limit } = req.query;
    const params = [tenantId];
    let where = 'WHERE p.tenant_id = ? AND p.is_active = 1';

    if (search) {
      const term = `%${search}%`;
      where += ` AND (
        p.product_code LIKE ?
        OR p.product_name LIKE ?
        OR COALESCE(p.product_name_thai, '') LIKE ?
        OR COALESCE(p.generic_name, '') LIKE ?
        OR COALESCE(p.barcode, '') LIKE ?
      )`;
      params.push(term, term, term, term, term);
    }

    if (category) {
      where += ` AND COALESCE(c.category_name, 'ไม่ระบุหมวด') = ?`;
      params.push(category);
    }

    if (drugtype) {
      where += ` AND COALESCE(dt.drugtype_code, COALESCE(p.drugtype, '')) = ?`;
      params.push(drugtype);
    }

    if (String(lowStock) === 'true') {
      where += ` AND ${currentStockExpr} <= COALESCE(sl.reorder_point, p.reorder_point, 0)`;
    }

    if (String(inStock) === 'true') {
      where += ` AND ${currentStockExpr} > 0`;
    }

    const parsedPage = Math.max(Number(page) || 1, 1);
    const parsedLimit = Math.min(Math.max(Number(limit) || 0, 0), 200);
    const usePagination = parsedLimit > 0;

    if (!usePagination) {
      const rows = await query(`${baseSelect} ${where} ORDER BY p.product_name ASC`, params);
      return res.json(rows.map(mapProduct));
    }

    const offset = (parsedPage - 1) * parsedLimit;
    const [countRow] = await query(`SELECT COUNT(*) AS total ${baseFrom} ${where}`, params);
    const rows = await query(
      `${baseSelect} ${where} ORDER BY p.product_name ASC LIMIT ? OFFSET ?`,
      [...params, parsedLimit, offset]
    );

    res.json({
      items: rows.map(mapProduct),
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total: Number(countRow.total || 0),
        totalPages: Math.max(Math.ceil(Number(countRow.total || 0) / parsedLimit), 1),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/categories/list', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const tenantId = req.tenantId;
    const rows = await query(
      `SELECT DISTINCT category_name FROM products WHERE tenant_id = ? AND is_active = 1 ORDER BY category_name ASC`,
      [tenantId]
    );
    res.json(rows.map((row) => row.category_name));
  } catch (error) {
    next(error);
  }
});

router.get('/drugtypes/list', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const rows = await query(`
      SELECT drugtype_code AS code, drugtype_name AS name
      FROM drugtypes
      WHERE is_active = 1
      ORDER BY sort_order ASC, drugtype_code ASC
    `);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await ensureAppSchema();
    const tenantId = req.tenantId;
    const payload = normalizeProductPayload(req.body);

    if (!payload.code || !payload.name) {
      return res.status(400).json({ message: 'Product code and name are required' });
    }

    const categoryId = await findCategoryId(payload.category);
    if (payload.category && !categoryId) {
      return res.status(400).json({ message: 'Category not found' });
    }

    // Check for duplicate within tenant
    const existing = await query('SELECT id FROM products WHERE tenant_id = ? AND product_code = ? LIMIT 1', [tenantId, payload.code]);
    if (existing[0]) {
      return res.status(409).json({ message: 'Product code already exists' });
    }

    await connection.beginTransaction();

    const [insertResult] = await connection.execute(
      `
        INSERT INTO products (
          tenant_id, product_code, product_name, generic_name, category_id, unit_sell,
          min_stock_level, max_stock_level, reorder_point, cost_price, unit_cost,
          barcode, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `,
      [
        tenantId,
        payload.code,
        payload.name,
        payload.genericName || null,
        categoryId,
        payload.unit || null,
        payload.minLevel,
        payload.maxLevel,
        payload.reorderPoint,
        payload.unitCost,
        payload.unitCost,
        payload.barcode || null,
      ]
    );

    await connection.execute(
      `
        INSERT INTO stock_levels (
          product_id, quantity, min_level, max_level, reorder_point, last_counted_at
        ) VALUES (?, 0, ?, ?, ?, NOW())
      `,
      [insertResult.insertId, payload.minLevel, payload.maxLevel, payload.reorderPoint]
    );

    await connection.commit();

    const rows = await query(`${baseSelect} AND p.product_code = ?`, [tenantId, payload.code]);
    res.status(201).json(mapProduct(rows[0]));
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const tenantId = req.tenantId;
    const rows = await query(`${baseSelect} AND p.product_code = ?`, [tenantId, req.params.id]);
    if (!rows[0]) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(mapProduct(rows[0]));
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await ensureAppSchema();
    const tenantId = req.tenantId;
    const payload = normalizeProductPayload(req.body);

    // Check product exists within tenant
    const existingRows = await query('SELECT id, product_code FROM products WHERE tenant_id = ? AND product_code = ? LIMIT 1', [tenantId, req.params.id]);
    if (!existingRows[0]) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const categoryId = await findCategoryId(payload.category);
    if (payload.category && !categoryId) {
      return res.status(400).json({ message: 'Category not found' });
    }

    // Check for duplicate code within tenant
    if (payload.code && payload.code !== req.params.id) {
      const duplicate = await query('SELECT id FROM products WHERE tenant_id = ? AND product_code = ? LIMIT 1', [tenantId, payload.code]);
      if (duplicate[0]) {
        return res.status(409).json({ message: 'Product code already exists' });
      }
    }

    const finalCode = payload.code || req.params.id;

    await connection.beginTransaction();

    await connection.execute(
      `
        UPDATE products
        SET
          product_code = ?,
          product_name = ?,
          generic_name = ?,
          category_id = ?,
          unit_sell = ?,
          min_stock_level = ?,
          max_stock_level = ?,
          reorder_point = ?,
          cost_price = ?,
          unit_cost = ?,
          barcode = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = ? AND product_code = ?
      `,
      [
        finalCode,
        payload.name,
        payload.genericName || null,
        categoryId,
        payload.unit || null,
        payload.minLevel,
        payload.maxLevel,
        payload.reorderPoint,
        payload.unitCost,
        payload.unitCost,
        payload.barcode || null,
        tenantId,
        req.params.id,
      ]
    );

    await connection.execute(
      `
        UPDATE stock_levels
        SET
          min_level = ?,
          max_level = ?,
          reorder_point = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE product_id = ?
      `,
      [payload.minLevel, payload.maxLevel, payload.reorderPoint, existingRows[0].id]
    );

    if (finalCode !== req.params.id) {
      await connection.execute('UPDATE invp_stock_lots SET product_code = ? WHERE tenant_id = ? AND product_code = ?', [finalCode, tenantId, req.params.id]);
      await connection.execute('UPDATE invp_stock_movements SET product_code = ? WHERE tenant_id = ? AND product_code = ?', [finalCode, tenantId, req.params.id]);
      await connection.execute('UPDATE invp_goods_receipt_items SET product_code = ? WHERE tenant_id = ? AND product_code = ?', [finalCode, tenantId, req.params.id]);
      await connection.execute('UPDATE invp_stock_adjustments SET product_code = ? WHERE tenant_id = ? AND product_code = ?', [finalCode, tenantId, req.params.id]);
      await connection.execute('UPDATE purchase_order_items SET product_code = ? WHERE tenant_id = ? AND product_code = ?', [finalCode, tenantId, req.params.id]);
    }

    await connection.commit();

    const rows = await query(`${baseSelect} AND p.product_code = ?`, [tenantId, finalCode]);
    res.json(mapProduct(rows[0]));
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
    const tenantId = req.tenantId;
    const existingRows = await query('SELECT id FROM products WHERE tenant_id = ? AND product_code = ? LIMIT 1', [tenantId, req.params.id]);
    if (!existingRows[0]) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await query('UPDATE products SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND product_code = ?', [tenantId, req.params.id]);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
