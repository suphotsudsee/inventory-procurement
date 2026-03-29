import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { stockApi, Product } from '../../services/api';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Loading } from '../common/Loading';
import { EmptyState } from '../common/EmptyState';

type ProductFormState = {
  code: string;
  name: string;
  genericName: string;
  category: string;
  unit: string;
  barcode: string;
  unitCost: string;
  minLevel: string;
  reorderPoint: string;
  maxLevel: string;
};

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

function createEmptyFormState(): ProductFormState {
  return {
    code: '',
    name: '',
    genericName: '',
    category: '',
    unit: '',
    barcode: '',
    unitCost: '0',
    minLevel: '0',
    reorderPoint: '0',
    maxLevel: '0',
  };
}

function buildFormState(product?: Product): ProductFormState {
  if (!product) {
    return createEmptyFormState();
  }

  return {
    code: product.code || '',
    name: product.name || '',
    genericName: product.genericName || '',
    category: product.category || '',
    unit: product.unit || '',
    barcode: product.barcode || '',
    unitCost: String(product.unitCost || 0),
    minLevel: String(product.minLevel || 0),
    reorderPoint: String(product.reorderPoint || 0),
    maxLevel: String(product.maxLevel || 0),
  };
}

export const ProductCatalogManager: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formState, setFormState] = useState<ProductFormState>(createEmptyFormState);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: categories = [] } = useQuery({
    queryKey: ['product-categories'],
    queryFn: async () => {
      const response = await stockApi.getProductCategories();
      return response.data;
    },
  });

  const {
    data: paginatedProducts,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['catalog-products', { search, categoryFilter, currentPage, pageSize }],
    queryFn: async () => {
      const response = await stockApi.getProductsPage({
        search: search || undefined,
        category: categoryFilter || undefined,
        page: currentPage,
        limit: pageSize,
      });
      return response.data;
    },
    placeholderData: (previousData) => previousData,
  });

  const saveProductMutation = useMutation({
    mutationFn: async (payload: ProductFormState) => {
      const body = {
        code: payload.code.trim(),
        name: payload.name.trim(),
        genericName: payload.genericName.trim(),
        category: payload.category,
        unit: payload.unit.trim(),
        barcode: payload.barcode.trim(),
        unitCost: Number(payload.unitCost || 0),
        minLevel: Number(payload.minLevel || 0),
        reorderPoint: Number(payload.reorderPoint || 0),
        maxLevel: Number(payload.maxLevel || 0),
      };

      if (editingProduct) {
        return stockApi.updateProduct(editingProduct.id, body);
      }

      return stockApi.createProduct(body as Omit<Product, 'id' | 'createdAt' | 'updatedAt'>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      setShowModal(false);
      setEditingProduct(null);
      setFormState(createEmptyFormState());
      setErrors({});
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: (productId: string) => stockApi.deleteProduct(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const products = paginatedProducts?.items || [];
  const totalItems = paginatedProducts?.pagination.total || 0;
  const totalPages = paginatedProducts?.pagination.totalPages || 1;
  const pageStart = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = totalItems === 0 ? 0 : Math.min(currentPage * pageSize, totalItems);

  const categoryOptions = useMemo(
    () => categories.map((category) => ({ value: category, label: category })),
    [categories]
  );

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormState(createEmptyFormState());
    setErrors({});
    setShowModal(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormState(buildFormState(product));
    setErrors({});
    setShowModal(true);
  };

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};

    if (!formState.code.trim()) nextErrors.code = 'กรุณากรอกรหัสยา';
    if (!formState.name.trim()) nextErrors.name = 'กรุณากรอกชื่อยา';
    if (!formState.category.trim()) nextErrors.category = 'กรุณาเลือกหมวดหมู่';
    if (!formState.unit.trim()) nextErrors.unit = 'กรุณากรอกหน่วย';

    const minLevel = Number(formState.minLevel || 0);
    const reorderPoint = Number(formState.reorderPoint || 0);
    const maxLevel = Number(formState.maxLevel || 0);

    if (minLevel < 0) nextErrors.minLevel = 'Min ต้องไม่น้อยกว่า 0';
    if (reorderPoint < minLevel) nextErrors.reorderPoint = 'Reorder ต้องไม่น้อยกว่า Min';
    if (maxLevel < reorderPoint) nextErrors.maxLevel = 'Max ต้องไม่น้อยกว่า Reorder';

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateForm()) return;
    await saveProductMutation.mutateAsync(formState);
  };

  const handleDelete = async (product: Product) => {
    if (!window.confirm(`ปิดใช้งานรายการยา ${product.name} (${product.code}) ?`)) {
      return;
    }
    await deleteProductMutation.mutateAsync(product.id);
  };

  if (isLoading && !paginatedProducts) {
    return <Loading message="กำลังโหลดรายการยา..." />;
  }

  if (error) {
    return (
      <div className="rounded-lg bg-white p-6 shadow">
        <div className="mb-4 text-lg font-medium text-red-700">ไม่สามารถโหลดรายการยาได้</div>
        <Button variant="secondary" onClick={() => refetch()}>
          ลองใหม่
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-white p-6 shadow">
        <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">รายการยาและเวชภัณฑ์</h3>
            <p className="text-sm text-gray-500">เพิ่ม แก้ไข และปิดใช้งานรายการยาใน master data</p>
          </div>
          <Button variant="primary" onClick={openCreateModal}>
            เพิ่มรายการยา
          </Button>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_160px]">
          <Input
            placeholder="ค้นหารหัสยา ชื่อยา generic name หรือบาร์โค้ด"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setCurrentPage(1);
            }}
          />
          <Select
            options={categoryOptions}
            value={categoryFilter}
            onChange={(event) => {
              setCategoryFilter(event.target.value);
              setCurrentPage(1);
            }}
            emptyOption="ทุกหมวดหมู่"
          />
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setCurrentPage(1);
            }}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} รายการ/หน้า
              </option>
            ))}
          </select>
        </div>

        {products.length === 0 ? (
          <EmptyState
            icon="Drug"
            title="ไม่พบรายการยา"
            description="ลองปรับคำค้นหรือเพิ่มรายการยาใหม่"
            action={{ label: 'เพิ่มรายการยา', onClick: openCreateModal }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">ยา</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">หมวด</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">หน่วย</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Threshold</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">ต้นทุน</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium text-gray-900">{product.name}</div>
                      <div className="text-xs text-gray-500">{product.code}</div>
                      {product.genericName && <div className="text-xs text-gray-400">{product.genericName}</div>}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">{product.category}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{product.unit || '-'}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      Min {product.minLevel} / Reorder {product.reorderPoint} / Max {product.maxLevel}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">฿{product.unitCost.toLocaleString('th-TH')}</td>
                    <td className="px-4 py-4 text-sm">
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => openEditModal(product)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          แก้ไข
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(product)}
                          className="text-red-600 hover:text-red-800"
                        >
                          ปิดใช้งาน
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3 border-t border-gray-200 pt-4 text-sm text-gray-500 md:flex-row md:items-center md:justify-between">
          <div>
            แสดง {pageStart}-{pageEnd} จาก {totalItems.toLocaleString('th-TH')} รายการ
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage((value) => Math.max(1, value - 1))}
              disabled={currentPage === 1}
            >
              ก่อนหน้า
            </Button>
            <span>
              หน้า {currentPage} / {Math.max(totalPages, 1)}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage((value) => Math.min(totalPages, value + 1))}
              disabled={currentPage >= totalPages}
            >
              ถัดไป
            </Button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingProduct ? 'แก้ไขรายการยา' : 'เพิ่มรายการยา'}
        size="lg"
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="รหัสยา"
              value={formState.code}
              onChange={(event) => setFormState((value) => ({ ...value, code: event.target.value }))}
              error={errors.code}
              disabled={Boolean(editingProduct)}
            />
            <Input
              label="บาร์โค้ด"
              value={formState.barcode}
              onChange={(event) => setFormState((value) => ({ ...value, barcode: event.target.value }))}
            />
          </div>

          <Input
            label="ชื่อยา"
            value={formState.name}
            onChange={(event) => setFormState((value) => ({ ...value, name: event.target.value }))}
            error={errors.name}
          />

          <Input
            label="ชื่อสามัญ / Generic Name"
            value={formState.genericName}
            onChange={(event) => setFormState((value) => ({ ...value, genericName: event.target.value }))}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="หมวดหมู่"
              options={categoryOptions}
              value={formState.category}
              onChange={(event) => setFormState((value) => ({ ...value, category: event.target.value }))}
              error={errors.category}
              emptyOption="เลือกหมวดหมู่"
            />
            <Input
              label="หน่วย"
              value={formState.unit}
              onChange={(event) => setFormState((value) => ({ ...value, unit: event.target.value }))}
              error={errors.unit}
              helperText="เช่น เม็ด, แผง, ขวด"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="ต้นทุนต่อหน่วย"
              type="number"
              min="0"
              step="0.01"
              value={formState.unitCost}
              onChange={(event) => setFormState((value) => ({ ...value, unitCost: event.target.value }))}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Input
              label="Min"
              type="number"
              min="0"
              value={formState.minLevel}
              onChange={(event) => setFormState((value) => ({ ...value, minLevel: event.target.value }))}
              error={errors.minLevel}
            />
            <Input
              label="Reorder Point"
              type="number"
              min="0"
              value={formState.reorderPoint}
              onChange={(event) => setFormState((value) => ({ ...value, reorderPoint: event.target.value }))}
              error={errors.reorderPoint}
            />
            <Input
              label="Max"
              type="number"
              min="0"
              value={formState.maxLevel}
              onChange={(event) => setFormState((value) => ({ ...value, maxLevel: event.target.value }))}
              error={errors.maxLevel}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>
              ยกเลิก
            </Button>
            <Button variant="primary" type="submit" loading={saveProductMutation.isPending}>
              {editingProduct ? 'บันทึกการแก้ไข' : 'เพิ่มรายการยา'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ProductCatalogManager;
