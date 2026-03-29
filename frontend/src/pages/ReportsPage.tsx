import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi, ReportFilter } from '../services/api';
import { InventoryValuationReport, StockMovementReport, ExpiryReport } from '../components/reports';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Loading } from '../components/common/Loading';
import { ErrorState } from '../components/common/ErrorState';

type ReportType = 'valuation' | 'movement' | 'expiry' | 'supplier';

const getReportFromHash = (): ReportType => {
  const hash = window.location.hash.replace(/^#/, '');
  const reportSegment = hash.split('/')[1];

  if (reportSegment === 'movement') return 'movement';
  if (reportSegment === 'expiry') return 'expiry';
  if (reportSegment === 'supplier') return 'supplier';
  return 'valuation';
};

export const ReportsPage: React.FC = () => {
  const [activeReport, setActiveReport] = useState<ReportType>(getReportFromHash);
  const [filters, setFilters] = useState<ReportFilter>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    const onHashChange = () => setActiveReport(getReportFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Fetch inventory valuation
  const { 
    data: valuationData, 
    isLoading: valuationLoading, 
    error: valuationError,
    refetch: refetchValuation 
  } = useQuery({
    queryKey: ['inventory-valuation', filters],
    queryFn: async () => {
      const response = await reportsApi.getInventoryValuation(filters);
      return response.data;
    },
    enabled: activeReport === 'valuation',
  });

  // Fetch stock movements
  const { 
    data: movementData, 
    isLoading: movementLoading, 
    error: movementError,
    refetch: refetchMovement 
  } = useQuery({
    queryKey: ['stock-movements', filters],
    queryFn: async () => {
      const response = await reportsApi.getStockMovements(filters);
      return response.data;
    },
    enabled: activeReport === 'movement',
  });

  // Fetch expiry report
  const { 
    data: expiryData, 
    isLoading: expiryLoading, 
    error: expiryError,
    refetch: refetchExpiry 
  } = useQuery({
    queryKey: ['expiry-report', filters],
    queryFn: async () => {
      const response = await reportsApi.getExpiryReport(filters);
      return response.data;
    },
    enabled: activeReport === 'expiry',
  });

  // Fetch supplier performance
  const { 
    isLoading: supplierLoading, 
    error: supplierError,
    refetch: refetchSupplier 
  } = useQuery({
    queryKey: ['supplier-performance-report', filters],
    queryFn: async () => {
      const response = await reportsApi.getSupplierPerformanceReport(filters);
      return response.data;
    },
    enabled: activeReport === 'supplier',
  });

  const handleExport = async () => {
    try {
      let response;
      if (activeReport === 'valuation') {
        response = await reportsApi.exportInventoryValuation(filters);
      } else if (activeReport === 'movement') {
        response = await reportsApi.exportStockMovements(filters);
      }
      
      if (response) {
        // Create download link
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${activeReport}_report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('การส่งออกล้มเหลว กรุณาลองใหม่');
    }
  };

  const handleSelectReport = (report: ReportType) => {
    window.location.hash = `#reports/${report}`;
    setActiveReport(report);
  };

  const renderReport = () => {
    switch (activeReport) {
      case 'valuation':
        if (valuationError) {
          return (
            <ErrorState 
              message="ไม่สามารถโหลดรายงานมูลค่าสินค้าคงเหลือ" 
              error={valuationError as Error}
              onRetry={() => refetchValuation()}
            />
          );
        }
        return (
          <InventoryValuationReport
            data={valuationData || []}
            loading={valuationLoading}
            onExport={handleExport}
          />
        );
      
      case 'movement':
        if (movementError) {
          return (
            <ErrorState 
              message="ไม่สามารถโหลดรายงานการเคลื่อนไหวสินค้า" 
              error={movementError as Error}
              onRetry={() => refetchMovement()}
            />
          );
        }
        return (
          <StockMovementReport
            data={movementData || []}
            loading={movementLoading}
            onExport={handleExport}
          />
        );
      
      case 'expiry':
        if (expiryError) {
          return (
            <ErrorState 
              message="ไม่สามารถโหลดรายงานสินค้าใกล้หมดอายุ" 
              error={expiryError as Error}
              onRetry={() => refetchExpiry()}
            />
          );
        }
        return (
          <ExpiryReport
            data={expiryData || []}
            loading={expiryLoading}
            onExport={handleExport}
          />
        );
      
      case 'supplier':
        if (supplierError) {
          return (
            <ErrorState 
              message="ไม่สามารถโหลดรายงานประสิทธิภาพซัพพลายเออร์" 
              error={supplierError as Error}
              onRetry={() => refetchSupplier()}
            />
          );
        }
        return (
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              📊 รายงานประสิทธิภาพซัพพลายเออร์
            </h3>
            {supplierLoading ? (
              <Loading message="กำลังโหลด..." />
            ) : (
              <div className="text-center text-gray-500 py-8">
                ฟีเจอร์นี้อยู่ระหว่างการพัฒนา
              </div>
            )}
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">📈 รายงาน</h2>
        <Button
          variant="secondary"
          onClick={handleExport}
          leftIcon="📥"
        >
          ส่งออกรายงาน
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input
            label="วันที่เริ่มต้น"
            type="date"
            value={filters.startDate || ''}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
          />
          <Input
            label="วันที่สิ้นสุด"
            type="date"
            value={filters.endDate || ''}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
          />
          <Input
            label="หมวดหมู่"
            type="text"
            placeholder="ทุกหมวดหมู่"
            value={filters.category || ''}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          />
          <div className="flex items-end">
            <Button
              variant="primary"
              onClick={() => {
                // Trigger refetch based on active report
                if (activeReport === 'valuation') refetchValuation();
                if (activeReport === 'movement') refetchMovement();
                if (activeReport === 'expiry') refetchExpiry();
                if (activeReport === 'supplier') refetchSupplier();
              }}
              className="w-full"
            >
              🔍 ค้นหา
            </Button>
          </div>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'valuation', label: 'มูลค่าสินค้าคงเหลือ', icon: '💰' },
            { id: 'movement', label: 'การเคลื่อนไหวสินค้า', icon: '📊' },
            { id: 'expiry', label: 'สินค้าใกล้หมดอายุ', icon: '⚠️' },
            { id: 'supplier', label: 'ประสิทธิภาพซัพพลายเออร์', icon: '🏭' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleSelectReport(tab.id as ReportType)}
              className={`${
                activeReport === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Report Content */}
      {renderReport()}
    </div>
  );
};

export default ReportsPage;
