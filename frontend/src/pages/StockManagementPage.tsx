import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  stockApi,
  Product,
  StockItem,
  DrugstoreReceiveImportSummary,
  procurementApi,
  Supplier,
} from '../services/api';
import {
  StockTable,
  GoodsReceiptForm,
  StockAdjustmentForm,
  BarcodeScanner,
  ProductCatalogManager,
} from '../components/stock';
import { Modal } from '../components/common/Modal';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';

type TabType = 'stock' | 'catalog' | 'receive' | 'adjust' | 'history';

function getStockFiltersFromHash() {
  const mode = window.location.hash.replace(/^#/, '').split('/')[1] || '';
  return {
    lowStock: mode === 'low-stock' || mode === 'in-stock-low-stock',
    inStock: mode === 'in-stock' || mode === 'in-stock-low-stock',
  };
}

function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

export const StockManagementPage: React.FC = () => {
  const initialFilters = getStockFiltersFromHash();
  const queryClient = useQueryClient();
  const receiveInputRef = useRef<HTMLInputElement | null>(null);
  const detailInputRef = useRef<HTMLInputElement | null>(null);

  const [activeTab, setActiveTab] = useState<TabType>('stock');
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();
  const [selectedStockItem, setSelectedStockItem] = useState<StockItem | undefined>();
  const [selectedReceiveFile, setSelectedReceiveFile] = useState<File | null>(null);
  const [selectedDetailFile, setSelectedDetailFile] = useState<File | null>(null);
  const [importSummary, setImportSummary] = useState<DrugstoreReceiveImportSummary | null>(null);
  const [importError, setImportError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [drugtypeFilter, setDrugtypeFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(initialFilters.lowStock);
  const [inStockOnly, setInStockOnly] = useState(initialFilters.inStock);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const shouldLoadAllProducts = showReceiptModal || activeTab === 'receive';

  const {
    data: paginatedProducts,
    isLoading: productsLoading,
    error: productsError,
    refetch: refetchProducts,
  } = useQuery({
    queryKey: ['products', 'paginated', { search, categoryFilter, drugtypeFilter, lowStockOnly, inStockOnly, currentPage, pageSize }],
    queryFn: async () => {
      const response = await stockApi.getProductsPage({
        search: search || undefined,
        category: categoryFilter || undefined,
        drugtype: drugtypeFilter || undefined,
        lowStock: lowStockOnly,
        inStock: inStockOnly,
        page: currentPage,
        limit: pageSize,
      });
      return response.data;
    },
    placeholderData: (previousData) => previousData,
  });

  const { data: categories } = useQuery({
    queryKey: ['product-categories'],
    queryFn: async () => {
      const response = await stockApi.getProductCategories();
      return response.data;
    },
  });

  const { data: drugtypes = [] } = useQuery({
    queryKey: ['product-drugtypes'],
    queryFn: async () => {
      const response = await stockApi.getProductDrugtypes();
      return response.data;
    },
  });

  const { data: allProducts } = useQuery({
    queryKey: ['products', 'all'],
    queryFn: async () => {
      const response = await stockApi.getProducts();
      return response.data;
    },
    enabled: shouldLoadAllProducts,
  });

  const { data: stockItems = [] } = useQuery({
    queryKey: ['stock-items', selectedProduct?.id],
    queryFn: async () => {
      if (!selectedProduct) return [];
      const response = await stockApi.getStockItems(selectedProduct.id);
      return response.data;
    },
    enabled: !!selectedProduct,
  });

  const { data: suppliersRaw } = useQuery({
    queryKey: ['stock-management', 'suppliers'],
    queryFn: async () => {
      const response = await procurementApi.getSuppliers();
      return response.data;
    },
  });

  const createReceiptMutation = useMutation({
    mutationFn: stockApi.createGoodsReceipt,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-items'] });
      setShowReceiptModal(false);
    },
  });

  const createAdjustmentMutation = useMutation({
    mutationFn: stockApi.createAdjustment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-items'] });
      setShowAdjustModal(false);
      setSelectedProduct(undefined);
      setSelectedStockItem(undefined);
    },
  });

  const importDrugstoreReceiveBundleMutation = useMutation({
    mutationFn: async ({ receiveFile, detailFile }: { receiveFile: File; detailFile: File }) => {
      const [receiveContent, detailContent] = await Promise.all([receiveFile.text(), detailFile.text()]);
      const response = await stockApi.importDrugstoreReceiveBundle({
        receiveFileName: receiveFile.name,
        receiveContent,
        detailFileName: detailFile.name,
        detailContent,
      });
      return response.data;
    },
    onSuccess: (summary) => {
      setImportSummary(summary);
      setImportError('');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-items'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error: any) => {
      setImportSummary(null);
      setImportError(error?.response?.data?.message || error?.message || 'ไม่สามารถนำเข้าไฟล์ได้');
    },
  });

  const handleScan = async (barcode: string) => {
    try {
      await stockApi.scanBarcode(barcode);
      setShowScanner(false);
    } catch (error) {
      console.error('Barcode scan failed:', error);
      alert('ไม่พบสินค้าที่มีบาร์โค้ดนี้');
    }
  };

  const handleReceive = (product?: Product) => {
    setSelectedProduct(product);
    setShowReceiptModal(true);
  };

  const handleAdjust = (product: Product) => {
    setSelectedProduct(product);
    setSelectedStockItem(undefined);
    setShowAdjustModal(true);
  };

  const handleSubmitReceipt = async (data: any) => {
    await createReceiptMutation.mutateAsync(data);
  };

  const handleSubmitAdjustment = async (data: any) => {
    await createAdjustmentMutation.mutateAsync(data);
  };

  const handleOpenImportModal = () => {
    setShowImportModal(true);
    setSelectedReceiveFile(null);
    setSelectedDetailFile(null);
    setImportSummary(null);
    setImportError('');
  };

  const handleCloseImportModal = () => {
    setShowImportModal(false);
    setSelectedReceiveFile(null);
    setSelectedDetailFile(null);
    setImportSummary(null);
    setImportError('');
    if (receiveInputRef.current) {
      receiveInputRef.current.value = '';
    }
    if (detailInputRef.current) {
      detailInputRef.current.value = '';
    }
  };

  const handleImportSubmit = async () => {
    if (!selectedReceiveFile || !selectedDetailFile) {
      setImportError('กรุณาเลือกทั้งไฟล์ drugstorereceive.csv และ drugstorereceivedetail.csv');
      return;
    }

    await importDrugstoreReceiveBundleMutation.mutateAsync({
      receiveFile: selectedReceiveFile,
      detailFile: selectedDetailFile,
    });
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleCategoryChange = (value: string) => {
    setCategoryFilter(value);
    setCurrentPage(1);
  };

  const handleDrugtypeChange = (value: string) => {
    setDrugtypeFilter(value);
    setCurrentPage(1);
  };

  const handleLowStockChange = (value: boolean) => {
    setLowStockOnly(value);
    setCurrentPage(1);
  };

  const handleInStockChange = (value: boolean) => {
    setInStockOnly(value);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (value: number) => {
    setPageSize(value);
    setCurrentPage(1);
  };

  const stockProducts = paginatedProducts?.items || [];
  const receiptProducts = allProducts || stockProducts;
  const suppliers = ensureArray<Supplier>(suppliersRaw);
  const totalItems = paginatedProducts?.pagination.total || 0;
  const totalPages = paginatedProducts?.pagination.totalPages || 1;
  const hasFilters = Boolean(search || categoryFilter || drugtypeFilter || lowStockOnly || inStockOnly);
  const adjustmentStockItem = selectedStockItem || stockItems[0];

  useEffect(() => {
    if (lowStockOnly && inStockOnly) {
      window.location.hash = '#stock/in-stock-low-stock';
      return;
    }
    if (lowStockOnly) {
      window.location.hash = '#stock/low-stock';
      return;
    }
    if (inStockOnly) {
      window.location.hash = '#stock/in-stock';
      return;
    }
    window.location.hash = '#stock';
  }, [lowStockOnly, inStockOnly]);

  useEffect(() => {
    const syncFromHash = () => {
      const filters = getStockFiltersFromHash();
      setLowStockOnly(filters.lowStock);
      setInStockOnly(filters.inStock);
      setCurrentPage(1);
    };

    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  if (productsLoading && !paginatedProducts) {
    return <Loading fullScreen message="กำลังโหลดข้อมูลสต็อก..." />;
  }

  if (productsError) {
    return (
      <ErrorState
        message="ไม่สามารถโหลดข้อมูลสต็อก"
        error={productsError as Error}
        onRetry={() => refetchProducts()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">จัดการสต็อก</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={handleOpenImportModal} leftIcon="CSV">
            นำเข้า drugstorereceive + detail
          </Button>
          <Button variant="secondary" onClick={() => setShowScanner(true)} leftIcon="Scan">
            สแกนบาร์โค้ด
          </Button>
          <Button variant="primary" onClick={() => handleReceive()} leftIcon="GR">
            รับสินค้าเข้า
          </Button>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'stock', label: 'สต็อกคงเหลือ', icon: 'Stock' },
            { id: 'catalog', label: 'รายการยา', icon: 'Catalog' },
            { id: 'receive', label: 'รับสินค้าเข้า', icon: 'Receipt' },
            { id: 'adjust', label: 'ปรับสต็อก', icon: 'Adjust' },
            { id: 'history', label: 'ประวัติ', icon: 'History' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              } whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'stock' && (
        <>
          {stockProducts.length === 0 && !hasFilters ? (
            <EmptyState
              icon="Stock"
              title="ไม่มีข้อมูลสินค้า"
              description="เริ่มต้นด้วยการเพิ่มสินค้าหรือรับสินค้าเข้า"
              action={{
                label: 'รับสินค้าเข้า',
                onClick: () => handleReceive(),
              }}
            />
          ) : (
            <StockTable
              products={stockProducts}
              categories={categories || []}
              drugtypes={drugtypes}
              loading={productsLoading}
              search={search}
              categoryFilter={categoryFilter}
              drugtypeFilter={drugtypeFilter}
              lowStockOnly={lowStockOnly}
              inStockOnly={inStockOnly}
              currentPage={currentPage}
              pageSize={pageSize}
              totalItems={totalItems}
              totalPages={totalPages}
              onSearchChange={handleSearchChange}
              onCategoryChange={handleCategoryChange}
              onDrugtypeChange={handleDrugtypeChange}
              onLowStockChange={handleLowStockChange}
              onInStockChange={handleInStockChange}
              onPageChange={setCurrentPage}
              onPageSizeChange={handlePageSizeChange}
              onReceive={handleReceive}
              onAdjust={handleAdjust}
              onScan={() => setShowScanner(true)}
            />
          )}
        </>
      )}

      {activeTab === 'receive' && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-4 text-lg font-medium text-gray-900">รับสินค้าเข้า (Goods Receipt)</h3>
          <GoodsReceiptForm
            suppliers={suppliers || []}
            products={receiptProducts}
            onSubmit={handleSubmitReceipt}
            onCancel={() => setActiveTab('stock')}
            loading={createReceiptMutation.isPending}
          />
        </div>
      )}

      {activeTab === 'catalog' && <ProductCatalogManager />}

      {activeTab === 'adjust' && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-4 text-lg font-medium text-gray-900">ปรับสต็อก</h3>
          {selectedProduct ? (
            <StockAdjustmentForm
              product={selectedProduct}
              stockItem={adjustmentStockItem}
              onSubmit={handleSubmitAdjustment}
              onCancel={() => {
                setSelectedProduct(undefined);
                setSelectedStockItem(undefined);
                setActiveTab('stock');
              }}
              loading={createAdjustmentMutation.isPending}
            />
          ) : (
            <div className="py-8 text-center text-gray-500">
              <p>กรุณาเลือกสินค้าจากตารางสต็อกคงเหลือ</p>
              <Button variant="secondary" onClick={() => setActiveTab('stock')} className="mt-4">
                ไปยังตารางสต็อก
              </Button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-4 text-lg font-medium text-gray-900">ประวัติการเคลื่อนไหวสินค้า</h3>
          <p className="py-8 text-center text-gray-500">ฟีเจอร์นี้อยู่ระหว่างการพัฒนา</p>
        </div>
      )}

      <Modal isOpen={showReceiptModal} onClose={() => setShowReceiptModal(false)} title="รับสินค้าเข้า" size="xl">
        <GoodsReceiptForm
          suppliers={suppliers || []}
          products={receiptProducts}
          onSubmit={handleSubmitReceipt}
          onCancel={() => setShowReceiptModal(false)}
          loading={createReceiptMutation.isPending}
        />
      </Modal>

      <Modal
        isOpen={showImportModal}
        onClose={handleCloseImportModal}
        title="นำเข้าไฟล์รับเข้าคลังจาก 2 CSV"
        size="lg"
      >
        <div className="space-y-4">
          <div className="rounded-md border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
            ต้องเลือกทั้งไฟล์ <strong>drugstorereceive.csv</strong> และ <strong>drugstorereceivedetail.csv</strong>
            พร้อมกัน ระบบจะลบ import ชุดเดิมของไฟล์ legacy นี้ก่อน แล้วนำเข้าใหม่ในรอบเดียว
          </div>

          <div>
            <label htmlFor="drugstorereceive-file" className="mb-2 block text-sm font-medium text-gray-700">
              ไฟล์ drugstorereceive.csv
            </label>
            <input
              ref={receiveInputRef}
              id="drugstorereceive-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                setSelectedReceiveFile(event.target.files?.[0] || null);
                setImportSummary(null);
                setImportError('');
              }}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700"
            />
            {selectedReceiveFile && (
              <p className="mt-2 text-sm text-gray-600">
                เลือกแล้ว: <span className="font-medium text-gray-900">{selectedReceiveFile.name}</span>
              </p>
            )}
          </div>

          <div>
            <label htmlFor="drugstorereceivedetail-file" className="mb-2 block text-sm font-medium text-gray-700">
              ไฟล์ drugstorereceivedetail.csv
            </label>
            <input
              ref={detailInputRef}
              id="drugstorereceivedetail-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                setSelectedDetailFile(event.target.files?.[0] || null);
                setImportSummary(null);
                setImportError('');
              }}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700"
            />
            {selectedDetailFile && (
              <p className="mt-2 text-sm text-gray-600">
                เลือกแล้ว: <span className="font-medium text-gray-900">{selectedDetailFile.name}</span>
              </p>
            )}
          </div>

          {importError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {importError}
            </div>
          )}

          {importSummary && (
            <div className="space-y-3 rounded-md border border-green-200 bg-green-50 p-4">
              <h4 className="text-sm font-semibold text-green-900">นำเข้าเรียบร้อย</h4>
              <div className="grid grid-cols-1 gap-2 text-sm text-green-900 sm:grid-cols-2">
                <div>ไฟล์หัวรับเข้า: {importSummary.receiveSourceRef}</div>
                <div>ไฟล์รายละเอียด: {importSummary.detailSourceRef}</div>
                <div>หัวรับเข้าทั้งหมด: {(importSummary.rawReceiveRows || 0).toLocaleString()}</div>
                <div>รายละเอียดทั้งหมด: {(importSummary.rawDetailRows || 0).toLocaleString()}</div>
                <div>หลังรวมรายละเอียด: {(importSummary.aggregatedDetailRows || 0).toLocaleString()}</div>
                <div>ใบรับเข้าที่สร้าง: {(importSummary.importedReceipts || 0).toLocaleString()}</div>
                <div>รายการรับเข้าที่สร้าง: {(importSummary.importedReceiptItems || 0).toLocaleString()}</div>
                <div>Lot ที่สร้าง: {importSummary.importedLots.toLocaleString()}</div>
                <div>จำนวนรวม: {importSummary.importedQuantity.toLocaleString()}</div>
                <div>มูลค่ารวม: {importSummary.importedValue.toLocaleString()}</div>
                <div>ข้าม: {importSummary.skippedRows.toLocaleString()}</div>
              </div>
              {importSummary.skippedSample.length > 0 && (
                <div className="text-sm text-green-900">
                  ตัวอย่างรหัสที่ข้าม: {importSummary.skippedSample.join(', ')}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={handleCloseImportModal}>
              ปิด
            </Button>
            <Button
              variant="primary"
              onClick={handleImportSubmit}
              loading={importDrugstoreReceiveBundleMutation.isPending}
            >
              นำเข้า 2 ไฟล์พร้อมกัน
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showAdjustModal}
        onClose={() => {
          setShowAdjustModal(false);
          setSelectedProduct(undefined);
          setSelectedStockItem(undefined);
        }}
        title="ปรับสต็อก"
        size="lg"
      >
        {selectedProduct && (
          <StockAdjustmentForm
            product={selectedProduct}
            stockItem={adjustmentStockItem}
            onSubmit={handleSubmitAdjustment}
            onCancel={() => {
              setShowAdjustModal(false);
              setSelectedProduct(undefined);
              setSelectedStockItem(undefined);
            }}
            loading={createAdjustmentMutation.isPending}
          />
        )}
      </Modal>

      <BarcodeScanner isOpen={showScanner} onClose={() => setShowScanner(false)} onScan={handleScan} />
    </div>
  );
};

export default StockManagementPage;
