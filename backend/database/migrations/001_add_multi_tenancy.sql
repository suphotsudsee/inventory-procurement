-- ============================================
-- Migration 001: Multi-Tenancy Support
-- Purpose: Add tenant isolation to all tables
-- Date: 2026-03-29
-- Author: SaaS Transition Project
-- ============================================

-- Start transaction for atomic migration
START TRANSACTION;

-- ============================================
-- 1. Create Tenants Table
-- ============================================

CREATE TABLE IF NOT EXISTS tenants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_code VARCHAR(50) NOT NULL UNIQUE,
  tenant_name VARCHAR(255) NOT NULL,
  tenant_type ENUM('hospital', 'clinic', 'pharmacy', 'health_center') DEFAULT 'hospital',
  status ENUM('active', 'suspended', 'trial', 'cancelled') DEFAULT 'trial',
  config JSON,
  max_users INT DEFAULT 10,
  max_products INT DEFAULT 5000,
  subscription_plan ENUM('basic', 'professional', 'enterprise') DEFAULT 'basic',
  trial_ends_at DATE,
  subscription_starts_at DATE,
  subscription_ends_at DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_code (tenant_code),
  INDEX idx_status (status),
  INDEX idx_type (tenant_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 2. Insert Default Tenant (for existing data)
-- ============================================

INSERT INTO tenants (tenant_code, tenant_name, tenant_type, status, subscription_plan, trial_ends_at)
VALUES ('DEFAULT-001', 'Default Tenant (Legacy Data)', 'hospital', 'active', 'enterprise', DATE_ADD(CURDATE(), INTERVAL 30 DAY))
ON DUPLICATE KEY UPDATE tenant_name = VALUES(tenant_name);

-- ============================================
-- 3. Add tenant_id to All Tables
-- ============================================

-- Products table
ALTER TABLE products 
  ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 AFTER id,
  ADD INDEX idx_tenant_active (tenant_id, is_active),
  ADD CONSTRAINT fk_products_tenant 
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Stock batches (invp_stock_lots)
ALTER TABLE invp_stock_lots 
  ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 AFTER id,
  ADD INDEX idx_tenant_product (tenant_id, product_code),
  ADD INDEX idx_tenant_expiry (tenant_id, expiry_date),
  ADD CONSTRAINT fk_stock_lots_tenant 
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Stock movements (invp_stock_movements)
ALTER TABLE invp_stock_movements 
  ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 AFTER id,
  ADD INDEX idx_tenant_type (tenant_id, movement_type),
  ADD INDEX idx_tenant_created (tenant_id, created_at),
  ADD CONSTRAINT fk_stock_movements_tenant 
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Stock adjustments (invp_stock_adjustments)
ALTER TABLE invp_stock_adjustments 
  ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 AFTER id,
  ADD INDEX idx_tenant_reason (tenant_id, reason),
  ADD CONSTRAINT fk_stock_adjustments_tenant 
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Goods receipts (invp_goods_receipts)
ALTER TABLE invp_goods_receipts 
  ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 AFTER id,
  ADD INDEX idx_tenant_supplier (tenant_id, supplier_id),
  ADD INDEX idx_tenant_date (tenant_id, received_date),
  ADD CONSTRAINT fk_goods_receipts_tenant 
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Goods receipt items (invp_goods_receipt_items)
ALTER TABLE invp_goods_receipt_items 
  ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 AFTER id,
  ADD INDEX idx_tenant_receipt (tenant_id, goods_receipt_id),
  ADD CONSTRAINT fk_goods_receipt_items_tenant 
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Purchase orders
ALTER TABLE purchase_orders 
  ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 AFTER id,
  ADD INDEX idx_tenant_status (tenant_id, status),
  ADD INDEX idx_tenant_date (tenant_id, order_date),
  ADD CONSTRAINT fk_po_tenant 
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Purchase order items
ALTER TABLE purchase_order_items 
  ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 AFTER id,
  ADD INDEX idx_tenant_order (tenant_id, order_id),
  ADD CONSTRAINT fk_po_items_tenant 
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Users table
ALTER TABLE users 
  ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 AFTER id,
  ADD INDEX idx_tenant_role (tenant_id, role),
  ADD INDEX idx_tenant_active (tenant_id, is_active),
  ADD CONSTRAINT fk_users_tenant 
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- ============================================
-- 4. Create Tenant Usage Tracking Table
-- ============================================

CREATE TABLE IF NOT EXISTS tenant_usage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  metric_name VARCHAR(100) NOT NULL,
  metric_value INT NOT NULL DEFAULT 0,
  recorded_at DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_tenant_metric_date (tenant_id, metric_name, recorded_at),
  INDEX idx_tenant_date (tenant_id, recorded_at),
  CONSTRAINT fk_usage_tenant 
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 5. Create Executive Aggregation Views
-- ============================================

-- View: Executive Summary (all tenants)
CREATE OR REPLACE VIEW v_executive_summary AS
SELECT 
  t.id AS tenant_id,
  t.tenant_code,
  t.tenant_name,
  t.tenant_type,
  t.status,
  t.subscription_plan,
  COUNT(DISTINCT p.id) AS total_products,
  COALESCE(SUM(lb.quantity), 0) AS total_stock_items,
  COALESCE(SUM(lb.quantity * p.unit_cost), 0) AS total_stock_value,
  (SELECT COUNT(*) FROM purchase_orders po WHERE po.tenant_id = t.id AND po.status = 'pending') AS pending_pos,
  (SELECT COUNT(*) FROM invp_stock_lots l WHERE l.tenant_id = t.id AND l.expiry_date < CURDATE() + INTERVAL 7 DAY AND l.quantity > 0) AS expiring_soon,
  (SELECT COUNT(*) FROM invp_stock_lots l WHERE l.tenant_id = t.id AND l.expiry_date < CURDATE() AND l.quantity > 0) AS expired_items,
  (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id AND u.is_active = TRUE) AS active_users
FROM tenants t
LEFT JOIN products p ON p.tenant_id = t.id AND p.is_active = TRUE
LEFT JOIN invp_stock_lots lb ON lb.tenant_id = t.id
LEFT JOIN products p ON p.id = lb.product_id
WHERE t.status IN ('active', 'trial')
GROUP BY t.id, t.tenant_code, t.tenant_name, t.tenant_type, t.status, t.subscription_plan;

-- View: Tenant Stock Status (per-tenant)
CREATE OR REPLACE VIEW v_tenant_stock_status AS
SELECT 
  p.tenant_id,
  p.id,
  p.product_code,
  p.product_name,
  p.category_id,
  COALESCE(lb.quantity, 0) AS current_stock,
  COALESCE(sl.min_level, p.min_stock_level, 0) AS min_level,
  COALESCE(sl.reorder_point, p.reorder_point, 0) AS reorder_point,
  p.unit_cost,
  (COALESCE(lb.quantity, 0) * p.unit_cost) AS stock_value,
  CASE 
    WHEN COALESCE(lb.quantity, 0) = 0 THEN 'out_of_stock'
    WHEN COALESCE(lb.quantity, 0) < COALESCE(sl.min_level, p.min_stock_level, 0) THEN 'low_stock'
    ELSE 'normal'
  END AS stock_status
FROM products p
LEFT JOIN (
  SELECT tenant_id, product_code, SUM(quantity) AS quantity
  FROM invp_stock_lots 
  WHERE quantity > 0
  GROUP BY tenant_id, product_code
) lb ON lb.tenant_id = p.tenant_id AND lb.product_code = p.product_code
LEFT JOIN stock_levels sl ON sl.product_id = p.id
WHERE p.is_active = TRUE;

-- View: Tenant Expiring Stock
CREATE OR REPLACE VIEW v_tenant_expiring_stock AS
SELECT 
  l.tenant_id,
  l.id AS lot_id,
  l.lot_number,
  l.product_code,
  p.product_name,
  l.quantity,
  l.expiry_date,
  DATEDIFF(l.expiry_date, CURDATE()) AS days_until_expiry,
  CASE 
    WHEN l.expiry_date < CURDATE() THEN 'expired'
    WHEN DATEDIFF(l.expiry_date, CURDATE()) <= 7 THEN 'critical'
    WHEN DATEDIFF(l.expiry_date, CURDATE()) <= 30 THEN 'warning'
    ELSE 'ok'
  END AS expiry_status
FROM invp_stock_lots l
JOIN products p ON p.product_code = l.product_code AND p.tenant_id = l.tenant_id
WHERE l.quantity > 0
ORDER BY l.tenant_id, l.expiry_date ASC;

-- ============================================
-- 6. Create Tenant Management Stored Procedures
-- ============================================

DELIMITER //

-- Procedure: Create New Tenant
CREATE PROCEDURE IF NOT EXISTS sp_create_tenant(
  IN p_tenant_code VARCHAR(50),
  IN p_tenant_name VARCHAR(255),
  IN p_tenant_type VARCHAR(50),
  IN p_subscription_plan VARCHAR(50),
  IN p_trial_days INT,
  OUT p_tenant_id INT
)
BEGIN
  INSERT INTO tenants (
    tenant_code, 
    tenant_name, 
    tenant_type, 
    subscription_plan, 
    status,
    trial_ends_at
  ) VALUES (
    p_tenant_code,
    p_tenant_name,
    p_tenant_type,
    p_subscription_plan,
    'trial',
    DATE_ADD(CURDATE(), INTERVAL p_trial_days DAY)
  );
  
  SET p_tenant_id = LAST_INSERT_ID();
END //

-- Procedure: Get Tenant Usage Stats
CREATE PROCEDURE IF NOT EXISTS sp_get_tenant_usage(
  IN p_tenant_id INT
)
BEGIN
  SELECT 
    t.id,
    t.tenant_code,
    t.tenant_name,
    t.status,
    t.subscription_plan,
    (SELECT COUNT(*) FROM products WHERE tenant_id = p_tenant_id AND is_active = TRUE) AS product_count,
    (SELECT COUNT(*) FROM users WHERE tenant_id = p_tenant_id AND is_active = TRUE) AS user_count,
    (SELECT COALESCE(SUM(quantity), 0) FROM invp_stock_lots WHERE tenant_id = p_tenant_id AND quantity > 0) AS stock_items,
    (SELECT COUNT(*) FROM purchase_orders WHERE tenant_id = p_tenant_id AND created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)) AS pos_last_30_days,
    t.max_products,
    t.max_users,
    t.trial_ends_at,
    t.subscription_ends_at
  FROM tenants t
  WHERE t.id = p_tenant_id;
