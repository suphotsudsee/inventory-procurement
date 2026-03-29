import React, { useEffect, useState } from 'react';
import { StockAdjustment, Product, StockItem } from '../../services/api';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';

interface StockAdjustmentFormProps {
  product?: Product;
  stockItem?: StockItem;
  onSubmit: (data: Omit<StockAdjustment, 'id'>) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export const StockAdjustmentForm: React.FC<StockAdjustmentFormProps> = ({
  product,
  stockItem,
  onSubmit,
  onCancel,
  loading = false,
}) => {
  const [formData, setFormData] = useState({
    productId: product?.id || '',
    lotNumber: stockItem?.lotNumber || '',
    previousQty: stockItem?.quantity ?? product?.currentStock ?? 0,
    newQty: stockItem?.quantity ?? product?.currentStock ?? 0,
    reason: 'count_adjustment' as StockAdjustment['reason'],
    reasonDetail: '',
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setFormData((previous) => ({
      ...previous,
      productId: product?.id || '',
      lotNumber: stockItem?.lotNumber || '',
      previousQty: stockItem?.quantity ?? product?.currentStock ?? 0,
      newQty: stockItem?.quantity ?? product?.currentStock ?? 0,
    }));
    setErrors({});
  }, [product?.id, product?.currentStock, stockItem?.lotNumber, stockItem?.quantity]);

  const reasonOptions = [
    { value: 'count_adjustment', label: 'ปรับจากการตรวจนับ' },
    { value: 'damage', label: 'สินค้าเสียหาย' },
    { value: 'expired', label: 'หมดอายุ' },
    { value: 'lost', label: 'สินค้าสูญหาย' },
    { value: 'found', label: 'พบสินค้าเพิ่ม' },
    { value: 'other', label: 'อื่นๆ' },
  ];

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.lotNumber) {
      newErrors.lotNumber = 'กรุณาระบุ Lot No.';
    }
    if (formData.newQty < 0) {
      newErrors.newQty = 'จำนวนต้องไม่ติดลบ';
    }
    if (formData.newQty === formData.previousQty) {
      newErrors.newQty = 'จำนวนใหม่ต้องไม่เท่าเดิม';
    }
    if (!formData.reason) {
      newErrors.reason = 'กรุณาเลือกเหตุผล';
    }
    if (formData.reason === 'other' && !formData.reasonDetail) {
      newErrors.reasonDetail = 'กรุณาระบุรายละเอียด';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;

    await onSubmit({
      productId: formData.productId,
      productName: product?.name || '',
      lotNumber: formData.lotNumber,
      previousQty: formData.previousQty,
      newQty: formData.newQty,
      reason: formData.reason,
      reasonDetail: formData.reasonDetail,
      adjustmentDate: new Date().toISOString(),
      adjustedBy: '', // Will be filled by backend
      notes: formData.notes || undefined,
    });
  };

  const adjustment = formData.newQty - formData.previousQty;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Product Info */}
      {product && (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500">รหัสสินค้า</div>
              <div className="font-medium">{product.code}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">ชื่อสินค้า</div>
              <div className="font-medium">{product.name}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">หน่วย</div>
              <div>{product.unit}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">สต็อกปัจจุบัน</div>
              <div className="font-medium">{formData.previousQty.toLocaleString('th-TH')}</div>
            </div>
          </div>
        </div>
      )}

      {/* Adjustment Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Lot No."
          value={formData.lotNumber}
          onChange={(e) => setFormData({ ...formData, lotNumber: e.target.value })}
          error={errors.lotNumber}
          required
        />
        
        <Input
          label="จำนวนปัจจุบัน"
          type="number"
          value={formData.previousQty}
          disabled
          helperText="จำนวนสต็อกก่อนปรับ"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="จำนวนใหม่"
          type="number"
          value={formData.newQty}
          onChange={(e) => setFormData({ ...formData, newQty: parseInt(e.target.value) || 0 })}
          error={errors.newQty}
          required
        />

        <div className="flex items-end">
          <div className={`text-lg font-semibold ${adjustment >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {adjustment >= 0 ? '+' : ''}{adjustment.toLocaleString('th-TH')} {product?.unit}
          </div>
        </div>
      </div>

      <Select
        label="เหตุผลการปรับสต็อก"
        value={formData.reason}
        onChange={(e) => setFormData({ ...formData, reason: e.target.value as StockAdjustment['reason'] })}
        options={reasonOptions}
        error={errors.reason}
        required
      />

      {formData.reason === 'other' && (
        <Input
          label="รายละเอียด"
          value={formData.reasonDetail}
          onChange={(e) => setFormData({ ...formData, reasonDetail: e.target.value })}
          error={errors.reasonDetail}
          placeholder="กรุณาระบุเหตุผล"
          required
        />
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          placeholder="หมายเหตุเพิ่มเติม..."
        />
      </div>

      {/* Warning if adjustment is significant */}
      {Math.abs(adjustment) > 100 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <span className="text-yellow-600 mr-2">⚠️</span>
            <div className="text-sm text-yellow-800">
              การปรับสต็อกจำนวนมาก กรุณาตรวจสอบให้แน่ใจก่อนบันทึก
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>
          ยกเลิก
        </Button>
        <Button type="submit" variant="primary" loading={loading}>
          บันทึกการปรับสต็อก
        </Button>
      </div>
    </form>
  );
};

export default StockAdjustmentForm;
