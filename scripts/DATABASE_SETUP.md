# Database Setup Guide

## 📋 Overview

สร้างฐานข้อมูลใหม่ `inventory_db` สำหรับระบบ Inventory & Procurement แยกจาก jhcisdb เดิม

## 🔧 Configuration

**Database Connection:**
- Host: `localhost`
- Port: `3306`
- Username: `root`
- Password: `12345678`
- Database: `inventory_db`

## 🚀 Setup Steps

### Option 1: Using MySQL Command Line

```bash
mysql -h localhost -P 3306 -u root -p12345678 < C:\fullstack\inventory-procurement\scripts\create-inventory-db.sql
```

### Option 2: Using MySQL Workbench

1. เปิด MySQL Workbench
2. เชื่อมต่อ localhost:3306 (root / 12345678)
3. เปิดไฟล์ `create-inventory-db.sql`
4. กด Execute (⚡)

### Option 3: Using PowerShell Script

```powershell
cd C:\fullstack\inventory-procurement\scripts
.\setup-database.ps1
```

## 📊 Tables Created

### Core Tables
1. **products** - Master Data ยา/เวชภัณฑ์
2. **suppliers** - ผู้จำหน่าย
3. **product_suppliers** - ความสัมพันธ์ ยา-ผู้จำหน่าย
4. **stock_batches** - ล็อตยา (สำหรับ FEFO)
5. **stock_movements** - การเคลื่อนไหวสต็อก
6. **purchase_orders** - ใบสั่งซื้อ
7. **purchase_order_items** - รายการในใบสั่งซื้อ
8. **po_approvals** - การอนุมัติ PO
9. **stock_adjustments** - การปรับสต็อก
10. **physical_counts** - การตรวจนับสต็อก
11. **physical_count_items** - รายการตรวจนับ
12. **users** - ผู้ใช้งานระบบ (RBAC)
13. **audit_logs** - บันทึกการตรวจสอบ
14. **expiry_alerts** - แจ้งเตือนยาหมดอายุ

### Views (Dashboard)
- `v_stock_levels` - สรุปสต็อกคงเหลือ
- `v_expiry_alerts` - แจ้งเตือนยาใกล้หมดอายุ
- `v_dashboard_summary` - ภาพรวม Dashboard

## 👤 Default Users

| Username | Password | Role | Permissions |
|----------|----------|------|-------------|
| admin | admin123 | admin | Full access |
| inventory_manager | admin123 | inventory_manager | Stock + Products + Reports |
| pharmacist | admin123 | pharmacist | Stock deduction + Read only |

⚠️ **เปลี่ยนรหัสผ่านก่อนใช้งานจริง!**

## 🔗 Connection Test

หลังสร้าง database แล้ว ทดสอบการเชื่อมต่อ:

```bash
mysql -h localhost -P 3306 -u root -p12345678 -e "USE inventory_db; SHOW TABLES;"
```

## 📝 Next Steps

1. ✅ สร้าง database (ขั้นตอนนี้)
2. ⏳ Import ข้อมูลจาก legacy system (migrate-*.py scripts)
3. ⏳ รัน Backend API
4. ⏳ ทดสอบการเชื่อมต่อ
