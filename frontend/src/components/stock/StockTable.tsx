import React from 'react';
import { DrugtypeOption, Product } from '../../services/api';

interface StockTableProps {
  products: Product[];
  categories: string[];
  drugtypes: DrugtypeOption[];
  loading?: boolean;
  search: string;
  categoryFilter: string;
  drugtypeFilter: string;
  lowStockOnly: boolean;
  inStockOnly: boolean;
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onDrugtypeChange: (value: string) => void;
  onLowStockChange: (value: boolean) => void;
  onInStockChange: (value: boolean) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onEdit?: (product: Product) => void;
  onAdjust?: (product: Product) => void;
  onReceive?: (product: Product) => void;
  onScan?: () => void;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export const StockTable: React.FC<StockTableProps> = ({
  products,
  categories,
  drugtypes,
  loading = false,
  search,
  categoryFilter,
  drugtypeFilter,
  lowStockOnly,
  inStockOnly,
  currentPage,
  pageSize,
  totalItems,
  totalPages,
  onSearchChange,
  onCategoryChange,
  onDrugtypeChange,
  onLowStockChange,
  onInStockChange,
  onPageChange,
  onPageSizeChange,
  onEdit,
  onAdjust,
  onReceive,
  onScan,
}) => {
  const pageStart = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = totalItems === 0 ? 0 : Math.min(currentPage * pageSize, totalItems);
  const hasFilters = Boolean(search || categoryFilter || drugtypeFilter || lowStockOnly || inStockOnly);

  const getStockLevel = (product: Product) => {
    const percentage = product.maxLevel > 0 ? (product.currentStock / product.maxLevel) * 100 : 0;

    if (percentage <= 10) return { label: 'ต่ำมาก', color: 'bg-red-100 text-red-800' };
    if (percentage <= 30) return { label: 'ต่ำ', color: 'bg-yellow-100 text-yellow-800' };
    if (percentage <= 70) return { label: 'ปกติ', color: 'bg-green-100 text-green-800' };

    return { label: 'สูง', color: 'bg-blue-100 text-blue-800' };
  };

  if (loading) {
    return (
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="animate-pulse p-4">
          <div className="mb-4 h-10 rounded bg-gray-200" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="h-16 rounded bg-gray-200" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow">
      <div className="border-b border-gray-200 p-4">
        <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.2fr)_220px_260px] 2xl:flex 2xl:min-w-0 2xl:grid-cols-none 2xl:flex-nowrap">
            <div className="min-w-0 2xl:flex-1">
              <input
                type="text"
                placeholder="ค้นหาชื่อสินค้า, รหัส หรือบาร์โค้ด"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => onCategoryChange(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 2xl:w-[220px]"
            >
              <option value="">ทุกหมวดหมู่</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            <select
              value={drugtypeFilter}
              onChange={(e) => onDrugtypeChange(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 2xl:w-[260px]"
            >
              <option value="">ทุก drugtype</option>
              {drugtypes.map((drugtype) => (
                <option key={drugtype.code} value={drugtype.code}>
                  {drugtype.code} - {drugtype.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3 2xl:ml-4 2xl:flex-nowrap">
            <div className="flex flex-wrap items-center gap-3 2xl:flex-nowrap">
              {onScan && (
                <button
                  type="button"
                  onClick={onScan}
                  className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  สแกนบาร์โค้ด
                </button>
              )}
              
              <label className="flex cursor-pointer items-center whitespace-nowrap rounded-md border border-gray-200 px-3 py-2">
                <input
                  type="checkbox"
                  checked={lowStockOnly}
                  onChange={(e) => onLowStockChange(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">แสดงเฉพาะสต็อกต่ำ</span>
              </label>

              <label className="flex cursor-pointer items-center whitespace-nowrap rounded-md border border-gray-200 px-3 py-2">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => onInStockChange(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">แสดงเฉพาะสินค้าที่มีสต็อก</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">รายการ</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Drugtype</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">หมวดหมู่</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">สต็อกคงเหลือ</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">ระดับสต็อก</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">มูลค่า</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {products.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  {hasFilters ? 'ไม่พบรายการที่ตรงกับเงื่อนไข' : 'ไม่มีข้อมูลสินค้า'}
                </td>
              </tr>
            ) : (
              products.map((product) => {
                const stockLevel = getStockLevel(product);

                return (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium text-gray-900">{product.name}</div>
                      <div className="text-xs text-gray-500">{product.code}</div>
                      {product.barcode && <div className="text-xs text-gray-400">{product.barcode}</div>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-500">{product.drugtype || '-'}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-500">{product.category}</td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <div className="text-sm text-gray-900">
                        {product.currentStock.toLocaleString('th-TH')} {product.unit}
                      </div>
                      <div className="text-xs text-gray-400">
                        Min: {product.minLevel} / Max: {product.maxLevel}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${stockLevel.color}`}>
                        {stockLevel.label}
                      </span>
                      {product.currentStock <= product.reorderPoint && (
                        <span className="ml-2 text-xs text-red-600">ต้องสั่งซื้อ</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-500">
                      ฿{(product.currentStock * product.unitCost).toLocaleString('th-TH')}
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        {onReceive && (
                          <button
                            type="button"
                            onClick={() => onReceive(product)}
                            className="whitespace-nowrap text-green-600 hover:text-green-800"
                          >
                            รับเข้า
                          </button>
                        )}
                        {onAdjust && (
                          <button
                            type="button"
                            onClick={() => onAdjust(product)}
                            className="whitespace-nowrap text-blue-600 hover:text-blue-800"
                          >
                            ปรับสต็อก
                          </button>
                        )}
                        {onEdit && (
                          <button
                            type="button"
                            onClick={() => onEdit(product)}
                            className="whitespace-nowrap text-gray-600 hover:text-gray-800"
                          >
                            แก้ไข
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 md:flex-row md:items-center md:justify-between">
        <div>
          แสดง {pageStart}-{pageEnd} จาก {totalItems.toLocaleString('th-TH')} รายการ
        </div>

        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} รายการ/หน้า
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ก่อนหน้า
          </button>

          <span className="min-w-24 text-center">
            หน้า {currentPage} / {Math.max(totalPages, 1)}
          </span>

          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ถัดไป
          </button>
        </div>
      </div>
    </div>
  );
};

export default StockTable;
