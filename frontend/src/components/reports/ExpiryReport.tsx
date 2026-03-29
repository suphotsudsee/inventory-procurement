import React, { useState } from 'react';
import { ExpiryAlert } from '../../services/api';
import { Button } from '../common/Button';
import { Select } from '../common/Select';
import { Modal } from '../common/Modal';

interface ExpiryReportProps {
  data: ExpiryAlert[];
  loading?: boolean;
  onExport?: () => void;
}

export const ExpiryReport: React.FC<ExpiryReportProps> = ({
  data,
  loading = false,
  onExport,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<ExpiryAlert | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const filteredData = statusFilter ? data.filter((item) => item.status === statusFilter) : data;
  const sortedData = [...filteredData].sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  const totalItems = sortedData.length;
  const totalPages = Math.max(Math.ceil(totalItems / pageSize), 1);
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedData = sortedData.slice(pageStartIndex, pageStartIndex + pageSize);
  const pageStart = totalItems === 0 ? 0 : pageStartIndex + 1;
  const pageEnd = totalItems === 0 ? 0 : Math.min(pageStartIndex + pageSize, totalItems);

  const summary = {
    critical: data.filter((item) => item.status === 'critical'),
    warning: data.filter((item) => item.status === 'warning'),
    normal: data.filter((item) => item.status === 'normal'),
  };

  const totalValue = data.reduce((sum, item) => sum + item.quantity * 100, 0);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, data, pageSize]);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  if (loading) {
    return (
      <div className="rounded-lg bg-white p-4 shadow">
        <div className="animate-pulse">
          <div className="mb-4 h-8 w-1/4 rounded bg-gray-200"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="h-16 rounded bg-gray-200"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4">
        <h3 className="text-lg font-medium text-gray-900">รายงานสินค้าใกล้หมดอายุ</h3>
        <div className="flex items-center gap-3">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: '', label: 'ทุกสถานะ' },
              { value: 'critical', label: 'วิกฤต (< 30 วัน)' },
              { value: 'warning', label: 'เตือน (30-60 วัน)' },
              { value: 'normal', label: 'ปกติ (60-90 วัน)' },
            ]}
          />
          {onExport && (
            <Button variant="secondary" size="sm" onClick={onExport}>
              ส่งออก
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 bg-gray-50 p-4 md:grid-cols-4">
        <div className="rounded-lg border-l-4 border-red-500 bg-white p-4">
          <div className="text-sm text-gray-500">วิกฤต (&lt; 30 วัน)</div>
          <div className="text-2xl font-bold text-red-600">{summary.critical.length}</div>
        </div>
        <div className="rounded-lg border-l-4 border-yellow-500 bg-white p-4">
          <div className="text-sm text-gray-500">เตือน (30-60 วัน)</div>
          <div className="text-2xl font-bold text-yellow-600">{summary.warning.length}</div>
        </div>
        <div className="rounded-lg border-l-4 border-blue-500 bg-white p-4">
          <div className="text-sm text-gray-500">ปกติ (60-90 วัน)</div>
          <div className="text-2xl font-bold text-blue-600">{summary.normal.length}</div>
        </div>
        <div className="rounded-lg bg-white p-4">
          <div className="text-sm text-gray-500">มูลค่าประมาณการ</div>
          <div className="text-2xl font-bold text-gray-900">฿{totalValue.toLocaleString('th-TH')}</div>
        </div>
      </div>

      <div className="max-h-96 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="sticky top-0 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">สินค้า</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Lot No.</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">วันหมดอายุ</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">จำนวนคงเหลือ</th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">เหลือเวลา</th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">สถานะ</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">ที่เก็บ</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  ไม่มีรายการที่ใกล้หมดอายุ
                </td>
              </tr>
            ) : (
              paginatedData.map((item) => {
                  const statusClass =
                    item.status === 'critical'
                      ? 'bg-red-100 text-red-800'
                      : item.status === 'warning'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-blue-100 text-blue-800';

                  return (
                    <tr key={item.id} className={item.status === 'critical' ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{item.productName}</div>
                        <div className="text-xs text-gray-400">{item.productId}</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{item.lotNumber}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{formatDate(item.expiryDate)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                        <div className="font-medium">{item.quantity.toLocaleString('th-TH')}</div>
                        <div className="text-xs text-gray-400">{item.unit}</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center">
                        <div className="font-bold text-gray-900">{item.daysUntilExpiry}</div>
                        <div className="text-xs text-gray-400">วัน</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass}`}>{item.status}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{item.location || '-'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        <button
                          type="button"
                          onClick={() => setSelectedItem(item)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          ดูรายละเอียด
                        </button>
                      </td>
                    </tr>
                  );
                })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-3">
        <div className="text-sm text-gray-500">
          แสดง {pageStart}-{pageEnd} จาก {totalItems} รายการ
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700"
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} รายการ/หน้า
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={safeCurrentPage === 1}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ก่อนหน้า
          </button>
          <span className="min-w-24 text-center text-sm text-gray-500">
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
          {summary.critical.length > 0 && (
            <Button variant="danger" size="sm">
              พิมพ์รายการวิกฤต ({summary.critical.length} รายการ)
            </Button>
          )}
        </div>
      </div>

      <Modal
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        title={selectedItem ? `รายละเอียด ${selectedItem.productName}` : 'รายละเอียด'}
        size="lg"
      >
        {selectedItem && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="text-sm text-gray-500">รหัสสินค้า</div>
                <div className="font-medium text-gray-900">{selectedItem.productId}</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="text-sm text-gray-500">Lot No.</div>
                <div className="font-medium text-gray-900">{selectedItem.lotNumber}</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="text-sm text-gray-500">วันหมดอายุ</div>
                <div className="font-medium text-gray-900">{formatDate(selectedItem.expiryDate)}</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="text-sm text-gray-500">จำนวนคงเหลือ</div>
                <div className="font-medium text-gray-900">
                  {selectedItem.quantity.toLocaleString('th-TH')} {selectedItem.unit}
                </div>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="text-sm text-gray-500">สถานะ</div>
                <div className="font-medium text-gray-900">{selectedItem.status}</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="text-sm text-gray-500">เหลือเวลา</div>
                <div className="font-medium text-gray-900">{selectedItem.daysUntilExpiry} วัน</div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500">ตำแหน่งจัดเก็บ</div>
              <div className="mt-1 font-medium text-gray-900">{selectedItem.location || '-'}</div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ExpiryReport;
