# ✨ Features & Roadmap

> รายการฟีเจอร์และแผนพัฒนาของระบบ Inventory & Procurement Management System

---

## 📑 สารบัญ

- [ฟีเจอร์ปัจจุบัน](#ฟีเจอร์ปัจจุบัน)
- [ฟีเจอร์ที่กำลังพัฒนา](#ฟีเจอร์ที่กำลังพัฒนา)
- [Roadmap](#roadmap)
- [รายละเอียดฟีเจอร์](#รายละเอียดฟีเจอร์)

---

## ✅ ฟีเจอร์ปัจจุบัน

### 📊 Dashboard

| ฟีเจอร์ | สถานะ | รายละเอียด |
|---------|-------|------------|
| Stats Cards | ✅ | แสดงมูลค่าสต็อก, ยาใกล้หมดอายุ, สต็อกต่ำ, PO รออนุมัติ |
| Expiry Alerts | ✅ | ตารางแจ้งเตือนยาใกล้หมดอายุ |
| Low Stock Alerts | ✅ | รายการสต็อกต่ำกว่าระดับขั้นต่ำ |
| Quick Actions | ✅ | ปุ่มด่วนสร้าง PO, รับเข้า, ตัดสต็อก |
| Auto Refresh | ✅ | รีเฟรชข้อมูลอัตโนมัติทุก 30 วินาที |

### 📦 จัดการสต็อก (Stock Management)

| ฟีเจอร์ | สถานะ | รายละเอียด |
|---------|-------|------------|
| รับเข้าสินค้า | ✅ | รับเข้าสินค้าพร้อมบันทึก Lot Number |
| ตัดสต็อก (FEFO) | ✅ | ตัดสต็อกอัตโนมัติจาก Lot ใกล้หมดอายุก่อน |
| ปรับสต็อก | ✅ | ปรับเพิ่ม/ลดสต็อกพร้อม Audit Log |
| ดูระดับสต็อก | ✅ | แสดงระดับสต็อกปัจจุบันทุกสินค้า |
| Expiry Alerts | ✅ | แจ้งเตือนสินค้าใกล้หมดอายุ |

### 🛒 จัดซื้อจัดจ้าง (Procurement)

| ฟีเจอร์ | สถานะ | รายละเอียด |
|---------|-------|------------|
| สร้างใบสั่งซื้อ (PO) | ✅ | สร้าง PO พร้อมรายการสินค้าหลายรายการ |
| ดูรายการ PO | ✅ | ดูรายการ PO ทั้งหมดพร้อมกรองตามสถานะ |
| อนุมัติ PO | ✅ | Manager/Admin อนุมัติ PO |
| ปฏิเสธ PO | ✅ | Manager/Admin ปฏิเสธ PO |
| Auto PO Number | ✅ | สร้างเลขที่ PO อัตโนมัติ (PO-YYYYMMDD-XXXX) |

### 📈 รายงาน (Reports)

| ฟีเจอร์ | สถานะ | รายละเอียด |
|---------|-------|------------|
| มูลค่าสต็อก | ✅ | รายงานมูลค่าสินค้าคงคลัง |
| ยาหมดอายุ | ✅ | รายงานสินค้าหมดอายุ/ใกล้หมดอายุ |
| สต็อกต่ำ | ✅ | รายงานสินค้าต่ำกว่าระดับขั้นต่ำ |
| ประวัติการเคลื่อนไหว | ✅ | รายงานการรับเข้า/ตัด/ปรับสต็อก |
| ประเมินซัพพลายเออร์ | ✅ | รายงานประสิทธิภาพผู้จำหน่าย |

### 🔐 Authentication & Authorization

| ฟีเจอร์ | สถานะ | รายละเอียด |
|---------|-------|------------|
| JWT Authentication | ✅ | ระบบล็อกอินด้วย JWT Token |
| Role-Based Access | ✅ | สิทธิ์การเข้าถึงตามบทบาท |
| Admin Role | ✅ | สิทธิ์เต็มทุกฟีเจอร์ |
| Manager Role | ✅ | จัดการสต็อก, อนุมัติ PO, ดูรายงาน |
| Staff Role | ✅ | รับเข้า/ตัดสต็อก, สร้าง PO |
| Viewer Role | ✅ | ดูข้อมูลอย่างเดียว |

### 🏗️ Infrastructure

| ฟีเจอร์ | สถานะ | รายละเอียด |
|---------|-------|------------|
| REST API | ✅ | API endpoints ครบถ้วน |
| MySQL Database | ✅ | Database schema พร้อมใช้งาน |
| Database Views | ✅ | Views สำหรับรายงาน |
| Stored Procedures | ✅ | Procedures สำหรับ FEFO |
| Connection Pool | ✅ | MySQL connection pooling |
| Error Handling | ✅ | จัดการ error อย่างเป็นระบบ |
| Graceful Shutdown | ✅ | ปิด connection เมื่อ shutdown |

---

## 🚧 ฟีเจอร์ที่กำลังพัฒนา

### Phase 1 (ปัจจุบัน)

| ฟีเจอร์ | สถานะ | Priority |
|---------|-------|----------|
| Barcode Scanner | 🚧 | High |
| Physical Count | 🚧 | High |
| Print Reports | 🚧 | Medium |
| Export Excel | 🚧 | Medium |
| User Management UI | 🚧 | High |

### Phase 2 (วางแผน)

| ฟีเจอร์ | สถานะ | Priority |
|---------|-------|----------|
| Supplier Management | 📋 | High |
| Category Management | 📋 | Medium |
| Notification System | 📋 | High |
| Email Alerts | 📋 | Medium |
| Dashboard Charts | 📋 | Medium |

---

## 🗓️ Roadmap

### Q2 2026 (เมษายน - มิถุนายน)

```
┌─────────────────────────────────────────────────────────────┐
│ ✅ Phase 1: Core Features Complete                          │
│ ├─ ✅ Stock Management (Receipt, Deduct, Adjust)           │
│ ├─ ✅ Purchase Order Workflow                               │
│ ├─ ✅ Dashboard & Alerts                                    │
│ └─ ✅ Reports                                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 🚧 Phase 2: Enhanced Features (Q2 2026)                     │
│ ├─ 🚧 Barcode Scanner Integration                          │
│ ├─ 🚧 Physical Stock Count                                  │
│ ├─ 🚧 User Management UI                                     │
│ ├─ 🚧 Supplier Management                                   │
│ └─ 🚧 Print & Export Features                               │
└─────────────────────────────────────────────────────────────┘
```

### Q3 2026 (กรกฎาคม - กันยายน)

```
┌─────────────────────────────────────────────────────────────┐
│ 📋 Phase 3: Advanced Features (Q3 2026)                     │
│ ├─ 📋 Notification System (Email/Line)                     │
│ ├─ 📋 Dashboard Charts & Analytics                          │
│ ├─ 📋 Multi-branch Support                                  │
│ ├─ 📋 API Rate Limiting                                     │
│ └─ 📋 Audit Trail Enhancement                               │
└─────────────────────────────────────────────────────────────┘
```

### Q4 2026 (ตุลาคม - ธันวาคม)

```
┌─────────────────────────────────────────────────────────────┐
│ 📋 Phase 4: Enterprise Features (Q4 2026)                   │
│ ├─ 📋 Integration API (HL7, FHIR)                           │
│ ├─ 📋 Mobile App                                            │
│ ├─ 📋 Advanced Reporting                                    │
│ ├─ 📋 Backup & Restore                                      │
│ └─ 📋 System Configuration UI                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 รายละเอียดฟีเจอร์

### 📦 Stock Management

#### รับเข้าสินค้า (Goods Receipt)

```
การทำงาน:
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ กรอกข้อมูล   │ ──▶│ ตรวจสอบ    │ ──▶│ บันทึก      │
│ - Product   │    │ - Product  │    │ - Batch     │
│ - Batch No  │    │   exists?  │    │ - Stock     │
│ - Quantity  │    │ - Valid    │    │ - Transaction│
│ - Expiry    │    │   data?    │    │ - Product   │
└─────────────┘    └─────────────┘    └─────────────┘
                          │
                          └──▶│ Error │
```

**Features:**
- ตรวจสอบ Product ID
- บันทึก Batch Number
- กำหนดวันหมดอายุ
- อัปเดตสต็อกอัตโนมัติ
- สร้าง Transaction Log

#### ตัดสต็อก (Stock Deduction - FEFO)

```
FEFO Flow:
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ ตรวจสอบสต็อก    │ ──▶│ เลือก Batch    │ ──▶│ ตัดสต็อก        │
│ - มีเพียงพอ?    │    │ (FEFO Order)   │    │ - Batch.qty    │
│ - Product ใช้ได้?│    │ - Expiry ASC   │    │ - Product.stock│
└─────────────────┘    │ - Received ASC │    │ - Log trans    │
                       └─────────────────┘    └─────────────────┘
```

**FEFO Logic:**
```sql
SELECT * FROM stock_batches
WHERE product_id = ? AND quantity > 0 AND expiry_date >= CURDATE()
ORDER BY expiry_date ASC, received_date ASC
```

### 🛒 Purchase Order Workflow

```
PO Status Flow:
                                    ┌───────────┐
                                    │ Cancelled │
                                    └───────────┘
                                          ▲
                                          │
┌─────────┐    ┌──────────┐    ┌────────┐ │
│ Pending │ ──▶│ Approved │ ──▶│Complete│─┘
└─────────┘    └──────────┘    └────────┘
     │              │
     │              └──▶┌──────────┐
     └──────────────────▶│ Rejected │
                        └──────────┘
```

**Status Definitions:**

| Status | คำอธิบาย | Action ถัดไป |
|--------|----------|--------------|
| `pending` | รอการอนุมัติ | อนุมัติ/ปฏิเสธ |
| `approved` | อนุมัติแล้ว | รับสินค้า |
| `rejected` | ปฏิเสธแล้ว | - |
| `completed` | รับสินค้าแล้ว | - |
| `cancelled` | ยกเลิกแล้ว | - |

### 📊 Dashboard Components

#### Stats Cards

```
┌────────────────────┐
│ 💰 มูลค่าสต็อก      │
│    ฿ 2,450,000     │
│    +5.2% vs เดือนก่อน│
└────────────────────┘

┌────────────────────┐
│ ⚠️ ยาใกล้หมดอายุ    │
│      23 รายการ     │
│    🔴 2 หมดแล้ว    │
│    🟠 8 < 7 วัน    │
│    🟡 13 < 30 วัน  │
└────────────────────┘
```

#### Expiry Status Colors

| สถานะ | สี | เงื่อนไข |
|--------|-----|----------|
| 🴢 Expired | แดง | หมดอายุแล้ว |
| 🟠 Critical | ส้ม | เหลือ < 7 วัน |
| 🟡 Warning | เหลือง | เหลือ < 30 วัน |
| 🟢 OK | เขียว | ปกติ |

---

## 🔄 Data Flow

### Stock Receipt Flow

```
User Input ──▶ Validate ──▶ Create Batch ──▶ Update Product Stock ──▶ Log Transaction
                    │
                    └──▶ Error Response
```

### Stock Deduction Flow

```
User Input ──▶ Validate ──▶ Check Stock ──▶ Select Batches (FEFO) ──▶ Deduct ──▶ Log
                    │              │
                    │              └──▶ Insufficient Stock Error
                    │
                    └──▶ Error Response
```

### Purchase Order Flow

```
Create PO ──▶ Validate ──▶ Generate PO Number ──▶ Calculate Total ──▶ Save ──▶ Status: Pending
                                                                                  │
                                                                                  ▼
                                              Approve ◀── Manager Review ◀── Notify
                                                  │
                                                  ▼
                                           Status: Approved
                                                  │
                                                  ▼
                                           Receive Goods
                                                  │
                                                  ▼
                                           Status: Completed
```

---

## 🔒 Security Features

### Authentication

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Login     │ ──▶│ Generate    │ ──▶│ Return      │
│ Username/   │    │ JWT Token   │    │ Token +     │
│ Password    │    │             │    │ User Info   │
└─────────────┘    └─────────────┘    └─────────────┘
```

### Authorization

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Request   │ ──▶│ Validate    │ ──▶│ Check       │
│ + Token     │    │ Token       │    │ Permission  │
└─────────────┘    └─────────────┘    └─────────────┘
                          │                  │
                          │                  ├──▶ Allow
                          │                  │
                          └──▶ Invalid ◀─────└──▶ Deny (403)
```

### Role Permissions Matrix

| Permission | Admin | Manager | Staff | Viewer |
|------------|-------|---------|-------|--------|
| `products:read` | ✅ | ✅ | ✅ | ✅ |
| `products:write` | ✅ | ✅ | ✅ | ❌ |
| `stock:read` | ✅ | ✅ | ✅ | ✅ |
| `stock:write` | ✅ | ✅ | ✅ | ❌ |
| `stock:adjust` | ✅ | ✅ | ❌ | ❌ |
| `purchase-orders:read` | ✅ | ✅ | ✅ | ✅ |
| `purchase-orders:write` | ✅ | ✅ | ✅ | ❌ |
| `purchase-orders:approve` | ✅ | ✅ | ❌ | ❌ |
| `dashboard:read` | ✅ | ✅ | ✅ | ✅ |
| `users:manage` | ✅ | ❌ | ❌ | ❌ |

---

## 📊 Database Schema Summary

### Core Tables

| Table | คำอธิบาย |
|-------|----------|
| `products` | ข้อมูลสินค้า/ยา |
| `stock_batches` | Batch สินค้า |
| `stock_transactions` | ประวัติการเคลื่อนไหว |
| `stock_adjustments` | ประวัติการปรับสต็อก |
| `purchase_orders` | ใบสั่งซื้อ |
| `purchase_order_items` | รายการใน PO |
| `users` | ผู้ใช้งาน |

### Views

| View | คำอธิบาย |
|------|----------|
| `v_product_stock_status` | สถานะสต็อกสินค้า |
| `v_expiring_stock` | สินค้าใกล้หมดอายุ |

### Stored Procedures

| Procedure | คำอธิบาย |
|-----------|----------|
| `sp_get_low_stock_products` | ดึงรายการสต็อกต่ำ |
| `sp_deduct_stock_fefo` | ตัดสต็อกด้วย FEFO |

---

## 🎯 Performance Considerations

### Indexing Strategy

```sql
-- Primary indexes on all tables
CREATE INDEX idx_product_code ON products(code);
CREATE INDEX idx_product_category ON products(category);

-- Batch lookups
CREATE INDEX idx_batch_product ON stock_batches(product_id);
CREATE INDEX idx_batch_expiry ON stock_batches(expiry_date);

-- Transaction queries
CREATE INDEX idx_trans_type ON stock_transactions(type);
CREATE INDEX idx_trans_created ON stock_transactions(created_at);

-- PO queries
CREATE INDEX idx_po_status ON purchase_orders(status);
CREATE INDEX idx_po_date ON purchase_orders(order_date);
```

### Connection Pooling

```javascript
// db/pool.js
const pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});
```

---

*Last updated: March 2026*