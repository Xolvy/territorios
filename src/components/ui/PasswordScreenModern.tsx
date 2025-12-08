"use client";

import React, { useState, useEffect } from "react";
import { Lock, Eye, EyeOff, Shield, Key } from "lucide-react";

interface PasswordScreenProps {
  onPasswordSubmit: (password: string) => void;
  title?: string;
  subtitle?: string;
  error?: string;
  isLoading?: boolean;
}

const PasswordScreenModern: React.FC<PasswordScreenProps> = ({
  onPasswordSubmit,
  title = "Acceso Administrador",
  subtitle = "Ingresa la contraseña para continuar",
  error,
  isLoading = false,
}) => {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isAnimated, setIsAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      onPasswordSubmit(password);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit(e as any);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_rgba(0,0,0,0.3)_100%)]" />

      {/* Main Container */}
      <div
        className={`
        relative w-full max-w-md transform transition-all duration-1000 ease-out
        ${
          isAnimated
            ? "translate-y-0 opacity-100 scale-100"
            : "translate-y-8 opacity-0 scale-95"
        }
      `}
      >
        {/* Card */}
        <div className="bg-white/[0.08] backdrop-blur-xl border border-white/[0.12] rounded-3xl p-8 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl mb-4">
              <Shield className="w-8 h-8 text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>
            <p className="text-white/60 text-sm">{subtitle}</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Password Input */}
            <div className="relative">
              <label className="block text-white/80 text-sm font-medium mb-2">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Key className="w-5 h-5 text-white/40" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="
                    w-full pl-12 pr-12 py-4 bg-white/[0.08] border border-white/[0.12] 
                    rounded-2xl text-white placeholder-white/40 focus:outline-none 
                    focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
                    transition-all duration-300 hover:bg-white/[0.12]
                  "
                  placeholder="Ingresa tu contraseña"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-white/40 hover:text-white/60 transition-colors"
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mt-2 text-red-400 text-sm flex items-center gap-2">
                  <div className="w-1 h-1 bg-red-400 rounded-full" />
                  {error}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!password.trim() || isLoading}
              className="
                w-full py-4 px-6 bg-gradient-to-r from-blue-500 to-purple-600 
                text-white font-semibold rounded-2xl transition-all duration-300
                hover:from-blue-600 hover:to-purple-700 hover:scale-105
                focus:outline-none focus:ring-2 focus:ring-blue-500/50
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                flex items-center justify-center gap-2 min-h-[56px]
              "
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  Acceder
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-white/40 text-xs">
              Solo personal autorizado tiene acceso
            </p>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute -top-4 -left-4 w-8 h-8 bg-gradient-to-br from-blue-500/30 to-transparent rounded-full blur-sm" />
        <div className="absolute -bottom-4 -right-4 w-12 h-12 bg-gradient-to-br from-purple-500/30 to-transparent rounded-full blur-sm" />
      </div>
    </div>
  );
};

export default PasswordScreenModern;
