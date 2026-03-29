import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';

export interface Tenant {
  id: number;
  tenant_code: string;
  tenant_name: string;
  tenant_type: 'hospital' | 'clinic' | 'pharmacy' | 'health_center';
  status: 'active' | 'suspended' | 'trial' | 'cancelled';
  subscription_plan: 'basic' | 'professional' | 'enterprise';
  max_users: number;
  max_products: number;
  trial_ends_at?: string;
  subscription_ends_at?: string;
  product_count?: number;
  user_count?: number;
  pending_pos?: number;
}

export interface TenantContextType {
  currentTenant: Tenant | null;
  availableTenants: Tenant[];
  isLoading: boolean;
  error: string | null;
  switchTenant: (tenantId: number) => Promise<void>;
  refreshCurrentTenant: () => Promise<void>;
  isExecutive: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Only platform admins should have cross-tenant executive access.
  const isExecutive = localStorage.getItem('user_role') === 'admin';

  useEffect(() => {
    loadTenantContext();
  }, []);

  async function loadTenantContext() {
    try {
      setIsLoading(true);
      setError(null);

      // Get current tenant from stored context
      const storedTenantId = localStorage.getItem('tenant_id');
      const token = localStorage.getItem('token');

      if (!token) {
        // Not logged in, skip loading
        setIsLoading(false);
        return;
      }

      if (storedTenantId) {
        // Load specific tenant
        await loadTenant(Number(storedTenantId));
      } else {
        // Load user's default tenant from token
        const userResponse = await api.get('/api/auth/me');
        if (userResponse.data.tenantId) {
          await loadTenant(userResponse.data.tenantId);
        }
      }

      // Load available tenants if user is admin/executive
      if (isExecutive) {
        const tenantsResponse = await api.get('/api/executive/tenants');
        setAvailableTenants(tenantsResponse.data);
      }
    } catch (err) {
      console.error('Failed to load tenant context:', err);
      setError('Failed to load tenant information');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadTenant(tenantId: number) {
    try {
      const response = await api.get(`/api/admin/tenants/${tenantId}`);
      const tenant: Tenant = response.data;
      
      setCurrentTenant(tenant);
      localStorage.setItem('tenant_id', String(tenant.id));
      localStorage.setItem('tenant_code', tenant.tenant_code);
      
      // Update API default headers with tenant context
      api.defaults.headers.common['X-Tenant-ID'] = String(tenant.id);
    } catch (err) {
      console.error('Failed to load tenant:', err);
      throw err;
    }
  }

  async function switchTenant(tenantId: number) {
    try {
      await loadTenant(tenantId);
      // Refresh the page to apply new tenant context
      window.location.reload();
    } catch (err) {
      console.error('Failed to switch tenant:', err);
      throw err;
    }
  }

  async function refreshCurrentTenant() {
    if (currentTenant) {
      await loadTenant(currentTenant.id);
    }
  }

  const value: TenantContextType = {
    currentTenant,
    availableTenants,
    isLoading,
    error,
    switchTenant,
    refreshCurrentTenant,
    isExecutive,
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
