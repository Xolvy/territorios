"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Lock,
  Eye,
  EyeOff,
  Shield,
  Key,
  User,
  Fingerprint,
  Sparkles,
  ChevronRight,
  AlertCircle,
  X,
} from "lucide-react";

interface PasswordScreenEvolutionProps {
  onPasswordSubmit: (password: string) => void;
  title?: string;
  subtitle?: string;
  error?: string;
  isLoading?: boolean;
  onClose?: () => void;
}

const PasswordScreenEvolution: React.FC<PasswordScreenEvolutionProps> = ({
  onPasswordSubmit,
  title = "Centro de Administración",
  subtitle = "Acceso restringido al personal autorizado",
  error,
  isLoading = false,
  onClose,
}) => {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isAnimated, setIsAnimated] = useState(false);
  const [focusedInput, setFocusedInput] = useState(false);
  const [particles, setParticles] = useState<
    Array<{ id: number; x: number; y: number; delay: number }>
  >([]);
  const [shakeAnimation, setShakeAnimation] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Create floating particles effect
  useEffect(() => {
    const timer = setTimeout(() => setIsAnimated(true), 100);

    // Generate random particles
    const particleArray = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 5,
    }));
    setParticles(particleArray);

    return () => clearTimeout(timer);
  }, []);

  // Auto focus input
  useEffect(() => {
    if (isAnimated && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAnimated]);

  // Shake animation on error
  useEffect(() => {
    if (error) {
      setShakeAnimation(true);
      const timer = setTimeout(() => setShakeAnimation(false), 600);
      return () => clearTimeout(timer);
    }
  }, [error]);

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
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6 z-50">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10" />

        {/* Floating Particles */}
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="absolute w-1 h-1 bg-blue-400/30 rounded-full animate-pulse"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              animationDelay: `${particle.delay}s`,
              animation: `float 6s ease-in-out infinite ${particle.delay}s`,
            }}
          />
        ))}

        {/* Rotating Rings */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="w-96 h-96 border border-blue-500/20 rounded-full animate-spin-slow" />
          <div className="absolute top-4 left-4 w-88 h-88 border border-purple-500/20 rounded-full animate-spin-reverse" />
        </div>
      </div>

      {/* Main Container */}
      <div
        className={`
        relative w-full max-w-lg transform transition-all duration-1000 ease-out
        ${
          isAnimated
            ? "translate-y-0 opacity-100 scale-100"
            : "translate-y-12 opacity-0 scale-95"
        }
        ${shakeAnimation ? "animate-shake" : ""}
      `}
      >
        {/* Glass Card */}
        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          {/* Sparkle Effect on Hover */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.02] to-purple-500/[0.02] opacity-0 hover:opacity-100 transition-opacity duration-500" />

          {/* Header Section */}
          <div className="text-center mb-8 relative z-10">
            {/* Animated Icon */}
            <div className="relative mx-auto mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-3xl flex items-center justify-center relative">
                {/* Pulsing Ring */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 to-purple-500/30 rounded-3xl animate-ping" />
                <div className="absolute inset-2 bg-gradient-to-br from-blue-500/40 to-purple-500/40 rounded-2xl" />

                {/* Main Icon */}
                <Shield className="w-10 h-10 text-blue-300 relative z-10" />

                {/* Corner Sparkles */}
                <Sparkles className="absolute -top-2 -right-2 w-4 h-4 text-yellow-400 animate-pulse" />
                <Sparkles className="absolute -bottom-1 -left-1 w-3 h-3 text-pink-400 animate-pulse delay-300" />
              </div>
            </div>

            <h1 className="text-3xl font-bold text-white mb-2 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              {title}
            </h1>
            <p className="text-white/60 text-sm leading-relaxed">{subtitle}</p>
          </div>

          {/* Form Section */}
          <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
            {/* Password Input */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-white/80 text-sm font-medium">
                <Key className="w-4 h-4 text-blue-400" />
                Contraseña de Administrador
              </label>

              <div
                className={`
                relative group
                ${focusedInput ? "scale-[1.02]" : "scale-100"}
                transition-transform duration-200
              `}
              >
                {/* Gradient Border */}
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-2xl opacity-0 group-hover:opacity-20 group-focus-within:opacity-30 transition-opacity duration-300" />

                <div className="relative">
                  {/* Icons */}
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Fingerprint
                      className={`w-5 h-5 transition-colors duration-300 ${
                        focusedInput ? "text-blue-400" : "text-white/40"
                      }`}
                    />
                  </div>

                  {/* Input */}
                  <input
                    ref={inputRef}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyPress={handleKeyPress}
                    onFocus={() => setFocusedInput(true)}
                    onBlur={() => setFocusedInput(false)}
                    className={`
                      w-full pl-12 pr-12 py-4 bg-white/[0.05] border rounded-2xl text-white 
                      placeholder-white/40 focus:outline-none transition-all duration-300
                      hover:bg-white/[0.08] focus:bg-white/[0.08]
                      ${
                        focusedInput
                          ? "border-blue-500/50 shadow-lg shadow-blue-500/20"
                          : "border-white/[0.12] hover:border-white/[0.20]"
                      }
                      ${error ? "border-red-500/50 bg-red-500/10" : ""}
                    `}
                    placeholder="Ingresa la contraseña secreta"
                    disabled={isLoading}
                  />

                  {/* Show/Hide Button */}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`
                      absolute inset-y-0 right-0 pr-4 flex items-center transition-all duration-200
                      ${
                        focusedInput
                          ? "text-blue-400"
                          : "text-white/40 hover:text-white/60"
                      }
                    `}
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>

                {/* Focus Ring */}
                {focusedInput && (
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-2xl animate-pulse" />
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-xl p-3 border border-red-500/20 animate-fade-in">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!password.trim() || isLoading}
              className={`
                group relative w-full py-4 px-6 rounded-2xl font-semibold text-white 
                transition-all duration-300 min-h-[56px] overflow-hidden
                ${
                  !password.trim() || isLoading
                    ? "bg-white/10 cursor-not-allowed opacity-50"
                    : "bg-gradient-to-r from-blue-500 via-purple-600 to-pink-600 hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-500/25 active:scale-[0.98]"
                }
              `}
            >
              {/* Button Background Animation */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-700 to-pink-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              {/* Button Content */}
              <div className="relative flex items-center justify-center gap-2">
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Verificando acceso...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5 group-hover:rotate-12 transition-transform duration-300" />
                    <span>Acceder al Sistema</span>
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
                  </>
                )}
              </div>

              {/* Shine Effect */}
              <div className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-white/30 text-xs">
              <User className="w-3 h-3" />
              <span>Solo personal autorizado</span>
            </div>
            <div className="text-white/20 text-xs">
              Sistema protegido con autenticación de nivel empresarial
            </div>
          </div>

          {/* Close Button (if provided) */}
          {onClose && !isLoading && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all duration-200 hover:scale-110 group"
            >
              <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
            </button>
          )}
        </div>
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-20px) rotate(180deg);
          }
        }
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes spin-reverse {
          from {
            transform: rotate(360deg);
          }
          to {
            transform: rotate(0deg);
          }
        }
        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-5px);
          }
          75% {
            transform: translateX(5px);
          }
        }
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-spin-slow {
          animation: spin-slow 20s linear infinite;
        }
        .animate-spin-reverse {
          animation: spin-reverse 15s linear infinite;
        }
        .animate-shake {
          animation: shake 0.6s ease-in-out;
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default PasswordScreenEvolution;
