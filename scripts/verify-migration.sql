-- Verification Queries for Data Migration
-- Run after all migration scripts are complete

-- =====================================================
-- 1. COUNT COMPARISON
-- =====================================================

-- Source counts
SELECT 'Source: Drugs (cdrug)' AS description, COUNT(*) AS count FROM jhcisdb.cdrug
UNION ALL
SELECT 'Source: Unique Suppliers', COUNT(DISTINCT companyname) FROM jhcisdb.drugstorereceive WHERE companyname IS NOT NULL AND companyname != ''
UNION ALL
SELECT 'Source: Stock Records (cdrugremain)', COUNT(*) FROM jhcisdb.cdrugremain;

-- Target counts
SELECT 'Target: Products' AS description, COUNT(*) AS count FROM products
UNION ALL
SELECT 'Target: Categories', COUNT(*) FROM categories
UNION ALL
SELECT 'Target: Suppliers', COUNT(*) FROM suppliers
UNION ALL
SELECT 'Target: Stock Levels', COUNT(*) FROM stock_levels
UNION ALL
SELECT 'Target: Stock Movements', COUNT(*) FROM stock_movements WHERE movement_type = 'initial';

-- =====================================================
-- 2. DATA QUALITY CHECKS
-- =====================================================

-- Check for NULL product codes
SELECT 'Products with NULL code' AS issue, COUNT(*) AS count FROM products WHERE product_code IS NULL OR product_code = '';

-- Check for NULL product names
SELECT 'Products with NULL name' AS issue, COUNT(*) AS count FROM products WHERE product_name IS NULL OR product_name = '';

-- Check for duplicate product codes
SELECT 'Duplicate product codes' AS issue, COUNT(*) AS count FROM (
    SELECT product_code FROM products GROUP BY product_code HAVING COUNT(*) > 1
) AS duplicates;

-- Check for products without category
SELECT 'Products without category' AS issue, COUNT(*) AS count FROM products WHERE category_id IS NULL;

-- Check for negative stock
SELECT 'Negative stock levels' AS issue, COUNT(*) AS count FROM stock_levels WHERE quantity < 0;

-- Check for orphan stock (no product reference)
SELECT 'Orphan stock records' AS issue, COUNT(*) AS count FROM stock_levels s LEFT JOIN products p ON s.product_id = p.id WHERE p.id IS NULL;

-- =====================================================
-- 3. SAMPLE DATA VERIFICATION
-- =====================================================

-- Sample products
SELECT 
    p.id,
    p.product_code,
    p.product_name,
    c.category_name,
    p.cost_price,
    p.sell_price,
    p.is_active
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
ORDER BY p.id
LIMIT 20;

-- Sample stock levels with product info
SELECT 
    p.product_code,
    p.product_name,
    s.quantity,
    s.lot_number,
    s.expiry_date
FROM stock_levels s
JOIN products p ON s.product_id = p.id
ORDER BY s.quantity DESC
LIMIT 20;

-- Sample suppliers
SELECT 
    id,
    supplier_code,
    supplier_name,
    supplier_type,
    is_government,
    is_active
FROM suppliers
ORDER BY id
LIMIT 20;

-- =====================================================
-- 4. CATEGORY VERIFICATION
-- =====================================================

-- Category distribution
SELECT 
    c.category_code,
    c.category_name,
    COUNT(p.id) AS product_count
FROM categories c
LEFT JOIN products p ON c.id = p.category_id
GROUP BY c.id, c.category_code, c.category_name
ORDER BY product_count DESC;

-- =====================================================
-- 5. STOCK VERIFICATION
-- =====================================================

-- Compare source vs target stock
-- This helps identify any discrepancies

-- Source: Total quantity from cdrugremain
SELECT 'Source: Total Stock Quantity' AS description, SUM(remain) AS total_qty FROM jhcisdb.cdrugremain;

-- Target: Total quantity from stock_levels
SELECT 'Target: Total Stock Quantity' AS description, SUM(quantity) AS total_qty FROM stock_levels;

-- Products in source but not in target
SELECT 
    'Products in source but not in target' AS issue,
    COUNT(*) AS count
FROM jhcisdb.cdrugremain cr
LEFT JOIN products p ON cr.drugcode = p.product_code
WHERE p.id IS NULL;

-- Stock summary by category
SELECT 
    c.category_name,
    COUNT(DISTINCT s.product_id) AS products_with_stock,
    SUM(s.quantity) AS total_quantity
FROM stock_levels s
JOIN products p ON s.product_id = p.id
JOIN categories c ON p.category_id = c.id
GROUP BY c.id, c.category_name
ORDER BY total_quantity DESC;

-- =====================================================
-- 6. MOVEMENT VERIFICATION
-- =====================================================

-- Check initial movements
SELECT 
    m.movement_no,
    m.movement_type,
    COUNT(*) AS record_count,
    SUM(m.quantity) AS total_quantity,
    MIN(m.movement_date) AS earliest_date,
    MAX(m.movement_date) AS latest_date
FROM stock_movements m
WHERE m.movement_type = 'initial'
GROUP BY m.movement_no, m.movement_type;

-- =====================================================
-- 7. MISSING DATA CHECKS
-- =====================================================

-- Products with zero stock
SELECT 
    'Products with zero stock' AS issue,
    COUNT(*) AS count
FROM products p
LEFT JOIN stock_levels s ON p.id = s.product_id
WHERE s.id IS NULL;

-- Suppliers with no transactions (from source)
SELECT 
    'Suppliers not migrated' AS issue,
    COUNT(DISTINCT d.companyname) AS count
FROM jhcisdb.drugstorereceive d
LEFT JOIN suppliers s ON d.companyname = s.supplier_name
WHERE s.id IS NULL AND d.companyname IS NOT NULL AND d.companyname != '';

-- =====================================================
-- 8. SUMMARY REPORT
-- =====================================================

-- Migration summary
SELECT 
    'Migration Summary' AS report,
    CONCAT(
        'Products: ', (SELECT COUNT(*) FROM products), ' / ',
        'Categories: ', (SELECT COUNT(*) FROM categories), ' / ',
        'Suppliers: ', (SELECT COUNT(*) FROM suppliers), ' / ',
        'Stock Levels: ', (SELECT COUNT(*) FROM stock_levels)
    ) AS summary;

-- End of verification queries