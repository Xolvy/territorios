"use client";

import React, { useEffect, useState } from "react";
import { X, CheckCircle, AlertTriangle, Info, XCircle } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastProps {
  toast: ToastMessage;
  onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Animación de entrada
    setTimeout(() => setIsVisible(true), 100);

    // Auto-close después del duration
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, toast.duration);

      return () => clearTimeout(timer);
    }
  }, [toast.duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose(toast.id);
    }, 300);
  };

  const getIcon = () => {
    switch (toast.type) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-400" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
      case "info":
        return <Info className="w-5 h-5 text-blue-400" />;
      default:
        return <Info className="w-5 h-5 text-blue-400" />;
    }
  };

  const getBgColor = () => {
    switch (toast.type) {
      case "success":
        return "bg-green-900/90 border-green-700/50";
      case "error":
        return "bg-red-900/90 border-red-700/50";
      case "warning":
        return "bg-yellow-900/90 border-yellow-700/50";
      case "info":
        return "bg-blue-900/90 border-blue-700/50";
      default:
        return "bg-gray-900/90 border-gray-700/50";
    }
  };

  return (
    <div
      className={`
        fixed top-4 right-4 z-50 max-w-md w-full
        transform transition-all duration-300 ease-in-out
        ${
          isVisible && !isExiting
            ? "translate-x-0 opacity-100 scale-100"
            : "translate-x-full opacity-0 scale-95"
        }
      `}
    >
      <div
        className={`
        ${getBgColor()}
        backdrop-blur-lg border rounded-lg p-4 shadow-2xl
        animate-in slide-in-from-right-4 duration-300
      `}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>

          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-white mb-1">
              {toast.title}
            </h4>
            {toast.message && (
              <p className="text-sm text-gray-300 leading-relaxed">
                {toast.message}
              </p>
            )}
            {toast.action && (
              <button
                onClick={toast.action.onClick}
                className="mt-2 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
              >
                {toast.action.label}
              </button>
            )}
          </div>

          <button
            onClick={handleClose}
            className="flex-shrink-0 p-1 rounded-md hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Toast;
