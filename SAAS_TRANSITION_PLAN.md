# SaaS Transition Plan: Inventory & Procurement System

**Target:** 80+ healthcare facilities (multi-tenant SaaS)  
**Orchestrator:** OpenClaw Executive Agent  
**Timeline:** Phased rollout  
**Status:** Planning Phase

---

## 🎯 Objectives

1. **Multi-tenant Architecture** - Each facility has isolated data with tenant_id
2. **Executive Dashboard** - Aggregated view across all 80 facilities
3. **Facility Dashboard** - Each facility sees only their own data
4. **Automated Reporting** - Periodic reports without manual triggers
5. **Agent Orchestration** - Multiple subagents handling different domains
6. **Scalable Deployment** - Handle 80+ facilities with growth to 200+

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    OpenClaw Executive Orchestrator              │
│  (Main Session: saas-orchestrator)                              │
│  - Coordinates all subagents                                    │
│  - Aggregates reports                                           │
│  - Manages cron schedules                                       │
│  - Handles escalations                                          │
└─────────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  Database Agent  │ │  Backend Agent   │ │  Frontend Agent  │
│  (subagent)      │ │  (subagent)      │ │  (subagent)      │
│  - Schema design │ │  - API updates   │ │  - UI updates    │
│  - Migration     │ │  - Tenant auth   │ │  - Dashboards    │
│  - Backups       │ │  - Rate limiting │ │  - Reports       │
└──────────────────┘ └──────────────────┘ └──────────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│   DevOps Agent   │ │   Security Agent │ │   Docs Agent     │
│   (subagent)     │ │   (subagent)     │ │   (subagent)     │
│   - Deployment   │ │   - Audit        │ │   - User guides  │
│   - Monitoring   │ │   - Compliance   │ │   - API docs     │
│   - Scaling      │ │   - Encryption   │ │   - Training     │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

---

## 📊 Multi-Tenant Database Design

### Strategy: Row-Level Isolation (Single Database, tenant_id)

**Pros:** Cost-effective, easier maintenance, unified backups  
**Cons:** Need strict query filtering, careful with indexes

### Schema Changes

```sql
-- Add tenants table
CREATE TABLE tenants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_code VARCHAR(50) NOT NULL UNIQUE,
  tenant_name VARCHAR(255) NOT NULL,
  tenant_type ENUM('hospital', 'clinic', 'pharmacy', 'health_center') DEFAULT 'hospital',
  status ENUM('active', 'suspended', 'trial', 'cancelled') DEFAULT 'trial',
  config JSON,
  max_users INT DEFAULT 10,
  max_products INT DEFAULT 5000,
  subscription_plan ENUM('basic', 'professional', 'enterprise') DEFAULT 'basic',
  trial_ends_at DATE,
  subscription_starts_at DATE,
  subscription_ends_at DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_code (tenant_code),
  INDEX idx_status (status)
);

-- Add tenant_id to all existing tables
ALTER TABLE products ADD COLUMN tenant_id INT NOT NULL AFTER id;
ALTER TABLE invp_stock_lots ADD COLUMN tenant_id INT NOT NULL AFTER id;
ALTER TABLE invp_stock_movements ADD COLUMN tenant_id INT NOT NULL AFTER id;
ALTER TABLE invp_stock_adjustments ADD COLUMN tenant_id INT NOT NULL AFTER id;
ALTER TABLE invp_goods_receipts ADD COLUMN tenant_id INT NOT NULL AFTER id;
ALTER TABLE invp_goods_receipt_items ADD COLUMN tenant_id INT NOT NULL AFTER id;
ALTER TABLE purchase_orders ADD COLUMN tenant_id INT NOT NULL AFTER id;
ALTER TABLE purchase_order_items ADD COLUMN tenant_id INT NOT NULL AFTER id;
ALTER TABLE users ADD COLUMN tenant_id INT NOT NULL AFTER id;

-- Add composite indexes for tenant-scoped queries
CREATE INDEX idx_products_tenant ON products(tenant_id, is_active);
CREATE INDEX idx_stock_lots_tenant ON invp_stock_lots(tenant_id, product_code);
CREATE INDEX idx_stock_movements_tenant ON invp_stock_movements(tenant_id, product_code);
CREATE INDEX idx_po_tenant ON purchase_orders(tenant_id, status);

-- Add foreign keys
ALTER TABLE products ADD CONSTRAINT fk_products_tenant 
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
-- (Repeat for all tables with tenant_id)
```

