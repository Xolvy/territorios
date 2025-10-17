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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      {/* Main Container - Super Compact */}
      <div className="relative w-full max-w-sm">
        {/* Login Card */}
        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          {/* Compact Header */}
          <div className="relative bg-blue-600 px-4 py-3">
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-2 right-2 p-1 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-3 h-3 text-white" />
            </button>

            {/* Mini Logo */}
            <div className="flex items-center justify-center gap-2">
              <div className="w-6 h-6 bg-white/20 rounded flex items-center justify-center">
                <Shield className="w-3 h-3 text-white" />
              </div>
              <h2 className="text-sm font-medium text-white">Iniciar Sesión</h2>
            </div>
          </div>

          {/* Compact Form */}
          <div className="p-4">
            {/* Error Message */}
            {error && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded flex items-start gap-2">
                <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Username Field */}
              <div>
                <div className="relative">
                  <User className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={handleUsernameChange}
                    placeholder="Teléfono o email"
                    className="w-full pl-7 pr-2 py-2 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <div className="relative">
                  <Lock className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    placeholder="Contraseña"
                    className="w-full pl-7 pr-7 py-2 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-3 h-3" />
                    ) : (
                      <Eye className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-1.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-xs font-medium rounded transition-colors disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Iniciando...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-3 h-3" />
                      <span>Iniciar Sesión</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Mini Footer */}
          <div className="px-4 py-2 bg-gray-50 border-t">
            <p className="text-center text-xs text-gray-500">
              Sistema de Conductores
            </p>
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-2 text-center">
          <p className="text-xs text-white/80">¿Problemas? Contacta al admin</p>
        </div>
      </div>
    </div>
  );
};

export default SimpleAuthScreen;
