# Data Migration Guide

## การย้ายข้อมูลจากระบบเดิม (JHCIS) สู่ระบบใหม่ (Inventory & Procurement)

คู่มือนี้อธิบายขั้นตอนการย้ายข้อมูลจากระบบ JHCIS (Visual FoxPro/MySQL) เข้าสู่ระบบ Inventory & Procurement ใหม่

---

## 📋 สารบัญ

1. [ภาพรวม](#ภาพรวม)
2. [ข้อกำหนดเบื้องต้น](#ข้อกำหนดเบื้องต้น)
3. [การเตรียมการ](#การเตรียมการ)
4. [ขั้นตอนการย้ายข้อมูล](#ขั้นตอนการย้ายข้อมูล)
5. [การตรวจสอบข้อมูล](#การตรวจสอบข้อมูล)
6. [การแก้ไขปัญหา](#การแก้ไขปัญหา)
7. [Rollback Procedures](#rollback-procedures)
8. [Appendix](#appendix)

---

## ภาพรวม

### ข้อมูลที่ต้องย้าย

| ลำดับ | ประเภทข้อมูล | แหล่งที่มา (Source) | ปลายทาง (Target) | Script |
|-------|-------------|---------------------|-----------------|--------|
| 1 | Master Data ยา/เวชภัณฑ์ | `cdrug` | `products`, `categories` | `migrate-master-data.py` |
| 2 | Suppliers | `drugstorereceive.companyname` | `suppliers` | `migrate-suppliers.py` |
| 3 | Initial Stock Levels | `cdrugremain` | `stock_levels`, `stock_movements` | `migrate-initial-stock.py` |
| 4 | Historical Movements | `drugstorereceivedetail` | `stock_movements` | *(Optional)* |

### Flow การย้ายข้อมูล

```
┌─────────────────────────────────────────────────────────────────┐
│                      Migration Pipeline                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Master Data (ยา/เวชภัณฑ์)                                     │
│     ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐     │
│     │ Extract │ -> │ Cleanse │ -> │ Validate│ -> │ Import  │     │
│     └─────────┘    └─────────┘    └─────────┘    └─────────┘     │
│                                                                  │
│  2. Suppliers (ซัพพลายเออร์)                                      │
│     ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐     │
│     │ Extract │ -> │ Dedupe  │ -> │ Validate│ -> │ Import  │     │
│     └─────────┘    └─────────┘    └─────────┘    └─────────┘     │
│                                                                  │
│  3. Initial Stock (สต็อกเริ่มต้น)                                  │
│     ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐     │
│     │ Extract │ -> │ Cleanse │ -> │ Map Prod│ -> │ Import  │     │
│     └─────────┘    └─────────┘    └─────────┘    └─────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## ข้อกำหนดเบื้องต้น

### Software Requirements

| Software | Version | หมายเหตุ |
|----------|---------|---------|
| Python | 3.8+ | สำหรับ run migration scripts |
| MySQL | 5.7+ / 8.0+ | Target database |
| pymysql | Latest | Python MySQL driver |
| pandas | Latest | Data processing *(optional)* |

### Database Access

ต้องมีสิทธิ์การเข้าถึง:
- **Source Database (JHCIS)**: SELECT permission
- **Target Database**: SELECT, INSERT, UPDATE, CREATE permission

### Python Dependencies

ติดตั้ง dependencies:

```bash
pip install pymysql pandas
```

หรือใช้ requirements.txt:

```bash
pip install -r requirements.txt
```

---

## การเตรียมการ

### 1. สร้าง Target Database

```sql
CREATE DATABASE inventory_procurement 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;
```

### 2. สร้าง Tables

Tables จะถูกสร้างอัตโนมัติโดย migration scripts แต่สามารถสร้างล่วงหน้าได้:

```sql
-- Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_code VARCHAR(10) UNIQUE NOT NULL,
    category_name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Products Table
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_code VARCHAR(24) UNIQUE NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    product_name_thai VARCHAR(255),
    generic_name VARCHAR(220),
    category_id INT,
    pack_size VARCHAR(255),
    unit_sell VARCHAR(15),
    unit_usage VARCHAR(15),
    cost_price DECIMAL(15,2) DEFAULT 0,
    sell_price DECIMAL(15,2) DEFAULT 0,
    lot_number VARCHAR(50),
    expiry_date DATE,
    old_code VARCHAR(50),
    tmt_code VARCHAR(55),
    properties TEXT,
    caution TEXT,
    is_antibiotic BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    source_checksum VARCHAR(32),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Suppliers Table
CREATE TABLE IF NOT EXISTS suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_code VARCHAR(20) UNIQUE NOT NULL,
    supplier_name VARCHAR(255) NOT NULL,
    supplier_type ENUM('limited_company', 'partnership', 'shop', 'government', 'private', 'unknown') DEFAULT 'private',
    is_government BOOLEAN DEFAULT FALSE,
    contact_person VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    tax_id VARCHAR(13),
    payment_terms VARCHAR(50),
    credit_limit DECIMAL(15,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Stock Locations Table
CREATE TABLE IF NOT EXISTS stock_locations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    location_code VARCHAR(20) UNIQUE NOT NULL,
    location_name VARCHAR(100) NOT NULL,
    location_type ENUM('warehouse', 'pharmacy', 'clinic', 'other') DEFAULT 'warehouse',
    parent_id INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Stock Levels Table
CREATE TABLE IF NOT EXISTS stock_levels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    location_id INT NOT NULL DEFAULT 1,
    quantity INT NOT NULL DEFAULT 0,
    reorder_point INT DEFAULT 0,
    max_stock INT DEFAULT 0,
    lot_number VARCHAR(50),
    expiry_date DATE,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_product_location (product_id, location_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES stock_locations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Stock Movements Table
CREATE TABLE IF NOT EXISTS stock_movements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    movement_no VARCHAR(50) NOT NULL,
    movement_type ENUM('initial', 'receive', 'issue', 'adjustment', 'transfer', 'return', 'damage') NOT NULL,
    product_id INT NOT NULL,
    location_id INT NOT NULL DEFAULT 1,
    quantity INT NOT NULL,
    movement_date DATE NOT NULL,
    reference_no VARCHAR(50),
    reference_type VARCHAR(20),
    lot_number VARCHAR(50),
    expiry_date DATE,
    unit_cost DECIMAL(15,2) DEFAULT 0,
    total_cost DECIMAL(15,2) DEFAULT 0,
    notes TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES stock_locations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 3. ตั้งค่า Configuration

แก้ไขไฟล์ `migration-config.json`:

```json
{
  "source": {
    "host": "localhost",
    "port": 3333,
    "user": "root",
    "password": "your_password",
    "database": "jhcisdb"
  },
  "target": {
    "host": "localhost", 
    "port": 3306,
    "user": "root",
    "password": "your_password",
    "database": "inventory_procurement"
  }
}
```

---

## ขั้นตอนการย้ายข้อมูล

### Step 1: Backup Data (สำรองข้อมูล)

```bash
# Backup source database
mysqldump -h localhost -P 3333 -u root -p jhcisdb > backup_jhcisdb_$(date +%Y%m%d).sql

# Create backup of target (if exists)
mysqldump -h localhost -P 3306 -u root -p inventory_procurement > backup_inventory_$(date +%Y%m%d).sql
```

### Step 2: ทดสอบ Dry Run

```bash
# Test master data migration (dry run)
python migrate-master-data.py --dry-run

# Test suppliers migration (dry run)
python migrate-suppliers.py --dry-run

# Test stock levels migration (dry run)
python migrate-initial-stock.py --dry-run
```

### Step 3: ย้าย Master Data (ยา/เวชภัณฑ์)

```bash
# Run migration
python migrate-master-data.py --config migration-config.json

# หรือระบุ config path
python migrate-master-data.py -c /path/to/migration-config.json -v
```

**ผลลัพธ์ที่คาดหวัง:**
- สร้าง categories ใหม่จาก drug types
- Import ยาทั้งหมดเข้า products table
- สร้าง checksum สำหรับตรวจสอบการเปลี่ยนแปลง

### Step 4: ย้าย Suppliers

```bash
# Run migration
python migrate-suppliers.py --config migration-config.json

# หรือแบบ verbose
python migrate-suppliers.py -v
```

**ผลลัพธ์ที่คาดหวัง:**
- Extract unique suppliers จาก drugstorereceive
- Deduplicate ชื่อซ้ำ
- Import เข้า suppliers table

### Step 5: ย้าย Initial Stock Levels

```bash
# Run migration (ต้อง run หลังจาก master data แล้ว)
python migrate-initial-stock.py --config migration-config.json
```

**ผลลัพธ์ที่คาดหวัง:**
- Import stock levels เข้า stock_levels table
- สร้าง initial stock movements

### Step 6: ตรวจสอบผลลัพธ์

```bash
# Run verification queries
mysql -u root -p inventory_procurement < verify_migration.sql
```

---

## การตรวจสอบข้อมูล

### Verification Queries

```sql
-- ตรวจสอบจำนวนข้อมูลที่ย้าย
SELECT 'Products' AS table_name, COUNT(*) AS count FROM products
UNION ALL
SELECT 'Categories', COUNT(*) FROM categories
UNION ALL
SELECT 'Suppliers', COUNT(*) FROM suppliers
UNION ALL
SELECT 'Stock Levels', COUNT(*) FROM stock_levels
UNION ALL
SELECT 'Stock Movements', COUNT(*) FROM stock_movements;

-- เปรียบเทียบกับ source
-- JHCIS products
SELECT COUNT(*) AS jhcis_drugs FROM jhcisdb.cdrug;

-- Target products
SELECT COUNT(*) AS target_products FROM inventory_procurement.products;

-- หา products ที่ไม่มี stock
SELECT p.product_code, p.product_name
FROM products p
LEFT JOIN stock_levels s ON p.id = s.product_id
WHERE s.id IS NULL;

-- หา stock ที่ product ไม่มีในระบบ
SELECT s.product_id, s.quantity
FROM stock_levels s
LEFT JOIN products p ON s.product_id = p.id
WHERE p.id IS NULL;
```

### Data Quality Checks

```sql
-- หา duplicate product codes
SELECT product_code, COUNT(*) as cnt
FROM products
GROUP BY product_code
HAVING cnt > 1;

-- หา products ที่ไม่มี category
SELECT id, product_code, product_name
FROM products
WHERE category_id IS NULL;

-- หา stock ติดลบ (ควรไม่มี)
SELECT * FROM stock_levels WHERE quantity < 0;

-- หา movements ที่ไม่มี product reference
SELECT m.id, m.movement_no, m.product_id
FROM stock_movements m
LEFT JOIN products p ON m.product_id = p.id
WHERE p.id IS NULL;
```

---

## การแก้ไขปัญหา

### Common Issues

#### 1. Connection Error

```
Error: Can't connect to MySQL server
```

**Solution:**
- ตรวจสอบ host, port, username, password ใน config
- ตรวจสอบ firewall settings
- ตรวจสอบ MySQL service ทำงานอยู่

#### 2. Character Encoding Issues

```
Error: Incorrect string value
```

**Solution:**
- ตั้งค่า charset = utf8mb4 ใน config
- ตรวจสอบ database/table collation

#### 3. Duplicate Key Error

```
Error: Duplicate entry 'XXX' for key 'uk_product_code'
```

**Solution:**
- Scripts จะจัดการ deduplication อัตโนมัติ
- หากยังพบปัญหา ให้ตรวจสอบ source data

#### 4. Foreign Key Constraint

```
Error: Cannot add or update a child row: a foreign key constraint fails
```

**Solution:**
- ตรวจสอบว่า master data import ก่อน stock
- ตรวจสอบว่า category มีอยู่ใน categories table

### Log Files

Logs จะถูกเก็บที่:
```
./logs/migration/
├── master_data_YYYYMMDD_HHMMSS.log
├── suppliers_YYYYMMDD_HHMMSS.log
├── initial_stock_YYYYMMDD_HHMMSS.log
├── master_data_report_YYYYMMDD_HHMMSS.json
├── suppliers_report_YYYYMMDD_HHMMSS.json
└── initial_stock_report_YYYYMMDD_HHMMSS.json
```

---

## Rollback Procedures

### Partial Rollback

ถ้า import ผิดพลาดบางส่วน:

```sql
-- Rollback products
DELETE FROM products WHERE created_at > '2026-03-29 10:00:00';

-- Rollback stock movements
DELETE FROM stock_movements WHERE movement_type = 'initial';

-- Rollback stock levels
DELETE FROM stock_levels WHERE last_updated > '2026-03-29 10:00:00';
```

### Full Rollback

```sql
-- Drop all migrated tables
DROP TABLE IF EXISTS stock_movements;
DROP TABLE IF EXISTS stock_levels;
DROP TABLE IF EXISTS stock_locations;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS suppliers;

-- Restore from backup
SOURCE backup_inventory_YYYYMMDD.sql;
```

### Using Transaction-based Rollback

Scripts รองรับ transaction-based rollback:

```python
# In migration scripts
try:
    with conn.cursor() as cursor:
        # All inserts/updates
        conn.commit()  # Only commit if all successful
except Exception as e:
    conn.rollback()  # Rollback on error
    raise
```

---

## Appendix

### A. Field Mapping Reference

#### cdrug → products

| Source Field | Target Field | Transformation |
|-------------|--------------|----------------|
| drugcode | product_code | Direct |
| drugname | product_name | Trim, Max 255 chars |
| drugnamethai | product_name_thai | Trim |
| drugtype | category_id | Map to category via drug_type_map |
| pack | pack_size | Trim |
| unitsell | unit_sell | Trim |
| unitusage | unit_usage | Trim |
| cost | cost_price | Decimal |
| sell | sell_price | Decimal |
| lotno | lot_number | Trim |
| dateexpire | expiry_date | Date format |
| tmtcode | tmt_code | Trim |
| drugproperties | properties | Trim |
| drugcaution | caution | Trim |
| antibio | is_antibiotic | Boolean (Y/N) |
| stockempty | is_active | Inverted Boolean |

#### drugstorereceive.companyname → suppliers

| Source Field | Target Field | Transformation |
|-------------|--------------|----------------|
| companyname | supplier_name | Trim, Deduplicate |
| - | supplier_code | Generate from name |
| - | supplier_type | Extract from name pattern |
| - | is_government | Detect from name keywords |
| - | notes | Add migration note |

#### cdrugremain → stock_levels

| Source Field | Target Field | Transformation |
|-------------|--------------|----------------|
| drugcode | product_id | Map via product_code |
| remain | quantity | Integer, Non-negative |
| pcucode | - | Store in movement notes |

### B. Drug Type Mapping

| Code | Category Name (Thai) | Category Name (English) |
|------|---------------------|------------------------|
| 01 | ยาเม็ด | Tablets |
| 02 | ยาแคปซูล | Capsules |
| 03 | ยาน้ำ | Liquid Medicine |
| 04 | ยาฉีด | Injectable |
| 05 | ยาภายนอก | External Medicine |
| 06 | ยาเตรียมพิเศษ | Special Preparations |
| 07 | เวชภัณฑ์ | Medical Supplies |
| 08 | วัสดุสิ้นเปลือง | Consumables |
| 09 | อุปกรณ์การแพทย์ | Medical Equipment |
| 10 | เวชภัณฑ์อื่นๆ | Other Medical Items |
| 99 | อื่นๆ | Others |

### C. Run Order

```
1. migrate-master-data.py    (ต้อง run ก่อน)
         ↓
2. migrate-suppliers.py      (สามารถ run พร้อมกับ step 1 ได้)
         ↓
3. migrate-initial-stock.py  (ต้อง run หลัง step 1)
```

### D. Estimated Time

| Data Type | Records | Estimated Time |
|-----------|---------|---------------|
| Master Data | ~5,000 | 2-5 minutes |
| Suppliers | ~100 | < 1 minute |
| Stock Levels | ~5,000 | 3-5 minutes |
| **Total** | ~10,100 | **5-10 minutes** |

---

## Support

หากพบปัญหาในการย้ายข้อมูล:

1. ตรวจสอบ log files ใน `./logs/migration/`
2. รัน script ด้วย `--verbose` flag: `python migrate-master-data.py -v`
3. ตรวจสอบ error messages ใน report JSON files
4. ติดต่อ Data Engineer team

---

**Version:** 1.0.0  
**Last Updated:** 2026-03-29  
**Author:** Data Engineer Team