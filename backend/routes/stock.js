const express = require('express');
const { pool, query } = require('../db/pool');
const { ensureAppSchema, getSupplierById, syncRemain } = require('../db/app');
const { lotBalanceJoin, currentStockExpr } = require('../utils/stock-balance');
const { unitJoin, unitNameExpr } = require('../utils/unit-name');
const { importDrugstoreReceiveDetailCsv } = require('../services/drugstorereceivedetail-import');
const { importDrugstoreReceiveBundle } = require('../services/drugstorereceive-bundle-import');

const router = express.Router();

function mapStockItem(row) {
  return {
    id: String(row.id),
    productId: row.product_code,
    productName: row.product_name,
    productCode: row.product_code,
    lotNumber: row.lot_number,
    expiryDate: row.expiry_date,
    quantity: Number(row.quantity || 0),
    unit: row.unit || '',
    location: row.location || 'MAIN',
    status: Number(row.quantity || 0) > 0 ? 'available' : 'damaged',
    receivedDate: row.received_date,
    unitCost: Number(row.unit_cost || 0),
  };
}

function mapStockItem(row) {
  return {
    id: String(row.id),
    productId: row.product_code,
    productName: row.product_name,
    productCode: row.product_code,
    lotNumber: row.lot_number,
    expiryDate: row.expiry_date,
    quantity: Number(row.quantity || 0),
    unit: row.unit || '',
    location: row.location || 'MAIN',
    status: Number(row.quantity || 0) > 0 ? 'available' : 'damaged',
    receivedDate: row.received_date,
    unitCost: Number(row.unit_cost || 0),
  };
}

router.get('/items', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const tenantId = req.tenantId;
    const params = [tenantId];
    let where = 'WHERE l.tenant_id = ? AND l.quantity > 0';
    if (req.query.productId) {
      where += ' AND l.product_code = ?';
      params.push(req.query.productId);
    }

    const rows = await query(
      `
        SELECT l.*, p.name, ${unitNameExpr} AS unit
        FROM invp_stock_lots l
        JOIN products p ON p.product_code = l.product_code AND p.tenant_id = l.tenant_id
        ${unitJoin}
        ${where}
        ORDER BY COALESCE(l.expiry_date, '9999-12-31') ASC, l.received_date ASC
      `,
      params
    );

    res.json(rows.map(mapStockItem));
  } catch (error) {
    next(error);
  }
});

router.get('/scan/:barcode', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const tenantId = req.tenantId;
    const rows = await query(
      `
        SELECT
          p.product_code AS id,
          p.product_code AS code,
          p.name AS name,
          p.generic_name AS generic_name,
          COALESCE(c.category_name, 'ไม่ระบุหมวด') AS category,
          ${unitNameExpr} AS unit,
          ${currentStockExpr} AS current_stock,
          COALESCE(sl.min_level, p.min_stock_level, 0) AS min_level,
          COALESCE(sl.max_level, p.max_stock_level, 0) AS max_level,
          COALESCE(NULLIF(p.unit_cost, 0), p.cost_price, 0) AS unit_cost,
          COALESCE(NULLIF(p.barcode, ''), p.product_code) AS barcode
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        ${unitJoin}
        LEFT JOIN stock_levels sl ON sl.product_id = p.id
        ${lotBalanceJoin}
        WHERE p.tenant_id = ? AND (p.product_code = ? OR p.barcode = ? OR p.tmt_code = ?)
        LIMIT 1
      `,
      [tenantId, req.params.barcode, req.params.barcode, req.params.barcode]
    );

    if (!rows[0]) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const stockItems = await query(
      `
        SELECT l.*, p.name, ${unitNameExpr} AS unit
        FROM invp_stock_lots l
        JOIN products p ON p.product_code = l.product_code AND p.tenant_id = l.tenant_id
        ${unitJoin}
        WHERE l.tenant_id = ? AND l.product_code = ? AND l.quantity > 0
        ORDER BY COALESCE(l.expiry_date, '9999-12-31') ASC
      `,
      [tenantId, rows[0].id]
    );

    res.json({
      id: rows[0].id,
      code: rows[0].code,
      name: rows[0].name,
      genericName: rows[0].generic_name || '',
      category: rows[0].category || 'ไม่ระบุหมวด',
      unit: rows[0].unit || '',
      minLevel: Number(rows[0].min_level || 0),
      maxLevel: Number(rows[0].max_level || 0),
      currentStock: Number(rows[0].current_stock || 0),
      reorderPoint: Number(rows[0].min_level || 0),
      unitCost: Number(rows[0].unit_cost || 0),
      barcode: rows[0].barcode || rows[0].code,
      createdAt: null,
      updatedAt: null,
      stockItems: stockItems.map(mapStockItem),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/goods-receipts', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const tenantId = req.tenantId;
    const receipts = await query(
      `SELECT * FROM invp_goods_receipts WHERE tenant_id = ? ORDER BY received_date DESC LIMIT 200`,
      [tenantId]
    );
    const items = await query(
      `
        SELECT gri.*, p.name
        FROM invp_goods_receipt_items gri
        JOIN products p ON p.product_code = gri.product_code AND p.tenant_id = gri.tenant_id
        WHERE gri.tenant_id = ?
        ORDER BY gri.id ASC
      `,
      [tenantId]
    );

    const itemsByReceipt = items.reduce((acc, item) => {
      const key = String(item.goods_receipt_id);
      acc[key] = acc[key] || [];
      acc[key].push({
        productId: item.product_code,
        productName: item.product_name,
        lotNumber: item.lot_number,
        expiryDate: item.expiry_date,
        quantity: Number(item.quantity || 0),
        unitCost: Number(item.unit_cost || 0),
        location: item.location || '',
      });
      return acc;
    }, {});

    res.json(
      receipts.map((receipt) => ({
        id: String(receipt.id),
        poNumber: '',
        supplierId: receipt.supplier_id || '',
        supplierName: receipt.supplier_name,
        receivedDate: receipt.received_date,
        receivedBy: receipt.received_by || 'admin',
        invoiceNumber: receipt.invoice_number || '',
        notes: receipt.notes || '',
        items: itemsByReceipt[String(receipt.id)] || [],
      }))
    );
  } catch (error) {
    next(error);
  }
});

