import React, { useEffect, useMemo, useState } from 'react';
import { ExpiryAlert } from '../../services/api';

interface ExpiryAlertsTableProps {
  alerts: ExpiryAlert[];
  loading?: boolean;
  onViewAll?: () => void;
  onSelectAlert?: (alert: ExpiryAlert) => void;
}

export const ExpiryAlertsTable: React.FC<ExpiryAlertsTableProps> = ({
  alerts,
  loading = false,
  onViewAll,
  onSelectAlert,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [alerts]);

  const getStatusBadge = (status: ExpiryAlert['status']) => {
    switch (status) {
      case 'critical':
        return <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">&lt; 30 วัน</span>;
      case 'warning':
        return <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-800">&lt; 60 วัน</span>;
      default:
        return <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-800">&lt; 90 วัน</span>;
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  const sortedAlerts = useMemo(
    () => [...alerts].sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry),
    [alerts]
  );
  const totalItems = sortedAlerts.length;
  const totalPages = Math.max(Math.ceil(totalItems / pageSize), 1);
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedAlerts = sortedAlerts.slice(pageStartIndex, pageStartIndex + pageSize);
  const pageStart = totalItems === 0 ? 0 : pageStartIndex + 1;
  const pageEnd = totalItems === 0 ? 0 : Math.min(pageStartIndex + pageSize, totalItems);

  if (loading) {
    return (
      <div className="rounded-lg bg-white shadow">
        <div className="px-4 py-5 sm:p-6">
          <div className="animate-pulse">
            <div className="mb-4 h-4 w-1/4 rounded bg-gray-200"></div>
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-10 rounded bg-gray-200"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white shadow">
      <div className="px-4 py-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-medium leading-6 text-gray-900">ยาและเวชภัณฑ์ที่กำลังจะหมดอายุ</h3>
          {onViewAll && (
            <button type="button" onClick={onViewAll} className="text-sm text-blue-600 hover:text-blue-800">
              ดูทั้งหมด
            </button>
          )}
        </div>

        {alerts.length === 0 ? (
          <div className="py-8 text-center text-gray-500">ไม่มีรายการที่ใกล้หมดอายุ</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="bg-gray-50 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">รายการ</th>
                  <th className="bg-gray-50 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Lot No.</th>
                  <th className="bg-gray-50 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">วันหมดอายุ</th>
                  <th className="bg-gray-50 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">จำนวนคงเหลือ</th>
                  <th className="bg-gray-50 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">สถานะ</th>
                  <th className="bg-gray-50 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {paginatedAlerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-4">
                      <div className="text-sm font-medium text-gray-900">{alert.productName}</div>
                      {alert.location && <div className="text-xs text-gray-400">{alert.location}</div>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-500">{alert.lotNumber}</td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <div className={`text-sm ${alert.status === 'critical' ? 'font-medium text-red-600' : 'text-gray-900'}`}>
                        {formatDate(alert.expiryDate)}
                      </div>
                      <div className="text-xs text-gray-400">{alert.daysUntilExpiry} วัน</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-500">
                      {alert.quantity.toLocaleString('th-TH')} {alert.unit}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">{getStatusBadge(alert.status)}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm">
                      <button
                        type="button"
                        onClick={() => onSelectAlert?.(alert)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        ดูรายละเอียด
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalItems > 0 && (
          <div className="mt-4 flex flex-col gap-3 border-t border-gray-200 pt-4 text-sm text-gray-500 md:flex-row md:items-center md:justify-between">
            <div>
              แสดง {pageStart}-{pageEnd} จาก {totalItems.toLocaleString('th-TH')} รายการ
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={safeCurrentPage === 1}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ก่อนหน้า
              </button>
              <span className="min-w-24 text-center">
                หน้า {safeCurrentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={safeCurrentPage >= totalPages}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ถัดไป
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpiryAlertsTable;
