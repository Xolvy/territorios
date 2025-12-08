"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  X,
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle,
  Sparkles,
  Zap,
  Heart,
  Star,
  Crown,
  Shield,
} from "lucide-react";

interface ModalEvolutionProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "full";
  closeOnOverlayClick?: boolean;
  showCloseButton?: boolean;
  type?:
    | "default"
    | "success"
    | "error"
    | "warning"
    | "info"
    | "highlight"
    | "celebration";
  animation?: "fade" | "slide-up" | "slide-down" | "zoom" | "flip" | "bounce";
  blur?: "light" | "medium" | "heavy";
}

const ModalEvolution: React.FC<ModalEvolutionProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  closeOnOverlayClick = true,
  showCloseButton = true,
  type = "default",
  animation = "zoom",
  blur = "medium",
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [isAnimated, setIsAnimated] = useState(false);
  const [particles, setParticles] = useState<
    Array<{ id: number; x: number; y: number; color: string }>
  >([]);

  // Generate particles for highlight/celebration types
  const generateParticles = useCallback(() => {
    if (type === "highlight" || type === "celebration") {
      const colors =
        type === "highlight"
          ? ["#ffd700", "#ffed4e", "#fbbf24"]
          : ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6"];

      const particleArray = Array.from({ length: 30 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)],
      }));
      setParticles(particleArray);
    }
  }, [type]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      const timer = setTimeout(() => {
        setIsAnimated(true);
        generateParticles();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      document.body.style.overflow = "unset";
      setIsAnimated(false);
      setParticles([]);
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen, generateParticles]);

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
    xs: "max-w-sm",
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-7xl mx-4",
  };

  const blurClasses = {
    light: "backdrop-blur-sm",
    medium: "backdrop-blur-md",
    heavy: "backdrop-blur-xl",
  };

  const animationClasses = {
    fade: isAnimated ? "opacity-100 scale-100" : "opacity-0 scale-100",
    "slide-up": isAnimated
      ? "translate-y-0 opacity-100"
      : "translate-y-8 opacity-0",
    "slide-down": isAnimated
      ? "translate-y-0 opacity-100"
      : "-translate-y-8 opacity-0",
    zoom: isAnimated ? "scale-100 opacity-100" : "scale-95 opacity-0",
    flip: isAnimated ? "rotateY-0 opacity-100" : "rotateY-90 opacity-0",
    bounce: isAnimated ? "scale-100 opacity-100" : "scale-110 opacity-0",
  };

  const typeIcons = {
    default: null,
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
    highlight: Crown,
    celebration: Star,
  };

  const typeColors = {
    default: {
      gradient: "from-slate-500/20 to-slate-600/20",
      border: "border-slate-500/30",
      icon: "text-slate-400",
      glow: "shadow-slate-500/25",
    },
    success: {
      gradient: "from-green-500/20 to-emerald-600/20",
      border: "border-green-500/30",
      icon: "text-green-400",
      glow: "shadow-green-500/25",
    },
    error: {
      gradient: "from-red-500/20 to-red-600/20",
      border: "border-red-500/30",
      icon: "text-red-400",
      glow: "shadow-red-500/25",
    },
    warning: {
      gradient: "from-orange-500/20 to-amber-600/20",
      border: "border-orange-500/30",
      icon: "text-orange-400",
      glow: "shadow-orange-500/25",
    },
    info: {
      gradient: "from-blue-500/20 to-blue-600/20",
      border: "border-blue-500/30",
      icon: "text-blue-400",
      glow: "shadow-blue-500/25",
    },
    highlight: {
      gradient: "from-yellow-500/20 via-orange-500/20 to-yellow-600/20",
      border: "border-yellow-500/30",
      icon: "text-yellow-400",
      glow: "shadow-yellow-500/25",
    },
    celebration: {
      gradient: "from-pink-500/20 via-purple-500/20 to-blue-500/20",
      border: "border-pink-500/30",
      icon: "text-pink-400",
      glow: "shadow-pink-500/25",
    },
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  const IconComponent = typeIcons[type];
  const colors = typeColors[type];

  return (
    <div
      className={`
        fixed inset-0 z-50 flex items-center justify-center p-4
        transition-all duration-500 ease-out
        ${isAnimated ? "opacity-100" : "opacity-0"}
      `}
      onClick={handleOverlayClick}
    >
      {/* Enhanced Backdrop */}
      <div
        className={`
        absolute inset-0 bg-black/60 ${blurClasses[blur]}
        transition-all duration-500
        ${isAnimated ? "opacity-100" : "opacity-0"}
      `}
      >
        {/* Animated Background Pattern */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-0 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl animate-blob" />
          <div className="absolute top-0 right-0 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000" />
        </div>
      </div>

      {/* Floating Particles for Premium/Celebration */}
      {particles.length > 0 && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {particles.map((particle) => (
            <div
              key={particle.id}
              className="absolute w-2 h-2 rounded-full animate-float"
              style={{
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                backgroundColor: particle.color,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${3 + Math.random() * 2}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Modal Container */}
      <div
        ref={modalRef}
        className={`
          relative w-full ${
            sizeClasses[size]
          } max-h-[95vh] overflow-hidden flex flex-col
          bg-white/[0.08] ${blurClasses[blur]} border border-white/[0.12] 
          rounded-3xl shadow-2xl ${colors.glow}
          transform transition-all duration-500 ease-out
          ${animationClasses[animation]}
          ${type === "highlight" ? "ring-2 ring-yellow-500/30" : ""}
          ${type === "celebration" ? "ring-2 ring-pink-500/30" : ""}
        `}
      >
        {/* Gradient Overlay */}
        <div
          className={`absolute inset-0 bg-gradient-to-br ${colors.gradient} opacity-50`}
        />

        {/* Content Container */}
        <div className="relative z-10">
          {/* Header */}
          {(title || showCloseButton) && (
            <div
              className={`
              flex items-center justify-between p-6 border-b border-white/[0.12] flex-shrink-0
              ${
                type === "highlight"
                  ? "bg-gradient-to-r from-yellow-500/10 to-orange-500/10"
                  : ""
              }
              ${
                type === "celebration"
                  ? "bg-gradient-to-r from-pink-500/10 to-purple-500/10"
                  : ""
              }
            `}
            >
              <div className="flex items-center gap-4">
                {IconComponent && (
                  <div
                    className={`
                    relative p-3 rounded-2xl bg-gradient-to-br ${
                      colors.gradient
                    } ${colors.border}
                    ${type === "highlight" ? "animate-pulse" : ""}
                    ${type === "celebration" ? "animate-bounce" : ""}
                  `}
                  >
                    <IconComponent className={`w-6 h-6 ${colors.icon}`} />

                    {/* Special Effects for Premium/Celebration */}
                    {type === "highlight" && (
                      <>
                        <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-yellow-400 animate-ping" />
                        <Sparkles className="absolute -bottom-1 -left-1 w-3 h-3 text-orange-400 animate-ping delay-300" />
                      </>
                    )}
                    {type === "celebration" && (
                      <>
                        <Heart className="absolute -top-1 -right-1 w-4 h-4 text-pink-400 animate-pulse" />
                        <Star className="absolute -bottom-1 -left-1 w-3 h-3 text-purple-400 animate-spin" />
                      </>
                    )}
                  </div>
                )}

                {title && (
                  <div>
                    <h2
                      className={`
                      text-xl font-bold text-white
                      ${
                        type === "highlight"
                          ? "bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent"
                          : ""
                      }
                      ${
                        type === "celebration"
                          ? "bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent"
                          : ""
                      }
                    `}
                    >
                      {title}
                      {type === "highlight" && (
                        <Crown className="inline-block w-5 h-5 ml-2 text-yellow-400" />
                      )}
                      {type === "celebration" && (
                        <Zap className="inline-block w-5 h-5 ml-2 text-pink-400" />
                      )}
                    </h2>
                  </div>
                )}
              </div>

              {showCloseButton && (
                <button
                  onClick={onClose}
                  className={`
                    group p-2 rounded-xl text-white/60 hover:text-white 
                    hover:bg-white/10 transition-all duration-200 hover:scale-110
                    ${type === "highlight" ? "hover:bg-yellow-500/20" : ""}
                    ${type === "celebration" ? "hover:bg-pink-500/20" : ""}
                  `}
                >
                  <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                </button>
              )}
            </div>
          )}

          {/* Content */}
          <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
            {children}
          </div>
        </div>

        {/* Shine Effect */}
        {(type === "highlight" || type === "celebration") && (
          <div className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] animate-shine" />
        )}
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        @keyframes float {
          0%,
          100% {
            transform: translateY(0px) rotate(0deg);
            opacity: 0.7;
          }
          50% {
            transform: translateY(-20px) rotate(180deg);
            opacity: 1;
          }
        }
        @keyframes shine {
          0% {
            transform: translateX(-100%) skewX(-12deg);
          }
          100% {
            transform: translateX(200%) skewX(-12deg);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        .animate-shine {
          animation: shine 3s ease-in-out infinite;
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.5);
        }
      `}</style>
    </div>
  );
};

// Enhanced Confirmation Modal
interface ConfirmationModalEvolutionProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: "default" | "danger" | "warning" | "success" | "highlight";
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const ConfirmationModalEvolution: React.FC<
  ConfirmationModalEvolutionProps
> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  type = "default",
  isLoading = false,
  icon,
}) => {
  const typeStyles = {
    default: {
      confirmButton:
        "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700",
      icon: Info,
      iconColor: "text-blue-400",
      modalType: "info" as const,
    },
    danger: {
      confirmButton:
        "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700",
      icon: AlertCircle,
      iconColor: "text-red-400",
      modalType: "error" as const,
    },
    warning: {
      confirmButton:
        "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700",
      icon: AlertTriangle,
      iconColor: "text-orange-400",
      modalType: "warning" as const,
    },
    success: {
      confirmButton:
        "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700",
      icon: CheckCircle,
      iconColor: "text-green-400",
      modalType: "success" as const,
    },
    highlight: {
      confirmButton:
        "bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600",
      icon: Crown,
      iconColor: "text-yellow-400",
      modalType: "highlight" as const,
    },
  };

  const style = typeStyles[type];
  const IconComponent = icon ? () => icon : style.icon;

  return (
    <ModalEvolution
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      closeOnOverlayClick={!isLoading}
      showCloseButton={!isLoading}
      type={style.modalType}
      animation="bounce"
      blur="heavy"
    >
      <div className="text-center space-y-6">
        {/* Icon */}
        <div className="mx-auto w-20 h-20 bg-gradient-to-br from-white/10 to-white/5 rounded-full flex items-center justify-center relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full animate-pulse" />
          <IconComponent
            className={`w-10 h-10 ${style.iconColor} relative z-10`}
          />

          {type === "highlight" && (
            <>
              <Sparkles className="absolute -top-2 -right-2 w-5 h-5 text-yellow-400 animate-spin" />
              <Shield className="absolute -bottom-1 -left-1 w-4 h-4 text-orange-400 animate-pulse" />
            </>
          )}
        </div>

        {/* Content */}
        <div className="space-y-3">
          <h3
            className={`
            text-xl font-bold text-white
            ${
              type === "highlight"
                ? "bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent"
                : ""
            }
          `}
          >
            {title}
          </h3>
          <p className="text-white/70 leading-relaxed">{message}</p>
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
              hover:scale-105 active:scale-95
            "
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`
              flex-1 py-3 px-4 text-white font-medium rounded-xl 
              transition-all duration-200 hover:scale-105 active:scale-95
              disabled:opacity-50 disabled:cursor-not-allowed
              ${style.confirmButton}
              flex items-center justify-center gap-2 relative overflow-hidden
            `}
          >
            {/* Shine Effect */}
            <div className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] hover:translate-x-[100%] transition-transform duration-1000" />

            <span className="relative z-10">
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Procesando...
                </>
              ) : (
                confirmText
              )}
            </span>
          </button>
        </div>
      </div>
    </ModalEvolution>
  );
};

export default ModalEvolution;