### Executive Aggregation Views

```sql
-- Cross-tenant executive view (admin only)
CREATE OR REPLACE VIEW v_executive_summary AS
SELECT 
  t.id AS tenant_id,
  t.tenant_code,
  t.tenant_name,
  t.tenant_type,
  t.status,
  COUNT(DISTINCT p.id) AS total_products,
  SUM(COALESCE(lb.quantity, 0)) AS total_stock_items,
  SUM(COALESCE(lb.quantity, 0) * p.unit_cost) AS total_stock_value,
  (SELECT COUNT(*) FROM purchase_orders po WHERE po.tenant_id = t.id AND po.status = 'pending') AS pending_pos,
  (SELECT COUNT(*) FROM invp_stock_lots l WHERE l.tenant_id = t.id AND l.expiry_date < CURDATE() + INTERVAL 7 DAY AND l.quantity > 0) AS expiring_soon,
  (SELECT COUNT(*) FROM invp_stock_lots l WHERE l.tenant_id = t.id AND l.expiry_date < CURDATE() AND l.quantity > 0) AS expired_items
FROM tenants t
LEFT JOIN products p ON p.tenant_id = t.id AND p.is_active = TRUE
LEFT JOIN (
  SELECT tenant_id, product_id, SUM(quantity) AS quantity
  FROM invp_stock_lots
  WHERE quantity > 0
  GROUP BY tenant_id, product_id
) lb ON lb.tenant_id = t.id
LEFT JOIN products p ON p.id = lb.product_id
WHERE t.status = 'active'
GROUP BY t.id;
```

---

## 🔐 Authentication & Authorization

### Tenant-Aware JWT

```javascript
// Token payload structure
{
  userId: 123,
  tenantId: 456,
  tenantCode: 'HOSP-001',
  role: 'manager',
  permissions: ['products:read', 'products:write', 'stock:read'],
  iat: 1234567890,
  exp: 1234567890 + 86400
}
```

### Middleware Updates

```javascript
// middleware/tenant-isolation.js
function requireTenant(req, res, next) {
  const userTenantId = req.user?.tenantId;
  const requestTenantId = req.params.tenantId || req.body.tenantId;

  // Admin can access any tenant
  if (req.user?.role === 'admin') {
    return next();
  }

  // Regular users must match their tenant
  if (requestTenantId && String(requestTenantId) !== String(userTenantId)) {
    return res.status(403).json({ message: 'Access denied to this tenant' });
  }

  // Inject tenant_id into query context
  req.tenantId = userTenantId;
  next();
}

// Apply to all API routes
app.use('/api', isAuthenticated, requireTenant);
```

### Query Scoping Helper

```javascript
// utils/tenant-scope.js
function tenantScope(query, tenantId, forceAll = false) {
  // Admin with forceAll can see all tenants
  if (forceAll) {
    return { query, params: [] };
  }

  // Add tenant_id filter
  if (query.includes('WHERE')) {
    return {
      query: query.replace('WHERE', 'WHERE tenant_id = ? AND '),
      params: [tenantId]
    };
  } else {
    return {
      query: query + ' WHERE tenant_id = ?',
      params: [tenantId]
    };
  }
}
```

---

## 📡 API Changes

### New Endpoints

```
Tenant Management (Admin only):
  POST   /api/admin/tenants           # Create tenant
  GET    /api/admin/tenants           # List all tenants
  GET    /api/admin/tenants/:id       # Get tenant details
  PUT    /api/admin/tenants/:id       # Update tenant
  DELETE /api/admin/tenants/:id       # Suspend/delete tenant
  GET    /api/admin/tenants/:id/usage # Usage stats

Executive Dashboard:
  GET    /api/executive/summary       # Aggregated stats all tenants
  GET    /api/executive/alerts        # Critical alerts across all
  GET    /api/executive/exports       # Bulk export all data

Tenant Switching (for users in multiple tenants):
  GET    /api/users/my-tenants        # List user's accessible tenants
  POST   /api/users/switch-tenant     # Switch active tenant context
```

