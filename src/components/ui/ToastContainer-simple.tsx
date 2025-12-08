import React from 'react';
import { Check, X, AlertTriangle, Info } from 'lucide-react';
import { ToastMessage } from '@/types';

interface ToastProps {
  toast: ToastMessage;
  onRemove: (id: string) => void;
}

function Toast({ toast, onRemove }: ToastProps) {
  const icons = {
    success: Check,
    error: X,
    warning: AlertTriangle,
    info: Info,
  };

  const getToastClass = (type: string) => {
    switch (type) {
      case 'success': 
        return 'fixed top-4 right-4 z-50 flex items-center gap-3 bg-green-500/90 text-white px-4 py-3 rounded-lg shadow-lg backdrop-blur-sm border border-green-400/30';
      case 'error': 
        return 'fixed top-4 right-4 z-50 flex items-center gap-3 bg-red-500/90 text-white px-4 py-3 rounded-lg shadow-lg backdrop-blur-sm border border-red-400/30';
      case 'warning':
        return 'fixed top-4 right-4 z-50 flex items-center gap-3 bg-orange-500/90 text-white px-4 py-3 rounded-lg shadow-lg backdrop-blur-sm border border-orange-400/30';
      default: 
        return 'fixed top-4 right-4 z-50 flex items-center gap-3 bg-blue-500/90 text-white px-4 py-3 rounded-lg shadow-lg backdrop-blur-sm border border-blue-400/30';
    }
  };

  const Icon = icons[toast.type];

  React.useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  return (
    <div className={getToastClass(toast.type)}>
      <Icon className="w-5 h-5" />
      <span className="font-medium">{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        className="ml-2 text-white/80 hover:text-white"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

export default function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed top-0 right-0 z-50 p-4 space-y-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}