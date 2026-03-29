import React, { useState } from 'react';
import { GoodsReceiptItem, Supplier, Product } from '../../services/api';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';

interface GoodsReceiptFormProps {
  suppliers: Supplier[];
  products: Product[];
  onSubmit: (data: { supplierId: string; items: GoodsReceiptItem[]; invoiceNumber?: string; notes?: string }) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

interface ReceiptItem {
  productId: string;
  lotNumber: string;
  expiryDate: string;
  quantity: number;
  unitCost: number;
  location: string;
}

export const GoodsReceiptForm: React.FC<GoodsReceiptFormProps> = ({
  suppliers,
  products,
  onSubmit,
  onCancel,
  loading = false,
}) => {
  const safeSuppliers = Array.isArray(suppliers) ? suppliers : [];
  const safeProducts = Array.isArray(products) ? products : [];
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const addItem = () => {
    setItems([
      ...items,
      {
        productId: '',
        lotNumber: '',
        expiryDate: '',
        quantity: 1,
        unitCost: 0,
        location: '',
      },
    ]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof ReceiptItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!supplierId) {
      newErrors.supplierId = 'กรุณาเลือกซัพพลายเออร์';
    }

    if (items.length === 0) {
      newErrors.items = 'กรุณาเพิ่มอย่างน้อย 1 รายการ';
    } else {
      items.forEach((item, index) => {
        if (!item.productId) {
          newErrors[`item_${index}_productId`] = 'กรุณาเลือกสินค้า';
        }
        if (!item.lotNumber) {
          newErrors[`item_${index}_lotNumber`] = 'กรุณาระบุ Lot No.';
        }
        if (!item.expiryDate) {
          newErrors[`item_${index}_expiryDate`] = 'กรุณาระบุวันหมดอายุ';
        }
        if (item.quantity <= 0) {
          newErrors[`item_${index}_quantity`] = 'จำนวนต้องมากกว่า 0';
        }
        if (item.unitCost <= 0) {
          newErrors[`item_${index}_unitCost`] = 'ราคาต่อหน่วยต้องมากกว่า 0';
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
      invoiceNumber: invoiceNumber || undefined,
      notes: notes || undefined,
      items: items.map((item) => ({
        productId: item.productId,
        productName: safeProducts.find((p) => p.id === item.productId)?.name || '',
        lotNumber: item.lotNumber,
        expiryDate: item.expiryDate,
        quantity: item.quantity,
        unitCost: item.unitCost,
        location: item.location,
      })),
    });
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Supplier and Invoice Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="ซัพพลายเออร์"
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          options={safeSuppliers.map((s) => ({ value: s.id, label: s.name }))}
          emptyOption="-- เลือกซัพพลายเออร์ --"
          error={errors.supplierId}
          required
        />
        <Input
          label="เลขที่ใบกำกับภาษี"
          value={invoiceNumber}
          onChange={(e) => setInvoiceNumber(e.target.value)}
          placeholder="เช่น INV-2024-001"
        />
      </div>

      {/* Items Section */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
          <h4 className="font-medium text-gray-900">รายการรับเข้า</h4>
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
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Lot No.</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">วันหมดอายุ</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">จำนวน</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">หน่วย</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">ราคา/หน่วย</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">ที่เก็บ</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">รวม</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((item, index) => {
                  const product = safeProducts.find((p) => p.id === item.productId);
                  return (
                    <tr key={index}>
                      <td className="px-3 py-2">
                        <select
                          value={item.productId}
                          onChange={(e) => updateItem(index, 'productId', e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">-- เลือกสินค้า --</option>
                          {safeProducts.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.code} - {p.name}
                            </option>
                          ))}
                        </select>
                        {errors[`item_${index}_productId`] && (
                          <p className="text-xs text-red-600">{errors[`item_${index}_productId`]}</p>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={item.lotNumber}
                          onChange={(e) => updateItem(index, 'lotNumber', e.target.value)}
                          className="w-24 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="LOT-001"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="date"
                          value={item.expiryDate}
                          onChange={(e) => updateItem(index, 'expiryDate', e.target.value)}
                          className="w-32 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
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
                          value={item.unitCost}
                          onChange={(e) => updateItem(index, 'unitCost', parseFloat(e.target.value) || 0)}
                          className="w-24 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="0"
                          step="0.01"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={item.location}
                          onChange={(e) => updateItem(index, 'location', e.target.value)}
                          className="w-24 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="A-01"
                        />
                      </td>
                      <td className="px-3 py-2 text-sm font-medium">
                        ฿{(item.quantity * item.unitCost).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
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

      {/* Total and Notes */}
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
          บันทึกรับเข้า
        </Button>
      </div>
    </form>
  );
};

export default GoodsReceiptForm;
