const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');

// GET /api/drugs - List all drugs with optional filters
router.get('/', async (req, res) => {
  try {
    const { search, limit = 100, offset = 0 } = req.query;
    
    let sql = `
      SELECT 
        d.drugcode,
        d.drugname,
        d.drugnamethai,
        d.pack,
        d.unitsell,
        d.unitusage,
        d.cost,
        d.sell,
        d.drugtype,
        d.drugtypesub,
        d.lotno,
        d.dateexpire,
        d.tmtcode,
        d.druggenericname,
        COALESCE(r.remain, 0) as stock_qty,
        d.requisitionamount as min_stock,
        d.amountstartdrugstore as max_stock
      FROM cdrug d
      LEFT JOIN cdrugremain r ON d.drugcode = r.drugcode
      WHERE d.drugname IS NOT NULL AND d.unitsell IS NOT NULL
    `;
    
    const params = [];
    
    if (search) {
      sql += ` AND (d.drugname LIKE ? OR d.drugcode LIKE ? OR d.drugnamethai LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    sql += ` ORDER BY d.drugname LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));
    
    const drugs = await query(sql, params);
    
    // Get total count
    let countSql = `SELECT COUNT(*) as total FROM cdrug WHERE drugname IS NOT NULL AND unitsell IS NOT NULL`;
    if (search) {
      countSql += ` AND (drugname LIKE ? OR drugcode LIKE ? OR drugnamethai LIKE ?)`;
      const searchTerm = `%${search}%`;
      const [countResult] = await query(countSql, [searchTerm, searchTerm, searchTerm]);
      var total = countResult[0]?.total || 0;
    } else {
      const [countResult] = await query(countSql);
      var total = countResult[0]?.total || 0;
    }
    
    res.json({
      success: true,
      data: drugs,
      pagination: {
        total: total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Error fetching drugs:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// GET /api/drugs/:drugcode - Get drug by code
router.get('/:drugcode', async (req, res) => {
  try {
    const { drugcode } = req.params;
    
    const sql = `
      SELECT 
        d.*,
        COALESCE(r.remain, 0) as stock_qty
      FROM cdrug d
      LEFT JOIN cdrugremain r ON d.drugcode = r.drugcode
      WHERE d.drugcode = ?
    `;
    
    const drugs = await query(sql, [drugcode]);
    
    if (drugs.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Drug not found'
      });
    }
    
    res.json({
      success: true,
      data: drugs[0]
    });
  } catch (error) {
    console.error('Error fetching drug:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// GET /api/drugs/stock/low - Get drugs with low stock
router.get('/stock/low', async (req, res) => {
  try {
    const sql = `
      SELECT 
        d.drugcode,
        d.drugname,
        d.drugnamethai,
        d.unitsell,
        COALESCE(r.remain, 0) as stock_qty,
        d.requisitionamount as min_stock,
        (d.requisitionamount - COALESCE(r.remain, 0)) as shortage
      FROM cdrug d
      LEFT JOIN cdrugremain r ON d.drugcode = r.drugcode
      WHERE d.drugname IS NOT NULL AND d.unitsell IS NOT NULL
        AND COALESCE(r.remain, 0) < d.requisitionamount
        AND d.requisitionamount > 0
      ORDER BY shortage DESC
    `;
    
    const drugs = await query(sql);
    
    res.json({
      success: true,
      data: drugs,
      count: drugs.length
    });
  } catch (error) {
    console.error('Error fetching low stock drugs:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// GET /api/drugs/stock/summary - Get stock summary
router.get('/stock/summary', async (req, res) => {
  try {
    const sql = `
      SELECT 
        COUNT(*) as total_items,
        SUM(COALESCE(r.remain, 0)) as total_stock,
        SUM(CASE WHEN COALESCE(r.remain, 0) < d.requisitionamount AND d.requisitionamount > 0 THEN 1 ELSE 0 END) as low_stock_count,
        SUM(CASE WHEN COALESCE(r.remain, 0) = 0 THEN 1 ELSE 0 END) as out_of_stock_count,
        AVG(d.cost) as avg_cost,
        AVG(d.sell) as avg_sell
      FROM cdrug d
      LEFT JOIN cdrugremain r ON d.drugcode = r.drugcode
    `;
    
    const [summary] = await query(sql);
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error fetching stock summary:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// GET /api/drugs/expiring - Get drugs nearing expiration
router.get('/expiring', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const sql = `
      SELECT 
        d.drugcode,
        d.drugname,
        d.drugnamethai,
        d.lotno,
        d.dateexpire as expire_date,
        COALESCE(r.remain, 0) as stock_qty,
        DATEDIFF(d.dateexpire, NOW()) as days_until_expire
      FROM cdrug d
      LEFT JOIN cdrugremain r ON d.drugcode = r.drugcode
      WHERE d.drugname IS NOT NULL AND d.unitsell IS NOT NULL
        AND d.dateexpire IS NOT NULL 
        AND d.dateexpire <= DATE_ADD(NOW(), INTERVAL ? DAY)
      ORDER BY d.dateexpire ASC
    `;
    
    const drugs = await query(sql, [parseInt(days)]);
    
    res.json({
      success: true,
      data: drugs,
      count: drugs.length
    });
  } catch (error) {
    console.error('Error fetching expiring drugs:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
