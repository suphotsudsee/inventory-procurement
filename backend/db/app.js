const { pool, query } = require('./pool');

let initialized = false;

const DRUGTYPE_REFERENCE_MAP = {
  '01': {
    name: 'ยาแผนปัจจุบัน',
    description: 'ALLOPURINOL, CHLORPHENIRAMINE และยาทั่วไป',
    inferred_meaning: 'ยาแผนปัจจุบัน',
    sort_order: 1,
  },
  '02': {
    name: 'หัตถการ/บริการทางการแพทย์',
    description: 'กลุ่มหัตถการและบริการทางการแพทย์',
    inferred_meaning: 'หัตถการ/บริการทางการแพทย์',
    sort_order: 2,
  },
  '03': {
    name: 'วัสดุการแพทย์/อุปกรณ์',
    description: 'เข็มฉีดยา ฝ้าย และวัสดุการแพทย์',
    inferred_meaning: 'วัสดุการแพทย์/อุปกรณ์',
    sort_order: 3,
  },
  '04': {
    name: 'ยาคุมกำเนิด/วางแผนครอบครัว',
    description: 'กลุ่มยาคุมกำเนิดและวางแผนครอบครัว',
    inferred_meaning: 'ยาคุมกำเนิด/วางแผนครอบครัว',
    sort_order: 4,
  },
  '05': {
    name: 'วัคซีน',
    description: 'BCG, COVID-19, DTP-Hib และวัคซีนอื่น',
    inferred_meaning: 'วัคซีน',
    sort_order: 5,
  },
  '06': {
    name: 'บริการคัดกรองสุขภาพ',
    description: 'กลุ่มบริการคัดกรองและตรวจสุขภาพ',
    inferred_meaning: 'บริการคัดกรองสุขภาพ',
    sort_order: 6,
  },
  '07': {
    name: 'อื่นๆ',
    description: 'albumin, ไข้หวัด 2009 และรายการพิเศษอื่น',
    inferred_meaning: 'อื่นๆ',
    sort_order: 7,
  },
  '10': {
    name: 'ยาสมุนไพร',
    description: 'ขมิ้นชัน ฟ้าทะลายโจร และสมุนไพร',
    inferred_meaning: 'ยาสมุนไพร',
    sort_order: 8,
  },
  '11': {
    name: 'ยาแผนไทย/บริการแพทย์แผนไทย',
    description: 'ยาแผนไทยและบริการแพทย์แผนไทย',
    inferred_meaning: 'ยาแผนไทย/บริการแพทย์แผนไทย',
    sort_order: 9,
  },
  '91': {
    name: 'ประเภทพิเศษ',
    description: 'กลุ่มพิเศษ',
    inferred_meaning: 'ประเภทพิเศษ',
    sort_order: 10,
  },
};

const CATEGORY_TYPE_MAP = {
  '01': { name: 'ยาเม็ด', description: 'ประเภท ยาเม็ด' },
  '02': { name: 'ยาแคปซูล', description: 'ประเภท ยาแคปซูล' },
  '03': { name: 'ยาน้ำ', description: 'ประเภท ยาน้ำ' },
  '04': { name: 'ยาฉีด', description: 'ประเภท ยาฉีด' },
  '05': { name: 'ยาภายนอก', description: 'ประเภท ยาภายนอก' },
  '06': { name: 'ยาเตรียมพิเศษ', description: 'ประเภท ยาเตรียมพิเศษ' },
  '07': { name: 'เวชภัณฑ์', description: 'ประเภท เวชภัณฑ์' },
  '10': { name: 'เวชภัณฑ์อื่นๆ', description: 'ประเภท เวชภัณฑ์อื่นๆ' },
  '11': { name: 'อื่นๆ', description: 'ประเภท อื่นๆ' },
};

