import React, { useState } from 'react';
import { PurchaseOrder } from '../../services/api';

interface PurchaseOrderListProps {
  orders: PurchaseOrder[];
  loading?: boolean;
  onView?: (order: PurchaseOrder) => void;
  onApprove?: (order: PurchaseOrder) => void;
  onCreateNew?: () => void;
}

export const PurchaseOrderList: React.FC<PurchaseOrderListProps> = ({
  orders,
  loading = false,
  onView,
  onApprove,
  onCreateNew,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  const statusOptions = [
    { value: '', label: 'ทุกสถานะ' },
    { value: 'draft', label: 'แบบร่าง' },
    { value: 'pending_approval', label: 'รออนุมัติ' },
    { value: 'approved', label: 'อนุมัติแล้ว' },
    { value: 'ordered', label: 'สั่งซื้อแล้ว' },
    { value: 'partial', label: 'รับบางส่วน' },
    { value: 'received', label: 'รับครบแล้ว' },
    { value: 'cancelled', label: 'ยกเลิก' },
  ];

  const getStatusBadge = (status: PurchaseOrder['status']) => {
    const statusConfig: Record<PurchaseOrder['status'], { label: string; color: string }> = {
      draft: { label: 'แบบร่าง', color: 'bg-gray-100 text-gray-800' },
      pending_approval: { label: 'รออนุมัติ', color: 'bg-yellow-100 text-yellow-800' },
      approved: { label: 'อนุมัติแล้ว', color: 'bg-green-100 text-green-800' },
      ordered: { label: 'สั่งซื้อแล้ว', color: 'bg-blue-100 text-blue-800' },
      partial: { label: 'รับบางส่วน', color: 'bg-purple-100 text-purple-800' },
      received: { label: 'รับครบแล้ว', color: 'bg-teal-100 text-teal-800' },
      cancelled: { label: 'ยกเลิก', color: 'bg-red-100 text-red-800' },
    };
    return statusConfig[status];
  };

  const filteredOrders = orders.filter((order) => {
    const matchesStatus = !statusFilter || order.status === statusFilter;
    const matchesSearch = !search || 
      order.poNumber.toLowerCase().includes(search.toLowerCase()) ||
      order.supplierName.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="p-4 animate-pulse">
          <div className="h-10 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1 flex gap-3">
            <input
              type="text"
              placeholder="ค้นหาเลขที่ PO หรือชื่อซัพพลายเออร์..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {onCreateNew && (
            <button
              onClick={onCreateNew}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              + สร้าง PO ใหม่
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                เลขที่ PO
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ซัพพลายเออร์
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                วันที่สั่ง
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                วันที่คาดว่าจะได้รับ
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                จำนวนรายการ
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                มูลค่ารวม
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                สถานะ
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                จัดการ
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  {search || statusFilter 
                    ? 'ไม่พบรายการที่ตรงกับเงื่อนไข' 
                    : 'ไม่มีใบสั่งซื้อ'}
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => {
                const statusBadge = getStatusBadge(order.status);
                return (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-blue-600">{order.poNumber}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{order.supplierName}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(order.orderDate)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(order.expectedDate)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {order.items.length} รายการ
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ฿{order.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusBadge.color}`}>
                        {statusBadge.label}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      {onView && (
                        <button
                          onClick={() => onView(order)}
                          className="text-blue-600 hover:text-blue-800 mr-3"
                        >
                          ดู
                        </button>
                      )}
                      {onApprove && order.status === 'pending_approval' && (
                        <button
                          onClick={() => onApprove(order)}
                          className="text-green-600 hover:text-green-800"
                        >
                          อนุมัติ
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-500">
        แสดง {filteredOrders.length} จาก {orders.length} รายการ
      </div>
    </div>
  );
};

export default PurchaseOrderList;