"use client";

import React, { useState } from "react";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  Shield,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface SimpleAuthScreenProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: any) => void;
}

const SimpleAuthScreen: React.FC<SimpleAuthScreenProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
}) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Format phone number from 0994749286 to +593994749286
  const formatPhoneNumber = (value: string): string => {
    // Remove all non-numeric characters
    const cleaned = value.replace(/\D/g, "");

    // If starts with 09, convert to +5939
    if (cleaned.startsWith("09") && cleaned.length === 10) {
      return "+593" + cleaned.substring(1);
    }

    // If already starts with +593, keep it
    if (value.startsWith("+593")) {
      return value;
    }

    // If starts with 593, add +
    if (cleaned.startsWith("593") && cleaned.length === 12) {
      return "+" + cleaned;
    }

    return value;
  };

  // Detect if input is email or phone number
  const isEmail = (input: string): boolean => {
    return input.includes("@") && input.includes(".");
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Permitir ingresar el número local tal como lo escribe el usuario
    setUsername(e.target.value);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !password) {
      setError("Usuario y contraseña son requeridos");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let email = username;

      // If it's a phone number, convert to email format for Firebase
      if (!isEmail(username)) {
        // Permitir login con el número local, sin reformatear
        email = username.replace(/\D/g, "") + "@phone.local";
      }

      const result = await signInWithEmailAndPassword(auth, email, password);

      // Create user profile object
      const userProfile = {
        uid: result.user.uid,
        email: result.user.email,
        phoneNumber: !isEmail(username) ? formatPhoneNumber(username) : null,
        displayName: result.user.displayName || "Usuario",
        photoURL: result.user.photoURL,
      };

      onAuthSuccess(userProfile);
    } catch (error: any) {
      console.error("Error en login:", error);

      // Handle specific error messages
      let errorMessage = "Error de autenticación";

      if (error.code === "auth/user-not-found") {
        errorMessage = "Usuario no encontrado";
      } else if (error.code === "auth/wrong-password") {
        errorMessage = "Contraseña incorrecta";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Email o teléfono inválido";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Demasiados intentos. Intenta más tarde";
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center z-50 p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5"></div>
      </div>

      {/* Main Container */}
      <div className="relative w-full max-w-md">
        {/* Login Card */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden">
          
          {/* Header Section */}
          <div className="relative bg-gradient-to-r from-blue-600/20 to-purple-600/20 px-8 py-6 border-b border-white/10">
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-all duration-200 group"
            >
              <X className="w-5 h-5 text-white/60 group-hover:text-white/90" />
            </button>

            {/* Logo/Icon */}
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Shield className="w-8 h-8 text-white" />
                </div>
                <div className="absolute -inset-1 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl blur opacity-25"></div>
              </div>
            </div>

            {/* Title */}
            <div className="text-center">
              <h1 className="text-2xl font-bold text-white mb-2">Bienvenido</h1>
              <p className="text-white/60 text-sm">Ingresa tus credenciales para continuar</p>
            </div>
          </div>

          {/* Form Section */}
          <div className="px-8 py-6">
            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-300">{error}</div>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Username Field */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-white/80">
                  Usuario
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-white/40 group-focus-within:text-blue-400 transition-colors" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={handleUsernameChange}
                    placeholder="Teléfono o correo electrónico"
                    className="block w-full pl-10 pr-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-white/80">
                  Contraseña
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-white/40 group-focus-within:text-blue-400 transition-colors" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    placeholder="Ingresa tu contraseña"
                    className="block w-full pl-10 pr-12 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/40 hover:text-white/70 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:from-gray-600 disabled:to-gray-700 text-white font-medium rounded-xl shadow-lg hover:shadow-xl disabled:shadow-none transition-all duration-300 disabled:cursor-not-allowed transform hover:scale-[1.02] disabled:scale-100"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Iniciando sesión...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-5 h-5" />
                      <span>Iniciar Sesión</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="px-8 py-4 bg-white/5 border-t border-white/10">
            <p className="text-center text-xs text-white/40">
              Sistema de Gestión de Conductores
            </p>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center">
          <p className="text-xs text-white/40">
            ¿Problemas para acceder? Contacta al administrador
          </p>
        </div>
      </div>
    </div>
  );
};

export default SimpleAuthScreen;
