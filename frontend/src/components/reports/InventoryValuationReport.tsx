import React, { useState } from 'react';
import { InventoryValuation } from '../../services/api';
import { Button } from '../common/Button';

interface InventoryValuationReportProps {
  data: InventoryValuation[];
  loading?: boolean;
  onExport?: () => void;
}

const CHART_COLORS = ['#2563eb', '#0f766e', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#65a30d', '#ea580c'];

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
  const chartData = sortedData
    .filter((item) => item.totalValue > 0)
    .slice(0, 8)
    .map((item, index) => ({
      ...item,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));

  let accumulatedPercentage = 0;
  const pieSegments = chartData.map((item) => {
    const startAngle = (accumulatedPercentage / 100) * Math.PI * 2 - Math.PI / 2;
    accumulatedPercentage += item.percentage;
    const endAngle = (accumulatedPercentage / 100) * Math.PI * 2 - Math.PI / 2;
    const largeArcFlag = item.percentage > 50 ? 1 : 0;
    const radius = 36;
    const startX = 50 + radius * Math.cos(startAngle);
    const startY = 50 + radius * Math.sin(startAngle);
    const endX = 50 + radius * Math.cos(endAngle);
    const endY = 50 + radius * Math.sin(endAngle);

    return {
      ...item,
      path: `M 50 50 L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`,
    };
  });

  if (loading) {
    return (
      <div className="rounded-lg bg-white p-4 shadow animate-pulse">
        <div className="mb-4 h-8 w-1/4 rounded bg-gray-200" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="h-12 rounded bg-gray-200" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4">
        <h3 className="text-lg font-medium text-gray-900">รายงานมูลค่าสินค้าคงเหลือ</h3>
        <div className="flex items-center gap-3">
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [by, order] = e.target.value.split('-');
              setSortBy(by as 'category' | 'totalValue');
              setSortOrder(order as 'asc' | 'desc');
            }}
            className="rounded-md border border-gray-300 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="totalValue-desc">มูลค่า มาก ไป น้อย</option>
            <option value="totalValue-asc">มูลค่า น้อย ไป มาก</option>
            <option value="category-asc">หมวดหมู่ A ถึง Z</option>
            <option value="category-desc">หมวดหมู่ Z ถึง A</option>
          </select>
          {onExport && (
            <Button variant="secondary" size="sm" onClick={onExport}>
              ส่งออกรายงาน
            </Button>
          )}
        </div>
      </div>

      <div className="bg-gray-50 px-4 py-6">
        {chartData.length ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-center">
            <div className="mx-auto flex w-full max-w-xs flex-col items-center">
              <svg viewBox="0 0 100 100" className="h-56 w-56 drop-shadow-sm">
                <circle cx="50" cy="50" r="36" fill="#e5e7eb" />
                {pieSegments.map((segment) => (
                  <path key={segment.category} d={segment.path} fill={segment.color} stroke="#ffffff" strokeWidth="1.5" />
                ))}
                <circle cx="50" cy="50" r="18" fill="#ffffff" />
                <text x="50" y="47" textAnchor="middle" className="fill-gray-500 text-[4px] font-medium">
                  มูลค่ารวม
                </text>
                <text x="50" y="54" textAnchor="middle" className="fill-gray-900 text-[5px] font-bold">
                  {grandTotal.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                </text>
              </svg>
              <div className="mt-3 text-sm font-medium text-gray-700">สัดส่วนมูลค่าตามหมวดหมู่</div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {chartData.map((item) => (
                <div key={item.category} className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-1 h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-gray-900">{item.category}</div>
                      <div className="mt-1 text-sm text-gray-500">
                        ฿{item.totalValue.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-gray-900">{item.percentage.toFixed(1)}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center rounded bg-white text-sm text-gray-500">
            ไม่มีข้อมูลมูลค่าคงเหลือสำหรับแสดงกราฟ
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                หมวดหมู่
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                จำนวนรายการ
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                ปริมาณรวม
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                มูลค่ารวม
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                สัดส่วน
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {sortedData.map((item) => (
              <tr key={item.category} className="hover:bg-gray-50">
                <td className="px-4 py-4 text-sm font-medium text-gray-900">{item.category}</td>
                <td className="px-4 py-4 text-right text-sm text-gray-500">
                  {item.itemCount.toLocaleString('th-TH')}
                </td>
                <td className="px-4 py-4 text-right text-sm text-gray-500">
                  {item.totalQuantity.toLocaleString('th-TH')}
                </td>
                <td className="px-4 py-4 text-right text-sm font-medium text-gray-900">
                  ฿{item.totalValue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-4 text-right text-sm text-gray-500">
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-2 w-24 rounded-full bg-gray-200">
                      <div className="h-2 rounded-full bg-blue-600" style={{ width: `${item.percentage}%` }} />
                    </div>
                    <span className="w-12 text-right">{item.percentage.toFixed(1)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50">
            <tr>
              <td className="px-4 py-4 text-sm font-bold text-gray-900">รวมทั้งหมด</td>
              <td className="px-4 py-4 text-right text-sm font-bold text-gray-900">
                {data.reduce((sum, item) => sum + item.itemCount, 0).toLocaleString('th-TH')}
              </td>
              <td className="px-4 py-4 text-right text-sm font-bold text-gray-900">
                {data.reduce((sum, item) => sum + item.totalQuantity, 0).toLocaleString('th-TH')}
              </td>
              <td className="px-4 py-4 text-right text-sm font-bold text-gray-900">
                ฿{grandTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-4 text-right text-sm font-bold text-gray-900">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="border-t border-blue-100 bg-blue-50 px-4 py-4">
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
