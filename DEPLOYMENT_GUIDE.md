# SaaS Multi-Tenant Deployment Guide

**Version:** 1.0  
**Last Updated:** 2026-03-29  
**Status:** Ready for Staging Deployment

---

## 🚀 Quick Start (Development)

### Prerequisites

- Node.js 18+
- MySQL 8.0+
- Git

### 1. Clone & Install

```bash
cd C:\fullstack\inventory-procurement

# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Database Setup

```bash
# Create database
mysql -u root -p -e "CREATE DATABASE inventory_saas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Run migration
cd backend
mysql -u root -p inventory_saas < database/migrations/001_add_multi_tenancy.sql

# Verify
mysql -u root -p inventory_saas -e "SELECT * FROM tenants;"
```

### 3. Configure Environment

**Backend (.env):**
```env
PORT=3001
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=inventory_saas

JWT_SECRET=your-super-secret-jwt-key-change-in-production
```

**Frontend (.env):**
```env
VITE_API_URL=http://localhost:3001
```

### 4. Start Development

```bash
# Terminal 1 - Backend
cd backend
npm run dev
# Server: http://localhost:3001

# Terminal 2 - Frontend
cd frontend
npm run dev
# App: http://localhost:5173
```

### 5. Create First Tenant

```bash
# Default tenant created by migration: DEFAULT-001 (tenant_id=1)

# Create additional tenant via API
curl -X POST http://localhost:3001/api/admin/tenants \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_code": "HOSP-001",
    "tenant_name": "Hospital 001",
    "tenant_type": "hospital",
    "subscription_plan": "professional",
    "max_users": 50,
    "max_products": 20000,
    "trial_days": 30
  }'
```

### 6. Login

- **URL:** http://localhost:5173
- **Username:** admin
- **Password:** admin123

---

## 🐳 Docker Deployment (Production)

### Dockerfile - Backend

```dockerfile
# backend/Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3001

CMD ["node", "server.js"]
```

### Dockerfile - Frontend

```dockerfile
# frontend/Dockerfile
FROM node:18-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      MYSQL_DATABASE: inventory_saas
    volumes:
      - mysql_data:/var/lib/mysql
      - ./backend/database/migrations:/docker-entrypoint-initdb.d
    ports:
      - "3306:3306"
    networks:
      - saas-network

  backend:
    build: ./backend
    environment:
      DB_HOST: mysql
      DB_PORT: 3306
      DB_USER: root
      DB_PASSWORD: ${DB_ROOT_PASSWORD}
      DB_NAME: inventory_saas
      JWT_SECRET: ${JWT_SECRET}
      PORT: 3001
    depends_on:
      - mysql
    ports:
      - "3001:3001"
    networks:
      - saas-network

  frontend:
    build: ./frontend
    depends_on:
      - backend
    ports:
      - "80:80"
    networks:
      - saas-network

volumes:
  mysql_data:

networks:
  saas-network:
    driver: bridge
```

### nginx.conf

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://backend:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### Deploy with Docker

```bash
# Build and start
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Restart
docker-compose restart
```

---

## ☁️ Cloud Deployment (AWS/GCP/Azure)

### Architecture

```
┌─────────────────┐
│   Load Balancer │
│   (ALB/NLB)     │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼────┐
│ App 1 │ │ App 2 │  (Auto-scaling group)
└───┬───┘ └──┬────┘
    │         │
    └────┬────┘
         │
┌────────▼────────┐
│   RDS MySQL     │
│   (Multi-AZ)    │
└─────────────────┘
```

### AWS Deployment Steps

#### 1. RDS MySQL

```bash
# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier inventory-saas-db \
  --db-instance-class db.t3.medium \
  --engine mysql \
  --engine-version 8.0 \
  --master-username admin \
  --master-user-password YOUR_PASSWORD \
  --allocated-storage 100 \
  --storage-type gp2 \
  --multi-az \
  --backup-retention-period 7
```

#### 2. ECR Repository

```bash
# Create ECR repos
aws ecr create-repository --repository-name inventory-saas-backend
aws ecr create-repository --repository-name inventory-saas-frontend

# Login to ECR
aws ecr get-login-password --region ap-southeast-1 | \
  docker login --username AWS --password-stdin YOUR_ACCOUNT.dkr.ecr.ap-southeast-1.amazonaws.com
```

#### 3. Build & Push Images

```bash
# Backend
docker build -t inventory-saas-backend ./backend
docker tag inventory-saas-backend:latest YOUR_ACCOUNT.dkr.ecr.ap-southeast-1.amazonaws.com/inventory-saas-backend:latest
docker push YOUR_ACCOUNT.dkr.ecr.ap-southeast-1.amazonaws.com/inventory-saas-backend:latest

