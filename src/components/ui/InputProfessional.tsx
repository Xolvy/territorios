'use client';

import React, { forwardRef } from 'react';
import { clsx } from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  variant?: 'default' | 'filled';
}

const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helpText,
  leftIcon,
  rightIcon,
  variant = 'default',
  className,
  ...props
}, ref) => {
  const baseClasses = 'block w-full rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1';
  
  const variantClasses = {
    default: clsx(
      'border-secondary-300 bg-white',
      'placeholder-secondary-400',
      'focus:border-primary-500 focus:ring-primary-500',
      error ? 'border-error-500 focus:border-error-500 focus:ring-error-500' : ''
    ),
    filled: clsx(
      'border-transparent bg-secondary-100',
      'placeholder-secondary-500',
      'focus:bg-white focus:border-primary-500 focus:ring-primary-500',
      error ? 'bg-error-50 focus:border-error-500 focus:ring-error-500' : ''
    ),
  };
  
  const sizeClasses = 'px-3 py-2 text-base';

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-secondary-700 mb-2">
          {label}
        </label>
      )}
      
      <div className="relative">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-secondary-400">{leftIcon}</span>
          </div>
        )}
        
        <input
          ref={ref}
          className={clsx(
            baseClasses,
            variantClasses[variant],
            sizeClasses,
            leftIcon && 'pl-10',
            rightIcon && 'pr-10',
            className
          )}
          {...props}
        />
        
        {rightIcon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className="text-secondary-400">{rightIcon}</span>
          </div>
        )}
      </div>
      
      {error && (
        <p className="mt-2 text-sm text-error-600">{error}</p>
      )}
      
      {helpText && !error && (
        <p className="mt-2 text-sm text-secondary-500">{helpText}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;