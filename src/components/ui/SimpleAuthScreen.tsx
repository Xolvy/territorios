"use client";

import React, { useState } from "react";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Shield,
  AlertCircle,
  Loader2,
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      {/* Floating particles background */}
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

      <div className="relative w-full max-w-sm">
        {/* Main Card */}
        <div className="bg-gradient-to-br from-gray-900/90 to-black/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white/80"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Header Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-white mb-1">
              Iniciar Sesión
            </h2>
            <p className="text-sm text-white/70">Ingresa tu usuario y contraseña</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-red-300">{error}</div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username Field (Email or Phone) */}
            <div>
              <label className="block text-white/80 text-xs font-medium mb-1">
                Usuario
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  value={username}
                  onChange={handleUsernameChange}
                  placeholder="Celular o correo electrónico"
                  className="w-full pl-10 pr-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-white/80 text-xs font-medium mb-1">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="Tu contraseña"
                  className="w-full pl-10 pr-10 py-2.5 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-lg text-white text-sm font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Iniciar Sesión</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Info */}
        </div>
      </div>
    </div>
  );
};

export default SimpleAuthScreen;
