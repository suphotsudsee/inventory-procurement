const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');

// GET /api/inventory/receive - List drug receiving records
router.get('/receive', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const sql = `
      SELECT 
        r.id,
        r.receive_date,
        r.receive_no,
        r.supplier,
        r.total_amount,
        r.status,
        r.created_at,
        d.drugcode,
        d.drugname,
        rd.qty,
        rd.unit_price,
        rd.line_total,
        rd.lot_no,
        rd.expire_date
      FROM drugstorereceive r
      LEFT JOIN drugstorereceivedetail rd ON r.id = rd.receive_id
      LEFT JOIN cdrug d ON rd.drug_id = d.id
      ORDER BY r.receive_date DESC
      LIMIT ? OFFSET ?
    `;
    
    const records = await query(sql, [parseInt(limit), parseInt(offset)]);
    
    res.json({
      success: true,
      data: records
    });
  } catch (error) {
    console.error('Error fetching receive records:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// GET /api/inventory/stock/current - Current stock levels
router.get('/stock/current', async (req, res) => {
  try {
    const sql = `
      SELECT 
        d.id,
        d.drugcode,
        d.drugname,
        d.drugname_en,
        d.drugunit,
        d.packsize,
        COALESCE(r.stock_qty, 0) as current_stock,
        d.min_stock,
        d.max_stock,
        CASE 
          WHEN COALESCE(r.stock_qty, 0) = 0 THEN 'out_of_stock'
          WHEN COALESCE(r.stock_qty, 0) < d.min_stock THEN 'low_stock'
          WHEN COALESCE(r.stock_qty, 0) > d.max_stock THEN 'over_stock'
          ELSE 'normal'
        END as stock_status,
        d.price,
        d.expire_date,
        d.lot_no
      FROM cdrug d
      LEFT JOIN cdrugremain r ON d.id = r.drug_id
      ORDER BY d.drugname
    `;
    
    const stock = await query(sql);
    
    // Calculate summary
    const summary = {
      total_items: stock.length,
      out_of_stock: stock.filter(s => s.stock_status === 'out_of_stock').length,
      low_stock: stock.filter(s => s.stock_status === 'low_stock').length,
      normal: stock.filter(s => s.stock_status === 'normal').length,
      over_stock: stock.filter(s => s.stock_status === 'over_stock').length
    };
    
    res.json({
      success: true,
      data: stock,
      summary
    });
  } catch (error) {
    console.error('Error fetching current stock:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// GET /api/inventory/movements - Drug movement history
router.get('/movements', async (req, res) => {
  try {
    const { drug_id, limit = 100 } = req.query;
    
    let sql = `
      SELECT 
        'receive' as movement_type,
        r.receive_date as date,
        r.receive_no as reference_no,
        d.drugname,
        rd.qty as qty_in,
        0 as qty_out,
        rd.lot_no,
        rd.expire_date,
        r.supplier as source
      FROM drugstorereceivedetail rd
      JOIN drugstorereceive r ON rd.receive_id = r.id
      JOIN cdrug d ON rd.drug_id = d.id
    `;
    
    const params = [];
    
    if (drug_id) {
      sql += ` WHERE rd.drug_id = ?`;
      params.push(drug_id);
    }
    
    sql += ` UNION ALL
    
      SELECT 
        'dispense' as movement_type,
        v.visit_date as date,
        v.id as reference_no,
        d.drugname,
        0 as qty_in,
        vd.qty as qty_out,
        vd.lot_no,
        NULL as expire_date,
        p.person_name as source
      FROM visitdrug vd
      JOIN visit v ON vd.visit_id = v.id
      JOIN cdrug d ON vd.drug_id = d.id
      JOIN person p ON v.person_id = p.id
    `;
    
    if (drug_id) {
      sql += ` WHERE vd.drug_id = ?`;
      params.push(drug_id);
    }
    
    sql += ` ORDER BY date DESC LIMIT ?`;
    params.push(parseInt(limit));
    
    const movements = await query(sql, params);
    
    res.json({
      success: true,
      data: movements
    });
  } catch (error) {
    console.error('Error fetching movements:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// POST /api/inventory/receive - Record new drug receipt
router.post('/receive', async (req, res) => {
  try {
    const { receive_no, receive_date, supplier, items } = req.body;
    
    if (!receive_no || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: receive_no, items'
      });
    }
    
    // Start transaction (would need connection.beginTransaction for full implementation)
    // For now, simplified insert
    
    const insertReceiveSql = `
      INSERT INTO drugstorereceive (receive_no, receive_date, supplier, status, created_at)
      VALUES (?, ?, ?, 'completed', NOW())
    `;
    
    const result = await query(insertReceiveSql, [receive_no, receive_date, supplier]);
    const receiveId = result.insertId;
    
    // Insert details
    const insertDetailSql = `
      INSERT INTO drugstorereceivedetail (receive_id, drug_id, qty, unit_price, line_total, lot_no, expire_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    for (const item of items) {
      await query(insertDetailSql, [
        receiveId,
        item.drug_id,
        item.qty,
        item.unit_price,
        item.qty * item.unit_price,
        item.lot_no,
        item.expire_date
      ]);
    }
    
    res.json({
      success: true,
      message: 'Drug receipt recorded successfully',
      receive_id: receiveId
    });
  } catch (error) {
    console.error('Error recording receipt:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
