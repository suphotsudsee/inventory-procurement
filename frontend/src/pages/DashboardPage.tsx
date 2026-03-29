import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../services/api';
import type { ExpiryAlert } from '../services/api';
import { StatsCard } from '../components/dashboard/StatsCard';
import { ExpiryAlertsTable } from '../components/dashboard/ExpiryAlertsTable';
import { Loading } from '../components/common/Loading';
import { ErrorState } from '../components/common/ErrorState';
import { Modal } from '../components/common/Modal';

export const DashboardPage: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedExpiryAlert, setSelectedExpiryAlert] = useState<ExpiryAlert | null>(null);

  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['dashboard-summary', refreshKey],
    queryFn: async () => {
      const response = await dashboardApi.getSummary();
      return response.data;
    },
    refetchInterval: 30000,
  });

  const {
    data: expiryAlerts,
    isLoading: alertsLoading,
    refetch: refetchAlerts,
  } = useQuery({
    queryKey: ['expiry-alerts', refreshKey],
    queryFn: async () => {
      const response = await dashboardApi.getExpiryAlerts(90);
      return response.data;
    },
    refetchInterval: 30000,
  });

  const { data: lowStockItems, refetch: refetchLowStock } = useQuery({
    queryKey: ['low-stock', refreshKey],
    queryFn: async () => {
      const response = await dashboardApi.getLowStock();
      return response.data;
    },
    refetchInterval: 30000,
  });

  const handleRefresh = () => setRefreshKey((prev) => prev + 1);
  const handleViewAllExpiry = () => {
    window.location.hash = '#reports/expiry';
  };

  if (summaryLoading && !summary) {
    return <Loading fullScreen message="กำลังโหลดข้อมูล..." />;
  }

  if (summaryError) {
    return (
      <ErrorState
        message="ไม่สามารถโหลดข้อมูล Dashboard"
        error={summaryError as Error}
        onRetry={() => {
          refetchSummary();
          refetchAlerts();
          refetchLowStock();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-500">อัปเดตล่าสุด: {new Date().toLocaleString('th-TH')}</p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          รีเฟรช
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          icon="มูลค่า"
          title="มูลค่าสต็อกทั้งหมด"
          value={summary ? `฿${summary.totalStockValue.toLocaleString('th-TH')}` : '฿0'}
          color="blue"
          onClick={() => {
            window.location.hash = '#stock';
          }}
        />
        <StatsCard
          icon="หมดอายุ"
          title="ยาใกล้หมดอายุ"
          value={summary?.expiringSoon || 0}
          subtitle="รายการ"
          color="red"
          onClick={handleViewAllExpiry}
        />
        <StatsCard
          icon="สต็อกต่ำ"
          title="สต็อกต่ำ"
          value={summary?.lowStockCount || 0}
          subtitle="รายการต้องสั่งซื้อ"
          color="yellow"
          onClick={() => {
            window.location.hash = '#stock/low-stock';
          }}
        />
        <StatsCard
          icon="PO"
          title="PO รออนุมัติ"
          value={summary?.pendingApprovals || 0}
          subtitle="ใบ"
          color="purple"
          onClick={() => {
            window.location.hash = '#procurement';
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <button
          type="button"
          onClick={() => {
            window.location.hash = '#stock';
          }}
          className="rounded-lg bg-white p-4 text-left shadow transition-shadow hover:shadow-md"
        >
          <div className="text-sm text-gray-500">สินค้าทั้งหมด</div>
          <div className="text-xl font-bold text-gray-900">{summary?.totalProducts || 0}</div>
        </button>
        <button
          type="button"
          onClick={() => {
            window.location.hash = '#stock/in-stock';
          }}
          className="rounded-lg bg-white p-4 text-left shadow transition-shadow hover:shadow-md"
        >
          <div className="text-sm text-gray-500">สินค้าที่มีสต็อก</div>
          <div className="text-xl font-bold text-gray-900">{summary?.productsInStock || 0}</div>
        </button>
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="text-sm text-gray-500">ซัพพลายเออร์</div>
          <div className="text-xl font-bold text-gray-900">{summary?.totalSuppliers || 0}</div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="text-sm text-gray-500">ธุรกรรมวันนี้</div>
          <div className="text-xl font-bold text-gray-900">{summary?.recentTransactions || 0}</div>
        </div>
      </div>

      <ExpiryAlertsTable
        alerts={expiryAlerts || []}
        loading={alertsLoading}
        onViewAll={handleViewAllExpiry}
        onSelectAlert={(alert) => setSelectedExpiryAlert(alert)}
      />

      {lowStockItems && lowStockItems.length > 0 && (
        <div className="rounded-lg bg-white shadow">
          <div className="px-4 py-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-medium leading-6 text-gray-900">รายการสต็อกต่ำ</h3>
              <button
                type="button"
                onClick={() => {
                  window.location.hash = '#stock/low-stock';
                }}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                ดูทั้งหมด
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="bg-gray-50 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">รายการ</th>
                    <th className="bg-gray-50 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">สต็อกปัจจุบัน</th>
                    <th className="bg-gray-50 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">ระดับต่ำสุด</th>
                    <th className="bg-gray-50 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">สถานะ</th>
                    <th className="bg-gray-50 px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {lowStockItems.slice(0, 5).map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-4">
                        <div className="font-medium text-gray-900">{item.name}</div>
                        <div className="text-xs text-gray-400">{item.code}</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-900">
                        {item.currentStock.toLocaleString('th-TH')} {item.unit}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-500">
                        {item.minLevel.toLocaleString('th-TH')} {item.unit}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">ต่ำ</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm">
                        <button type="button" className="text-blue-600 hover:text-blue-800">
                          สั่งซื้อ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={!!selectedExpiryAlert}
        onClose={() => setSelectedExpiryAlert(null)}
        title={selectedExpiryAlert ? `รายละเอียด ${selectedExpiryAlert.productName}` : 'รายละเอียด'}
        size="lg"
      >
        {selectedExpiryAlert && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="text-sm text-gray-500">รหัสสินค้า</div>
                <div className="font-medium text-gray-900">{selectedExpiryAlert.productId}</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="text-sm text-gray-500">Lot No.</div>
                <div className="font-medium text-gray-900">{selectedExpiryAlert.lotNumber}</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="text-sm text-gray-500">วันหมดอายุ</div>
                <div className="font-medium text-gray-900">
                  {new Date(selectedExpiryAlert.expiryDate).toLocaleDateString('th-TH')}
                </div>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="text-sm text-gray-500">จำนวนคงเหลือ</div>
                <div className="font-medium text-gray-900">
                  {selectedExpiryAlert.quantity.toLocaleString('th-TH')} {selectedExpiryAlert.unit}
                </div>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="text-sm text-gray-500">สถานะ</div>
                <div className="font-medium text-gray-900">{selectedExpiryAlert.status}</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="text-sm text-gray-500">เหลือเวลา</div>
                <div className="font-medium text-gray-900">{selectedExpiryAlert.daysUntilExpiry} วัน</div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500">ตำแหน่งจัดเก็บ</div>
              <div className="mt-1 font-medium text-gray-900">{selectedExpiryAlert.location || '-'}</div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DashboardPage;
