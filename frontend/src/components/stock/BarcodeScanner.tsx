import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../common/Button';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onScan,
  onClose,
  isOpen,
}) => {
  const [manualBarcode, setManualBarcode] = useState('');
  const [scanResult, setScanResult] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle keyboard input for barcode scanner (simulated)
  useEffect(() => {
    if (!isOpen) return;

    let barcodeBuffer = '';
    let timeout: ReturnType<typeof setTimeout>;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Barcode scanners typically send Enter at the end
      if (e.key === 'Enter' && barcodeBuffer.length > 0) {
        setScanResult(barcodeBuffer);
        onScan(barcodeBuffer);
        barcodeBuffer = '';
      } else if (e.key.length === 1) {
        barcodeBuffer += e.key;
        // Clear buffer after timeout (in case of partial scan)
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          barcodeBuffer = '';
        }, 100);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timeout);
    };
  }, [isOpen, onScan]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualBarcode.trim()) {
      onScan(manualBarcode.trim());
      setManualBarcode('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
          onClick={onClose}
        />

        {/* Modal panel */}
        <div className="relative bg-white rounded-lg shadow-xl transform transition-all sm:max-w-lg sm:w-full">
          {/* Header */}
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-medium leading-6 text-gray-900">
                📱 สแกนบาร์โค้ด
              </h3>
              <button
                type="button"
                className="ml-3 inline-flex items-center justify-center rounded-md text-gray-400 hover:text-gray-500"
                onClick={onClose}
              >
                <span className="sr-only">ปิด</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scanner area */}
            <div className="mt-6">
              {/* Camera preview placeholder */}
              <div className="bg-gray-900 rounded-lg aspect-video flex items-center justify-center mb-4">
                <div className="text-center text-white">
                  <svg className="h-12 w-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m4 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  <p className="text-sm opacity-50">ใช้เครื่องสแกนบาร์โค้ดหรือกรอกด้านล่าง</p>
                </div>
              </div>

              {/* Scan result */}
              {scanResult && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center">
                    <span className="text-green-600 mr-2">✓</span>
                    <span className="text-green-800 font-medium">{scanResult}</span>
                  </div>
                </div>
              )}

              {/* Manual input */}
              <form onSubmit={handleManualSubmit}>
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={manualBarcode}
                    onChange={(e) => setManualBarcode(e.target.value)}
                    placeholder="กรอกบาร์โค้ดหรือรหัสสินค้า..."
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Button type="submit" variant="primary">
                    ค้นหา
                  </Button>
                </div>
              </form>

              <p className="mt-2 text-xs text-gray-500">
                💡 ใช้เครื่องสแกนบาร์โค้ดเพื่อสแกนโดยอัตโนมัติ หรือกรอกรหัสด้วยมือ
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <Button variant="secondary" onClick={onClose}>
              ปิด
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BarcodeScanner;