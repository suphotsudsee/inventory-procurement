import React, { useMemo, useState } from 'react';
import { StockMovement } from '../../services/api';
import { Button } from '../common/Button';
import { Select } from '../common/Select';

interface StockMovementReportProps {
  data: StockMovement[];
  loading?: boolean;
  onExport?: () => void;
  onFilter?: (type: string) => void;
}

const movementTypeMeta: Record<
  StockMovement['movementType'],
  { label: string; badgeClass: string; summaryClass: string }
> = {
  receipt: {
    label: 'รับเข้า',
    badgeClass: 'bg-green-100 text-green-800',
    summaryClass: 'border-l-4 border-green-500',
  },
  dispensing: {
    label: 'เบิกจ่าย',
    badgeClass: 'bg-red-100 text-red-800',
    summaryClass: 'border-l-4 border-red-500',
  },
  adjustment: {
    label: 'ปรับสต็อก',
    badgeClass: 'bg-yellow-100 text-yellow-800',
    summaryClass: 'border-l-4 border-yellow-500',
  },
  transfer_in: {
    label: 'โอนเข้า',
    badgeClass: 'bg-blue-100 text-blue-800',
    summaryClass: 'border-l-4 border-blue-500',
  },
  transfer_out: {
    label: 'โอนออก',
    badgeClass: 'bg-purple-100 text-purple-800',
    summaryClass: 'border-l-4 border-purple-500',
  },
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export const StockMovementReport: React.FC<StockMovementReportProps> = ({
  data,
  loading = false,
  onExport,
  onFilter,
}) => {
  const [selectedType, setSelectedType] = useState<string>('');

  const filteredData = useMemo(() => {
    if (!selectedType) return data;
    return data.filter((item) => item.movementType === selectedType);
  }, [data, selectedType]);

  const summary = useMemo(
    () => ({
      receipt: data.filter((item) => item.movementType === 'receipt').length,
      dispensing: data.filter((item) => item.movementType === 'dispensing').length,
      adjustment: data.filter((item) => item.movementType === 'adjustment').length,
      transfer_in: data.filter((item) => item.movementType === 'transfer_in').length,
      transfer_out: data.filter((item) => item.movementType === 'transfer_out').length,
    }),
    [data]
  );

  const handleFilterChange = (value: string) => {
    setSelectedType(value);
    onFilter?.(value);
  };

  if (loading) {
    return (
      <div className="rounded-lg bg-white p-4 shadow">
        <div className="animate-pulse">
          <div className="mb-4 h-8 w-1/3 rounded bg-gray-200"></div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            {[1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="h-24 rounded bg-gray-200"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4">
        <h3 className="text-lg font-medium text-gray-900">รายงานการเคลื่อนไหวสินค้า</h3>
        <div className="flex items-center gap-3">
          <Select
            value={selectedType}
            onChange={(e) => handleFilterChange(e.target.value)}
            options={[
              { value: 'receipt', label: 'รับเข้า' },
              { value: 'dispensing', label: 'เบิกจ่าย' },
              { value: 'adjustment', label: 'ปรับสต็อก' },
              { value: 'transfer_in', label: 'โอนเข้า' },
              { value: 'transfer_out', label: 'โอนออก' },
            ]}
            emptyOption="ทุกประเภท"
          />
          {onExport && (
            <Button variant="secondary" size="sm" onClick={onExport}>
              ส่งออกรายงาน
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 bg-gray-50 p-4 md:grid-cols-5">
        {(Object.keys(summary) as Array<keyof typeof summary>).map((key) => (
          <div key={key} className={`rounded-lg bg-white p-4 ${movementTypeMeta[key].summaryClass}`}>
            <div className="text-sm text-gray-500">{movementTypeMeta[key].label}</div>
            <div className="text-2xl font-bold text-gray-900">{summary[key].toLocaleString('th-TH')}</div>
          </div>
        ))}
      </div>

      <div className="max-h-[32rem] overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="sticky top-0 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">วันที่</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">สินค้า</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Lot No.</th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">ประเภท</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">จำนวน</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">อ้างอิง</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">ผู้ดำเนินการ</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">หมายเหตุ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  ไม่พบรายการความเคลื่อนไหว
                </td>
              </tr>
            ) : (
              filteredData.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{formatDateTime(item.date)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{item.productName}</div>
                    <div className="text-xs text-gray-400">{item.productId}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{item.lotNumber || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-center">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${movementTypeMeta[item.movementType].badgeClass}`}>
                      {movementTypeMeta[item.movementType].label}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-gray-900">
                    {item.quantity.toLocaleString('th-TH')} {item.unit}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{item.reference || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{item.performedBy}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{item.notes || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
        <div>
          แสดง {filteredData.length.toLocaleString('th-TH')} จาก {data.length.toLocaleString('th-TH')} รายการ
        </div>
        <div>
          รับเข้า / ปรับสต็อก แยกประเภทชัดเจนแล้ว
        </div>
      </div>
    </div>
  );
};

export default StockMovementReport;
