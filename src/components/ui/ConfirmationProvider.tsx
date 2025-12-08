"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import ConfirmationModal from "./ConfirmationModal";

export type ConfirmType = "info" | "warning" | "error" | "success";

interface ConfirmationOptions {
  title?: string;
  message: string;
  type?: ConfirmType;
  confirmText?: string;
  cancelText?: string;
}

interface ConfirmationContextType {
  showConfirmation: (options: ConfirmationOptions) => Promise<boolean>;
}

const ConfirmationContext = createContext<ConfirmationContextType | undefined>(
  undefined
);

export const useConfirmation = (): ConfirmationContextType => {
  const context = useContext(ConfirmationContext);
  if (!context) {
    throw new Error(
      "useConfirmation must be used within a ConfirmationProvider"
    );
  }
  return context;
};

interface ConfirmationProviderProps {
  children: ReactNode;
}

export const ConfirmationProvider: React.FC<ConfirmationProviderProps> = ({
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmationOptions | null>(null);
  const [resolvePromise, setResolvePromise] = useState<
    ((value: boolean) => void) | null
  >(null);

  const showConfirmation = (
    confirmationOptions: ConfirmationOptions
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      setOptions(confirmationOptions);
      setResolvePromise(() => resolve);
      setIsOpen(true);
    });
  };

  const handleConfirm = () => {
    if (resolvePromise) {
      resolvePromise(true);
    }
    closeModal();
  };

  const handleCancel = () => {
    if (resolvePromise) {
      resolvePromise(false);
    }
    closeModal();
  };

  const closeModal = () => {
    setIsOpen(false);
    setTimeout(() => {
      setOptions(null);
      setResolvePromise(null);
    }, 200);
  };

  return (
    <ConfirmationContext.Provider value={{ showConfirmation }}>
      {children}
      {options && (
        <ConfirmationModal
          isOpen={isOpen}
          title={options.title}
          message={options.message}
          type={options.type}
          confirmText={options.confirmText}
          cancelText={options.cancelText}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </ConfirmationContext.Provider>
  );
};

// Función de utilidad para uso global
let globalConfirmationContext: ConfirmationContextType | null = null;

export const setGlobalConfirmationContext = (
  context: ConfirmationContextType
) => {
  globalConfirmationContext = context;
};

// Función legacy para compatibilidad
export const showConfirm = async (
  message: string,
  title?: string,
  type: ConfirmType = "info"
): Promise<boolean> => {
  if (globalConfirmationContext) {
    return globalConfirmationContext.showConfirmation({ title, message, type });
  } else {
    // Fallback al confirm nativo
    return window.confirm(`${title ? title + "\n\n" : ""}${message}`);
  }
};
