import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi, PaginatedResponse, TenantRecord, TenantUsageResponse } from '../services/api';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Loading } from '../components/common/Loading';
import { Modal } from '../components/common/Modal';
import { Select } from '../components/common/Select';

type TenantFormState = {
  tenant_code: string;
  tenant_name: string;
  tenant_type: TenantRecord['tenant_type'];
  subscription_plan: TenantRecord['subscription_plan'];
  max_users: number;
  max_products: number;
  trial_days: number;
  status: TenantRecord['status'];
  subscription_ends_at: string;
  admin_username: string;
  admin_password: string;
  admin_full_name: string;
  admin_email: string;
};

const tenantTypeOptions = [
  { value: 'hospital', label: 'Hospital' },
  { value: 'clinic', label: 'Clinic' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'health_center', label: 'Health Center' },
];

const subscriptionOptions = [
  { value: 'basic', label: 'Basic' },
  { value: 'professional', label: 'Professional' },
  { value: 'enterprise', label: 'Enterprise' },
];

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'trial', label: 'Trial' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'cancelled', label: 'Cancelled' },
];

function buildTenantFormState(tenant?: TenantRecord): TenantFormState {
  return {
    tenant_code: tenant?.tenant_code || '',
    tenant_name: tenant?.tenant_name || '',
    tenant_type: tenant?.tenant_type || 'hospital',
    subscription_plan: tenant?.subscription_plan || 'basic',
    max_users: tenant?.max_users || 10,
    max_products: tenant?.max_products || 5000,
    trial_days: 30,
    status: tenant?.status || 'trial',
    subscription_ends_at: tenant?.subscription_ends_at?.slice(0, 10) || '',
    admin_username: '',
    admin_password: '',
    admin_full_name: tenant?.tenant_name ? `${tenant.tenant_name} Administrator` : 'Tenant Administrator',
    admin_email: '',
  };
}

function normalizeTenantsResponse(data: TenantRecord[] | PaginatedResponse<TenantRecord> | undefined) {
  if (!data) {
    return { items: [], pagination: null as PaginatedResponse<TenantRecord>['pagination'] | null };
  }

  if (Array.isArray(data)) {
    return { items: data, pagination: null };
  }

  return {
    items: data.items || [],
    pagination: data.pagination || null,
  };
}