# Frontend
docker build -t inventory-saas-frontend ./frontend
docker tag inventory-saas-frontend:latest YOUR_ACCOUNT.dkr.ecr.ap-southeast-1.amazonaws.com/inventory-saas-frontend:latest
docker push YOUR_ACCOUNT.dkr.ecr.ap-southeast-1.amazonaws.com/inventory-saas-frontend:latest
```

#### 4. ECS Cluster

```bash
# Create cluster
aws ecs create-cluster --cluster-name inventory-saas

# Create task definitions (backend-task.json, frontend-task.json)
# Create services
aws ecs create-service \
  --cluster inventory-saas \
  --service-name backend-service \
  --task-definition backend-task:1 \
  --desired-count 2 \
  --launch-type FARGATE
```

#### 5. Application Load Balancer

```bash
# Create ALB
aws elbv2 create-load-balancer \
  --name inventory-saas-alb \
  --subnets subnet-xxx subnet-yyy \
  --security-groups sg-xxx \
  --type application
```

---

## 🔧 CI/CD Pipeline (GitHub Actions)

### .github/workflows/deploy.yml

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd backend && npm ci && npm test
      - run: cd frontend && npm ci && npm test

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Login to ECR
        uses: aws-actions/amazon-ecr-login@v1
      - name: Build & Push Backend
        run: |
          docker build -t ${{ secrets.ECR_REPO }}/backend:latest ./backend
          docker push ${{ secrets.ECR_REPO }}/backend:latest
      - name: Build & Push Frontend
        run: |
          docker build -t ${{ secrets.ECR_REPO }}/frontend:latest ./frontend
          docker push ${{ secrets.ECR_REPO }}/frontend:latest

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-southeast-1
      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster inventory-saas \
            --service backend-service \
            --force-new-deployment
```

---

## 📊 Monitoring Setup

### Prometheus Metrics

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'backend'
    static_configs:
      - targets: ['backend:3001']
    metrics_path: '/metrics'
```

### Grafana Dashboard

Import dashboard ID: `10823` (Node.js Application)

### Alert Rules

```yaml
# alerting.yml
groups:
  - name: saas-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        annotations:
          summary: High error rate detected

      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 0.5
        for: 5m
        annotations:
          summary: High response time detected
```

---

## 🔒 Security Hardening

### Security Headers (nginx)

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;
```

### Rate Limiting (backend middleware)

```javascript
// middleware/rate-limit.js
const rateLimit = require('express-rate-limit');

const tenantLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  keyGenerator: (req) => req.tenantId || req.ip,
  message: 'Too many requests from this tenant',
});

app.use('/api', tenantLimiter);
```

### Environment Variables (Production)

```bash
# .env.production
NODE_ENV=production
PORT=3001

DB_HOST=your-rds-endpoint.amazonaws.com
DB_PORT=3306
DB_USER=inventory_app
DB_PASSWORD=STRONG_PASSWORD_HERE
DB_NAME=inventory_saas

JWT_SECRET=USE_STRONG_RANDOM_STRING_HERE_MIN_32_CHARS

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

---

## 🧪 Testing Checklist

### Pre-Deployment

- [ ] Database migration tested on staging
- [ ] All API endpoints tested with Postman
- [ ] Tenant isolation verified (cross-tenant access denied)
- [ ] Executive dashboard working for admin users
- [ ] Tenant switching working
- [ ] Audit logging capturing events
- [ ] Load testing passed (100 concurrent users)

### Post-Deployment

- [ ] Health check endpoint responding
- [ ] All tenants can access their data
- [ ] Admin can view all tenants
- [ ] Monitoring dashboards showing data
- [ ] Alerts configured and tested
- [ ] Backup strategy verified
- [ ] Rollback procedure tested

---

## 📞 Support & Maintenance

### Daily Tasks

- [ ] Check monitoring dashboards
- [ ] Review error logs
- [ ] Check backup status
- [ ] Review tenant usage metrics

### Weekly Tasks

- [ ] Security updates
- [ ] Performance review
- [ ] Capacity planning
- [ ] Tenant onboarding review

### Monthly Tasks

- [ ] Full security audit
- [ ] Disaster recovery test
- [ ] Capacity review
- [ ] Billing reconciliation

---

## 🚨 Incident Response

### Critical Issues (Response Time: 15 min)

- System outage
- Data breach
- Data loss

### High Priority (Response Time: 1 hour)

- Performance degradation
- Tenant isolation failure
- Security vulnerability

### Medium Priority (Response Time: 4 hours)

- Bug affecting multiple tenants
- Feature malfunction

### Low Priority (Response Time: 24 hours)

- UI/UX issues
- Feature requests
- Documentation updates

---

**Deployment Ready:** ✅ Yes  
**Last Tested:** 2026-03-29  
**Next Review:** 2026-04-05
