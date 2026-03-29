import React, { useState } from 'react';
import { PurchaseOrderItem, Supplier, Product } from '../../services/api';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';

interface PurchaseOrderFormProps {
  suppliers: Supplier[];
  products: Product[];
  lowStockProducts?: Product[];
  onSubmit: (data: {
    supplierId: string;
    expectedDate: string;
    items: PurchaseOrderItem[];
    notes?: string;
  }) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export const PurchaseOrderForm: React.FC<PurchaseOrderFormProps> = ({
  suppliers,
  products,
  lowStockProducts = [],
  onSubmit,
  onCancel,
  loading = false,
}) => {
  const [supplierId, setSupplierId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Pre-fill with low stock products if provided
  React.useEffect(() => {
    if (lowStockProducts.length > 0 && items.length === 0) {
      const lowStockItems = lowStockProducts.map((p) => ({
        productId: p.id,
        quantity: Math.max(p.maxLevel - p.currentStock, p.reorderPoint),
        unitPrice: p.unitCost,
      }));
      setItems(lowStockItems);
    }
  }, [lowStockProducts]);

  const addItem = () => {
    setItems([...items, { productId: '', quantity: 1, unitPrice: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof OrderItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!supplierId) {
      newErrors.supplierId = 'กรุณาเลือกซัพพลายเออร์';
    }
    if (!expectedDate) {
      newErrors.expectedDate = 'กรุณาระบุวันที่คาดว่าจะได้รับ';
    }
    if (items.length === 0) {
      newErrors.items = 'กรุณาเพิ่มอย่างน้อย 1 รายการ';
    } else {
      items.forEach((item, index) => {
        if (!item.productId) {
          newErrors[`item_${index}_productId`] = 'กรุณาเลือกสินค้า';
        }
        if (item.quantity <= 0) {
          newErrors[`item_${index}_quantity`] = 'จำนวนต้องมากกว่า 0';
        }
        if (item.unitPrice <= 0) {
          newErrors[`item_${index}_unitPrice`] = 'ราคาต้องมากกว่า 0';
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;

    await onSubmit({
      supplierId,
      expectedDate,
      notes: notes || undefined,
      items: items.map((item) => ({
        productId: item.productId,
        productName: products.find((p) => p.id === item.productId)?.name || '',
        quantity: item.quantity,
        unit: products.find((p) => p.id === item.productId)?.unit || '',
        unitPrice: item.unitPrice,
        totalPrice: item.quantity * item.unitPrice,
      })),
    });
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  };

  // Get products filtered by supplier (if applicable)
  const availableProducts = products.filter((p) => !p.supplierId || p.supplierId === supplierId || !supplierId);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Supplier and Date */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="ซัพพลายเออร์"
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          options={suppliers.filter((s) => s.active).map((s) => ({ value: s.id, label: s.name }))}
          emptyOption="-- เลือกซัพพลายเออร์ --"
          error={errors.supplierId}
          required
        />
        <Input
          label="วันที่คาดว่าจะได้รับ"
          type="date"
          value={expectedDate}
          onChange={(e) => setExpectedDate(e.target.value)}
          error={errors.expectedDate}
          required
        />
      </div>

      {/* Items */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
          <h4 className="font-medium text-gray-900">รายการสั่งซื้อ</h4>
          <Button type="button" variant="secondary" size="sm" onClick={addItem}>
            + เพิ่มรายการ
          </Button>
        </div>

        {items.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            ยังไม่มีรายการ กรุณาเพิ่มรายการสินค้า
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">สินค้า</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">จำนวน</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">หน่วย</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">ราคา/หน่วย</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">รวม</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((item, index) => {
                  const product = products.find((p) => p.id === item.productId);
                  return (
                    <tr key={index}>
                      <td className="px-3 py-2">
                        <select
                          value={item.productId}
                          onChange={(e) => updateItem(index, 'productId', e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">-- เลือกสินค้า --</option>
                          {availableProducts.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.code} - {p.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                          className="w-20 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="1"
                        />
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-500">
                        {product?.unit || '-'}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="w-24 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="0"
                          step="0.01"
                        />
                      </td>
                      <td className="px-3 py-2 text-sm font-medium">
                        ฿{(item.quantity * item.unitPrice).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Notes and Total */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="หมายเหตุเพิ่มเติม..."
          />
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm text-gray-500 mb-1">มูลค่ารวม</div>
          <div className="text-2xl font-bold text-gray-900">
            ฿{calculateTotal().toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {items.length} รายการ
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>
          ยกเลิก
        </Button>
        <Button type="submit" variant="primary" loading={loading}>
          สร้าง PO
        </Button>
      </div>
    </form>
  );
};

export default PurchaseOrderForm;