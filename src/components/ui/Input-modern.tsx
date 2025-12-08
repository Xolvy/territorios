'use client';

import React, { forwardRef, useState } from 'react';
import { cn } from '@/utils';
import { Eye, EyeOff, Search, X } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  success?: boolean;
  variant?: 'default' | 'search' | 'floating' | 'minimal';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  clearable?: boolean;
  onClear?: () => void;
}

const Input = forwardRef<HTMLInputElement, InputProps>(({
  className,
  type = 'text',
  label,
  error,
  success,
  variant = 'default',
  icon,
  iconPosition = 'left',
  clearable = false,
  onClear,
  value,
  placeholder,
  ...props
}, ref) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;
  const hasValue = value && value.toString().length > 0;

  const baseClasses = `
    w-full transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1)
    focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed
    placeholder:text-gray-500
  `;

  const variantClasses = {
    default: `
      glass-card px-4 py-3 rounded-2xl text-white
      border border-white/10 hover:border-white/20
      focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/20
      bg-white/5 hover:bg-white/10 focus:bg-white/10
    `,
    search: `
      glass-card px-12 py-4 rounded-full text-white text-lg
      border border-white/10 hover:border-white/20
      focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/20
      bg-white/5 hover:bg-white/10 focus:bg-white/10
    `,
    floating: `
      bg-transparent border-0 border-b-2 border-white/20 rounded-none
      px-0 py-3 text-white focus:border-blue-400
      hover:border-white/30
    `,
    minimal: `
      bg-white/5 border border-white/10 rounded-xl px-4 py-3
      text-white hover:bg-white/10 focus:bg-white/10
      focus:border-white/30
    `
  };

  const errorClasses = error 
    ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' 
    : '';
  
  const successClasses = success 
    ? 'border-green-500/50 focus:border-green-500 focus:ring-green-500/20' 
    : '';

  return (
    <div className="space-y-2">
      {/* Label */}
      {label && variant !== 'floating' && (
        <label className="block text-sm font-semibold text-gray-200">
          {label}
        </label>
      )}

      {/* Input Container */}
      <div className="relative group">
        {/* Floating Label */}
        {variant === 'floating' && label && (
          <label className={cn(
            'absolute left-0 transition-all duration-300 pointer-events-none',
            'text-gray-400 origin-left',
            isFocused || hasValue
              ? '-translate-y-6 scale-75 text-blue-400'
              : 'top-3 text-base'
          )}>
            {label}
          </label>
        )}

        {/* Left Icon */}
        {icon && iconPosition === 'left' && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 z-10">
            {variant === 'search' ? <Search className="w-5 h-5" /> : icon}
          </div>
        )}

        {/* Input */}
        <input
          ref={ref}
          type={inputType}
          value={value}
          placeholder={variant === 'floating' ? '' : placeholder}
          className={cn(
            baseClasses,
            variantClasses[variant],
            errorClasses,
            successClasses,
            {
              'pl-12': (icon && iconPosition === 'left') || variant === 'search',
              'pr-12': (icon && iconPosition === 'right') || isPassword || clearable,
            },
            className
          )}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          {...props}
        />

        {/* Right Icons */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center space-x-2">
          {/* Clear Button */}
          {clearable && hasValue && (
            <button
              type="button"
              onClick={onClear}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Password Toggle */}
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          )}

          {/* Right Icon */}
          {icon && iconPosition === 'right' && !isPassword && !clearable && (
            <div className="text-gray-400">
              {icon}
            </div>
          )}
        </div>

        {/* Focus Ring */}
        <div className={cn(
          'absolute inset-0 rounded-2xl transition-opacity duration-300',
          'bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-cyan-600/10',
          'opacity-0 pointer-events-none',
          {
            'opacity-100': isFocused,
            'rounded-full': variant === 'search',
            'rounded-none': variant === 'floating',
            'rounded-xl': variant === 'minimal'
          }
        )} />
      </div>

      {/* Error Message */}
      {error && (
        <p className="text-sm text-red-400 font-medium flex items-center space-x-2">
          <span className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center">
            ⚠
          </span>
          <span>{error}</span>
        </p>
      )}

      {/* Success Message */}
      {success && !error && (
        <p className="text-sm text-green-400 font-medium flex items-center space-x-2">
          <span className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
            ✓
          </span>
          <span>Campo válido</span>
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
