"use client";

import React, { forwardRef } from "react";
import { cn } from "../../utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "secondary"
    | "ghost"
    | "outline"
    | "success"
    | "error"
    | "gradient";
  size?: "sm" | "md" | "lg" | "xl";
  isLoading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  fullWidth?: boolean;
  glow?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      icon,
      iconPosition = "left",
      fullWidth = false,
      glow = false,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseClasses = `
    btn-modern
    relative inline-flex items-center justify-center
    font-semibold rounded-2xl border-none cursor-pointer
    transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1)
    focus:outline-none focus:ring-4 focus:ring-blue-500/20
    disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
    overflow-hidden
  `;

    const variantClasses = {
      primary: `
      bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700
      text-white shadow-lg shadow-blue-500/25
      hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-1
      active:scale-98
    `,
      secondary: `
      bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-600
      text-white shadow-lg shadow-cyan-500/25
      hover:shadow-xl hover:shadow-cyan-500/40 hover:-translate-y-1
      active:scale-98
    `,
      ghost: `
      bg-white/5 border border-white/10 text-white
      backdrop-blur-xl hover:bg-white/10 hover:border-white/20
      hover:-translate-y-0.5 active:scale-98
    `,
      outline: `
      bg-transparent border-2 border-blue-500/30 text-blue-400
      hover:border-blue-400 hover:bg-blue-500/10 hover:text-blue-300
      hover:-translate-y-0.5 active:scale-98
    `,
      success: `
      bg-gradient-to-r from-emerald-500 to-green-600
      text-white shadow-lg shadow-green-500/25
      hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-1
      active:scale-98
    `,
      error: `
      bg-gradient-to-r from-red-500 to-rose-600
      text-white shadow-lg shadow-red-500/25
      hover:shadow-xl hover:shadow-red-500/40 hover:-translate-y-1
      active:scale-98
    `,
      gradient: `
      bg-gradient-to-r from-violet-600 via-purple-600 to-blue-600
      text-white shadow-lg shadow-purple-500/25
      hover:shadow-xl hover:shadow-purple-500/40 hover:-translate-y-1
      active:scale-98
    `,
    };

    const sizeClasses = {
      sm: "px-4 py-2 text-sm min-h-[36px]",
      md: "px-6 py-3 text-base min-h-[44px]",
      lg: "px-8 py-4 text-lg min-h-[52px]",
      xl: "px-10 py-5 text-xl min-h-[60px]",
    };

    const glowClasses = glow ? "animate-glow" : "";
    const fullWidthClasses = fullWidth ? "w-full" : "";

    return (
      <button
        ref={ref}
        className={cn(
          baseClasses,
          variantClasses[variant],
          sizeClasses[size],
          glowClasses,
          fullWidthClasses,
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {/* Shine Effect */}
        <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-500">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 -translate-x-full animate-[shimmer_2s_ease-in-out_infinite]" />
        </div>

        {/* Content */}
        <div className="relative flex items-center justify-center gap-2">
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span>Cargando...</span>
            </>
          ) : (
            <>
              {icon && iconPosition === "left" && (
                <span className="w-5 h-5 flex items-center justify-center">
                  {icon}
                </span>
              )}
              {children}
              {icon && iconPosition === "right" && (
                <span className="w-5 h-5 flex items-center justify-center">
                  {icon}
                </span>
              )}
            </>
          )}
        </div>
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
