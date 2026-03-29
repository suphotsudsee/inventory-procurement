# Inventory & Procurement Backend API

Backend API ของระบบคลังยาและจัดซื้อ

## Tech Stack

- `Node.js`
- `Express`
- `MySQL2`
- `dotenv`

## Installation

```bash
cd C:\fullstack\inventory-procurement\backend
npm install
```

## Configuration

ระบบปัจจุบันอ่านค่า environment จาก [backend/.env](c:/fullstack/inventory-procurement/backend/.env)

ตัวอย่าง:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=inventory_db
PORT=3001
NODE_ENV=development
JWT_SECRET=change-me
```

## Database

ฐานข้อมูลหลักที่ backend ใช้งานจริงตอนนี้คือ `inventory_db`

ถ้าใช้ MySQL บนเครื่อง:

```bash
mysql -h localhost -P 3306 -u root -p inventory_db < C:/fullstack/inventory-procurement/inventory_db.sql
```

ถ้าใช้ Docker Compose ของโปรเจกต์นี้:

- MySQL ภายใน container ใช้พอร์ต `3306`
- MySQL ที่ expose ออก host ใช้พอร์ต `3307` โดย default

ตัวอย่าง:

```bash
mysql -h localhost -P 3307 -u root -p inventory_saas
```

## Multi-Tenancy Bootstrap

ไฟล์ migration [001_add_multi_tenancy.sql](c:/fullstack/inventory-procurement/backend/database/migrations/001_add_multi_tenancy.sql)
ตอนนี้เป็น `safe bootstrap` สำหรับสร้างตาราง tenant พื้นฐาน โดยไม่ไปแตะตารางหลักของ inventory ตอนฐานยังว่าง

ถ้าจะรันเองบน MySQL ใน Docker:

```bash
docker exec -i saas-mysql mysql -u root -p inventory_saas < backend/database/migrations/001_add_multi_tenancy.sql
```

หรือเข้า shell ก่อน:

```bash
docker exec -it saas-mysql mysql -u root -p
```

แล้วค่อย:

```sql
USE inventory_saas;
SOURCE /docker-entrypoint-initdb.d/001_add_multi_tenancy.sql;
```

## Running

```bash
npm run dev
```

หรือ production:

```bash
npm start
```

Backend จะรันที่:

- `http://localhost:3001` เมื่อใช้ `backend/.env`

## Main Endpoints

### Auth

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Products

- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/products`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`
- `GET /api/products/categories/list`
- `GET /api/products/drugtypes/list`

### Stock

- `GET /api/stock/items`
- `GET /api/stock/goods-receipts`
- `GET /api/stock/adjustments`
- `GET /api/stock/scan/:barcode`
- `POST /api/stock/goods-receipt`
- `POST /api/stock/adjustment`
- `POST /api/stock/deduct`
- `POST /api/stock/import/drugstorereceivedetail`
- `POST /api/stock/import/drugstorereceive-bundle`

### Dashboard

- `GET /api/dashboard/summary`
- `GET /api/dashboard/expiry-alerts`
- `GET /api/dashboard/low-stock`

### Procurement

- `GET /api/suppliers`
- `GET /api/suppliers/performance`
- `GET /api/purchase-orders`
- `POST /api/purchase-orders`
- `POST /api/approvals/approve/:poId`
- `POST /api/approvals/reject/:poId`

### Reports

- `GET /api/reports/inventory-valuation`
- `GET /api/reports/stock-movements`
- `GET /api/reports/expiry`
- `GET /api/reports/supplier-performance`

## Current Schema Notes

ระบบ runtime ปัจจุบันอิงตารางหลักใน `inventory_db` เช่น:

- `products`
- `categories`
- `drugtypes`
- `stock_levels`
- `suppliers`
- `purchase_orders`
- `purchase_order_items`
- `invp_stock_lots`
- `invp_stock_movements`
- `invp_stock_adjustments`
- `invp_goods_receipts`
- `invp_goods_receipt_items`
- `users`

หมายเหตุ:

- บาง route ฝั่ง SaaS/multi-tenant ยังอยู่ใน repo แต่ฐาน `inventory_db` จริงไม่ได้มี `tenant_id` ในทุกตาราง
- ถ้าจะเปิดใช้ multi-tenant เต็มรูปแบบ ต้องทำ schema migration ให้ครบก่อน