async function columnExists(tableName, columnName) {
  const rows = await query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?
    `,
    [tableName, columnName]
  );

  return Number(rows[0]?.total || 0) > 0;
}

async function ensureColumn(tableName, columnName, definition) {
  if (await columnExists(tableName, columnName)) {
    return;
  }

  await query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

async function ensureTenantColumns() {
  await ensureColumn('products', 'tenant_id', 'INT NOT NULL DEFAULT 1');
  await ensureColumn('suppliers', 'tenant_id', 'INT NOT NULL DEFAULT 1');
  await ensureColumn('users', 'tenant_id', 'INT NOT NULL DEFAULT 1');
  await ensureColumn('users', 'last_login', 'TIMESTAMP NULL');
  await ensureColumn('purchase_orders', 'tenant_id', 'INT NOT NULL DEFAULT 1');
  await ensureColumn('purchase_order_items', 'tenant_id', 'INT NOT NULL DEFAULT 1');
  await ensureColumn('purchase_order_items', 'product_code', 'VARCHAR(50) NULL');
  await ensureColumn('invp_stock_lots', 'tenant_id', 'INT NOT NULL DEFAULT 1');
  await ensureColumn('invp_stock_movements', 'tenant_id', 'INT NOT NULL DEFAULT 1');
  await ensureColumn('invp_stock_adjustments', 'tenant_id', 'INT NOT NULL DEFAULT 1');
  await ensureColumn('invp_goods_receipts', 'tenant_id', 'INT NOT NULL DEFAULT 1');
  await ensureColumn('invp_goods_receipt_items', 'tenant_id', 'INT NOT NULL DEFAULT 1');
}

async function ensureAppSchema() {
  if (initialized) {
    return;
  }

  await query(`
    CREATE TABLE IF NOT EXISTS drugtypes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      drugtype_code VARCHAR(10) NOT NULL UNIQUE,
      drugtype_name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      inferred_meaning VARCHAR(255) NULL,
      sort_order INT DEFAULT 0,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await syncDrugtypeReference();

  await query(`
    CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      category_code VARCHAR(20) NOT NULL UNIQUE,
      category_name VARCHAR(100) NOT NULL,
      description TEXT NULL,
      parent_id INT NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await syncCategoryMaster();

  await query(`
    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_code VARCHAR(50) NOT NULL UNIQUE,
      product_name VARCHAR(255) NULL,
      product_name_thai VARCHAR(255) NULL,
      generic_name VARCHAR(255) NULL,
      category_id INT NULL,
      drugtype VARCHAR(10) NULL,
      pack_size VARCHAR(100) NULL,
      unit_sell VARCHAR(50) NULL,
      unit_usage VARCHAR(50) NULL,
      min_stock_level INT DEFAULT 0,
      max_stock_level INT DEFAULT 0,
      reorder_point INT DEFAULT 0,
      cost_price DECIMAL(10,2) DEFAULT 0,
      sell_price DECIMAL(10,2) DEFAULT 0,
      unit_cost DECIMAL(10,2) DEFAULT 0,
      unit_price DECIMAL(10,2) DEFAULT 0,
      lot_number VARCHAR(100) NULL,
      expiry_date DATE NULL,
      old_code VARCHAR(100) NULL,
      tmt_code VARCHAR(100) NULL,
      properties TEXT NULL,
      caution TEXT NULL,
      is_antibiotic TINYINT(1) DEFAULT 0,
      is_active TINYINT(1) DEFAULT 1,
      source_checksum VARCHAR(100) NULL,
      barcode VARCHAR(100) NULL,
      storage_condition VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await ensureColumn('products', 'drugtype', 'VARCHAR(10) NULL');
  await ensureColumn('products', 'min_stock_level', 'INT DEFAULT 0');
  await ensureColumn('products', 'max_stock_level', 'INT DEFAULT 0');
  await ensureColumn('products', 'reorder_point', 'INT DEFAULT 0');
  await ensureColumn('products', 'unit_cost', 'DECIMAL(10,2) DEFAULT 0');
  await ensureColumn('products', 'unit_price', 'DECIMAL(10,2) DEFAULT 0');
  await ensureColumn('products', 'barcode', 'VARCHAR(100) NULL');
  await ensureColumn('products', 'storage_condition', 'VARCHAR(255) NULL');

  await query(`
    CREATE TABLE IF NOT EXISTS stock_levels (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id INT NOT NULL,
      quantity INT DEFAULT 0,
      min_level INT DEFAULT 0,
      max_level INT DEFAULT 0,
      reorder_point INT DEFAULT 0,
      last_counted_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_stock_levels_product (product_id),
      CONSTRAINT fk_stock_levels_product FOREIGN KEY (product_id) REFERENCES products(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      supplier_code VARCHAR(50) NOT NULL UNIQUE,
      name_th VARCHAR(255) NOT NULL,
      name_en VARCHAR(255) NULL,
      contact_person VARCHAR(255) NULL,
      phone VARCHAR(50) NULL,
      email VARCHAR(255) NULL,
      address TEXT NULL,
      tax_id VARCHAR(50) NULL,
      payment_terms VARCHAR(100) NULL,
      lead_time_days INT DEFAULT 7,
      rating DECIMAL(3,2) DEFAULT 0,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      supplier_name VARCHAR(255) NULL,
      supplier_type VARCHAR(50) NULL,
      company_name VARCHAR(255) NULL,
      is_government TINYINT(1) DEFAULT 0,
      create_date DATE NULL,
      update_date DATE NULL,
      source_checksum VARCHAR(100) NULL,
      notes TEXT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      email VARCHAR(255) NULL,
      full_name VARCHAR(255) NULL,
      role ENUM('admin', 'manager', 'staff', 'viewer') DEFAULT 'staff',
      is_active TINYINT(1) DEFAULT 1,
      last_login TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await seedDefaultUsers();

  await query(`
    CREATE TABLE IF NOT EXISTS invp_stock_lots (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      product_code VARCHAR(50) NOT NULL,
      lot_number VARCHAR(100) NOT NULL,
      expiry_date DATE NULL,
      quantity INT NOT NULL DEFAULT 0,
      unit_cost DECIMAL(15,2) DEFAULT 0,
      location VARCHAR(100) DEFAULT '',
      source_type VARCHAR(30) DEFAULT 'opening_balance',
      source_ref VARCHAR(100) DEFAULT '',
      supplier_id VARCHAR(36) NULL,
      supplier_name VARCHAR(255) DEFAULT '',
      received_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_invp_stock_lots (product_code, lot_number, expiry_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS invp_stock_movements (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      movement_type ENUM('receipt', 'dispensing', 'adjustment', 'transfer_in', 'transfer_out') NOT NULL,
      product_code VARCHAR(50) NOT NULL,
      lot_number VARCHAR(100) DEFAULT '',
      quantity INT NOT NULL,
      reference VARCHAR(100) DEFAULT '',
      performed_by VARCHAR(100) DEFAULT '',
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS invp_stock_adjustments (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      product_code VARCHAR(50) NOT NULL,
      lot_number VARCHAR(100) NOT NULL,
      previous_qty INT NOT NULL,
      new_qty INT NOT NULL,
      reason VARCHAR(50) NOT NULL,
      reason_detail TEXT NULL,
      notes TEXT NULL,
      adjusted_by VARCHAR(100) DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS invp_goods_receipts (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      receipt_number VARCHAR(50) NOT NULL UNIQUE,
      supplier_id VARCHAR(36) NULL,
      supplier_name VARCHAR(255) NOT NULL,
      invoice_number VARCHAR(100) DEFAULT '',
      notes TEXT NULL,
      received_by VARCHAR(100) DEFAULT '',
      received_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS invp_goods_receipt_items (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      goods_receipt_id BIGINT NOT NULL,
      product_code VARCHAR(50) NOT NULL,
      lot_number VARCHAR(100) NOT NULL,
      expiry_date DATE NULL,
      quantity INT NOT NULL,
      unit_cost DECIMAL(15,2) DEFAULT 0,
      location VARCHAR(100) DEFAULT '',
      FOREIGN KEY (goods_receipt_id) REFERENCES invp_goods_receipts(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      po_number VARCHAR(50) NOT NULL UNIQUE,
      supplier_id INT NOT NULL,
      order_date DATE NOT NULL,
      expected_delivery_date DATE NULL,
      actual_delivery_date DATE NULL,
      status ENUM('draft','pending_approval','approved','sent','partially_received','completed','cancelled') DEFAULT 'draft',
      total_amount DECIMAL(12,2) DEFAULT 0,
      notes TEXT NULL,
      created_by INT NULL,
      approved_by INT NULL,
      approved_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      po_id INT NOT NULL,
      product_id INT NOT NULL,
      quantity_ordered INT NOT NULL,
      quantity_received INT DEFAULT 0,
      unit_price DECIMAL(10,2) NOT NULL,
      total_price DECIMAL(12,2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE RESTRICT,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS po_approvals (
      id INT AUTO_INCREMENT PRIMARY KEY,
      po_id INT NOT NULL,
      approver_id INT NOT NULL,
      approval_level INT NOT NULL,
      status ENUM('pending','approved','rejected') DEFAULT 'pending',
      comments TEXT NULL,
      approved_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await ensureTenantColumns();
  await seedStockLevelsFromLots();
  initialized = true;
}

function extractCategoryCode(categoryCode) {
  const code = String(categoryCode || '').trim();
  if (/^\d{2}$/.test(code)) {
    return code;
  }

  const match = code.match(/^TYPE-(\d{2})/i);
  if (match) {
    return match[1];
  }

  return '11';
}

async function syncCategoryMaster() {
  const standardCodes = Object.keys(CATEGORY_TYPE_MAP);

  for (const code of standardCodes) {
    const category = CATEGORY_TYPE_MAP[code];
    await query(
      `
        INSERT INTO categories (category_code, category_name, description, is_active)
        VALUES (?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE
          category_name = VALUES(category_name),
          description = VALUES(description),
          is_active = 1
      `,
      [code, category.name, category.description]
    );
  }

  const existingCategories = await query('SELECT id, category_code FROM categories');
  const standardCategoryIdByCode = new Map(
    existingCategories
      .filter((row) => standardCodes.includes(String(row.category_code)))
      .map((row) => [String(row.category_code), Number(row.id)])
  );
  const oldCategoryCodeById = new Map(existingCategories.map((row) => [Number(row.id), String(row.category_code || '')]));

  const products = await query('SELECT id, category_id, drugtype FROM products');
  for (const product of products) {
    const fallbackCode = extractCategoryCode(oldCategoryCodeById.get(Number(product.category_id)) || product.drugtype || '');
    const targetCategoryId = standardCategoryIdByCode.get(fallbackCode) || standardCategoryIdByCode.get('11') || null;
    await query(
      'UPDATE products SET drugtype = ?, category_id = ? WHERE id = ?',
      [fallbackCode, targetCategoryId, product.id]
    );
  }

  await query(
    `UPDATE categories SET is_active = 0 WHERE category_code NOT IN (${standardCodes.map(() => '?').join(',')})`,
    standardCodes
  );
}

async function syncDrugtypeReference() {
  const standardCodes = Object.keys(DRUGTYPE_REFERENCE_MAP);

  for (const code of standardCodes) {
    const item = DRUGTYPE_REFERENCE_MAP[code];
    await query(
      `
        INSERT INTO drugtypes (
          drugtype_code, drugtype_name, description, inferred_meaning, sort_order, is_active
        )
        VALUES (?, ?, ?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE
          drugtype_name = VALUES(drugtype_name),
          description = VALUES(description),
          inferred_meaning = VALUES(inferred_meaning),
          sort_order = VALUES(sort_order),
          is_active = 1
      `,
      [code, item.name, item.description, item.inferred_meaning, item.sort_order]
    );
  }

  await query(
    `UPDATE drugtypes SET is_active = 0 WHERE drugtype_code NOT IN (${standardCodes.map(() => '?').join(',')})`,
    standardCodes
  );
}

async function seedStockLevelsFromLots() {
  const existing = await query('SELECT COUNT(*) AS total FROM stock_levels');
  if (Number(existing[0]?.total || 0) > 0) {
    return;
  }

  await query(`
    INSERT INTO stock_levels (product_id, quantity, min_level, max_level, reorder_point, last_counted_at)
    SELECT
      p.id,
      COALESCE(SUM(l.quantity), 0),
      COALESCE(p.min_stock_level, 0),
      COALESCE(p.max_stock_level, 0),
      COALESCE(p.reorder_point, 0),
      NOW()
    FROM products p
    LEFT JOIN invp_stock_lots l ON l.product_code = p.product_code
    WHERE p.is_active = 1
    GROUP BY p.id, p.min_stock_level, p.max_stock_level, p.reorder_point
  `);
}

async function seedDefaultUsers() {
  const rows = await query('SELECT COUNT(*) AS total FROM users');
  if (Number(rows[0]?.total || 0) > 0) {
    return;
  }

  const crypto = require('crypto');
  const passwordHash = crypto.createHash('sha256').update('admin123').digest('hex');

  await query(
    `
      INSERT INTO users (username, password_hash, email, full_name, role, is_active)
      VALUES ('admin', ?, 'admin@example.local', 'System Administrator', 'admin', 1)
    `,
    [passwordHash]
  );
}

async function getSupplierById(id) {
  await ensureAppSchema();
  const rows = await query('SELECT * FROM suppliers WHERE id = ?', [id]);
  return rows[0] || null;
}

async function syncRemain(productCode, delta, connection) {
  await ensureAppSchema();
  const executor = connection || pool;
  const [productRows] = await executor.execute(
    'SELECT id, min_stock_level, max_stock_level, reorder_point FROM products WHERE product_code = ? LIMIT 1',
    [productCode]
  );

  if (!productRows.length) {
    throw new Error(`Product not found for stock sync: ${productCode}`);
  }

  const product = productRows[0];
  const [levelRows] = await executor.execute('SELECT quantity FROM stock_levels WHERE product_id = ? LIMIT 1', [product.id]);

  if (levelRows.length) {
    const newQuantity = Number(levelRows[0].quantity || 0) + Number(delta || 0);
    await executor.execute(
      `
        UPDATE stock_levels
        SET quantity = ?, last_counted_at = NOW(), updated_at = CURRENT_TIMESTAMP
        WHERE product_id = ?
      `,
      [newQuantity, product.id]
    );
    return newQuantity;
  }

  const initialQuantity = Math.max(Number(delta || 0), 0);
  await executor.execute(
    `
      INSERT INTO stock_levels (product_id, quantity, min_level, max_level, reorder_point, last_counted_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `,
    [
      product.id,
      initialQuantity,
      Number(product.min_stock_level || 0),
      Number(product.max_stock_level || 0),
      Number(product.reorder_point || 0),
    ]
  );
  return initialQuantity;
}

module.exports = {
  ensureAppSchema,
  getSupplierById,
  syncRemain,
};