### Existing Endpoint Updates

All existing endpoints must now:
1. Accept optional `tenant_id` in query/body
2. Scope queries by tenant_id automatically
3. Return 403 if user tries to access another tenant's data

---

## 🖥️ Frontend Changes

### Tenant Context Provider

```typescript
// contexts/TenantContext.tsx
interface TenantContext {
  currentTenant: Tenant | null;
  availableTenants: Tenant[];
  switchTenant: (tenantId: number) => Promise<void>;
  isExecutive: boolean;
}
```

### Executive Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│  EXECUTIVE DASHBOARD                              [Export] [🔔] │
├─────────────────────────────────────────────────────────────────┤
│  Total Facilities: 80  │  Active: 78  │  Trial: 2  │  Issues: 3 │
├─────────────────────────────────────────────────────────────────┤
│  📊 Stock Value (All Facilities)                                │
│  ฿ 245,000,000  (+12% vs last month)                           │
├─────────────────────────────────────────────────────────────────┤
│  ⚠️ Critical Alerts (Last 24h)                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ HOSP-023: 15 items expired                               │   │
│  │ CLINIC-007: Stock below minimum (23 products)            │   │
│  │ HOSP-045: PO pending approval > 7 days                   │   │
│  └──────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  🏥 Facilities by Region                                        │
│  [Map visualization with status indicators]                     │
├─────────────────────────────────────────────────────────────────┤
│  📈 Top 10 Facilities by Stock Value                            │
│  1. HOSP-001 (Bangkok)    ฿ 45,000,000  ████████████           │
│  2. HOSP-012 (Chiang Mai) ฿ 32,000,000  ██████████             │
│  ...                                                            │
└─────────────────────────────────────────────────────────────────┘
```

### Facility Dashboard (Tenant View)

```
┌─────────────────────────────────────────────────────────────────┐
│  HOSPITAL-001 Dashboard                         [Switch] [🔔]   │
├─────────────────────────────────────────────────────────────────┤
│  Products: 2,450  │  Stock Items: 15,230  │  Value: ฿ 45M      │
├─────────────────────────────────────────────────────────────────┤
│  [Standard dashboard - same as current single-tenant version]   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🤖 OpenClaw Agent Orchestration

### Executive Orchestrator (Main Session)

```
Session: saas-orchestrator
Role: Coordinate all subagents, aggregate reports, manage timelines
Responsibilities:
  - Spawn and monitor subagents
  - Collect progress from each subagent
  - Send periodic reports to user (every 4-6 hours)
  - Handle blockers and escalations
  - Track overall completion percentage
```

### Subagent Structure

| Agent | Session | Task | Duration |
|-------|---------|------|----------|
| Database Agent | `saas-db-architect` | Schema redesign, migration scripts, backup strategy | 2-3 days |
| Backend Agent | `saas-backend-dev` | API updates, tenant isolation, auth updates | 3-4 days |
| Frontend Agent | `saas-frontend-dev` | Tenant context, executive dashboard, facility views | 3-4 days |
| DevOps Agent | `saas-devops` | Deployment pipeline, monitoring, scaling config | 2-3 days |
| Security Agent | `saas-security` | Audit logging, compliance, penetration testing | 2 days |
| Docs Agent | `saas-docs` | User guides, API docs, training materials | 2 days |

### Communication Pattern

```
Executive Orchestrator
         │
    ┌────┴────┐
    │         │
    ▼         ▼
[Subagent] [Subagent]
    │         │
    └────┬────┘
         │
         ▼
   Progress Report
   (auto-sent to user)
```

---

## 📅 Automated Reporting Schedule

### Cron Jobs (via OpenClaw)

