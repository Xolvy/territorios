"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Lock,
  Mail,
  Phone,
  Eye,
  EyeOff,
  Shield,
  AlertCircle,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { useToast } from "./ToastProvider";
import {
  signInWithEmail,
  createUserWithEmail,
  signInWithPhone,
  verifyPhoneCode,
  setupRecaptcha,
  auth,
} from "../../lib/firebase";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";

type AuthMethod = "email" | "phone" | "password";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (method: AuthMethod, credential?: any) => void;
  title?: string;
  allowedMethods?: AuthMethod[];
  requireAdmin?: boolean;
  allowGoogleForAdminsOnly?: boolean;
}

const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  title = "Iniciar Sesión",
  allowedMethods = ["phone", "password"],
  requireAdmin = false,
  allowGoogleForAdminsOnly = true,
}) => {
  const [activeMethod, setActiveMethod] = useState<AuthMethod>("phone");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    phone: "",
    password: "",
    verificationCode: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"auth" | "verify">("auth");
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<any>(null);
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    if (isOpen) {
      setActiveMethod(allowedMethods[0] || "phone");
      setFormData({ email: "", phone: "", password: "", verificationCode: "" });
      setErrors({});
      setStep("auth");
      setConfirmationResult(null);

      // Limpiar reCAPTCHA anterior si existe
      if (recaptchaVerifier) {
        recaptchaVerifier.clear();
        setRecaptchaVerifier(null);
      }
    }

    // Cleanup cuando se cierra el modal
    return () => {
      if (!isOpen && recaptchaVerifier) {
        recaptchaVerifier.clear();
        setRecaptchaVerifier(null);
      }
    };
  }, [isOpen, allowedMethods, recaptchaVerifier]);

  // Google sign-in disabled

  const handleEmailAuth = async () => {
    if (!formData.email || !formData.password) {
      setErrors({
        email: !formData.email ? "Email requerido" : "",
        password: !formData.password ? "Contraseña requerida" : "",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Intentar iniciar sesión primero
      let result;
      try {
        result = await signInWithEmail(formData.email, formData.password);
      } catch (signInError: any) {
        // Si el usuario no existe, crear cuenta nueva
        if (signInError.code === "auth/user-not-found") {
          result = await createUserWithEmail(formData.email, formData.password);
          showSuccess("Cuenta creada", "Tu cuenta ha sido creada exitosamente");
        } else {
          throw signInError;
        }
      }

      const user = result.user;
      showSuccess("Autenticación exitosa", `Bienvenido ${user.email}`);
      onSuccess("email", { user });
    } catch (error: any) {
      console.error("Error con Email Auth:", error);
      let errorMessage = "Email o contraseña incorrectos";

      if (error.code === "auth/weak-password") {
        errorMessage = "La contraseña debe tener al menos 6 caracteres";
      } else if (error.code === "auth/email-already-in-use") {
        errorMessage = "Este email ya está en uso";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Email inválido";
      }

      showError("Credenciales inválidas", errorMessage);
      setErrors({ general: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneAuth = async () => {
    if (!formData.phone || !formData.password) {
      setErrors({
        phone: !formData.phone ? "Número de teléfono requerido" : "",
        password: !formData.password ? "Contraseña requerida" : "",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Buscar usuario en nuestra base de datos
      const { userService } = await import("../../lib/userService");
      const appUser = await userService.getUserByPhone(formData.phone);

      if (!appUser) {
        throw new Error("Usuario no encontrado. Contacte al administrador.");
      }

      if (!appUser.isActive) {
        throw new Error("Cuenta desactivada. Contacte al administrador.");
      }

      // Validar contraseña (simplificada por ahora)
      // TODO: Implementar hash de contraseñas
      if (
        formData.password !== "conductor123" &&
        formData.password !== "admin2024"
      ) {
        throw new Error("Contraseña incorrecta");
      }

      // Crear sesión "simulada" para el usuario
      // En un sistema real, aquí crearías un token JWT o similar
      showSuccess(
        "Autenticación exitosa",
        `Bienvenido ${appUser.fullName || appUser.phoneNumber}`
      );
      onSuccess("phone", { appUser });
    } catch (error: any) {
      console.error("Error con autenticación telefónica:", error);
      showError(
        "Error de autenticación",
        error.message || "Credenciales inválidas"
      );
      setErrors({ general: error.message || "Credenciales inválidas" });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordAuth = async () => {
    if (!formData.password) {
      setErrors({ password: "Contraseña requerida" });
      return;
    }

    setIsLoading(true);
    try {
      // Validación simple de contraseña de administrador
      if (
        formData.password === "admin2024" ||
        formData.password === "conductor123"
      ) {
        showSuccess("Acceso autorizado", "Credenciales válidas");
        onSuccess("password", {
          role: formData.password === "admin2024" ? "admin" : "conductor",
        });
      } else {
        throw new Error("Contraseña incorrecta");
      }
    } catch (error) {
      showError("Acceso denegado", "Contraseña incorrecta");
      setErrors({ password: "Contraseña incorrecta" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    switch (activeMethod) {
      case "email":
        await handleEmailAuth();
        break;
      case "phone":
        await handlePhoneAuth();
        break;
      case "password":
        await handlePasswordAuth();
        break;
    }
  };

  if (!isOpen) return null;

  const getMethodIcon = (method: AuthMethod) => {
    switch (method) {
      case "email":
        return <Mail className="w-5 h-5" />;
      case "phone":
        return <Phone className="w-5 h-5" />;
      case "password":
        return <Lock className="w-5 h-5" />;
    }
  };

  const getMethodLabel = (method: AuthMethod) => {
    switch (method) {
      case "email":
        return "Email";
      case "phone":
        return "Teléfono";
      case "password":
        return "Contraseña";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-900/95 backdrop-blur-lg border border-gray-700/50 rounded-2xl shadow-2xl max-w-md w-full mx-4 animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-xl">
              <Shield className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{title}</h2>
              {requireAdmin && (
                <p className="text-xs text-gray-400">
                  Acceso administrativo requerido
                </p>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            disabled={isLoading}
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Method Tabs */}
        {allowedMethods.length > 1 && (
          <div className="flex p-2 m-4 bg-gray-800/50 rounded-xl">
            {allowedMethods.map((method) => (
              <button
                key={method}
                onClick={() => setActiveMethod(method)}
                disabled={isLoading}
                className={`
                  flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
                  ${
                    activeMethod === method
                      ? "bg-blue-600 text-white shadow-lg"
                      : "text-gray-400 hover:text-gray-300 hover:bg-gray-700/50"
                  }
                `}
              >
                {getMethodIcon(method)}
                {getMethodLabel(method)}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 pt-4 space-y-4">
          {/* Google Sign In removed */}

          {/* Email Auth */}
          {activeMethod === "email" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className={`w-full p-3 bg-gray-800/50 border rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                    errors.email ? "border-red-500" : "border-gray-600"
                  }`}
                  placeholder="tu@email.com"
                  disabled={isLoading}
                />
                {errors.email && (
                  <p className="text-xs text-red-400 mt-1">{errors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className={`w-full p-3 pr-10 bg-gray-800/50 border rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                      errors.password ? "border-red-500" : "border-gray-600"
                    }`}
                    placeholder="••••••••"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-400 mt-1">{errors.password}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Mail className="w-5 h-5" />
                    Iniciar sesión con email
                  </>
                )}
              </button>
            </div>
          )}

          {/* Phone Auth */}
          {activeMethod === "phone" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Número de teléfono
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className={`w-full p-3 bg-gray-800/50 border rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                    errors.phone ? "border-red-500" : "border-gray-600"
                  }`}
                  placeholder="Celular o correo electrónico"
                  disabled={isLoading}
                />
                {errors.phone && (
                  <p className="text-xs text-red-400 mt-1">{errors.phone}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className={`w-full p-3 pr-10 bg-gray-800/50 border rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                      errors.password ? "border-red-500" : "border-gray-600"
                    }`}
                    placeholder="••••••••"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-400 mt-1">{errors.password}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full p-3 bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Phone className="w-5 h-5" />
                    Iniciar sesión
                  </>
                )}
              </button>
            </div>
          )}

          {/* Password Auth */}
          {activeMethod === "password" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Contraseña de acceso
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className={`w-full p-3 pr-10 bg-gray-800/50 border rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                      errors.password ? "border-red-500" : "border-gray-600"
                    }`}
                    placeholder="••••••••••"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-400 mt-1">{errors.password}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full p-3 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Lock className="w-5 h-5" />
                    Verificar credenciales
                  </>
                )}
              </button>
            </div>
          )}

          {/* General Error */}
          {errors.general && (
            <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-800/50 rounded-lg text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {errors.general}
            </div>
          )}
        </form>

        {/* reCAPTCHA container - invisible para autenticación por teléfono */}
        <div id="recaptcha-container" className="hidden"></div>
      </div>
    </div>
  );
};

export default AuthModal;
