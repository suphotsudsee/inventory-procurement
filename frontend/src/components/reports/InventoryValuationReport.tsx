import React, { useState } from 'react';
import { InventoryValuation } from '../../services/api';
import { Button } from '../common/Button';

interface InventoryValuationReportProps {
  data: InventoryValuation[];
  loading?: boolean;
  onExport?: () => void;
}

export const InventoryValuationReport: React.FC<InventoryValuationReportProps> = ({
  data,
  loading = false,
  onExport,
}) => {
  const [sortBy, setSortBy] = useState<'category' | 'totalValue'>('totalValue');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const sortedData = [...data].sort((a, b) => {
    const multiplier = sortOrder === 'asc' ? 1 : -1;
    if (sortBy === 'category') {
      return multiplier * a.category.localeCompare(b.category);
    }
    return multiplier * (a.totalValue - b.totalValue);
  });

  const grandTotal = data.reduce((sum, item) => sum + item.totalValue, 0);

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded mb-4 w-1/4"></div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          📊 รายงานมูลค่าสินค้าคงเหลือ
        </h3>
        <div className="flex items-center gap-3">
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [by, order] = e.target.value.split('-');
              setSortBy(by as 'category' | 'totalValue');
              setSortOrder(order as 'asc' | 'desc');
            }}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="totalValue-desc">มูลค่า มาก → น้อย</option>
            <option value="totalValue-asc">มูลค่า น้อย → มาก</option>
            <option value="category-asc">หมวดหมู่ A → Z</option>
            <option value="category-desc">หมวดหมู่ Z → A</option>
          </select>
          {onExport && (
            <Button variant="secondary" size="sm" onClick={onExport}>
              📥 ส่งออก
            </Button>
          )}
        </div>
      </div>

      {/* Chart placeholder */}
      <div className="px-4 py-6 bg-gray-50">
        <div className="h-48 bg-gray-200 rounded flex items-center justify-center text-gray-400">
          📈 Pie Chart - สัดส่วนมูลค่าตามหมวดหมู่
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                หมวดหมู่
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                จำนวนรายการ
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                ปริมาณรวม
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                มูลค่ารวม
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                สัดส่วน
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedData.map((item) => (
              <tr key={item.category} className="hover:bg-gray-50">
                <td className="px-4 py-4 text-sm font-medium text-gray-900">
                  {item.category}
                </td>
                <td className="px-4 py-4 text-sm text-gray-500 text-right">
                  {item.itemCount.toLocaleString('th-TH')}
                </td>
                <td className="px-4 py-4 text-sm text-gray-500 text-right">
                  {item.totalQuantity.toLocaleString('th-TH')}
                </td>
                <td className="px-4 py-4 text-sm font-medium text-gray-900 text-right">
                  ฿{item.totalValue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-4 text-sm text-gray-500 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 rounded-full h-2" 
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                    <span className="w-12 text-right">{item.percentage.toFixed(1)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50">
            <tr>
              <td className="px-4 py-4 text-sm font-bold text-gray-900">
                รวมทั้งหมด
              </td>
              <td className="px-4 py-4 text-sm font-bold text-gray-900 text-right">
                {data.reduce((sum, item) => sum + item.itemCount, 0).toLocaleString('th-TH')}
              </td>
              <td className="px-4 py-4 text-sm font-bold text-gray-900 text-right">
                {data.reduce((sum, item) => sum + item.totalQuantity, 0).toLocaleString('th-TH')}
              </td>
              <td className="px-4 py-4 text-sm font-bold text-gray-900 text-right">
                ฿{grandTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-4 text-sm font-bold text-gray-900 text-right">
                100%
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Summary */}
      <div className="px-4 py-4 bg-blue-50 border-t border-blue-100">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-blue-600">มูลค่าสินค้าคงเหลือทั้งหมด</div>
            <div className="text-2xl font-bold text-blue-900">
              ฿{grandTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-blue-600">จำนวนหมวดหมู่</div>
            <div className="text-2xl font-bold text-blue-900">{data.length}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryValuationReport;