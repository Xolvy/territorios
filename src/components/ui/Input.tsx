'use client';

import React, { forwardRef } from 'react';
import { cn } from '@/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  variant?: 'default' | 'filled';
  fullWidth?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  variant = 'default',
  fullWidth = false,
  className,
  id,
  ...props
}, ref) => {
  const inputId = id || `input-${Math.random().toString(36).substring(7)}`;
  
  const baseClasses = 'px-3 py-2 border rounded-xl transition-all duration-200 focus-ring';
  const variantClasses = {
    default: 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:bg-white focus:border-blue-500',
    filled: 'bg-gray-50 border-transparent text-gray-900 placeholder-gray-500 focus:bg-white'
  };

  return (
    <div className={cn(fullWidth && 'w-full')}>
      {label && (
        <label 
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          {label}
        </label>
      )}
      
      <input
        ref={ref}
        id={inputId}
        className={cn(
          baseClasses,
          variantClasses[variant],
          error && 'border-red-500 focus:border-red-500',
          fullWidth && 'w-full',
          className
        )}
        {...props}
      />
      
      {(error || helperText) && (
        <div className="mt-1 text-sm">
          {error && (
            <p className="text-red-600">{error}</p>
          )}
          {!error && helperText && (
            <p className="text-gray-600">{helperText}</p>
          )}
        </div>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
