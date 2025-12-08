'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showCloseButton?: boolean;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  className,
  showCloseButton = true,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-[min(820px,94vw)]', // Estilo del código original
  };

  // Cerrar modal con Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Cerrar modal clickeando fuera
  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      style={{
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(4px)'
      }}
    >
      <div
        ref={modalRef}
        className={`
          relative w-full ${sizeClasses[size]} rounded-2xl border border-white/20
          ${className || ''}
        `}
        style={{
          background: 'linear-gradient(180deg, #2c3e50, #1e293b)',
          color: 'var(--text)',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div 
            className="flex items-center justify-between gap-3 p-4 border-b border-white/20"
          >
            {title && (
              <h2 className="text-lg font-semibold text-white truncate">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
                aria-label="Cerrar modal"
              >
                <X className="w-5 h-5 text-white/70" />
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div 
          className="p-4 overflow-auto"
          style={{ maxHeight: '70vh' }}
        >
          {children}
        </div>
      </div>
    </div>
  );

  // Renderizar en portal si estamos en el cliente
  if (typeof window !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return null;
}
