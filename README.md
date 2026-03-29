# 📦 Inventory & Procurement Management System

> ระบบบริหารจัดการคลังเวชภัณฑ์และการจัดซื้อจัดจ้าง

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://reactjs.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-orange.svg)](https://mysql.com/)

---

## 📋 ภาพรวมระบบ

ระบบจัดการคลังสินค้าและการจัดซื้อจัดจ้าง ออกแบบมาสำหรับโรงพยาบาลและหน่วยงานที่ต้องจัดการเวชภัณฑ์ ยา และเวชภัณฑ์อุปกรณ์การแพทย์

### ✨ ฟีเจอร์หลัก

| ฟีเจอร์ | รายละเอียด |
|---------|------------|
| 📊 **Dashboard** | ภาพรวมระบบ แจ้งเตือนสต็อกต่ำ ยาใกล้หมดอายุ |
| 📦 **จัดการสต็อก** | รับเข้า ตัดสต็อก (FEFO) ปรับสต็อก ตรวจนับ |
| 🛒 **จัดซื้อจัดจ้าง** | สร้างใบสั่งซื้อ (PO) อนุมัติ/ปฏิเสธ ติดตามสถานะ |
| 📈 **รายงาน** | มูลค่าสต็อก ยาหมดอายุ ประเมินซัพพลายเออร์ |
| 🔐 **สิทธิ์การใช้งาน** | Admin, Manager, Staff, Viewer |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │Dashboard │  │  Stock   │  │Procure-  │  │ Reports  │        │
│  │  Page    │  │Management│  │  ment    │  │  Page    │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
│       │             │              │              │               │
│       └─────────────┴──────────────┴──────────────┘               │
│                           │                                     │
│                    TanStack Query                               │
│                           │                                     │
│                      Axios API                                  │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (Node.js/Express)                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    API Routes                             │   │
│  │  /api/products  /api/stock  /api/purchase-orders         │   │
│  │  /api/dashboard  /api/users                              │   │
│  └─────────────────────────┬────────────────────────────────┘   │
│                            │                                    │
│  ┌─────────────────────────┴────────────────────────────────┐   │
│  │                  Middleware Layer                         │   │
│  │         Authentication │ Authorization │ Validation       │   │
│  └─────────────────────────┬────────────────────────────────┘   │
│                            │                                    │
│                     MySQL2 Pool                                 │
└────────────────────────────┼────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MySQL Database                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐         │
│  │  products  │  │stock_batches│  │ purchase_orders   │         │
│  ├────────────┤  ├────────────┤  ├───────────────────┤         │
│  │stock_trans │  │  users     │  │ purchase_order_   │         │
│  │  actions   │  │            │  │      items        │         │
│  └────────────┘  └────────────┘  └───────────────────┘         │
│                                                                  │
│  Views: v_product_stock_status, v_expiring_stock                │
│  Procedures: sp_get_low_stock, sp_deduct_stock_fefo            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 การติดตั้ง

### ข้อกำหนดเบื้องต้น

- Node.js 18.x หรือใหม่กว่า
- MySQL 8.0 หรือใหม่กว่า
- npm หรือ yarn

### 1. Clone Repository

```bash
git clone <repository-url>
cd inventory-procurement
```

### 2. ตั้งค่า Database

```bash
# สร้าง database
mysql -u root -p < scripts/create-inventory-db.sql

# รัน schema
mysql -u root -p inventory_db < backend/database/schema.sql
```

### 3. ตั้งค่า Backend

```bash
cd backend

# ติดตั้ง dependencies
npm install

# สร้างไฟล์ .env
cp .env.example .env
# แก้ไขค่าใน .env ให้ตรงกับ database ของคุณ
```

ไฟล์ `.env`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=inventory_db
PORT=3001
NODE_ENV=development
JWT_SECRET=your_jwt_secret
```

### 4. ตั้งค่า Frontend

```bash
cd frontend

# ติดตั้ง dependencies
npm install

# สร้างไฟล์ .env จากตัวอย่าง
copy .env.example .env
```

ไฟล์ `frontend/.env.example`

```env
VITE_API_PROXY_TARGET=http://localhost:3001
```

---

## 🏃 การรันระบบ

### Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
# Server จะรันที่ http://localhost:3001
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# Frontend จะรันที่ http://localhost:5173
# Proxy /api -> http://localhost:3001
```

### Production Mode

```bash
# Build frontend
cd frontend
npm run build

# Serve ด้วย nginx หรือ static server
# Backend ใช้ PM2
cd backend
npm run start
```

