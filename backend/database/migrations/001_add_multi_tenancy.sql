-- ============================================
-- Migration 001: Multi-Tenancy Bootstrap
-- Purpose: Initialize tenant master tables safely on a fresh database.
-- Note: Product/stock table tenant columns must be added later after the
--       core application schema exists. This script must not fail on an
--       empty database during first container startup.
-- ============================================

START TRANSACTION;

CREATE TABLE IF NOT EXISTS tenants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_code VARCHAR(50) NOT NULL UNIQUE,
  tenant_name VARCHAR(255) NOT NULL,
  tenant_type ENUM('hospital', 'clinic', 'pharmacy', 'health_center') DEFAULT 'hospital',
  status ENUM('active', 'suspended', 'trial', 'cancelled') DEFAULT 'trial',
  config JSON NULL,
  max_users INT DEFAULT 10,
  max_products INT DEFAULT 5000,
  subscription_plan ENUM('basic', 'professional', 'enterprise') DEFAULT 'basic',
  trial_ends_at DATE NULL,
  subscription_starts_at DATE NULL,
  subscription_ends_at DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_code (tenant_code),
  INDEX idx_status (status),
  INDEX idx_type (tenant_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tenants (
  id,
  tenant_code,
  tenant_name,
  tenant_type,
  status,
  subscription_plan,
  trial_ends_at
) VALUES (
  1,
  'DEFAULT-001',
  'Default Tenant',
  'hospital',
  'active',
  'enterprise',
  DATE_ADD(CURDATE(), INTERVAL 30 DAY)
)
ON DUPLICATE KEY UPDATE
  tenant_name = VALUES(tenant_name),
  status = VALUES(status),
  subscription_plan = VALUES(subscription_plan);

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

CREATE TABLE IF NOT EXISTS tenant_access_audit (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  user_id INT NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NULL,
  resource_id INT NULL,
  accessed_tenant_id INT NULL,
  success BOOLEAN DEFAULT TRUE,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_user (user_id),
  INDEX idx_created (created_at),
  INDEX idx_action (action),
  CONSTRAINT fk_audit_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tenant_configs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  config_key VARCHAR(100) NOT NULL,
  config_value TEXT NULL,
  config_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
  description TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_tenant_config (tenant_id, config_key),
  CONSTRAINT fk_configs_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tenant_configs (tenant_id, config_key, config_value, config_type, description) VALUES
  (1, 'timezone', 'Asia/Bangkok', 'string', 'Tenant timezone'),
  (1, 'currency', 'THB', 'string', 'Default currency'),
  (1, 'date_format', 'YYYY-MM-DD', 'string', 'Date display format'),
  (1, 'low_stock_threshold', '20', 'number', 'Low stock threshold'),
  (1, 'auto_approve_po_limit', '10000', 'number', 'Auto-approve POs under this amount')
ON DUPLICATE KEY UPDATE
  config_value = VALUES(config_value),
  config_type = VALUES(config_type),
  description = VALUES(description);

COMMIT;