```javascript
// Every 4 hours: Progress report
{
  schedule: { kind: "every", everyMs: 4 * 60 * 60 * 1000 },
  payload: {
    kind: "agentTurn",
    message: "Collect progress from all subagents and send consolidated report to user"
  },
  delivery: { mode: "announce" }
}

// Daily at 18:00: Summary report
{
  schedule: { kind: "cron", expr: "0 18 * * *", tz: "Asia/Bangkok" },
  payload: {
    kind: "agentTurn",
    message: "Generate daily summary: completion %, blockers, next day plan"
  },
  delivery: { mode: "announce" }
}

// On completion: Final handoff
{
  schedule: { kind: "at", at: "<completion-date>" },
  payload: {
    kind: "agentTurn",
    message: "Prepare final handoff package: deployment guide, credentials, support contacts"
  },
  delivery: { mode: "announce" }
}
```

### Report Format

```markdown
## 🚀 SaaS Transition Progress Report
**Time:** 2026-03-29 18:00 (GMT+7)
**Overall Progress:** 35% complete

### ✅ Completed
- [x] Database schema design
- [x] Tenant model created
- [x] Migration scripts drafted

### 🚧 In Progress
- [~] Backend tenant isolation (60%)
- [~] Executive dashboard UI (40%)

### ⏸️ Blocked
- [!] Waiting for security review on JWT implementation

### 📋 Next 4 Hours
- Complete backend tenant scoping
- Finish executive dashboard wireframes
- Security agent to review auth flow

### 📊 Agent Status
| Agent | Status | Progress |
|-------|--------|----------|
| DB Agent | ✅ Done | 100% |
| Backend | 🚧 Working | 60% |
| Frontend | 🚧 Working | 40% |
| DevOps | ⏸️ Waiting | 0% |
| Security | 🚧 Reviewing | 25% |
| Docs | ⏸️ Waiting | 0% |
```

---

## 🚀 Deployment Strategy

### Phase 1: Development Environment
- Set up staging environment
- Deploy multi-tenant schema
- Test with 3-5 mock facilities

### Phase 2: Pilot (5 Facilities)
- Onboard 5 friendly facilities
- Monitor performance and issues
- Gather feedback

### Phase 3: Rollout (80 Facilities)
- Batch rollout: 10 facilities per week
- Dedicated support channel
- Daily health checks

### Phase 4: Optimization
- Performance tuning
- Feature enhancements
- Scale to 200+ capacity

---

## 🔒 Security Considerations

1. **Row-Level Security** - All queries must include tenant_id
2. **Audit Logging** - Track all cross-tenant access attempts
3. **Data Encryption** - Encrypt sensitive data at rest
4. **API Rate Limiting** - Per-tenant rate limits
5. **Backup Isolation** - Each tenant can request their own backup
6. **Compliance** - HIPAA/GDPR considerations for healthcare data

---

## 📊 Monitoring & Alerts

### Metrics to Track

```
Per-Tenant Metrics:
- API response time (p95)
- Error rate
- Active users
- Data storage used
- Monthly API calls

Executive Metrics:
- Total facilities online
- System-wide error rate
- Aggregate stock value
- Critical alerts count
- Tenant onboarding rate
```

### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| API p95 > | 500ms | 2000ms |
| Error rate > | 1% | 5% |
| Expired items > | 10 per facility | 50 per facility |
| Backup age > | 24 hours | 72 hours |

---

## 📝 Migration Checklist

- [ ] Create tenants table
- [ ] Add tenant_id to all tables
- [ ] Update all queries with tenant scoping
- [ ] Update authentication to include tenant context
- [ ] Create executive dashboard
- [ ] Create tenant switching UI
- [ ] Set up monitoring per tenant
- [ ] Create backup/restore per tenant
- [ ] Write migration scripts for existing data
- [ ] Test with 5 mock tenants
- [ ] Security audit
- [ ] Performance testing
- [ ] Documentation complete
- [ ] Training materials ready
- [ ] Support team trained

---

## 🎯 Success Criteria

1. ✅ All 80 facilities can log in and see only their data
2. ✅ Executive can view aggregated data across all facilities
3. ✅ No data leakage between tenants (verified by security audit)
4. ✅ System handles 1000+ concurrent users
5. ✅ API response time < 200ms for 95% of requests
6. ✅ Automated reports sent every 4 hours without manual trigger
7. ✅ Full deployment completed within 3 weeks

---

**Next Action:** Spawn subagents and begin execution. User will receive automated progress reports every 4 hours until completion.
