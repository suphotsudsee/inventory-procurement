const express = require('express');
const { query } = require('../db/pool');
const { ensureAppSchema } = require('../db/app');

const router = express.Router();
const DEFAULT_APPROVER_ID = 1;

router.get('/pending', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const rows = await query(`
      SELECT
        po.id,
        po.po_number,
        s.name_th AS supplier_name,
        po.created_by,
        po.created_at,
        po.total_amount,
        COUNT(poi.id) AS item_count,
        pa.status AS approval_status
      FROM purchase_orders po
      JOIN suppliers s ON s.id = po.supplier_id
      LEFT JOIN purchase_order_items poi ON poi.po_id = po.id
      LEFT JOIN po_approvals pa ON pa.po_id = po.id
      WHERE po.status = 'pending_approval'
        AND COALESCE(pa.status, 'pending') = 'pending'
      GROUP BY po.id, po.po_number, s.name_th, po.created_by, po.created_at, po.total_amount, pa.status
      ORDER BY po.created_at ASC
    `);

    res.json(
      rows.map((row) => ({
        id: String(row.id),
        poId: String(row.id),
        poNumber: row.po_number,
        requestedBy: row.created_by ? String(row.created_by) : '1',
        requestedDate: row.created_at,
        status: 'pending',
        totalAmount: Number(row.total_amount || 0),
        itemCount: Number(row.item_count || 0),
        supplierName: row.supplier_name,
      }))
    );
  } catch (error) {
    next(error);
  }
});

router.post('/approve/:id', async (req, res, next) => {
  try {
    await ensureAppSchema();
    await query(
      `
        UPDATE purchase_orders
        SET status = 'approved',
            approved_by = ?,
            approved_at = NOW()
        WHERE id = ?
      `,
      [DEFAULT_APPROVER_ID, req.params.id]
    );

    await query(
      `
        UPDATE po_approvals
        SET status = 'approved',
            approved_at = NOW(),
            comments = COALESCE(comments, '')
        WHERE po_id = ?
      `,
      [req.params.id]
    );

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post('/reject/:id', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const reason = req.body.reason || 'No reason provided';

    await query(
      `
        UPDATE purchase_orders
        SET status = 'cancelled',
            notes = CONCAT('[Rejected] ', ?, '\n', COALESCE(notes, ''))
        WHERE id = ?
      `,
      [reason, req.params.id]
    );

    await query(
      `
        UPDATE po_approvals
        SET status = 'rejected',
            approved_at = NOW(),
            comments = ?
        WHERE po_id = ?
      `,
      [reason, req.params.id]
    );

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
