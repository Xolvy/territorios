"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  closeOnOverlayClick?: boolean;
  showCloseButton?: boolean;
  type?: "default" | "success" | "error" | "warning" | "info";
}

const ModernModal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  closeOnOverlayClick = true,
  showCloseButton = true,
  type = "default",
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [isAnimated, setIsAnimated] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      const timer = setTimeout(() => setIsAnimated(true), 50);
      return () => clearTimeout(timer);
    } else {
      document.body.style.overflow = "unset";
      setIsAnimated(false);
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  const typeIcons = {
    default: null,
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const typeColors = {
    default:
      "from-slate-500/20 to-slate-600/20 border-slate-500/30 text-slate-400",
    success:
      "from-green-500/20 to-green-600/20 border-green-500/30 text-green-400",
    error: "from-red-500/20 to-red-600/20 border-red-500/30 text-red-400",
    warning:
      "from-orange-500/20 to-orange-600/20 border-orange-500/30 text-orange-400",
    info: "from-blue-500/20 to-blue-600/20 border-blue-500/30 text-blue-400",
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  const IconComponent = typeIcons[type];

  return (
    <div
      className={`
        fixed inset-0 z-50 flex items-center justify-center p-4
        transition-all duration-300 ease-out
        ${isAnimated ? "opacity-100" : "opacity-0"}
      `}
      onClick={handleOverlayClick}
    >
      {/* Backdrop */}
      <div
        className={`
        absolute inset-0 bg-black/60 backdrop-blur-sm
        transition-opacity duration-300
        ${isAnimated ? "opacity-100" : "opacity-0"}
      `}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className={`
          relative w-full ${sizeClasses[size]} max-h-[90vh] overflow-hidden
          bg-white/[0.08] backdrop-blur-xl border border-white/[0.12] 
          rounded-3xl shadow-2xl
          transform transition-all duration-300 ease-out
          ${isAnimated ? "scale-100 translate-y-0" : "scale-95 translate-y-4"}
        `}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-6 border-b border-white/[0.12]">
            <div className="flex items-center gap-3">
              {IconComponent && (
                <div
                  className={`p-2 rounded-xl bg-gradient-to-br ${typeColors[type]}`}
                >
                  <IconComponent className="w-5 h-5" />
                </div>
              )}
              {title && (
                <h2 className="text-xl font-semibold text-white">{title}</h2>
              )}
            </div>

            {showCloseButton && (
              <button
                onClick={onClose}
                className="
                  p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10
                  transition-all duration-200 hover:scale-110
                "
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {children}
        </div>
      </div>
    </div>
  );
};

// Confirmation Modal Component
interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: "default" | "danger" | "warning" | "success";
  isLoading?: boolean;
}

export const ConfirmationModalModern: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  type = "default",
  isLoading = false,
}) => {
  const typeStyles = {
    default: {
      confirmButton:
        "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700",
      icon: Info,
      iconColor: "text-blue-400",
    },
    danger: {
      confirmButton:
        "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700",
      icon: AlertCircle,
      iconColor: "text-red-400",
    },
    warning: {
      confirmButton:
        "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700",
      icon: AlertTriangle,
      iconColor: "text-orange-400",
    },
    success: {
      confirmButton:
        "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700",
      icon: CheckCircle,
      iconColor: "text-green-400",
    },
  };

  const style = typeStyles[type];
  const IconComponent = style.icon;

  return (
    <ModernModal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      closeOnOverlayClick={!isLoading}
      showCloseButton={!isLoading}
    >
      <div className="text-center space-y-6">
        {/* Icon */}
        <div className="mx-auto w-16 h-16 bg-white/10 rounded-full flex items-center justify-center">
          <IconComponent className={`w-8 h-8 ${style.iconColor}`} />
        </div>

        {/* Content */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="text-white/60">{message}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="
              flex-1 py-3 px-4 bg-white/10 hover:bg-white/15 
              text-white font-medium rounded-xl transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`
              flex-1 py-3 px-4 text-white font-medium rounded-xl 
              transition-all duration-200 hover:scale-105
              disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
              ${style.confirmButton}
              flex items-center justify-center gap-2
            `}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Procesando...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </ModernModal>
  );
};

export default ModernModal;
