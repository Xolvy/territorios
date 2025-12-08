"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { logger } from "@/utils/logger";
import Toast, { ToastMessage, ToastType } from "./Toast";

interface ToastContextType {
  showToast: (
    type: ToastType,
    title: string,
    message?: string,
    options?: {
      duration?: number;
      action?: { label: string; onClick: () => void };
    }
  ) => void;
  showSuccess: (title: string, message?: string) => void;
  showError: (title: string, message?: string) => void;
  showWarning: (title: string, message?: string) => void;
  showInfo: (title: string, message?: string) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

interface ReadonlyToastProviderProps {
  readonly children: ReactNode;
}

export const ToastProvider: React.FC<ReadonlyToastProviderProps> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const generateId = (): string => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  };

  const showToast = (
    type: ToastType,
    title: string,
    message?: string,
    options?: {
      duration?: number;
      action?: { label: string; onClick: () => void };
    }
  ) => {
    const id = generateId();
    const newToast: ToastMessage = {
      id,
      type,
      title,
      message,
      duration: options?.duration || 5000, // 5 segundos por defecto
      action: options?.action,
    };

    setToasts((prev) => [...prev, newToast]);
  };

  const showSuccess = (title: string, message?: string) => {
    showToast("success", title, message);
  };

  const showError = (title: string, message?: string) => {
    showToast("error", title, message, { duration: 7000 }); // Errores duran más
  };

  const showWarning = (title: string, message?: string) => {
    showToast("warning", title, message);
  };

  const showInfo = (title: string, message?: string) => {
    showToast("info", title, message);
  };

  const clearToasts = () => {
    setToasts([]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  return (
    <ToastContext.Provider
      value={{
        showToast,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        clearToasts,
      }}
    >
      {children}

      {/* Render toasts */}
      <div className="fixed top-0 right-0 z-50 p-4 space-y-2 pointer-events-none">
        {toasts.map((toast, index) => (
          <div
            key={toast.id}
            className="pointer-events-auto"
            style={{
              transform: `translateY(${index * 80}px)`,
              transition: "transform 0.3s ease-in-out",
            }}
          >
            <Toast toast={toast} onClose={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// Funciones de utilidad para uso directo (legacy support)
let globalToastContext: ToastContextType | null = null;

export const setGlobalToastContext = (context: ToastContextType) => {
  globalToastContext = context;
};

// Funciones legacy para compatibilidad
export const toast = {
  success: (title: string, message?: string) => {
    if (globalToastContext) {
      globalToastContext.showSuccess(title, message);
    } else {
      const fullMessage = message ? `${title}: ${message}` : title;
      logger.log(`✅ ${fullMessage}`);
    }
  },
  error: (title: string, message?: string) => {
    if (globalToastContext) {
      globalToastContext.showError(title, message);
    } else {
      const fullMessage = message ? `${title}: ${message}` : title;
      logger.error(`❌ ${fullMessage}`);
    }
  },
  warning: (title: string, message?: string) => {
    if (globalToastContext) {
      globalToastContext.showWarning(title, message);
    } else {
      const fullMessage = message ? `${title}: ${message}` : title;
      logger.warn(`⚠️ ${fullMessage}`);
    }
  },
  info: (title: string, message?: string) => {
    if (globalToastContext) {
      globalToastContext.showInfo(title, message);
    } else {
      const fullMessage = message ? `${title}: ${message}` : title;
      logger.log(`ℹ️ ${fullMessage}`);
    }
  },
};
