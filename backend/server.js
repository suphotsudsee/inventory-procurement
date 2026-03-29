const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const authRouter = require('./routes/auth');
const productsRouter = require('./routes/products');
const stockRouter = require('./routes/stock');
const purchaseOrdersRouter = require('./routes/purchase-orders');
const dashboardRouter = require('./routes/dashboard');
const suppliersRouter = require('./routes/suppliers');
const approvalsRouter = require('./routes/approvals');
const reportsRouter = require('./routes/reports');
const usersRouter = require('./routes/users');
const adminRouter = require('./routes/admin');
const executiveRouter = require('./routes/executive');
const { isAuthenticated } = require('./middleware/auth');
const { requireTenant, requireActiveTenant } = require('./middleware/tenant-isolation');
const { tenantLimiter, loginLimiter, exportLimiter } = require('./middleware/rate-limit');
const { closePool } = require('./db/pool');
const { ensureAppSchema } = require('./db/app');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Rate limiting on auth endpoints
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRouter);
app.use('/api/dashboard', tenantLimiter, isAuthenticated, dashboardRouter);

// Apply rate limiting to all API routes
app.use('/api', tenantLimiter);
app.use('/api', isAuthenticated, requireTenant, requireActiveTenant);

// Tenant-scoped routes
app.use('/api/products', productsRouter);
app.use('/api/stock', stockRouter);
app.use('/api/purchase-orders', purchaseOrdersRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/approvals', approvalsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/users', usersRouter);

// Admin routes (tenant management, requires admin role)
app.use('/api/admin', adminRouter);

// Executive routes (cross-tenant aggregation, requires admin/executive role)
app.use('/api/executive', executiveRouter);

app.get('/api', (req, res) => {
  res.json({
    name: 'Inventory & Procurement API',
    version: '2.0.0',
    endpoints: {
      products: ['/api/products', '/api/products/:id'],
      stock: ['/api/stock/items', '/api/stock/goods-receipt', '/api/stock/adjustment', '/api/stock/deduct', '/api/stock/scan/:barcode'],
      procurement: ['/api/suppliers', '/api/purchase-orders', '/api/purchase-orders/from-low-stock', '/api/approvals/pending'],
      reports: ['/api/reports/inventory-valuation', '/api/reports/stock-movements', '/api/reports/expiry', '/api/reports/supplier-performance'],
    },
  });
});

app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
});

process.on('SIGINT', async () => {
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closePool();
  process.exit(0);
});

ensureAppSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Inventory & Procurement backend listening on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize app schema:', error);
    process.exit(1);
  });

module.exports = app;
