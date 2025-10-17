"use client";

import React, { useState } from "react";
import { Shield, Users, User, Phone, Lock, Eye, EyeOff, LogIn, X } from "lucide-react";

interface WelcomeScreenProps {
  onAdminLogin: (user: any) => void;
  onConductorLogin: (conductor: any) => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onAdminLogin,
  onConductorLogin,
}) => {
  const [mode, setMode] = useState<"welcome" | "admin" | "conductor">("welcome");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lista temporal de conductores (más tarde vendrá de la base de datos)
  const [conductores] = useState([
    { id: 1, nombre: "Juan Pérez", telefono: "0991234567" },
    { id: 2, nombre: "María González", telefono: "0987654321" },
    { id: 3, nombre: "Carlos Rodriguez", telefono: "0999876543" },
  ]);

  const handleAdminLogin = async () => {
    setIsLoading(true);
    setError(null);

    // Validar credenciales SuperAdmin
    if (phoneNumber === "0994749286" && password === "Sonita.09") {
      const adminUser = {
        id: "super-admin",
        nombre: "Super Administrador",
        telefono: phoneNumber,
        role: "super-admin",
      };
      onAdminLogin(adminUser);
    } else {
      setError("Credenciales incorrectas");
    }

    setIsLoading(false);
  };

  const handleConductorSelect = (conductor: any) => {
    onConductorLogin(conductor);
  };

  const resetToWelcome = () => {
    setMode("welcome");
    setPhoneNumber("");
    setPassword("");
    setError(null);
  };

  if (mode === "welcome") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5"></div>
        </div>

        <div className="relative w-full max-w-md">
          {/* Logo Principal */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl shadow-xl mb-6">
              <Shield className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Sistema de Conductores
            </h1>
            <p className="text-white/60">
              Selecciona tu tipo de acceso
            </p>
          </div>

          {/* Opciones de Acceso */}
          <div className="space-y-4">
            {/* Opción Administrador */}
            <button
              onClick={() => setMode("admin")}
              className="w-full bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 hover:bg-white/15 transition-all duration-300 text-left group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-1">
                    Administrador
                  </h3>
                  <p className="text-white/60 text-sm">
                    Gestión completa del sistema
                  </p>
                </div>
                <div className="text-white/40 group-hover:text-white/60 transition-colors">
                  →
                </div>
              </div>
            </button>

            {/* Opción Conductor */}
            <button
              onClick={() => setMode("conductor")}
              className="w-full bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 hover:bg-white/15 transition-all duration-300 text-left group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-1">
                    Conductor
                  </h3>
                  <p className="text-white/60 text-sm">
                    Ver mis asignaciones
                  </p>
                </div>
                <div className="text-white/40 group-hover:text-white/60 transition-colors">
                  →
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "admin") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md">
          {/* Header con botón de regreso */}
          <div className="flex items-center mb-8">
            <button
              onClick={resetToWelcome}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-white/60" />
            </button>
            <h2 className="text-xl font-semibold text-white ml-3">
              Acceso de Administrador
            </h2>
          </div>

          {/* Formulario de Login */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6">
            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {/* Campo Celular */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Número de Celular
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="0991234567"
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                  />
                </div>
              </div>

              {/* Campo Contraseña */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tu contraseña"
                    className="w-full pl-10 pr-12 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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

              {/* Botón Iniciar Sesión */}
              <button
                onClick={handleAdminLogin}
                disabled={isLoading || !phoneNumber || !password}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:from-gray-600 disabled:to-gray-700 text-white font-medium rounded-xl shadow-lg hover:shadow-xl disabled:shadow-none transition-all duration-300 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Iniciando...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Iniciar Sesión</span>
                  </>
                )}
              </button>
            </div>

            {/* Información de ayuda */}
            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <p className="text-xs text-blue-300">
                <strong>SuperAdmin:</strong> 0994749286 / Sonita.09
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "conductor") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md">
          {/* Header con botón de regreso */}
          <div className="flex items-center mb-8">
            <button
              onClick={resetToWelcome}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-white/60" />
            </button>
            <h2 className="text-xl font-semibold text-white ml-3">
              Seleccionar Conductor
            </h2>
          </div>

          {/* Lista de Conductores */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6">
            <div className="space-y-3">
              {conductores.map((conductor) => (
                <button
                  key={conductor.id}
                  onClick={() => handleConductorSelect(conductor)}
                  className="w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl p-4 text-left transition-all duration-200 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-white group-hover:text-white/90">
                        {conductor.nombre}
                      </h3>
                      <p className="text-white/60 text-sm">
                        {conductor.telefono}
                      </p>
                    </div>
                    <div className="text-white/40 group-hover:text-white/60 transition-colors">
                      →
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {conductores.length === 0 && (
              <div className="text-center py-8">
                <p className="text-white/60">
                  No hay conductores registrados
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default WelcomeScreen;