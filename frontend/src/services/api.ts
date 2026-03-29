import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth token and tenant context
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  const tenantId = localStorage.getItem('tenant_id');
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Include tenant ID in headers for multi-tenant support
  if (tenantId) {
    config.headers['X-Tenant-ID'] = tenantId;
  }
  
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('tenant_id');
      window.location.hash = '#login';
    }
    return Promise.reject(error);
  }
);

// ========== Types ==========
export interface DashboardSummary {
  totalStockValue: number;
  expiringSoon: number;
  lowStockCount: number;
  pendingApprovals: number;
  recentTransactions: number;
  totalProducts: number;
  productsInStock: number;
  totalSuppliers: number;
}

export interface ExpiryAlert {
  id: string;
  productId: string;
  productName: string;
  lotNumber: string;
  expiryDate: string;
  quantity: number;
  unit: string;
  status: 'critical' | 'warning' | 'normal';
  daysUntilExpiry: number;
  location?: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  genericName?: string;
  drugtypeCode?: string;
  drugtypeName?: string;
  drugtype?: string;
  category: string;
  unit: string;
  minLevel: number;
  maxLevel: number;
  currentStock: number;
  reorderPoint: number;
  unitCost: number;
  supplier?: Supplier;
  supplierId?: string;
  barcode?: string;
  location?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DrugtypeOption {
  code: string;
  name: string;
}

export interface StockItem {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  lotNumber: string;
  expiryDate: string;
  quantity: number;
  unit: string;
  location: string;
  status: 'available' | 'reserved' | 'expired' | 'damaged';
  receivedDate: string;
  unitCost: number;
}

export interface GoodsReceiptItem {
  productId: string;
  productName: string;
  lotNumber: string;
  expiryDate: string;
  quantity: number;
  unitCost: number;
  location: string;
}

export interface GoodsReceipt {
  id?: string;
  poNumber?: string;
  supplierId: string;
  supplierName: string;
  receivedDate: string;
  receivedBy: string;
  invoiceNumber?: string;
  items: GoodsReceiptItem[];
  notes?: string;
}

export interface StockAdjustment {
  id?: string;
  productId: string;
  productName: string;
  lotNumber: string;
  previousQty: number;
  newQty: number;
  reason: 'damage' | 'expired' | 'lost' | 'found' | 'count_adjustment' | 'other';
  reasonDetail: string;
  adjustmentDate: string;
  adjustedBy: string;
  notes?: string;
}

export interface StockDeduction {
  productId: string;
  lotNumber: string;
  quantity: number;
  referenceType: 'dispensing' | 'adjustment' | 'transfer';
  referenceId?: string;
  notes?: string;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  taxId?: string;
  paymentTerms: string;
  rating: number;
  active: boolean;
  createdAt: string;
}

export interface PurchaseOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
}

export interface PurchaseOrder {
  id?: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  orderDate: string;
  expectedDate: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'ordered' | 'partial' | 'received' | 'cancelled';
  items: PurchaseOrderItem[];
  totalAmount: number;
  notes?: string;
  approvedBy?: string;
  approvedDate?: string;
  createdAt: string;
}

export interface ApprovalRequest {
  id: string;
  poId: string;
  poNumber: string;
  requestedBy: string;
  requestedDate: string;
  status: 'pending' | 'approved' | 'rejected';
  totalAmount: number;
  itemCount: number;
  supplierName: string;
  approvedBy?: string;
  approvedDate?: string;
  rejectionReason?: string;
}

export interface SupplierPerformance {
  supplierId: string;
  supplierName: string;
  totalOrders: number;
  onTimeDelivery: number;
  qualityScore: number;
  avgLeadTime: number;
  totalSpend: number;
  lastOrderDate: string;
  issues: number;
}

