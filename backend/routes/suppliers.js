const express = require('express');
const { query } = require('../db/pool');
const { ensureAppSchema } = require('../db/app');

const router = express.Router();

function mapSupplier(row) {
  return {
    id: String(row.id),
    code: row.supplier_code,
    name: row.name_th,
    contactPerson: row.contact_person || '',
    email: row.email || '',
    phone: row.phone || '',
    address: row.address || '',
    taxId: row.tax_id || '',
    paymentTerms: row.payment_terms || '',
    rating: Number(row.rating || 0),
    active: Boolean(row.is_active),
    createdAt: row.created_at,
  };
}

router.get('/', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const tenantId = req.tenantId;
    const rows = await query('SELECT * FROM suppliers WHERE tenant_id = ? ORDER BY is_active DESC, name_th ASC', [tenantId]);
    res.json(rows.map(mapSupplier));
  } catch (error) {
    next(error);
  }
});

router.get('/performance', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const tenantId = req.tenantId;
    const { supplierId } = req.query;
    const params = [tenantId];
    let where = 'WHERE s.tenant_id = ?';

    if (supplierId) {
      where += ' AND s.id = ?';
      params.push(supplierId);
    }

    const rows = await query(
      `
        SELECT
          s.id AS supplier_id,
          s.name_th AS supplier_name,
          COUNT(DISTINCT po.id) AS total_orders,
          COALESCE(SUM(CASE WHEN po.status IN ('approved', 'sent', 'partially_received', 'completed') THEN 1 ELSE 0 END), 0) AS on_time_delivery,
          COALESCE(AVG(s.rating), 0) AS quality_score,
          COALESCE(AVG(DATEDIFF(po.expected_delivery_date, po.order_date)), 0) AS avg_lead_time,
          COALESCE(SUM(po.total_amount), 0) AS total_spend,
          MAX(po.order_date) AS last_order_date,
          COALESCE(SUM(CASE WHEN po.status = 'cancelled' THEN 1 ELSE 0 END), 0) AS issues
        FROM suppliers s
        LEFT JOIN purchase_orders po ON po.supplier_id = s.id AND po.tenant_id = s.tenant_id
        ${where}
        GROUP BY s.id, s.name_th, s.rating
        ORDER BY total_spend DESC, s.name_th ASC
      `,
      params
    );

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

router.get('/:id', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const tenantId = req.tenantId;
    const rows = await query('SELECT * FROM suppliers WHERE tenant_id = ? AND id = ?', [tenantId, req.params.id]);
    if (!rows[0]) {
      return res.status(404).json({ message: 'Supplier not found' });
    }
    res.json(mapSupplier(rows[0]));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const tenantId = req.tenantId;
    const {
      name,
      contactPerson = '',
      email = '',
      phone = '',
      address = '',
      taxId = '',
      paymentTerms = 'NET30',
      rating = 5,
      active = true,
    } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Supplier name is required' });
    }

    const [{ total }] = await query('SELECT COUNT(*) AS total FROM suppliers');
    const code = `SUP-${String(Number(total || 0) + 1).padStart(4, '0')}`;

    const result = await query(
      `
        INSERT INTO suppliers (
          supplier_code, name_th, contact_person, email, phone, address, tax_id, payment_terms, rating, is_active, supplier_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [code, name, contactPerson, email, phone, address, taxId, paymentTerms, rating, active ? 1 : 0, name]
    );

    const rows = await query('SELECT * FROM suppliers WHERE id = ?', [result.insertId]);
    res.status(201).json(mapSupplier(rows[0]));
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    await ensureAppSchema();
    const fields = [
      ['name', 'name_th'],
      ['contactPerson', 'contact_person'],
      ['email', 'email'],
      ['phone', 'phone'],
      ['address', 'address'],
      ['taxId', 'tax_id'],
      ['paymentTerms', 'payment_terms'],
      ['rating', 'rating'],
      ['active', 'is_active'],
    ];

    const updates = [];
    const params = [];
    fields.forEach(([input, column]) => {
      if (req.body[input] !== undefined) {
        updates.push(`${column} = ?`);
        params.push(input === 'active' ? (req.body[input] ? 1 : 0) : req.body[input]);
      }
    });

    if (req.body.name !== undefined) {
      updates.push('supplier_name = ?');
      params.push(req.body.name);
    }

    if (!updates.length) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    params.push(req.params.id);
    await query(`UPDATE suppliers SET ${updates.join(', ')} WHERE id = ?`, params);
    const rows = await query('SELECT * FROM suppliers WHERE id = ?', [req.params.id]);
    if (!rows[0]) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    res.json(mapSupplier(rows[0]));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
