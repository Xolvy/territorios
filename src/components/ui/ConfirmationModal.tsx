"use client";

import React from "react";
import Modal from "./Modal";
import Button from "./Button";

interface ConfirmationModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: "info" | "warning" | "error" | "success";
}

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  onConfirm,
  onCancel,
  type = "info",
}: ConfirmationModalProps) {
  const getTypeStyles = () => {
    switch (type) {
      case "warning":
        return "text-yellow-400";
      case "error":
        return "text-red-400";
      case "success":
        return "text-green-400";
      default:
        return "text-blue-400";
    }
  };

  const getConfirmButtonVariant = () => {
    switch (type) {
      case "error":
        return "error";
      case "success":
        return "success";
      default:
        return "primary";
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title || "Confirmación"}
      size="sm"
    >
      <div className="space-y-4">
        <p className={`text-sm ${getTypeStyles()}`}>{message}</p>

        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onCancel} size="sm">
            {cancelText}
          </Button>
          <Button
            variant={getConfirmButtonVariant()}
            onClick={onConfirm}
            size="sm"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
