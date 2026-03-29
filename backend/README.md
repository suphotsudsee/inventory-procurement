# Inventory & Procurement Backend API

Backend API สำหรับระบบ Inventory & Procurement สำหรับโรงพยาบาล

## Tech Stack

- **Node.js** - Runtime
- **Express** - Web Framework
- **MySQL2** - Database (jhcisdb)
- **CORS** - Cross-origin support

## Installation

```bash
cd C:\fullstack\inventory-procurement\backend
npm install
```

## Configuration

สร้างไฟล์ `.env`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=jhcisdb
PORT=3001
NODE_ENV=development
JWT_SECRET=your-secret-key
```

## Database Setup

รัน SQL script เพื่อสร้าง tables:

```bash
mysql -u root -p jhcisdb < database/schema.sql
```

## Running

```bash
# Development
npm run dev

# Production
npm start
```

Server จะทำงานที่ `http://localhost:3001`

## API Endpoints

### Products (Master Data)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | ดึงข้อมูลสินค้าทั้งหมด |
| GET | `/api/products/:id` | ดึงข้อมูลสินค้าตาม ID |
| POST | `/api/products` | สร้างสินค้าใหม่ |
| PUT | `/api/products/:id` | อัปเดตสินค้า |
| DELETE | `/api/products/:id` | ลบสินค้า (soft delete) |

### Stock Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/stock/receipt` | รับสินค้าเข้าคลัง |
| POST | `/api/stock/deduct` | ตัดสต็อก (FEFO) |
| POST | `/api/stock/adjust` | ปรับปรุงสต็อก + Audit Log |
| GET | `/api/stock/levels` | ดูระดับสต็อก |
| GET | `/api/stock/expiry-alerts` | แจ้งเตือนยาใกล้หมดอายุ |

### Purchase Orders

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/purchase-orders` | ดึงรายการสั่งซื้อทั้งหมด |
| GET | `/api/purchase-orders/pending` | ดึงรายการรออนุมัติ |
| GET | `/api/purchase-orders/:id` | ดึงรายละเอียดใบสั่งซื้อ |
| POST | `/api/purchase-orders` | สร้างใบสั่งซื้อ |
| POST | `/api/purchase-orders/:id/approve` | อนุมัติใบสั่งซื้อ |
| POST | `/api/purchase-orders/:id/reject` | ปฏิเสธใบสั่งซื้อ |

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/summary` | สรุปภาพรวมสต็อก |
| GET | `/api/dashboard/expiry` | รายงานยาใกล้หมดอายุ |
| GET | `/api/dashboard/low-stock` | รายการสต็อกต่ำ |

## RBAC Permissions

| Permission | Description |
|------------|-------------|
| `products:read` | อ่านข้อมูลสินค้า |
| `products:write` | เพิ่ม/แก้ไขสินค้า |
| `stock:read` | อ่านข้อมูลสต็อก |
| `stock:write` | รับ/ตัดสต็อก |
| `stock:adjust` | ปรับปรุงสต็อก |
| `purchase-orders:read` | อ่านใบสั่งซื้อ |
| `purchase-orders:write` | สร้างใบสั่งซื้อ |
| `purchase-orders:approve` | อนุมัติใบสั่งซื้อ |
| `dashboard:read` | อ่าน Dashboard |

## Database Tables

- `products` - ข้อมูลหลักสินค้า/ยา
- `stock_batches` - การ์ดยา (รุ่นยา)
- `stock_transactions` - ประวัติการเคลื่อนไหวสต็อก
- `stock_adjustments` - Audit log การปรับปรุงสต็อก
- `purchase_orders` - ใบสั่งซื้อ
- `purchase_order_items` - รายการในใบสั่งซื้อ
- `purchase_order_approvals` - ประวัติการอนุมัติ
- `users` - ข้อมูลผู้ใช้งาน

## FEFO Logic

ระบบใช้หลักการ FEFO (First Expiry First Out) ในการตัดสต็อก:
1. จัดลำดับตามวันหมดอายุ (ใกล้หมดอายุก่อน)
2. หากวันหมดอายุเท่ากัน จัดลำดับตามวันรับเข้า
3. ตัดจาก batch ที่ใกล้หมดอายุที่สุดก่อน