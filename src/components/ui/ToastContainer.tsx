import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, AlertTriangle, Info } from "lucide-react";
import { ToastMessage } from "@/types";

interface ReadonlyToastProps {
  readonly toast: ToastMessage;
  readonly onRemove: (id: string) => void;
}

function Toast({ toast, onRemove }: ReadonlyToastProps) {
  const icons = {
    success: Check,
    error: X,
    warning: AlertTriangle,
    info: Info,
  };

  const getToastClass = (type: string) => {
    switch (type) {
      case "success":
        return "toast success";
      case "error":
        return "toast error";
      default:
        return "toast";
    }
  };

  const Icon = icons[toast.type];

  return (
    <div className={getToastClass(toast.type)}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <Icon className="w-5 h-5 flex-shrink-0" />
        <span className="flex-1">{toast.message}</span>
        <button
          onClick={() => onRemove(toast.id)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            opacity: 0.7,
            padding: "2px",
          }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

interface ReadonlyToastContainerProps {
  readonly toasts: readonly ToastMessage[];
  readonly onRemove: (id: string) => void;
}

export function ToastContainer({
  toasts,
  onRemove,
}: ReadonlyToastContainerProps) {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

export default ToastContainer;
