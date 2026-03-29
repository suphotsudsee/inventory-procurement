const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const authRouter = require('./routes/auth');
const productsRouter = require('./routes/products');
const stockRouter = require('./routes/stock');
const purchaseOrdersRouter = require('./routes/purchase-orders');
const dashboardRouter = require('./routes/dashboard');
const suppliersRouter = require('./routes/suppliers');
const approvalsRouter = require('./routes/approvals');
const reportsRouter = require('./routes/reports');
const usersRouter = require('./routes/users');
const { isAuthenticated } = require('./middleware/auth');
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

app.use('/api/auth', authRouter);
app.use('/api', isAuthenticated);

app.use('/api/products', productsRouter);
app.use('/api/stock', stockRouter);
app.use('/api/purchase-orders', purchaseOrdersRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/approvals', approvalsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/users', usersRouter);

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