export const TenantsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantRecord | null>(null);
  const [formState, setFormState] = useState<TenantFormState>(buildTenantFormState());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [usageTenant, setUsageTenant] = useState<TenantRecord | null>(null);
  const [cloneTargetTenant, setCloneTargetTenant] = useState<TenantRecord | null>(null);
  const [cloneSourceTenantId, setCloneSourceTenantId] = useState('1');
  const [cloneResult, setCloneResult] = useState<{
    sourceTenantId: number;
    targetTenantId: number;
    insertedProducts: number;
    sourceProductCount: number;
    targetProductCount: number;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-tenants', page, limit, search, statusFilter, planFilter],
    queryFn: async () => {
      const response = await adminApi.getTenants({
        page,
        limit,
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        plan: planFilter || undefined,
      });
      return response.data;
    },
  });

  const tenantsState = useMemo(() => normalizeTenantsResponse(data), [data]);

  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ['tenant-usage', usageTenant?.id],
    queryFn: async () => {
      if (!usageTenant) return null;
      const response = await adminApi.getTenantUsage(usageTenant.id);
      return response.data;
    },
    enabled: Boolean(usageTenant),
  });

  const saveTenantMutation = useMutation({
    mutationFn: async (payload: TenantFormState) => {
      if (editingTenant) {
        return adminApi.updateTenant(editingTenant.id, {
          tenant_name: payload.tenant_name.trim(),
          tenant_type: payload.tenant_type,
          subscription_plan: payload.subscription_plan,
          max_users: Number(payload.max_users),
          max_products: Number(payload.max_products),
          status: payload.status,
          subscription_ends_at: payload.subscription_ends_at || null,
        });
      }

      return adminApi.createTenant({
        tenant_code: payload.tenant_code.trim(),
        tenant_name: payload.tenant_name.trim(),
        tenant_type: payload.tenant_type,
        subscription_plan: payload.subscription_plan,
        max_users: Number(payload.max_users),
        max_products: Number(payload.max_products),
        trial_days: Number(payload.trial_days),
        admin_username: payload.admin_username.trim(),
        admin_password: payload.admin_password,
        admin_full_name: payload.admin_full_name.trim(),
        admin_email: payload.admin_email.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tenants'] });
      setShowTenantModal(false);
      setEditingTenant(null);
      setFormState(buildTenantFormState());
      setErrors({});
    },
  });

  const suspendTenantMutation = useMutation({
    mutationFn: (tenantId: number) => adminApi.deleteTenant(tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tenants'] });
    },
  });

  const cloneMasterMutation = useMutation({
    mutationFn: async ({ targetTenantId, sourceTenantId }: { targetTenantId: number; sourceTenantId: number }) =>
      adminApi.cloneTenantMaster(targetTenantId, { sourceTenantId }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['admin-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-usage', cloneTargetTenant?.id] });
      setCloneResult(response.data);
    },
  });

  const openCreateTenant = () => {
    setEditingTenant(null);
    setFormState(buildTenantFormState());
    setErrors({});
    setShowTenantModal(true);
  };

  const openEditTenant = (tenant: TenantRecord) => {
    setEditingTenant(tenant);
    setFormState(buildTenantFormState(tenant));
    setErrors({});
    setShowTenantModal(true);
  };

  const openCloneMaster = (tenant: TenantRecord) => {
    setCloneTargetTenant(tenant);
    setCloneSourceTenantId(tenant.id === 1 ? '' : '1');
    setCloneResult(null);
  };

  const validateTenantForm = () => {
    const nextErrors: Record<string, string> = {};
    if (!editingTenant && !formState.tenant_code.trim()) nextErrors.tenant_code = 'กรุณากรอก tenant code';
    if (!formState.tenant_name.trim()) nextErrors.tenant_name = 'กรุณากรอก tenant name';
    if (Number(formState.max_users) <= 0) nextErrors.max_users = 'จำนวนผู้ใช้ต้องมากกว่า 0';
    if (Number(formState.max_products) <= 0) nextErrors.max_products = 'จำนวนสินค้าต้องมากกว่า 0';
    if (!editingTenant && Number(formState.trial_days) <= 0) nextErrors.trial_days = 'Trial days ต้องมากกว่า 0';
    if (!editingTenant && !formState.admin_username.trim()) nextErrors.admin_username = 'กรุณากรอก admin username';
    if (!editingTenant && !formState.admin_password.trim()) nextErrors.admin_password = 'กรุณากรอก admin password';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateTenantForm()) return;
    await saveTenantMutation.mutateAsync(formState);
  };

  const handleSuspend = async (tenant: TenantRecord) => {
    if (!window.confirm(`ระงับ tenant ${tenant.tenant_code} ?`)) {
      return;
    }
    await suspendTenantMutation.mutateAsync(tenant.id);
  };

  const handleCloneMaster = async () => {
    if (!cloneTargetTenant || !cloneSourceTenantId) {
      return;
    }

    await cloneMasterMutation.mutateAsync({
      targetTenantId: cloneTargetTenant.id,
      sourceTenantId: Number(cloneSourceTenantId),
    });
  };

  const closeCloneModal = () => {
    setCloneTargetTenant(null);
    setCloneSourceTenantId('1');
    setCloneResult(null);
  };

  const pagination = tenantsState.pagination;
  const sourceTenantOptions = tenantsState.items
    .filter((tenant) => tenant.id !== cloneTargetTenant?.id)
    .map((tenant) => ({
      value: String(tenant.id),
      label: `${tenant.tenant_code} - ${tenant.tenant_name}`,
    }));

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-white p-6 shadow">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">จัดการ Tenants</h2>
            <p className="text-sm text-gray-500">สร้าง tenant พร้อม tenant admin ที่เข้าใช้งานระบบได้ทันที</p>
          </div>
          <Button variant="primary" onClick={openCreateTenant}>
            เพิ่ม Tenant
          </Button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Input
            label="ค้นหา"
            placeholder="tenant code หรือชื่อ"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <Select
            label="สถานะ"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            options={statusOptions}
            emptyOption="ทุกสถานะ"
          />
          <Select
            label="แผน"
            value={planFilter}
            onChange={(event) => {
              setPlanFilter(event.target.value);
              setPage(1);
            }}
            options={subscriptionOptions}
            emptyOption="ทุกแผน"
          />
          <Select
            label="รายการต่อหน้า"
            value={String(limit)}
            onChange={(event) => {
              setLimit(Number(event.target.value));
              setPage(1);
            }}
            options={[
              { value: '10', label: '10 รายการ/หน้า' },
              { value: '20', label: '20 รายการ/หน้า' },
              { value: '50', label: '50 รายการ/หน้า' },
            ]}
          />
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        {isLoading ? (
          <Loading message="กำลังโหลด tenants..." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Tenant</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">ประเภท</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">แผน</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">สถานะ</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Users</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Products</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Pending PO</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {tenantsState.items.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-gray-900">{tenant.tenant_name}</div>
                        <div className="text-xs text-gray-500">{tenant.tenant_code}</div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">{tenant.tenant_type}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">{tenant.subscription_plan}</td>
                      <td className="px-4 py-4 text-sm">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            tenant.status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : tenant.status === 'trial'
                                ? 'bg-yellow-100 text-yellow-700'
                                : tenant.status === 'suspended'
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {tenant.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right text-sm text-gray-600">{tenant.user_count || 0}</td>
                      <td className="px-4 py-4 text-right text-sm text-gray-600">{tenant.product_count || 0}</td>
                      <td className="px-4 py-4 text-right text-sm text-gray-600">{tenant.pending_pos || 0}</td>
                      <td className="px-4 py-4 text-sm">
                        <div className="flex flex-wrap gap-3">
                          <button type="button" className="text-sky-600 hover:text-sky-800" onClick={() => setUsageTenant(tenant)}>
                            ดู usage
                          </button>
                          <button type="button" className="text-emerald-600 hover:text-emerald-800" onClick={() => openCloneMaster(tenant)}>
                            คัดลอกรายการยา
                          </button>
                          <button type="button" className="text-blue-600 hover:text-blue-800" onClick={() => openEditTenant(tenant)}>
                            แก้ไข
                          </button>
                          {tenant.status !== 'cancelled' && (
                            <button type="button" className="text-red-600 hover:text-red-800" onClick={() => handleSuspend(tenant)}>
                              ระงับ
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination && (
              <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                <div>
                  แสดง {(pagination.page - 1) * pagination.limit + 1}-
                  {Math.min(pagination.page * pagination.limit, pagination.total)} จาก {pagination.total} รายการ
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setPage((value) => Math.max(value - 1, 1))} disabled={pagination.page <= 1}>
                    ก่อนหน้า
                  </Button>
                  <span>หน้า {pagination.page} / {pagination.totalPages}</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((value) => Math.min(value + 1, pagination.totalPages))}
                    disabled={pagination.page >= pagination.totalPages}
                  >
                    ถัดไป
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        isOpen={showTenantModal}
        onClose={() => setShowTenantModal(false)}
        title={editingTenant ? 'แก้ไข Tenant' : 'เพิ่ม Tenant'}
        size="lg"
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Tenant Code"
              value={formState.tenant_code}
              onChange={(event) => setFormState((value) => ({ ...value, tenant_code: event.target.value }))}
              error={errors.tenant_code}
              disabled={Boolean(editingTenant)}
            />
            <Input
              label="Tenant Name"
              value={formState.tenant_name}
              onChange={(event) => setFormState((value) => ({ ...value, tenant_name: event.target.value }))}
              error={errors.tenant_name}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Tenant Type"
              value={formState.tenant_type}
              onChange={(event) => setFormState((value) => ({ ...value, tenant_type: event.target.value as TenantRecord['tenant_type'] }))}
              options={tenantTypeOptions}
            />
            <Select
              label="Subscription Plan"
              value={formState.subscription_plan}
              onChange={(event) => setFormState((value) => ({ ...value, subscription_plan: event.target.value as TenantRecord['subscription_plan'] }))}
              options={subscriptionOptions}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Max Users"
              type="number"
              value={String(formState.max_users)}
              onChange={(event) => setFormState((value) => ({ ...value, max_users: Number(event.target.value) }))}
              error={errors.max_users}
            />
            <Input
              label="Max Products"
              type="number"
              value={String(formState.max_products)}
              onChange={(event) => setFormState((value) => ({ ...value, max_products: Number(event.target.value) }))}
              error={errors.max_products}
            />
          </div>

          {!editingTenant ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Trial Days"
                  type="number"
                  value={String(formState.trial_days)}
                  onChange={(event) => setFormState((value) => ({ ...value, trial_days: Number(event.target.value) }))}
                  error={errors.trial_days}
                />
                <Input
                  label="Admin Username"
                  value={formState.admin_username}
                  onChange={(event) => setFormState((value) => ({ ...value, admin_username: event.target.value }))}
                  error={errors.admin_username}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Admin Password"
                  type="password"
                  value={formState.admin_password}
                  onChange={(event) => setFormState((value) => ({ ...value, admin_password: event.target.value }))}
                  error={errors.admin_password}
                />
                <Input
                  label="Admin Full Name"
                  value={formState.admin_full_name}
                  onChange={(event) => setFormState((value) => ({ ...value, admin_full_name: event.target.value }))}
                />
              </div>

              <Input
                label="Admin Email"
                type="email"
                value={formState.admin_email}
                onChange={(event) => setFormState((value) => ({ ...value, admin_email: event.target.value }))}
              />
            </>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                label="Status"
                value={formState.status}
                onChange={(event) => setFormState((value) => ({ ...value, status: event.target.value as TenantRecord['status'] }))}
                options={statusOptions}
              />
              <Input
                label="Subscription Ends At"
                type="date"
                value={formState.subscription_ends_at}
                onChange={(event) => setFormState((value) => ({ ...value, subscription_ends_at: event.target.value }))}
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowTenantModal(false)}>
              ยกเลิก
            </Button>
            <Button variant="primary" type="submit" loading={saveTenantMutation.isPending}>
              {editingTenant ? 'บันทึกการแก้ไข' : 'สร้าง Tenant'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(usageTenant)}
        onClose={() => setUsageTenant(null)}
        title={usageTenant ? `Usage: ${usageTenant.tenant_name}` : 'Usage'}
        size="lg"
      >
        {usageLoading || !usageData ? (
          <Loading message="กำลังโหลด usage..." />
        ) : (
          <TenantUsageSummary data={usageData} />
        )}
      </Modal>

      <Modal
        isOpen={Boolean(cloneTargetTenant)}
        onClose={closeCloneModal}
        title={cloneTargetTenant ? `คัดลอกรายการยาไปยัง ${cloneTargetTenant.tenant_name}` : 'คัดลอกรายการยา'}
        size="md"
      >
        <div className="space-y-4">
          <Select
            label="Tenant ต้นแบบ"
            value={cloneSourceTenantId}
            onChange={(event) => setCloneSourceTenantId(event.target.value)}
            options={sourceTenantOptions}
            emptyOption="เลือก tenant ต้นแบบ"
          />

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            ระบบจะคัดลอก `products` และ `stock_levels` จาก tenant ต้นแบบไป tenant ปลายทาง
            โดยจะข้าม product_code ที่มีอยู่แล้วอัตโนมัติ
          </div>

          {cloneResult && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <div className="font-semibold">คัดลอกรายการยาสำเร็จ</div>
              <div className="mt-2">เพิ่มสินค้าใหม่ {cloneResult.insertedProducts.toLocaleString('th-TH')} รายการ</div>
              <div>ต้นทางมี {cloneResult.sourceProductCount.toLocaleString('th-TH')} รายการ</div>
              <div>ปลายทางมีทั้งหมด {cloneResult.targetProductCount.toLocaleString('th-TH')} รายการ</div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={closeCloneModal}>
              ยกเลิก
            </Button>
            <Button
              variant="primary"
              onClick={handleCloneMaster}
              loading={cloneMasterMutation.isPending}
              disabled={!cloneSourceTenantId}
            >
              คัดลอกข้อมูล
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

function TenantUsageSummary({ data }: { data: TenantUsageResponse }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg bg-slate-50 p-4">
          <div className="text-sm text-slate-500">Products</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{data.usage.product_count}</div>
          <div className="text-xs text-slate-500">Quota {data.quota_utilization.products}</div>
        </div>
        <div className="rounded-lg bg-slate-50 p-4">
          <div className="text-sm text-slate-500">Users</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{data.usage.active_users}</div>
          <div className="text-xs text-slate-500">Quota {data.quota_utilization.users}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <UsageCard label="Stock Items" value={data.usage.total_stock_items} />
        <UsageCard label="Active Batches" value={data.usage.active_batches} />
        <UsageCard label="Unique Products" value={data.usage.unique_products} />
        <UsageCard label="Total POs" value={data.usage.total_pos} />
        <UsageCard label="Pending POs" value={data.usage.pending_pos} />
        <UsageCard label="Movements 30d" value={data.usage.movements_30d} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
        <div>Plan: <span className="font-medium text-slate-900">{data.subscription_plan}</span></div>
        <div>Max Users: <span className="font-medium text-slate-900">{data.limits.max_users}</span></div>
        <div>Max Products: <span className="font-medium text-slate-900">{data.limits.max_products}</span></div>
        <div>Total PO Value: <span className="font-medium text-slate-900">฿{Number(data.usage.total_po_value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span></div>
      </div>
    </div>
  );
}

function UsageCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-bold text-slate-900">{Number(value || 0).toLocaleString('th-TH')}</div>
    </div>
  );
}

export default TenantsPage;
