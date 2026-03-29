import React from 'react';
import { ApprovalRequest } from '../../services/api';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';

interface ApprovalWorkflowProps {
  requests: ApprovalRequest[];
  loading?: boolean;
  onApprove: (request: ApprovalRequest) => Promise<void>;
  onReject: (request: ApprovalRequest, reason: string) => Promise<void>;
  onViewPO?: (request: ApprovalRequest) => void;
}

export const ApprovalWorkflow: React.FC<ApprovalWorkflowProps> = ({
  requests,
  loading = false,
  onApprove,
  onReject,
  onViewPO,
}) => {
  const [rejectModal, setRejectModal] = React.useState<{
    open: boolean;
    request: ApprovalRequest | null;
    reason: string;
  }>({
    open: false,
    request: null,
    reason: '',
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleRejectClick = (request: ApprovalRequest) => {
    setRejectModal({
      open: true,
      request,
      reason: '',
    });
  };

  const handleRejectConfirm = async () => {
    if (!rejectModal.request || !rejectModal.reason.trim()) return;
    
    await onReject(rejectModal.request, rejectModal.reason);
    setRejectModal({ open: false, request: null, reason: '' });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white shadow rounded-lg p-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-3"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-8 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">ไม่มีรายการรออนุมัติ</h3>
        <p className="text-sm text-gray-500">ทุกใบสั่งซื้อได้รับการอนุมัติแล้ว</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
        <div className="flex">
          <span className="text-yellow-600 mr-2">⚠️</span>
          <div className="text-sm text-yellow-800">
            มี {requests.length} รายการรอการอนุมัติ
          </div>
        </div>
      </div>

      {requests.map((request) => (
        <div key={request.id} className="bg-white shadow rounded-lg p-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            {/* Left: PO Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <h4 className="text-lg font-medium text-blue-600">{request.poNumber}</h4>
                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                  รออนุมัติ
                </span>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">ซัพพลายเออร์</div>
                  <div className="font-medium">{request.supplierName}</div>
                </div>
                <div>
                  <div className="text-gray-500">จำนวนรายการ</div>
                  <div className="font-medium">{request.itemCount} รายการ</div>
                </div>
                <div>
                  <div className="text-gray-500">มูลค่ารวม</div>
                  <div className="font-medium text-lg">
                    ฿{request.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">ผู้ขออนุมัติ</div>
                  <div className="font-medium">{request.requestedBy}</div>
                </div>
              </div>
              
              <div className="mt-2 text-xs text-gray-400">
                ขอเมื่อ {formatDate(request.requestedDate)}
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex gap-2">
              {onViewPO && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onViewPO(request)}
                >
                  ดูรายละเอียด
                </Button>
              )}
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleRejectClick(request)}
              >
                ปฏิเสธ
              </Button>
              <Button
                variant="success"
                size="sm"
                onClick={() => onApprove(request)}
              >
                อนุมัติ
              </Button>
            </div>
          </div>
        </div>
      ))}

      {/* Reject Modal */}
      <Modal
        isOpen={rejectModal.open}
        onClose={() => setRejectModal({ open: false, request: null, reason: '' })}
        title="ปฏิเสธใบสั่งซื้อ"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            กรุณาระบุเหตุผลในการปฏิเสธใบสั่งซื้อ {rejectModal.request?.poNumber}
          </p>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              เหตุผล *
            </label>
            <textarea
              value={rejectModal.reason}
              onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="ระบุเหตุผล..."
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => setRejectModal({ open: false, request: null, reason: '' })}
            >
              ยกเลิก
            </Button>
            <Button
              variant="danger"
              onClick={handleRejectConfirm}
              disabled={!rejectModal.reason.trim()}
            >
              ปฏิเสธ
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ApprovalWorkflow;