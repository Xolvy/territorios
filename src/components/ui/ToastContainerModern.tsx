"use client";

import React, { useEffect, useState, useCallback } from "react";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "warning" | "info";
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ReadonlyToastItemProps {
  readonly toast: Toast;
  readonly onRemove: (id: string) => void;
}

const ToastItem: React.FC<ReadonlyToastItemProps> = ({ toast, onRemove }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = useCallback(() => {
    setIsLeaving(true);
    setTimeout(() => {
      onRemove(toast.id);
    }, 300);
  }, [onRemove, toast.id]);

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.duration, handleClose]);

  const typeConfig = {
    success: {
      icon: CheckCircle,
      colors:
        "from-green-500/20 to-green-600/20 border-green-500/50 text-green-300",
      iconColor: "text-green-400",
    },
    error: {
      icon: AlertCircle,
      colors: "from-red-500/20 to-red-600/20 border-red-500/50 text-red-300",
      iconColor: "text-red-400",
    },
    warning: {
      icon: AlertTriangle,
      colors:
        "from-orange-500/20 to-orange-600/20 border-orange-500/50 text-orange-300",
      iconColor: "text-orange-400",
    },
    info: {
      icon: Info,
      colors:
        "from-blue-500/20 to-blue-600/20 border-blue-500/50 text-blue-300",
      iconColor: "text-blue-400",
    },
  };

  const config = typeConfig[toast.type];
  const IconComponent = config.icon;

  return (
    <div
      className={`
        transform transition-all duration-300 ease-out
        ${
          isVisible && !isLeaving
            ? "translate-x-0 opacity-100 scale-100"
            : "translate-x-full opacity-0 scale-95"
        }
        ${isLeaving ? "translate-x-full opacity-0 scale-95" : ""}
      `}
    >
      <div
        className={`
        bg-gradient-to-r ${config.colors} backdrop-blur-xl
        border rounded-2xl p-4 shadow-2xl max-w-md w-full
        hover:scale-105 transition-transform duration-200
      `}
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="flex-shrink-0 mt-0.5">
            <IconComponent className={`w-5 h-5 ${config.iconColor}`} />
          </div>

          {/* Content */}
          <div className="flex-grow min-w-0">
            <p className="text-white text-sm leading-relaxed">
              {toast.message}
            </p>

            {toast.action && (
              <button
                onClick={toast.action.onClick}
                className="mt-2 text-xs font-medium text-white/80 hover:text-white underline"
              >
                {toast.action.label}
              </button>
            )}
          </div>

          {/* Close Button */}
          <button
            onClick={handleClose}
            className="
              flex-shrink-0 p-1 rounded-lg text-white/60 hover:text-white 
              hover:bg-white/10 transition-colors duration-200
            "
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar (if duration is set) */}
        {toast.duration && toast.duration > 0 && (
          <div className="mt-3 h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-white/30 rounded-full animate-progress"
              style={{
                animation: `progress ${toast.duration}ms linear forwards`,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

interface ReadonlyToastContainerProps {
  readonly toasts: readonly Toast[];
  readonly onRemove: (id: string) => void;
  readonly position?:
    | "top-right"
    | "top-left"
    | "bottom-right"
    | "bottom-left"
    | "top-center"
    | "bottom-center";
}

const ToastContainerModern: React.FC<ReadonlyToastContainerProps> = ({
  toasts,
  onRemove,
  position = "top-right",
}) => {
  const positionClasses = {
    "top-right": "top-4 right-4",
    "top-left": "top-4 left-4",
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "top-center": "top-4 left-1/2 transform -translate-x-1/2",
    "bottom-center": "bottom-4 left-1/2 transform -translate-x-1/2",
  };

  if (toasts.length === 0) return null;

  return (
    <>
      {/* CSS Animation */}
      <style jsx>{`
        @keyframes progress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
        .animate-progress {
          animation: progress var(--duration, 5000ms) linear forwards;
        }
      `}</style>

      <div className={`fixed ${positionClasses[position]} z-50 space-y-2`}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
        ))}
      </div>
    </>
  );
};

// Hook for using toasts
export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (
    message: string,
    type: Toast["type"] = "info",
    duration: number = 5000,
    action?: Toast["action"]
  ) => {
    const id = Math.random().toString(36).substr(2, 9);
    const toast: Toast = { id, message, type, duration, action };

    setToasts((prev) => [...prev, toast]);

    return id;
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const removeAllToasts = () => {
    setToasts([]);
  };

  // Convenience methods
  const success = (
    message: string,
    duration?: number,
    action?: Toast["action"]
  ) => addToast(message, "success", duration, action);

  const error = (
    message: string,
    duration?: number,
    action?: Toast["action"]
  ) => addToast(message, "error", duration, action);

  const warning = (
    message: string,
    duration?: number,
    action?: Toast["action"]
  ) => addToast(message, "warning", duration, action);

  const info = (message: string, duration?: number, action?: Toast["action"]) =>
    addToast(message, "info", duration, action);

  return {
    toasts,
    addToast,
    removeToast,
    removeAllToasts,
    success,
    error,
    warning,
    info,
  };
};

export default ToastContainerModern;
