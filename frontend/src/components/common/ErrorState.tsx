import React from 'react';

interface ErrorStateProps {
  message?: string;
  error?: Error | string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ 
  message = 'เกิดข้อผิดพลาด', 
  error, 
  onRetry 
}) => {
  const errorMessage = error 
    ? (typeof error === 'string' ? error : error.message) 
    : null;

  return (
    <div className="text-center py-12">
      <div className="text-red-500 text-5xl mb-4">⚠️</div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">{message}</h3>
      {errorMessage && (
        <p className="text-sm text-gray-500 mb-4">{errorMessage}</p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          ลองใหม่
        </button>
      )}
    </div>
  );
};

export default ErrorState;