---

## 📁 โครงสร้างโปรเจค

```
inventory-procurement/
├── backend/                    # Node.js API Server
│   ├── database/
│   │   └── schema.sql          # Database schema
│   ├── db/
│   │   ├── connection.js       # DB connection
│   │   └── pool.js             # Connection pool
│   ├── middleware/
│   │   └── auth.js             # Authentication middleware
│   ├── routes/
│   │   ├── products.js         # Products CRUD
│   │   ├── stock.js            # Stock operations
│   │   ├── purchase-orders.js  # PO workflow
│   │   └── dashboard.js        # Dashboard data
│   ├── server.js               # Entry point
│   └── package.json
│
├── frontend/                   # React Web UI
│   ├── src/
│   │   ├── components/         # Reusable components
│   │   ├── pages/              # Page components
│   │   ├── services/           # API services
│   │   └── App.tsx             # Main app
│   ├── index.html
│   └── package.json
│
├── docs/                       # Documentation
│   ├── USER_MANUAL.md          # User guide
│   ├── API_DOCUMENTATION.md    # API docs
│   ├── QUICK_START.md          # Quick start guide
│   └── FEATURES.md             # Feature list
│
├── scripts/                    # Utility scripts
│   └── create-inventory-db.sql
│
└── README.md                   # This file
```

---

## 🔌 API Endpoints

### Products API
| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| GET | `/api/products` | ดึงรายการสินค้าทั้งหมด |
| GET | `/api/products/:id` | ดึงข้อมูลสินค้าตาม ID |
| POST | `/api/products` | สร้างสินค้าใหม่ |
| PUT | `/api/products/:id` | แก้ไขข้อมูลสินค้า |
| DELETE | `/api/products/:id` | ลบสินค้า (soft delete) |

### Stock API
| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| POST | `/api/stock/receipt` | รับเข้าสินค้า |
| POST | `/api/stock/deduct` | ตัดสต็อก (FEFO) |
| POST | `/api/stock/adjust` | ปรับสต็อก |
| GET | `/api/stock/levels` | ดูระดับสต็อก |
| GET | `/api/stock/expiry-alerts` | ดูการแจ้งเตือนหมดอายุ |

### Purchase Orders API
| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| GET | `/api/purchase-orders` | ดึงรายการ PO ทั้งหมด |
| GET | `/api/purchase-orders/pending` | ดึง PO ที่รออนุมัติ |
| POST | `/api/purchase-orders` | สร้าง PO ใหม่ |
| POST | `/api/purchase-orders/:id/approve` | อนุมัติ PO |
| POST | `/api/purchase-orders/:id/reject` | ปฏิเสธ PO |

### Dashboard API
| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| GET | `/api/dashboard/summary` | สรุปภาพรวมระบบ |
| GET | `/api/dashboard/expiry` | ข้อมูลหมดอายุ |
| GET | `/api/dashboard/low-stock` | รายการสต็อกต่ำ |
| GET | `/api/dashboard/movement-history` | ประวัติการเคลื่อนไหว |

📖 รายละเอียดเพิ่มเติม: [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md)

---

## 🔐 Authentication & Authorization

ระบบใช้ JWT-based authentication กับ role-based access control:

| Role | สิทธิ์ |
|------|-------|
| `admin` | Full access ทุกฟีเจอร์ |
| `manager` | จัดการสต็อก, อนุมัติ PO, ดูรายงาน |
| `staff` | รับเข้า/ตัดสต็อก, สร้าง PO |
| `viewer` | ดูข้อมูลอย่างเดียว |

---

## 📖 เอกสารเพิ่มเติม

- 📘 [คู่มือผู้ใช้ (User Manual)](docs/USER_MANUAL.md)
- 🔌 [API Documentation](docs/API_DOCUMENTATION.md)
- 🚀 [Quick Start Guide](docs/QUICK_START.md)
- ✨ [Features & Roadmap](docs/FEATURES.md)

---

## 🛠️ เทคโนโลยีที่ใช้

### Frontend
- **React 19** - UI library
- **Vite** - Build tool
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Styling
- **TanStack Query** - Data fetching

### Backend
- **Node.js** - Runtime
- **Express** - Web framework
- **MySQL2** - Database driver

### Database
- **MySQL 8.0** - Primary database

---

## 📝 License

MIT License

---

## 👨‍💻 Development Team

พัฒนาโดยทีม OpenClaw Agent Team

---

*Last updated: March 2026*
