import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useTenant } from '../../contexts/TenantContext';

interface ExecutiveSummary {
  overview: {
    active_tenants: number;
    trial_tenants: number;
    suspended_tenants: number;
    cancelled_tenants: number;
    total_products: number;
    total_stock_items: number;
    total_pos: number;
    pending_pos: number;
    total_active_users: number;
    expired_items: number;
    expiring_7d: number;
    expiring_30d: number;
  };
  plan_breakdown: Array<{
    subscription_plan: string;
    tenant_count: number;
    active_count: number;
  }>;
  recent_activity: {
    pos_created_24h: number;
    stock_movements_24h: number;
    active_users_24h: number;
  };
}

interface Alert {
  tenant_code: string;
  tenant_name: string;
  [key: string]: any;
}

interface Alerts {
  expired_stock: { count: number; items: Alert[] };
  critical_expiry: { count: number; items: Alert[] };
  low_stock: { count: number; items: Alert[] };
  pending_pos: { count: number; items: Alert[] };
  tenant_issues: { count: number; items: Alert[] };
}

export function ExecutiveDashboard() {
  const { currentTenant, isExecutive } = useTenant();
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [alerts, setAlerts] = useState<Alerts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isExecutive) {
      loadExecutiveData();
    }
  }, [isExecutive]);

  async function loadExecutiveData() {
    try {
      setLoading(true);
      const [summaryRes, alertsRes] = await Promise.all([
        api.get('/api/executive/summary'),
        api.get('/api/executive/alerts'),
      ]);
      setSummary(summaryRes.data);
      setAlerts(alertsRes.data);
    } catch (err) {
      console.error('Failed to load executive data:', err);
      setError('Failed to load executive dashboard');
    } finally {
      setLoading(false);
    }
  }

  if (!isExecutive) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            Executive dashboard access required. Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Executive Dashboard</h1>
        <button
          onClick={loadExecutiveData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {/* Overview Stats */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Active Facilities"
            value={summary.overview.active_tenants}
            subtitle={`${summary.overview.trial_tenants} trial, ${summary.overview.suspended_tenants} suspended`}
            color="blue"
          />
          <StatCard
            title="Total Products"
            value={summary.overview.total_products.toLocaleString()}
            subtitle={`${summary.overview.total_stock_items.toLocaleString()} stock items`}
            color="green"
          />
          <StatCard
            title="Pending POs"
            value={summary.overview.pending_pos}
            subtitle={`${summary.overview.total_pos} total POs`}
            color="yellow"
          />
          <StatCard
            title="Active Users"
            value={summary.overview.total_active_users.toLocaleString()}
            subtitle={`${summary.recent_activity.active_users_24h} active today`}
            color="purple"
          />
        </div>
      )}

      {/* Alerts Section */}
      {alerts && alerts.total_alerts > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Critical Alerts ({alerts.total_alerts})
            </h2>
          </div>
          <div className="p-6 space-y-4">
            {alerts.alerts.expired_stock.count > 0 && (
              <AlertRow
                type="expired"
                count={alerts.alerts.expired_stock.count}
                items={alerts.alerts.expired_stock.items.slice(0, 3)}
              />
            )}
            {alerts.alerts.critical_expiry.count > 0 && (
              <AlertRow
                type="critical"
                count={alerts.alerts.critical_expiry.count}
                items={alerts.alerts.critical_expiry.items.slice(0, 3)}
              />
            )}
            {alerts.alerts.low_stock.count > 0 && (
              <AlertRow
                type="low_stock"
                count={alerts.alerts.low_stock.count}
                items={alerts.alerts.low_stock.items.slice(0, 3)}
              />
            )}
          </div>
        </div>
      )}

      {/* Plan Breakdown */}
      {summary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Subscription Plans</h2>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {summary.plan_breakdown.map((plan) => (
                  <div key={plan.subscription_plan} className="flex items-center justify-between">
                    <span className="text-gray-700 capitalize">{plan.subscription_plan}</span>
                    <span className="text-gray-900 font-medium">
                      {plan.tenant_count} ({plan.active_count} active)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Activity (24h)</h2>
            </div>
            <div className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Purchase Orders</span>
                <span className="text-gray-900 font-medium">
                  {summary.recent_activity.pos_created_24h}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Stock Movements</span>
                <span className="text-gray-900 font-medium">
                  {summary.recent_activity.stock_movements_24h}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Active Users</span>
                <span className="text-gray-900 font-medium">
                  {summary.recent_activity.active_users_24h}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, subtitle, color }: {
  title: string;
  value: string | number;
  subtitle: string;
  color: 'blue' | 'green' | 'yellow' | 'purple';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    purple: 'bg-purple-50 border-purple-200',
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <p className="text-sm text-gray-600">{title}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
    </div>
  );
}

function AlertRow({ type, count, items }: {
  type: 'expired' | 'critical' | 'low_stock';
  count: number;
  items: Alert[];
}) {
  const typeConfig = {
    expired: { color: 'red', label: 'Expired Stock' },
    critical: { color: 'orange', label: 'Critical Expiry (< 7 days)' },
    low_stock: { color: 'yellow', label: 'Low Stock' },
  };

  const config = typeConfig[type];

  return (
    <div className={`border-l-4 border-${config.color}-500 pl-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-gray-900">{config.label}</span>
        <span className={`text-${config.color}-600 font-bold`}>{count}</span>
      </div>
      <div className="space-y-1">
        {items.map((item, idx) => (
          <p key={idx} className="text-sm text-gray-600">
            <span className="font-medium">{item.tenant_code}</span>: {item.product_name || item.product_code}
          </p>
        ))}
      </div>
    </div>
  );
}
