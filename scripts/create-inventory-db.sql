-- Create new database for Inventory & Procurement System
CREATE DATABASE IF NOT EXISTS inventory_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE inventory_db;

-- ============================================
-- 1. PRODUCTS (Master Data - ยา/เวชภัณฑ์)
-- ============================================
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_code VARCHAR(50) UNIQUE NOT NULL,
    name_th VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    generic_name VARCHAR(255),
    category ENUM('drug', 'medical_supply', 'equipment', 'consumable') NOT NULL,
    unit_of_measure VARCHAR(50) NOT NULL,
    pack_size VARCHAR(100),
    min_stock_level INT DEFAULT 0,
    max_stock_level INT DEFAULT 0,
    reorder_point INT DEFAULT 0,
    unit_cost DECIMAL(10,2) DEFAULT 0,
    unit_price DECIMAL(10,2) DEFAULT 0,
    barcode VARCHAR(100),
    storage_condition VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_product_code (product_code),
    INDEX idx_category (category),
    INDEX idx_barcode (barcode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 2. SUPPLIERS (ผู้จำหน่าย)
-- ============================================
CREATE TABLE suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_code VARCHAR(50) UNIQUE NOT NULL,
    name_th VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    contact_person VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    tax_id VARCHAR(50),
    payment_terms VARCHAR(100),
    lead_time_days INT DEFAULT 7,
    rating DECIMAL(3,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_supplier_code (supplier_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 3. PRODUCT_SUPPLIER (ความสัมพันธ์ ยา-ผู้จำหน่าย)
-- ============================================
CREATE TABLE product_suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    supplier_id INT NOT NULL,
    supplier_product_code VARCHAR(100),
    supplier_product_name VARCHAR(255),
    unit_price DECIMAL(10,2),
    min_order_qty INT DEFAULT 1,
    is_preferred BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    UNIQUE KEY unique_product_supplier (product_id, supplier_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 4. STOCK_BATCHES (ล็อตยา/เวชภัณฑ์ - สำหรับ FEFO)
-- ============================================
CREATE TABLE stock_batches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    batch_number VARCHAR(100) NOT NULL,
    quantity_received INT NOT NULL,
    quantity_remaining INT NOT NULL,
    expiry_date DATE NOT NULL,
    manufacturing_date DATE,
    received_date DATE NOT NULL,
    storage_location VARCHAR(100),
    status ENUM('available', 'reserved', 'expired', 'quarantined') DEFAULT 'available',
    unit_cost DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    INDEX idx_product_expiry (product_id, expiry_date),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 5. STOCK_MOVEMENTS (การเคลื่อนไหวสต็อก)
-- ============================================
CREATE TABLE stock_movements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    batch_id INT,
    movement_type ENUM('receipt', 'deduction', 'adjustment', 'transfer', 'return', 'expired') NOT NULL,
    quantity INT NOT NULL,
    quantity_before INT NOT NULL,
    quantity_after INT NOT NULL,
    reference_type VARCHAR(50),
    reference_id INT,
    reason TEXT,
    performed_by INT,
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (batch_id) REFERENCES stock_batches(id),
    INDEX idx_product_movement (product_id, movement_type),
    INDEX idx_reference (reference_type, reference_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 6. PURCHASE_ORDERS (ใบสั่งซื้อ)
-- ============================================
CREATE TABLE purchase_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    po_number VARCHAR(50) UNIQUE NOT NULL,
    supplier_id INT NOT NULL,
    order_date DATE NOT NULL,
    expected_delivery_date DATE,
    actual_delivery_date DATE,
    status ENUM('draft', 'pending_approval', 'approved', 'sent', 'partially_received', 'completed', 'cancelled') DEFAULT 'draft',
    total_amount DECIMAL(12,2) DEFAULT 0,
    notes TEXT,
    created_by INT,
    approved_by INT,
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    INDEX idx_po_number (po_number),
    INDEX idx_status (status),
    INDEX idx_order_date (order_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 7. PURCHASE_ORDER_ITEMS (รายการในใบสั่งซื้อ)
-- ============================================
CREATE TABLE purchase_order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    po_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity_ordered INT NOT NULL,
    quantity_received INT DEFAULT 0,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (po_id) REFERENCES purchase_orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 8. PO_APPROVALS (การอนุมัติใบสั่งซื้อ)
-- ============================================
CREATE TABLE po_approvals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    po_id INT NOT NULL,
    approver_id INT NOT NULL,
    approval_level INT NOT NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    comments TEXT,
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (po_id) REFERENCES purchase_orders(id),
    INDEX idx_po_approval (po_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 9. STOCK_ADJUSTMENTS (การปรับสต็อก)
-- ============================================
CREATE TABLE stock_adjustments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    adjustment_number VARCHAR(50) UNIQUE NOT NULL,
    product_id INT NOT NULL,
    batch_id INT,
    adjustment_type ENUM('increase', 'decrease') NOT NULL,
    quantity INT NOT NULL,
    reason ENUM('damaged', 'expired', 'lost', 'found', 'correction', 'other') NOT NULL,
    description TEXT,
    evidence_document VARCHAR(255),
    performed_by INT NOT NULL,
    approved_by INT,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (batch_id) REFERENCES stock_batches(id),
    INDEX idx_adjustment_number (adjustment_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 10. PHYSICAL_COUNTS (การตรวจนับสต็อก)
-- ============================================
CREATE TABLE physical_counts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    count_number VARCHAR(50) UNIQUE NOT NULL,
    count_date DATE NOT NULL,
    status ENUM('scheduled', 'in_progress', 'completed', 'cancelled') DEFAULT 'scheduled',
    scheduled_by INT,
    completed_by INT,
    completed_at TIMESTAMP NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_count_number (count_number),
    INDEX idx_count_date (count_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 11. PHYSICAL_COUNT_ITEMS (รายการตรวจนับ)
-- ============================================
CREATE TABLE physical_count_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    count_id INT NOT NULL,
    product_id INT NOT NULL,
    batch_id INT,
    system_quantity INT NOT NULL,
    counted_quantity INT NOT NULL,
    variance INT,
    notes TEXT,
    counted_by INT,
    counted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (count_id) REFERENCES physical_counts(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (batch_id) REFERENCES stock_batches(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 12. USERS (ผู้ใช้งานระบบ - RBAC)
-- ============================================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    role ENUM('admin', 'inventory_manager', 'pharmacist', 'purchaser', 'viewer') NOT NULL,
    permissions JSON,
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 13. AUDIT_LOGS (บันทึกการตรวจสอบ)
-- ============================================
CREATE TABLE audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(50),
    user_agent VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_action (action),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 14. EXPIRY_ALERTS (แจ้งเตือนยาหมดอายุ)
-- ============================================
CREATE TABLE expiry_alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    batch_id INT NOT NULL,
    expiry_date DATE NOT NULL,
    alert_type ENUM('30_days', '60_days', '90_days', 'expired') NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP NULL,
    read_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (batch_id) REFERENCES stock_batches(id),
    INDEX idx_expiry_date (expiry_date),
    INDEX idx_is_read (is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- INSERT DEFAULT ADMIN USER
-- ============================================
-- Password: admin123 (bcrypt hash placeholder - should be properly hashed in production)
INSERT INTO users (username, password_hash, full_name, email, role, permissions) VALUES
('admin', '$2b$10$X7VZQhJzKzJzKzJzKzJzK.hZxZxZxZxZxZxZxZxZxZxZxZxZxZxZx', 'System Administrator', 'admin@hospital.com', 'admin', '{"all": true}'),
('inventory_manager', '$2b$10$X7VZQhJzKzJzKzJzKzJzK.hZxZxZxZxZxZxZxZxZxZxZxZxZxZxZx', 'Inventory Manager', 'inventory@hospital.com', 'inventory_manager', '{"stock": ["read", "write"], "products": ["read", "write"], "reports": ["read"]}'),
('pharmacist', '$2b$10$X7VZQhJzKzJzKzJzKzJzK.hZxZxZxZxZxZxZxZxZxZxZxZxZxZxZx', 'Pharmacist', 'pharmacist@hospital.com', 'pharmacist', '{"stock": ["read", "deduct"], "products": ["read"], "reports": ["read"]}');

-- ============================================
-- VIEWS สำหรับ Dashboard
-- ============================================

-- View: Stock Levels Summary
CREATE OR REPLACE VIEW v_stock_levels AS
SELECT 
    p.id,
    p.product_code,
    p.name_th,
    p.name_en,
    p.category,
    p.unit_of_measure,
    COALESCE(SUM(sb.quantity_remaining), 0) AS total_stock,
    p.min_stock_level,
    p.max_stock_level,
    p.reorder_point,
    CASE 
        WHEN COALESCE(SUM(sb.quantity_remaining), 0) <= p.reorder_point THEN 'low'
        WHEN COALESCE(SUM(sb.quantity_remaining), 0) >= p.max_stock_level THEN 'overstock'
        ELSE 'normal'
    END AS stock_status
FROM products p
LEFT JOIN stock_batches sb ON p.id = sb.product_id AND sb.status = 'available'
WHERE p.is_active = TRUE
GROUP BY p.id;

-- View: Expiry Alerts
CREATE OR REPLACE VIEW v_expiry_alerts AS
SELECT 
    p.id AS product_id,
    p.product_code,
    p.name_th,
    p.name_en,
    sb.batch_number,
    sb.quantity_remaining,
    sb.expiry_date,
    DATEDIFF(sb.expiry_date, CURDATE()) AS days_until_expiry,
    CASE 
        WHEN sb.expiry_date < CURDATE() THEN 'expired'
        WHEN DATEDIFF(sb.expiry_date, CURDATE()) <= 30 THEN '30_days'
        WHEN DATEDIFF(sb.expiry_date, CURDATE()) <= 60 THEN '60_days'
        WHEN DATEDIFF(sb.expiry_date, CURDATE()) <= 90 THEN '90_days'
        ELSE 'ok'
    END AS alert_type
FROM products p
INNER JOIN stock_batches sb ON p.id = sb.product_id
WHERE sb.quantity_remaining > 0 AND sb.status = 'available'
ORDER BY sb.expiry_date ASC;

-- View: Dashboard Summary
CREATE OR REPLACE VIEW v_dashboard_summary AS
SELECT 
    (SELECT COUNT(*) FROM products WHERE is_active = TRUE) AS total_products,
    (SELECT COUNT(*) FROM stock_batches WHERE status = 'available' AND quantity_remaining > 0) AS total_batches,
    (SELECT SUM(quantity_remaining * unit_cost) FROM stock_batches WHERE status = 'available') AS total_inventory_value,
    (SELECT COUNT(*) FROM v_expiry_alerts WHERE alert_type IN ('expired', '30_days')) AS urgent_expiry_count,
    (SELECT COUNT(*) FROM v_stock_levels WHERE stock_status = 'low') AS low_stock_count,
    (SELECT COUNT(*) FROM purchase_orders WHERE status = 'pending_approval') AS pending_po_count;
