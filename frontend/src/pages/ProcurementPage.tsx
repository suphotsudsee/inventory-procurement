import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  procurementApi,
  PurchaseOrder,
  ApprovalRequest,
  Product,
  SupplierPerformance,
  Supplier,
  stockApi,
} from '../services/api';
import {
  PurchaseOrderList,
  PurchaseOrderForm,
  ApprovalWorkflow,
  SupplierPerformanceDashboard,
} from '../components/procurement';
import { Modal } from '../components/common/Modal';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';

type TabType = 'orders' | 'approvals' | 'suppliers';

function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export const ProcurementPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('orders');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | undefined>();
  const [selectedSupplierPerformance, setSelectedSupplierPerformance] = useState<SupplierPerformance | undefined>();
  const [lowStockMode, setLowStockMode] = useState(false);

  const queryClient = useQueryClient();

  const {
    data: ordersRaw,
    isLoading: ordersLoading,
    error: ordersError,
    refetch: refetchOrders,
  } = useQuery({
    queryKey: ['procurement', 'purchase-orders'],
    queryFn: async () => {
      const response = await procurementApi.getPurchaseOrders();
      return ensureArray<PurchaseOrder>(response.data);
    },
  });

  const {
    data: approvalsRaw,
    isLoading: approvalsLoading,
  } = useQuery({
    queryKey: ['procurement', 'pending-approvals'],
    queryFn: async () => {
      const response = await procurementApi.getPendingApprovals();
      return ensureArray<ApprovalRequest>(response.data);
    },
  });

  const {
    data: suppliersRaw,
  } = useQuery({
    queryKey: ['procurement', 'suppliers'],
    queryFn: async () => {
      const response = await procurementApi.getSuppliers();
      return ensureArray<Supplier>(response.data);
    },
  });

  const {
    data: productsRaw,
  } = useQuery({
    queryKey: ['procurement-products'],
    queryFn: async () => {
      const response = await stockApi.getProducts({ lowStock: true });
      return ensureArray<Product>(response.data);
    },
  });

  const {
    data: performanceRaw,
    isLoading: performanceLoading,
  } = useQuery({
    queryKey: ['procurement', 'supplier-performance'],
    queryFn: async () => {
      const response = await procurementApi.getSupplierPerformance();
      return ensureArray<SupplierPerformance>(response.data);
    },
    enabled: activeTab === 'suppliers',
  });

  const createPOMutation = useMutation({
    mutationFn: procurementApi.createPurchaseOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['procurement', 'pending-approvals'] });
      setShowCreateModal(false);
      setLowStockMode(false);
    },
  });

  const createPOFromLowStockMutation = useMutation({
    mutationFn: procurementApi.createPurchaseOrderFromLowStock,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['procurement', 'pending-approvals'] });
      setShowCreateModal(false);
    },
  });

  const approveMutation = useMutation({
    mutationFn: procurementApi.approvePurchaseOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['procurement', 'purchase-orders'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ poId, reason }: { poId: string; reason: string }) =>
      procurementApi.rejectPurchaseOrder(poId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['procurement', 'purchase-orders'] });
    },
  });

  const orders = ensureArray<PurchaseOrder>(ordersRaw);
  const approvals = ensureArray<ApprovalRequest>(approvalsRaw);
  const suppliers = ensureArray<Supplier>(suppliersRaw);
  const products = ensureArray<Product>(productsRaw);
  const performance = ensureArray<SupplierPerformance>(performanceRaw);

  const handleCreatePO = async (data: any) => {
    await createPOMutation.mutateAsync(data);
  };

  const handleApprove = async (request: ApprovalRequest) => {
    await approveMutation.mutateAsync(request.poId);
  };

  const handleReject = async (request: ApprovalRequest, reason: string) => {
    await rejectMutation.mutateAsync({ poId: request.poId, reason });
  };

  const handleCreateFromLowStock = async () => {
    await createPOFromLowStockMutation.mutateAsync();
  };

  const selectedSupplierProfile = useMemo(
    () => suppliers.find((supplier) => supplier.id === selectedSupplierPerformance?.supplierId),
    [suppliers, selectedSupplierPerformance]
  );

  const selectedSupplierOrders = useMemo(
    () => orders.filter((order) => order.supplierId === selectedSupplierPerformance?.supplierId),
    [orders, selectedSupplierPerformance]
  );

  const lowStockProducts = useMemo(
    () => products.filter((product) => product.currentStock <= product.minLevel),
    [products]
  );

  if (ordersLoading && orders.length === 0) {
    return <Loading fullScreen message="กำลังโหลดข้อมูลจัดซื้อจัดจ้าง..." />;
  }

  if (ordersError) {
    return (
      <ErrorState
        message="ไม่สามารถโหลดข้อมูลจัดซื้อจัดจ้าง"
        error={ordersError as Error}
        onRetry={() => refetchOrders()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">จัดซื้อจัดจ้าง</h2>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={handleCreateFromLowStock}
            loading={createPOFromLowStockMutation.isPending}
          >
            สร้าง PO จากสต็อกต่ำ
          </Button>
          <Button variant="primary" onClick={() => setShowCreateModal(true)}>
            สร้าง PO ใหม่
          </Button>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'orders', label: 'ใบสั่งซื้อ', count: orders.length },
            { id: 'approvals', label: 'รออนุมัติ', count: approvals.length },
            { id: 'suppliers', label: 'ซัพพลายเออร์' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              } flex items-center gap-2 whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    tab.id === 'approvals' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'orders' && (
        <>
          {orders.length === 0 ? (
            <EmptyState
              icon="PO"
              title="ไม่มีใบสั่งซื้อ"
              description="เริ่มต้นด้วยการสร้างใบสั่งซื้อใหม่"
              action={{
                label: 'สร้าง PO ใหม่',
                onClick: () => setShowCreateModal(true),
              }}
            />
          ) : (
            <PurchaseOrderList
              orders={orders}
              loading={ordersLoading}
              onView={(order) => setSelectedPO(order)}
              onCreateNew={() => setShowCreateModal(true)}
            />
          )}
        </>
      )}

      {activeTab === 'approvals' && (
        <ApprovalWorkflow
          requests={approvals}
          loading={approvalsLoading}
          onApprove={handleApprove}
          onReject={handleReject}
          onViewPO={(request) => {
            const order = orders.find((item) => item.id === request.poId);
            if (order) setSelectedPO(order);
          }}
        />
      )}

      {activeTab === 'suppliers' && (
        <div>
          <h3 className="mb-4 text-lg font-medium text-gray-900">ประสิทธิภาพซัพพลายเออร์</h3>
          <SupplierPerformanceDashboard
            performance={performance}
            loading={performanceLoading}
            onSelectSupplier={(supplier) => setSelectedSupplierPerformance(supplier)}
          />
        </div>
      )}

      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setLowStockMode(false);
        }}
        title="สร้างใบสั่งซื้อใหม่"
        size="xl"
      >
        <PurchaseOrderForm
          suppliers={suppliers}
          products={products}
          lowStockProducts={lowStockMode ? lowStockProducts : []}
          onSubmit={handleCreatePO}
          onCancel={() => setShowCreateModal(false)}
          loading={createPOMutation.isPending}
        />
      </Modal>

      {selectedPO && (
        <Modal
          isOpen={Boolean(selectedPO)}
          onClose={() => setSelectedPO(undefined)}
          title={selectedPO.poNumber}
          size="xl"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <div className="text-sm text-gray-500">ซัพพลายเออร์</div>
                <div className="font-medium">{selectedPO.supplierName}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">วันที่สั่ง</div>
                <div className="font-medium">{new Date(selectedPO.orderDate).toLocaleDateString('th-TH')}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">กำหนดรับ</div>
                <div className="font-medium">{new Date(selectedPO.expectedDate).toLocaleDateString('th-TH')}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">สถานะ</div>
                <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-800">
                  {selectedPO.status}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">สินค้า</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">จำนวน</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">หน่วย</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">ราคา/หน่วย</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">รวม</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {selectedPO.items.map((item, index) => (
                    <tr key={`${item.productId}-${index}`}>
                      <td className="px-4 py-3 text-sm">{item.productName}</td>
                      <td className="px-4 py-3 text-right text-sm">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm">{item.unit}</td>
                      <td className="px-4 py-3 text-right text-sm">฿{item.unitPrice.toLocaleString('th-TH')}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium">฿{item.totalPrice.toLocaleString('th-TH')}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-right font-medium">รวมทั้งสิ้น</td>
                    <td className="px-4 py-3 text-right font-bold">
                      ฿{selectedPO.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {selectedPO.notes && (
              <div className="rounded-lg bg-gray-50 p-3">
                <div className="text-sm text-gray-500">หมายเหตุ</div>
                <div className="text-sm">{selectedPO.notes}</div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setSelectedPO(undefined)}>
                ปิด
              </Button>
              {selectedPO.status === 'pending_approval' && (
                <Button
                  variant="success"
                  onClick={() => {
                    approveMutation.mutate(selectedPO.id!);
                    setSelectedPO(undefined);
                  }}
                  loading={approveMutation.isPending}
                >
                  อนุมัติ
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {selectedSupplierPerformance && (
        <Modal
          isOpen={Boolean(selectedSupplierPerformance)}
          onClose={() => setSelectedSupplierPerformance(undefined)}
          title={selectedSupplierPerformance.supplierName}
          size="xl"
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="text-sm text-gray-500">จำนวนใบสั่งซื้อ</div>
                <div className="text-2xl font-bold text-gray-900">{selectedSupplierPerformance.totalOrders}</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="text-sm text-gray-500">ส่งตรงเวลา</div>
                <div className="text-2xl font-bold text-green-600">{selectedSupplierPerformance.onTimeDelivery.toFixed(1)}%</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="text-sm text-gray-500">คะแนนคุณภาพ</div>
                <div className="text-2xl font-bold text-blue-600">{selectedSupplierPerformance.qualityScore.toFixed(1)}</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="text-sm text-gray-500">มูลค่ารวม</div>
                <div className="text-2xl font-bold text-gray-900">
                  ฿{selectedSupplierPerformance.totalSpend.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-gray-200 p-4">
                <h4 className="mb-3 text-base font-semibold text-gray-900">ข้อมูลซัพพลายเออร์</h4>
                <div className="space-y-2 text-sm">
                  <div><span className="text-gray-500">ชื่อ:</span> <span className="font-medium text-gray-900">{selectedSupplierPerformance.supplierName}</span></div>
                  <div><span className="text-gray-500">รหัส:</span> <span className="text-gray-900">{selectedSupplierProfile?.code || '-'}</span></div>
                  <div><span className="text-gray-500">ผู้ติดต่อ:</span> <span className="text-gray-900">{selectedSupplierProfile?.contactPerson || '-'}</span></div>
                  <div><span className="text-gray-500">โทร:</span> <span className="text-gray-900">{selectedSupplierProfile?.phone || '-'}</span></div>
                  <div><span className="text-gray-500">อีเมล:</span> <span className="text-gray-900">{selectedSupplierProfile?.email || '-'}</span></div>
                  <div><span className="text-gray-500">เครดิต:</span> <span className="text-gray-900">{selectedSupplierProfile?.paymentTerms || '-'}</span></div>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 p-4">
                <h4 className="mb-3 text-base font-semibold text-gray-900">สรุปประสิทธิภาพ</h4>
                <div className="space-y-2 text-sm">
                  <div><span className="text-gray-500">Lead Time เฉลี่ย:</span> <span className="font-medium text-gray-900">{selectedSupplierPerformance.avgLeadTime.toFixed(0)} วัน</span></div>
                  <div><span className="text-gray-500">ปัญหาที่พบ:</span> <span className={`font-medium ${selectedSupplierPerformance.issues > 0 ? 'text-red-600' : 'text-green-600'}`}>{selectedSupplierPerformance.issues} รายการ</span></div>
                  <div><span className="text-gray-500">สั่งซื้อล่าสุด:</span> <span className="text-gray-900">{selectedSupplierPerformance.lastOrderDate ? new Date(selectedSupplierPerformance.lastOrderDate).toLocaleDateString('th-TH') : '-'}</span></div>
                  <div><span className="text-gray-500">สถานะใช้งาน:</span> <span className={`font-medium ${selectedSupplierProfile?.active ? 'text-green-600' : 'text-gray-500'}`}>{selectedSupplierProfile?.active ? 'ใช้งาน' : 'ไม่ใช้งาน'}</span></div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200">
              <div className="border-b border-gray-200 px-4 py-3">
                <h4 className="text-base font-semibold text-gray-900">ใบสั่งซื้อที่เกี่ยวข้อง</h4>
              </div>
              {selectedSupplierOrders.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-500">ยังไม่มีใบสั่งซื้อของซัพพลายเออร์รายนี้</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">PO</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">วันที่สั่ง</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">กำหนดรับ</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">สถานะ</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">มูลค่า</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {selectedSupplierOrders.map((order) => (
                        <tr key={order.id}>
                          <td className="px-4 py-3 text-sm font-medium text-blue-600">{order.poNumber}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{new Date(order.orderDate).toLocaleDateString('th-TH')}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{new Date(order.expectedDate).toLocaleDateString('th-TH')}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{order.status}</td>
                          <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                            ฿{order.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setSelectedSupplierPerformance(undefined)}>
                ปิด
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ProcurementPage;
