import { useState } from 'react';
import { useTenant } from '../../contexts/TenantContext';

interface TenantSwitcherProps {
  onSwitch?: (tenantId: number) => void;
}

export function TenantSwitcher({ onSwitch }: TenantSwitcherProps) {
  const { currentTenant, availableTenants, switchTenant, isExecutive } = useTenant();
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  if (!isExecutive || availableTenants.length === 0) {
    return null;
  }

  async function handleSwitch(tenantId: number) {
    try {
      setIsSwitching(true);
      await switchTenant(tenantId);
      onSwitch?.(tenantId);
    } catch (err) {
      console.error('Failed to switch tenant:', err);
    } finally {
      setIsSwitching(false);
      setIsOpen(false);
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'trial':
        return 'bg-yellow-500';
      case 'suspended':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSwitching}
        className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
      >
        <span className="text-sm font-medium text-gray-700">
          {currentTenant?.tenant_code || 'Loading...'}
        </span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-20 max-h-96 overflow-y-auto">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Switch Facility</h3>
              <p className="text-xs text-gray-500 mt-1">
                {availableTenants.length} facilities available
              </p>
            </div>
            <div className="py-2">
              {availableTenants.map((tenant) => (
                (() => {
                  const pendingPos = tenant.pending_pos ?? 0;
                  return (
                <button
                  key={tenant.id}
                  onClick={() => handleSwitch(tenant.id)}
                  disabled={isSwitching || tenant.id === currentTenant?.id}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed ${
                    tenant.id === currentTenant?.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {tenant.tenant_name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {tenant.tenant_code} • {tenant.subscription_plan}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${getStatusColor(tenant.status)}`}
                        title={tenant.status}
                      />
                      {tenant.id === currentTenant?.id && (
                        <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                    <span>{tenant.product_count || 0} products</span>
                    <span>{tenant.user_count || 0} users</span>
                    {pendingPos > 0 && (
                      <span className="text-yellow-600">{pendingPos} pending POs</span>
                    )}
                  </div>
                </button>
                  );
                })()
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