END //

-- Procedure: Archive Old Tenant Data (for cleanup)
CREATE PROCEDURE IF NOT EXISTS sp_archive_tenant_data(
  IN p_tenant_id INT,
  IN p_days_old INT
)
BEGIN
  -- Archive old stock movements
  INSERT INTO invp_stock_movements_archive
  SELECT * FROM invp_stock_movements 
  WHERE tenant_id = p_tenant_id 
    AND created_at < DATE_SUB(CURDATE(), INTERVAL p_days_old DAY);
  
  -- Delete archived movements
  DELETE FROM invp_stock_movements 
  WHERE tenant_id = p_tenant_id 
    AND created_at < DATE_SUB(CURDATE(), INTERVAL p_days_old DAY);
END //

DELIMITER ;

-- ============================================
-- 7. Create Audit Log Table for Tenant Access
-- ============================================

CREATE TABLE IF NOT EXISTS tenant_access_audit (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  user_id INT,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id INT,
  accessed_tenant_id INT,
  success BOOLEAN DEFAULT TRUE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_user (user_id),
  INDEX idx_created (created_at),
  INDEX idx_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 8. Update Existing Data to Default Tenant
-- ============================================

-- Note: Since we set DEFAULT 1 on all tenant_id columns,
-- existing data will automatically have tenant_id = 1
-- This matches our DEFAULT-001 tenant inserted above

-- ============================================
-- 9. Create Tenant Configuration Table
-- ============================================

CREATE TABLE IF NOT EXISTS tenant_configs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  config_key VARCHAR(100) NOT NULL,
  config_value TEXT,
  config_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_tenant_config (tenant_id, config_key),
  CONSTRAINT fk_configs_tenant 
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default configurations for DEFAULT tenant
INSERT INTO tenant_configs (tenant_id, config_key, config_value, config_type, description) VALUES
(1, 'timezone', 'Asia/Bangkok', 'string', 'Tenant timezone'),
(1, 'currency', 'THB', 'string', 'Default currency'),
(1, 'date_format', 'YYYY-MM-DD', 'string', 'Date display format'),
(1, 'low_stock_threshold', '20', 'number', 'Days before expiry to warn'),
(1, 'auto_approve_po_limit', '10000', 'number', 'Auto-approve POs under this amount')
ON DUPLICATE KEY UPDATE config_value = VALUES(config_value);

-- ============================================
-- Migration Complete
-- ============================================

COMMIT;

-- Verification queries (run these to confirm migration success)
-- SELECT COUNT(*) FROM tenants;
-- SELECT * FROM tenants;
-- SHOW INDEX FROM products WHERE Key_name = 'idx_tenant_active';
