"use client";

import React, { useState, useEffect } from "react";
import {
  Mail,
  Phone,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  Shield,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Smartphone,
  MessageSquare,
} from "lucide-react";
import {
  robustAuthService,
  AuthMethod,
  LoginCredentials,
  SignupData,
  UserProfile,
} from "@/lib/authServiceRobust";
import LoadingSpinner from "./LoadingSpinner";

interface RobustAuthScreenProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: UserProfile) => void;
  initialMode?: "login" | "signup";
  requiredRole?: "admin" | "conductor";
}

type AuthStep = "methods" | "phone" | "phone-verify" | "loading";

interface FormData {
  phoneNumber: string;
  verificationCode: string;
}

const RobustAuthScreen: React.FC<RobustAuthScreenProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  initialMode = "login",
  requiredRole,
}) => {
  // States
  const [currentStep, setCurrentStep] = useState<AuthStep>("methods");
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  const [formData, setFormData] = useState<FormData>({
    phoneNumber: "",
    verificationCode: "",
  });

  // Reset form when opening/closing
  useEffect(() => {
    if (isOpen) {
      setCurrentStep("methods");
      setMode(initialMode);
      setError(null);
      setSuccess(null);
      setFormData({
        phoneNumber: "",
        verificationCode: "",
      });
    }
  }, [isOpen, initialMode]);

  // Countdown for phone verification
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // Initialize phone auth when needed
  useEffect(() => {
    if (currentStep === "phone") {
      robustAuthService.initializePhoneAuth("recaptcha-container");
    }
  }, [currentStep]);

  const handleInputChange = (
    field: keyof FormData,
    value: string | boolean
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const validateForm = (): boolean => {
    if (currentStep === "phone") {
      if (!formData.phoneNumber) {
        setError("Número de teléfono es requerido");
        return false;
      }
    } else if (currentStep === "phone-verify") {
      if (
        !formData.verificationCode ||
        formData.verificationCode.length !== 6
      ) {
        setError("Código de verificación inválido");
        return false;
      }
    }
    return true;
  };

  const handlePhoneAuth = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    setError(null);

    try {
      await robustAuthService.sendPhoneVerificationCode(formData.phoneNumber);
      setSuccess("Código SMS enviado");
      setCurrentStep("phone-verify");
      setCountdown(60); // 60 seconds countdown
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneVerification = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    setError(null);

    try {
      const user = await robustAuthService.verifyPhoneCode(
        formData.verificationCode
      );
      setSuccess("¡Verificación exitosa!");
      setTimeout(() => onAuthSuccess(user), 1500);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhoneNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    const match = cleaned.match(/^(\d{0,2})(\d{0,4})(\d{0,4})$/);
    if (match) {
      return [match[1], match[2], match[3]].filter(Boolean).join(" ");
    }
    return value;
  };

  if (!isOpen) return null;

  // Floating particles background
  const FloatingParticles = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full opacity-30 animate-pulse"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 3}s`,
            animationDuration: `${2 + Math.random() * 2}s`,
          }}
        />
      ))}
    </div>
  );

  // Auth Methods Selection
  const renderAuthMethods = () => (
    <div className="space-y-4">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">
          {mode === "login" ? "Iniciar Sesión" : "Crear Cuenta"}
        </h2>
        <p className="text-white/70">
          {mode === "login"
            ? "Ingresa con tu número de teléfono"
            : "Registra tu número de teléfono"}
        </p>
      </div>

      {/* Phone Auth - Solo opción disponible */}
      <button
        onClick={() => setCurrentStep("phone")}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-3 p-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all duration-300 group"
      >
        <Phone className="w-6 h-6 text-green-400" />
        <span className="text-white font-medium">Número de Celular</span>
        <ArrowRight className="w-5 h-5 text-white/70 group-hover:translate-x-1 transition-transform" />
      </button>

      {/* Mode Toggle */}
      <div className="text-center pt-6 border-t border-white/10">
        <p className="text-white/60 mb-2">
          {mode === "login" ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}
        </p>
        <button
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
        >
          {mode === "login" ? "Crear cuenta nueva" : "Iniciar sesión"}
        </button>
      </div>
    </div>
  );

  // Phone Auth Form
  const renderPhoneAuth = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setCurrentStep("methods")}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-white">Número de Celular</h2>
          <p className="text-white/70">Te enviaremos un código SMS</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-white/80 text-sm font-medium mb-2">
            Número de Celular
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
            <div className="absolute left-12 top-1/2 transform -translate-y-1/2 text-white/60 text-sm">
              +52
            </div>
            <input
              type="tel"
              value={formatPhoneNumber(formData.phoneNumber)}
              onChange={(e) =>
                handleInputChange(
                  "phoneNumber",
                  e.target.value.replace(/\D/g, "")
                )
              }
              placeholder="55 1234 5678"
              className="w-full pl-20 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              maxLength={12}
            />
          </div>
          <p className="text-white/50 text-xs mt-2">
            Formato: 10 dígitos sin lada (será agregada automáticamente)
          </p>
        </div>

        <button
          onClick={handlePhoneAuth}
          disabled={isLoading || formData.phoneNumber.length < 10}
          className="w-full flex items-center justify-center gap-2 p-4 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500 rounded-xl text-white font-medium transition-all duration-300 disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <MessageSquare className="w-5 h-5" />
              <span>Enviar Código SMS</span>
            </>
          )}
        </button>
      </div>

      {/* reCAPTCHA container */}
      <div id="recaptcha-container"></div>
    </div>
  );

  // Phone Verification Form
  const renderPhoneVerification = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setCurrentStep("phone")}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-white">Verificación SMS</h2>
          <p className="text-white/70">
            Ingresa el código enviado a +52{" "}
            {formatPhoneNumber(formData.phoneNumber)}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-white/80 text-sm font-medium mb-2">
            Código de Verificación
          </label>
          <input
            type="text"
            value={formData.verificationCode}
            onChange={(e) =>
              handleInputChange(
                "verificationCode",
                e.target.value.replace(/\D/g, "")
              )
            }
            placeholder="123456"
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-center text-2xl tracking-widest"
            maxLength={6}
          />
        </div>

        <button
          onClick={handlePhoneVerification}
          disabled={isLoading || formData.verificationCode.length !== 6}
          className="w-full flex items-center justify-center gap-2 p-4 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500 rounded-xl text-white font-medium transition-all duration-300 disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              <span>Verificar Código</span>
            </>
          )}
        </button>

        {countdown > 0 ? (
          <p className="text-center text-white/60 text-sm">
            Reenviar código en {countdown}s
          </p>
        ) : (
          <button
            onClick={handlePhoneAuth}
            className="w-full p-2 text-blue-400 hover:text-blue-300 text-sm transition-colors"
          >
            Reenviar código
          </button>
        )}
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case "methods":
        return renderAuthMethods();
      case "phone":
        return renderPhoneAuth();
      case "phone-verify":
        return renderPhoneVerification();
      default:
        return renderAuthMethods();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <FloatingParticles />

      <div className="relative w-full max-w-md">
        {/* Main Card */}
        <div className="bg-gradient-to-br from-gray-900/90 to-black/90 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>

          {/* Header Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* Content */}
          {renderCurrentStep()}

          {/* Messages */}
          {error && (
            <div className="mt-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <span className="text-red-200 text-sm">{error}</span>
            </div>
          )}

          {success && (
            <div className="mt-6 p-4 bg-green-500/20 border border-green-500/30 rounded-xl flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
              <span className="text-green-200 text-sm">{success}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RobustAuthScreen;