export interface UserAccount {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: 'admin' | 'manager' | 'staff' | 'viewer';
  permissions: string[];
  active: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoleDefinition {
  role: 'admin' | 'manager' | 'staff' | 'viewer';
  permissions: string[];
}

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: 'admin' | 'manager' | 'staff' | 'viewer';
  permissions: string[];
  active: boolean;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface ReportFilter {
  startDate?: string;
  endDate?: string;
  supplierId?: string;
  productId?: string;
  category?: string;
}

export interface InventoryValuation {
  category: string;
  itemCount: number;
  totalQuantity: number;
  totalValue: number;
  percentage: number;
}

export interface StockMovement {
  id: string;
  date: string;
  productId: string;
  productName: string;
  lotNumber?: string;
  movementType: 'receipt' | 'dispensing' | 'adjustment' | 'transfer_in' | 'transfer_out';
  quantity: number;
  unit: string;
  reference?: string;
  performedBy: string;
  notes?: string;
}

export interface DrugstoreReceiveImportSummary {
  sourceRef?: string;
  receiveSourceRef?: string;
  detailSourceRef?: string;
  rawRows?: number;
  rawReceiveRows?: number;
  rawDetailRows?: number;
  aggregatedRows?: number;
  aggregatedDetailRows?: number;
  importedRows?: number;
  importedReceipts?: number;
  importedReceiptItems?: number;
  skippedRows: number;
  importedLots: number;
  importedQuantity: number;
  importedValue: number;
  skippedSample: string[];
}

// ========== Dashboard API ==========
export const dashboardApi = {
  getSummary: () => api.get<DashboardSummary>('/dashboard/summary'),
  getExpiryAlerts: (days?: number) => api.get<ExpiryAlert[]>('/dashboard/expiry-alerts', { params: { days } }),
  getLowStock: () => api.get<Product[]>('/dashboard/low-stock'),
};

// ========== Stock API ==========
export const stockApi = {
  // Products
  getProducts: (params?: { search?: string; category?: string; drugtype?: string; lowStock?: boolean; inStock?: boolean }) => 
    api.get<Product[]>('/products', { params }),
  getProductsPage: (params?: { search?: string; category?: string; drugtype?: string; lowStock?: boolean; inStock?: boolean; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<Product>>('/products', { params }),
  getProductCategories: () => api.get<string[]>('/products/categories/list'),
  getProductDrugtypes: () => api.get<DrugtypeOption[]>('/products/drugtypes/list'),
  getProduct: (id: string) => api.get<Product>(`/products/${id}`),
  createProduct: (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => 
    api.post<Product>('/products', data),
  updateProduct: (id: string, data: Partial<Product>) => 
    api.put<Product>(`/products/${id}`, data),
  deleteProduct: (id: string) =>
    api.delete<{ success: boolean }>(`/products/${id}`),
  
  // Stock Items
  getStockItems: (productId?: string) => api.get<StockItem[]>('/stock/items', { params: { productId } }),
  
  // Goods Receipt
  createGoodsReceipt: (data: GoodsReceipt) => api.post<GoodsReceipt>('/stock/goods-receipt', data),
  getGoodsReceipts: (params?: { startDate?: string; endDate?: string }) => 
    api.get<GoodsReceipt[]>('/stock/goods-receipts', { params }),
  importDrugstoreReceiveDetail: (payload: { fileName: string; content: string }) =>
    api.post<DrugstoreReceiveImportSummary>('/stock/import/drugstorereceivedetail', payload),
  importDrugstoreReceiveBundle: (payload: {
    receiveFileName: string;
    receiveContent: string;
    detailFileName: string;
    detailContent: string;
  }) => api.post<DrugstoreReceiveImportSummary>('/stock/import/drugstorereceive-bundle', payload),
  
  // Stock Adjustment
  createAdjustment: (data: StockAdjustment) => api.post<StockAdjustment>('/stock/adjustment', data),
  getAdjustments: (params?: { productId?: string; startDate?: string; endDate?: string }) => 
    api.get<StockAdjustment[]>('/stock/adjustments', { params }),
  
  // Stock Deduction (FEFO)
  deductStock: (data: StockDeduction) => api.post('/stock/deduct', data),
  
  // Barcode scan
  scanBarcode: (barcode: string) => api.get<Product & { stockItems: StockItem[] }>(`/stock/scan/${barcode}`),
};

// ========== Procurement API ==========
export const procurementApi = {
  // Suppliers
  getSuppliers: () => api.get<Supplier[]>('/suppliers'),
  getSupplier: (id: string) => api.get<Supplier>(`/suppliers/${id}`),
  createSupplier: (data: Omit<Supplier, 'id' | 'createdAt'>) => api.post<Supplier>('/suppliers', data),
  updateSupplier: (id: string, data: Partial<Supplier>) => api.put<Supplier>(`/suppliers/${id}`, data),
  
  // Purchase Orders
  getPurchaseOrders: (params?: { status?: string; supplierId?: string }) => 
    api.get<PurchaseOrder[]>('/purchase-orders', { params }),
  getPurchaseOrder: (id: string) => api.get<PurchaseOrder>(`/purchase-orders/${id}`),
  createPurchaseOrder: (data: Omit<PurchaseOrder, 'id' | 'createdAt'>) => 
    api.post<PurchaseOrder>('/purchase-orders', data),
  createPurchaseOrderFromLowStock: () => api.post<PurchaseOrder>('/purchase-orders/from-low-stock'),
  updatePurchaseOrder: (id: string, data: Partial<PurchaseOrder>) => 
    api.put<PurchaseOrder>(`/purchase-orders/${id}`, data),
  
  // Approval Workflow
  getPendingApprovals: () => api.get<ApprovalRequest[]>('/approvals/pending'),
  approvePurchaseOrder: (poId: string) => api.post(`/approvals/approve/${poId}`),
  rejectPurchaseOrder: (poId: string, reason: string) => 
    api.post(`/approvals/reject/${poId}`, { reason }),
  
  // Supplier Performance
  getSupplierPerformance: (supplierId?: string) => 
    api.get<SupplierPerformance[]>('/suppliers/performance', { params: { supplierId } }),
};

export const settingsApi = {
  getUsers: () => api.get<UserAccount[]>('/users'),
  getRoles: () => api.get<RoleDefinition[]>('/users/roles'),
  createUser: (data: {
    username: string;
    email?: string;
    fullName: string;
    role: UserAccount['role'];
    active: boolean;
    password: string;
  }) => api.post<UserAccount>('/users', data),
  updateUser: (id: string, data: {
    username: string;
    email?: string;
    fullName: string;
    role: UserAccount['role'];
    active: boolean;
    password?: string;
  }) => api.put<UserAccount>(`/users/${id}`, data),
  deleteUser: (id: string) => api.delete<{ success: boolean }>(`/users/${id}`),
};

export const authApi = {
  login: (data: { username: string; password: string }) => api.post<LoginResponse>('/auth/login', data),
  logout: () => api.post<{ success: boolean }>('/auth/logout'),
  me: () => api.get<AuthUser>('/auth/me'),
};

// ========== Reports API ==========
export const reportsApi = {
  getInventoryValuation: (filter?: ReportFilter) => 
    api.get<InventoryValuation[]>('/reports/inventory-valuation', { params: filter }),
  getStockMovements: (filter?: ReportFilter) => 
    api.get<StockMovement[]>('/reports/stock-movements', { params: filter }),
  getExpiryReport: (filter?: ReportFilter) => 
    api.get<ExpiryAlert[]>('/reports/expiry', { params: filter }),
  getSupplierPerformanceReport: (filter?: ReportFilter) => 
    api.get<SupplierPerformance[]>('/reports/supplier-performance', { params: filter }),
  
  // Export functions
  exportInventoryValuation: (filter?: ReportFilter) => 
    api.get('/reports/inventory-valuation/export', { params: filter, responseType: 'blob' }),
  exportStockMovements: (filter?: ReportFilter) => 
    api.get('/reports/stock-movements/export', { params: filter, responseType: 'blob' }),
};

export default api;
