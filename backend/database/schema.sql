/**
 * Database Schema for Inventory & Procurement System
 * MySQL Database Schema for jhcisdb
 * 
 * Run this SQL to create required tables
 */

-- ============================================
-- Products (Master Data)
-- ============================================

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  unit VARCHAR(50),
  min_stock INT DEFAULT 0,
  current_stock INT DEFAULT 0,
  unit_price DECIMAL(15, 2) DEFAULT 0.00,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_code (code),
  INDEX idx_name (name),
  INDEX idx_category (category),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Stock Batches (Inventory Tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS stock_batches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  batch_number VARCHAR(100) NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  original_quantity INT NOT NULL,
  expiry_date DATE,
  supplier VARCHAR(255),
  unit_price DECIMAL(15, 2) DEFAULT 0.00,
  received_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  INDEX idx_product (product_id),
  INDEX idx_batch (batch_number),
  INDEX idx_expiry (expiry_date),
  INDEX idx_quantity (quantity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Stock Transactions (Audit Trail)
-- ============================================

CREATE TABLE IF NOT EXISTS stock_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('receipt', 'deduct', 'adjust') NOT NULL,
  product_id INT NOT NULL,
  batch_id INT,
  quantity INT NOT NULL,
  previous_stock INT,
  new_stock INT,
  notes TEXT,
  user_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  FOREIGN KEY (batch_id) REFERENCES stock_batches(id) ON DELETE SET NULL,
  INDEX idx_type (type),
  INDEX idx_product (product_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Stock Adjustments (Audit Log)
-- ============================================

CREATE TABLE IF NOT EXISTS stock_adjustments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  batch_id INT,
  adjustment_type ENUM('increase', 'decrease') NOT NULL,
  quantity INT NOT NULL,
  previous_stock INT NOT NULL,
  new_stock INT NOT NULL,
  reason TEXT NOT NULL,
  user_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  FOREIGN KEY (batch_id) REFERENCES stock_batches(id) ON DELETE SET NULL,
  INDEX idx_product (product_id),
  INDEX idx_type (adjustment_type),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Purchase Orders
-- ============================================

CREATE TABLE IF NOT EXISTS purchase_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(50) NOT NULL UNIQUE,
  supplier_name VARCHAR(255) NOT NULL,
  supplier_contact VARCHAR(255),
  status ENUM('pending', 'approved', 'rejected', 'completed', 'cancelled') DEFAULT 'pending',
  total_amount DECIMAL(15, 2) DEFAULT 0.00,
  order_date DATE,
  expected_delivery_date DATE,
  approved_by INT,
  approved_at TIMESTAMP NULL,
  notes TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_order_number (order_number),
  INDEX idx_status (status),
  INDEX idx_supplier (supplier_name),
  INDEX idx_date (order_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Purchase Order Items
-- ============================================

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(15, 2) NOT NULL,
  total_price DECIMAL(15, 2) NOT NULL,
  notes TEXT,
  FOREIGN KEY (order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  INDEX idx_order (order_id),
  INDEX idx_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Purchase Order Approvals
-- ============================================

CREATE TABLE IF NOT EXISTS purchase_order_approvals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  approved_by INT,
  approved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  FOREIGN KEY (order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  INDEX idx_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Users (For RBAC)
-- ============================================

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  full_name VARCHAR(255),
  role ENUM('admin', 'manager', 'staff', 'viewer') DEFAULT 'staff',
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_username (username),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Sample Data (Optional)
-- ============================================

-- Insert default admin user (password: admin123)
-- Note: In production, use proper password hashing (bcrypt)
-- INSERT INTO users (username, password_hash, full_name, role) VALUES
-- ('admin', '$2b$10$...', 'System Administrator', 'admin');

-- Insert sample products
-- INSERT INTO products (code, name, category, unit, min_stock, unit_price) VALUES
-- ('DRUG001', 'Paracetamol 500mg', 'Medicine', 'Tablet', 1000, 0.50),
-- ('DRUG002', 'Amoxicillin 500mg', 'Antibiotic', 'Capsule', 500, 1.00),
-- ('SUPPLY001', 'Syringe 5ml', 'Medical Supply', 'Piece', 200, 0.20),
-- ('SUPPLY002', 'Gloves (Box)', 'Medical Supply', 'Box', 50, 5.00);

-- ============================================
-- Views for Reporting
-- ============================================

-- View: Product Stock Status
CREATE OR REPLACE VIEW v_product_stock_status AS
SELECT 
  p.id,
  p.code,
  p.name,
  p.category,
  p.unit,
  p.current_stock,
  p.min_stock,
  p.unit_price,
  (p.current_stock * p.unit_price) as stock_value,
  CASE 
    WHEN p.current_stock = 0 THEN 'out_of_stock'
    WHEN p.current_stock < p.min_stock THEN 'low_stock'
    ELSE 'normal'
  END as stock_status,
  (SELECT COUNT(*) FROM stock_batches sb WHERE sb.product_id = p.id AND sb.quantity > 0) as batch_count,
  (SELECT MIN(sb.expiry_date) FROM stock_batches sb WHERE sb.product_id = p.id AND sb.quantity > 0) as earliest_expiry
FROM products p
WHERE p.is_active = TRUE;

-- View: Expiring Stock
CREATE OR REPLACE VIEW v_expiring_stock AS
SELECT 
  sb.id as batch_id,
  sb.batch_number,
  p.id as product_id,
  p.code as product_code,
  p.name as product_name,
  p.category,
  sb.quantity,
  sb.expiry_date,
  DATEDIFF(sb.expiry_date, CURDATE()) as days_until_expiry,
  CASE 
    WHEN sb.expiry_date < CURDATE() THEN 'expired'
    WHEN DATEDIFF(sb.expiry_date, CURDATE()) <= 7 THEN 'critical'
    WHEN DATEDIFF(sb.expiry_date, CURDATE()) <= 30 THEN 'warning'
    ELSE 'ok'
  END as expiry_status
FROM stock_batches sb
JOIN products p ON sb.product_id = p.id
WHERE sb.quantity > 0
ORDER BY sb.expiry_date ASC;

-- ============================================
-- Stored Procedures (Optional)
-- ============================================

DELIMITER //

-- Procedure: Get Low Stock Products
CREATE PROCEDURE IF NOT EXISTS sp_get_low_stock_products()
BEGIN
  SELECT 
    p.id,
    p.code,
    p.name,
    p.category,
    p.current_stock,
    p.min_stock,
    (p.min_stock - p.current_stock) as shortage
  FROM products p
  WHERE p.is_active = TRUE
    AND p.current_stock < p.min_stock
  ORDER BY (p.min_stock - p.current_stock) DESC;
END //

-- Procedure: Deduct Stock with FEFO
CREATE PROCEDURE IF NOT EXISTS sp_deduct_stock_fefo(
  IN p_product_id INT,
  IN p_quantity INT,
  IN p_user_id INT,
  IN p_notes TEXT
)
BEGIN
  DECLARE v_previous_stock INT;
  DECLARE v_remaining INT;
  DECLARE v_batch_id INT;
  DECLARE v_batch_qty INT;
  DECLARE v_deduct_qty INT;
  
  -- Get current stock
  SELECT current_stock INTO v_previous_stock
  FROM products WHERE id = p_product_id;
  
  IF v_previous_stock < p_quantity THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient stock';
  END IF;
  
  SET v_remaining = p_quantity;
  
  -- Deduct from batches (FEFO)
  WHILE v_remaining > 0 DO
    SELECT id, quantity INTO v_batch_id, v_batch_qty
    FROM stock_batches
    WHERE product_id = p_product_id
      AND quantity > 0
      AND expiry_date >= CURDATE()
    ORDER BY expiry_date ASC, received_date ASC
    LIMIT 1;
    
    SET v_deduct_qty = LEAST(v_batch_qty, v_remaining);
    
    UPDATE stock_batches 
    SET quantity = quantity - v_deduct_qty
    WHERE id = v_batch_id;
    
    SET v_remaining = v_remaining - v_deduct_qty;
  END WHILE;
  
  -- Update product stock
  UPDATE products 
  SET current_stock = current_stock - p_quantity
  WHERE id = p_product_id;
  
  -- Log transaction
  INSERT INTO stock_transactions (type, product_id, quantity, previous_stock, new_stock, notes, user_id, created_at)
  VALUES ('deduct', p_product_id, p_quantity, v_previous_stock, v_previous_stock - p_quantity, p_notes, p_user_id, NOW());
END //

DELIMITER ;

-- ============================================
-- Indexes for Performance
-- ============================================

-- Additional composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_product_category_active ON products(category, is_active);
CREATE INDEX IF NOT EXISTS idx_stock_product_expiry ON stock_batches(product_id, expiry_date);
CREATE INDEX IF NOT EXISTS idx_po_status_date ON purchase_orders(status, order_date);