router.post('/goods-receipt', async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await ensureAppSchema();
    const tenantId = req.tenantId;
    const { supplierId = '', invoiceNumber = '', notes = '', items = [] } = req.body;
    if (!items.length) {
      return res.status(400).json({ message: 'At least one item is required' });
    }

    const supplier = supplierId ? await getSupplierById(supplierId) : null;
    const supplierName = supplier?.name_th || supplier?.supplier_name || 'Unknown supplier';

    await connection.beginTransaction();

    const [[countRow]] = await connection.query(
      'SELECT COUNT(*) AS total FROM invp_goods_receipts WHERE tenant_id = ? AND DATE(received_date) = CURDATE()',
      [tenantId]
    );
    const receiptNumber = `GR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Number(countRow.total || 0) + 1).padStart(4, '0')}`;

    const [receiptResult] = await connection.execute(
      `
        INSERT INTO invp_goods_receipts (
          tenant_id, receipt_number, supplier_id, supplier_name, invoice_number, notes, received_by, received_date
        ) VALUES (?, ?, ?, ?, ?, ?, 'admin', NOW())
      `,
      [tenantId, receiptNumber, supplierId || null, supplierName, invoiceNumber, notes]
    );

    for (const item of items) {
      await connection.execute(
        `
          INSERT INTO invp_goods_receipt_items (
            tenant_id, goods_receipt_id, product_code, lot_number, expiry_date, quantity, unit_cost, location
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          tenantId,
          receiptResult.insertId,
          item.productId,
          item.lotNumber,
          item.expiryDate || null,
          item.quantity,
          item.unitCost,
          item.location || 'MAIN',
        ]
      );

      await connection.execute(
        `
          INSERT INTO invp_stock_lots (
            tenant_id, product_code, lot_number, expiry_date, quantity, unit_cost, location,
            source_type, source_ref, supplier_id, supplier_name, received_date
          ) VALUES (?, ?, ?, ?, ?, ?, 'goods_receipt', ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
            quantity = quantity + VALUES(quantity),
            unit_cost = VALUES(unit_cost),
            location = VALUES(location),
            supplier_id = VALUES(supplier_id),
            supplier_name = VALUES(supplier_name),
            updated_at = CURRENT_TIMESTAMP
        `,
        [
          tenantId,
          item.productId,
          item.lotNumber,
          item.expiryDate || null,
          item.quantity,
          item.unitCost,
          item.location || 'MAIN',
          receiptNumber,
          supplierId || null,
          supplierName,
        ]
      );

      await connection.execute(
        `
          INSERT INTO invp_stock_movements (
            tenant_id, movement_type, product_code, lot_number, quantity, reference, performed_by, notes
          ) VALUES ('receipt', ?, ?, ?, ?, 'admin', ?)
        `,
        [tenantId, item.productId, item.lotNumber, item.quantity, receiptNumber, notes]
      );

      await syncRemain(item.productId, Number(item.quantity || 0), connection);
    }

    await connection.commit();
    res.status(201).json({
      id: String(receiptResult.insertId),
      poNumber: '',
      supplierId,
      supplierName,
      receivedDate: new Date().toISOString(),
      receivedBy: 'admin',
      invoiceNumber,
      notes,
      items,
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

router.post('/import/drugstorereceivedetail', async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { content = '', fileName = 'drugstorereceivedetail.csv' } = req.body || {};

    if (!String(content || '').trim()) {
      return res.status(400).json({ message: 'CSV content is required' });
    }

    const summary = await importDrugstoreReceiveDetailCsv({
      tenantId,
      content,
      sourceRef: fileName,
    });

    res.status(201).json(summary);
  } catch (error) {
    next(error);
  }
});

router.post('/import/drugstorereceive-bundle', async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const {
      receiveContent = '',
      detailContent = '',
      receiveFileName = 'drugstorereceive.csv',
      detailFileName = 'drugstorereceivedetail.csv',
    } = req.body || {};

    if (!String(receiveContent || '').trim() || !String(detailContent || '').trim()) {
      return res.status(400).json({ message: 'Both receive and detail CSV contents are required' });
    }

    const summary = await importDrugstoreReceiveBundle({
      tenantId,
      receiveContent,
      detailContent,
      receiveFileName,
      detailFileName,
    });

    res.status(201).json(summary);
  } catch (error) {
    next(error);
  }
});

router.get('/adjustments', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const tenantId = req.tenantId;
    const rows = await query(
      `
        SELECT a.*, p.name
        FROM invp_stock_adjustments a
        JOIN products p ON p.product_code = a.product_code AND p.tenant_id = a.tenant_id
        WHERE a.tenant_id = ?
        ORDER BY a.created_at DESC
        LIMIT 200
      `,
      [tenantId]
    );

    res.json(
      rows.map((row) => ({
        id: String(row.id),
        productId: row.product_code,
        productName: row.product_name,
        lotNumber: row.lot_number,
        previousQty: Number(row.previous_qty || 0),
        newQty: Number(row.new_qty || 0),
        reason: row.reason,
        reasonDetail: row.reason_detail || '',
        adjustmentDate: row.created_at,
        adjustedBy: row.adjusted_by || 'admin',
        notes: row.notes || '',
      }))
    );
  } catch (error) {
    next(error);
  }
});

router.post('/adjustment', async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await ensureAppSchema();
    const tenantId = req.tenantId;
    const { productId, lotNumber, previousQty, newQty, reason, reasonDetail = '', notes = '' } = req.body;
    const delta = Number(newQty || 0) - Number(previousQty || 0);

    await connection.beginTransaction();
    await connection.execute(
      'UPDATE invp_stock_lots SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND product_code = ? AND lot_number = ?',
      [newQty, tenantId, productId, lotNumber]
    );
    await connection.execute(
      `
        INSERT INTO invp_stock_adjustments (
          tenant_id, product_code, lot_number, previous_qty, new_qty, reason, reason_detail, notes, adjusted_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'admin')
      `,
      [tenantId, productId, lotNumber, previousQty, newQty, reason, reasonDetail, notes]
    );
    await connection.execute(
      `
        INSERT INTO invp_stock_movements (
          tenant_id, movement_type, product_code, lot_number, quantity, reference, performed_by, notes
        ) VALUES ('adjustment', ?, ?, ?, 'manual-adjustment', 'admin', ?)
      `,
      [tenantId, productId, lotNumber, delta, notes || reasonDetail || reason]
    );
    await syncRemain(productId, delta, connection);
    await connection.commit();

    res.json(req.body);
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

router.post('/deduct', async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await ensureAppSchema();
    const tenantId = req.tenantId;
    const { productId, quantity, notes = '' } = req.body;
    const qty = Number(quantity || 0);
    if (!productId || qty <= 0) {
      return res.status(400).json({ message: 'Product and quantity are required' });
    }

    const lots = await query(
      `
        SELECT *
        FROM invp_stock_lots
        WHERE tenant_id = ? AND product_code = ? AND quantity > 0
        ORDER BY COALESCE(expiry_date, '9999-12-31') ASC, received_date ASC
      `,
      [tenantId, productId]
    );

    let remaining = qty;
    const usedLots = [];
    await connection.beginTransaction();
    for (const lot of lots) {
      if (remaining <= 0) {
        break;
      }
      const used = Math.min(Number(lot.quantity || 0), remaining);
      remaining -= used;
      usedLots.push({ lotNumber: lot.lot_number, quantity: used });
      await connection.execute('UPDATE invp_stock_lots SET quantity = quantity - ? WHERE tenant_id = ? AND id = ?', [used, tenantId, lot.id]);
      await connection.execute(
        `
          INSERT INTO invp_stock_movements (
            tenant_id, movement_type, product_code, lot_number, quantity, reference, performed_by, notes
          ) VALUES ('dispensing', ?, ?, ?, 'fefo-deduct', 'admin', ?)
        `,
        [tenantId, productId, lot.lot_number, -used, notes]
      );
    }

    if (remaining > 0) {
      throw new Error('Insufficient stock for FEFO deduction');
    }

    await syncRemain(productId, -qty, connection);
    await connection.commit();
    res.json({ success: true, usedLots });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

module.exports = router;
