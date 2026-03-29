import React from 'react';
import { SupplierPerformance } from '../../services/api';

interface SupplierPerformanceDashboardProps {
  performance: SupplierPerformance[];
  loading?: boolean;
  onSelectSupplier?: (supplier: SupplierPerformance) => void;
}

export const SupplierPerformanceDashboard: React.FC<SupplierPerformanceDashboardProps> = ({
  performance,
  loading = false,
  onSelectSupplier,
}) => {
  const getRatingStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      if (i <= rating) {
        stars.push(<span key={i} className="text-yellow-400">★</span>);
      } else {
        stars.push(<span key={i} className="text-gray-300">★</span>);
      }
    }
    return stars;
  };

  const getDeliveryColor = (percentage: number) => {
    if (percentage >= 95) return 'text-green-600';
    if (percentage >= 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getQualityColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Calculate average rating from scores
  const getRating = (supplier: SupplierPerformance): number => {
    return Math.round((supplier.qualityScore / 20) + (supplier.onTimeDelivery / 50));
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white shadow rounded-lg p-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (performance.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-8 text-center">
        <div className="text-5xl mb-4">📊</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">ไม่มีข้อมูลประสิทธิภาพ</h3>
        <p className="text-sm text-gray-500">ยังไม่มีข้อมูลการประเมินซัพพลายเออร์</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white shadow rounded-lg p-4">
          <div className="text-sm text-gray-500">จำนวนซัพพลายเออร์ทั้งหมด</div>
          <div className="text-2xl font-bold text-gray-900">{performance.length}</div>
        </div>
        <div className="bg-white shadow rounded-lg p-4">
          <div className="text-sm text-gray-500">เฉลี่ยการส่งตรงเวลา</div>
          <div className="text-2xl font-bold text-green-600">
            {(performance.reduce((sum, p) => sum + p.onTimeDelivery, 0) / performance.length).toFixed(1)}%
          </div>
        </div>
        <div className="bg-white shadow rounded-lg p-4">
          <div className="text-sm text-gray-500">เฉลี่ยคะแนนคุณภาพ</div>
          <div className="text-2xl font-bold text-blue-600">
            {(performance.reduce((sum, p) => sum + p.qualityScore, 0) / performance.length).toFixed(1)}
          </div>
        </div>
        <div className="bg-white shadow rounded-lg p-4">
          <div className="text-sm text-gray-500">มูลค่าการซื้อทั้งหมด</div>
          <div className="text-2xl font-bold text-gray-900">
            ฿{(performance.reduce((sum, p) => sum + p.totalSpend, 0) / 1000000).toFixed(1)}M
          </div>
        </div>
      </div>

      {/* Performance Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ซัพพลายเออร์
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  เรตติ้ง
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ส่งตรงเวลา
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  คุณภาพ
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lead Time
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  มูลค่ารวม
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ปัญหา
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {performance.map((supplier) => (
                <tr key={supplier.supplierId} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <div className="font-medium text-gray-900">{supplier.supplierName}</div>
                    <div className="text-xs text-gray-500">
                      {supplier.totalOrders} ใบสั่งซื้อ
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="flex justify-center">
                      {getRatingStars(getRating(supplier))}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className={`font-medium ${getDeliveryColor(supplier.onTimeDelivery)}`}>
                      {supplier.onTimeDelivery.toFixed(1)}%
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className={`font-medium ${getQualityColor(supplier.qualityScore)}`}>
                      {supplier.qualityScore.toFixed(1)}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="text-gray-900">{supplier.avgLeadTime.toFixed(0)} วัน</div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="font-medium text-gray-900">
                      ฿{supplier.totalSpend.toLocaleString('th-TH')}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    {supplier.issues > 0 ? (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                        {supplier.issues} ปัญหา
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center">
                    {onSelectSupplier && (
                      <button
                        onClick={() => onSelectSupplier(supplier)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        ดูรายละเอียด
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SupplierPerformanceDashboard;