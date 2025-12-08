"use client";

import React, { useState, useEffect } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebase";
import { Shield, Briefcase, ArrowLeft, User } from "lucide-react";
import { userService } from "../lib/userService";
import { AppUser } from "../types/user";
import { authDiagnostic } from "../lib/authDiagnostic";

interface LoginPanelProps {
  onLogin: (user: any) => void;
  onConductorLogin: (conductor: AppUser) => void;
  onShowToast?: (
    message: string,
    type: "success" | "error" | "warning"
  ) => void;
}

export const LoginPanel: React.FC<LoginPanelProps> = ({
  onLogin,
  onConductorLogin,
  onShowToast,
}) => {
  const [view, setView] = useState<"main" | "admin" | "conductor">("main");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [conductores, setConductores] = useState<AppUser[]>([]);
  const [loadingConductores, setLoadingConductores] = useState(false);

  // Cargar lista de conductores
  const loadConductores = async () => {
    setLoadingConductores(true);
    try {
      const allUsers = await userService.getAllUsers();
      // Filtrar solo usuarios activos que sean conductores (no admin ni super-admin)
      const solosConductores = allUsers.filter(
        (user) =>
          user.isActive && user.role !== "admin" && user.role !== "super-admin"
      );
      setConductores(solosConductores);
    } catch (error) {
      console.error("Error cargando conductores:", error);
      onShowToast?.("Error al cargar la lista de conductores", "error");
    } finally {
      setLoadingConductores(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim() || !password.trim()) {
      onShowToast?.("Por favor completa todos los campos", "error");
      return;
    }

    setLoading(true);
    let emailToUse = "";
    const isDevelopment = process.env.NODE_ENV === "development";

    try {
      if (isDevelopment) {
        console.log("🔍 Iniciando login con teléfono:", phoneNumber);
      }

      // Mapeo directo para el super admin principal
      if (phoneNumber === "0994749286" || phoneNumber === "+593994749286") {
        emailToUse = "italo.fm0@gmail.com";
        if (isDevelopment) {
          console.log("✅ Mapeo directo encontrado, email:", emailToUse);
        }
      } else {
        // Buscar usuario admin por número de teléfono en la base de datos
        const allUsers = await userService.getAllUsers();
        const adminUser = allUsers.find(
          (user) =>
            (user.phoneNumber === phoneNumber ||
              user.phoneNumber === `+593${phoneNumber}`) &&
            (user.role === "admin" || user.role === "super-admin") &&
            user.isActive
        );

        if (!adminUser) {
          onShowToast?.(
            "Número de teléfono no autorizado como administrador",
            "error"
          );
          return;
        }

        emailToUse = adminUser.email || "";
      }

      if (!emailToUse) {
        onShowToast?.(
          "Usuario administrador no tiene email configurado",
          "error"
        );
        return;
      }

      // Diagnóstico completo antes de intentar login (solo en desarrollo)
      if (isDevelopment) {
        await authDiagnostic.fullDiagnostic(emailToUse);
      }

      // Autenticar con el email encontrado/mapeado
      if (isDevelopment) {
        console.log("🔐 Intentando autenticación con email:", emailToUse);
      }
      const userCredential = await signInWithEmailAndPassword(
        auth,
        emailToUse,
        password
      );

      if (isDevelopment) {
        console.log("✅ Autenticación exitosa:", userCredential.user.uid);
      }
      onLogin(userCredential.user);
      onShowToast?.("Inicio de sesión exitoso", "success");
    } catch (error: any) {
      if (isDevelopment) {
        console.error("❌ Error detallado en login:", {
          code: error.code,
          message: error.message,
          email: emailToUse,
          phoneNumber: phoneNumber,
        });
      }

      let errorMessage = "Error de autenticación";
      if (error.code === "auth/user-not-found") {
        errorMessage = "Usuario no encontrado en Firebase";
      } else if (error.code === "auth/wrong-password") {
        errorMessage = "Contraseña incorrecta";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Email inválido";
      } else if (error.code === "auth/network-request-failed") {
        errorMessage = "Error de conexión. Verifica tu internet";
      }

      onShowToast?.(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleConductorSelection = (conductor: AppUser) => {
    onConductorLogin(conductor);
  };

  // Vista de login de administrador
  if (view === "admin") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 p-8 shadow-2xl">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-full mb-4">
                <Shield className="w-8 h-8 text-cyan-400" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">
                Acceso Administrativo
              </h1>
              <p className="text-white/70">Ingresa tus credenciales</p>
            </div>

            {/* Formulario */}
            <form onSubmit={handleAdminLogin} className="space-y-6">
              <div>
                <label className="block text-white/80 mb-2 text-sm font-medium">
                  Número de teléfono
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all"
                  placeholder="+1234567890"
                  required
                />
              </div>

              <div>
                <label className="block text-white/80 mb-2 text-sm font-medium">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="space-y-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-blue-500/80 to-cyan-500/80 hover:from-blue-400/80 hover:to-cyan-400/80 disabled:from-slate-500/50 disabled:to-slate-600/50 text-white rounded-xl font-semibold transition-all duration-300 disabled:cursor-not-allowed"
                >
                  {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
                </button>

                <button
                  type="button"
                  onClick={() => setView("main")}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 text-white/80 rounded-xl font-medium transition-all duration-300 border border-white/20 flex items-center justify-center space-x-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Volver al inicio</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Vista de selección de conductor
  if (view === "conductor") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 p-8 shadow-2xl">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-emerald-500/20 to-green-500/20 rounded-full mb-4">
                <Briefcase className="w-8 h-8 text-emerald-400" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">
                Selecciona tu Nombre
              </h1>
              <p className="text-white/70">Encuentra tu nombre en la lista</p>
            </div>

            {/* Lista de Conductores */}
            <div className="space-y-4 mb-6">
              {loadingConductores ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400 mb-4"></div>
                  <p className="text-white/80">Cargando conductores...</p>
                </div>
              ) : conductores.length === 0 ? (
                <div className="text-center py-8">
                  <User className="w-16 h-16 text-white/30 mx-auto mb-4" />
                  <p className="text-white/80">
                    No hay conductores registrados
                  </p>
                  <p className="text-white/50 text-sm mt-2">
                    Contacta al administrador para registrarte
                  </p>
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto space-y-2 custom-scrollbar">
                  {conductores.map((conductor) => (
                    <button
                      key={conductor.uid}
                      onClick={() => handleConductorSelection(conductor)}
                      className="w-full p-4 bg-gradient-to-r from-emerald-500/10 to-green-500/10 hover:from-emerald-500/20 hover:to-green-500/20 border border-white/10 hover:border-emerald-400/30 rounded-xl text-white transition-all duration-300 group text-left"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold group-hover:text-emerald-300 transition-colors">
                            {conductor.displayName ||
                              conductor.fullName ||
                              "Usuario sin nombre"}
                          </h3>
                          {conductor.phoneNumber && (
                            <p className="text-sm text-white/70">
                              {conductor.phoneNumber}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Botón Volver */}
            <button
              onClick={() => setView("main")}
              className="w-full py-3 bg-white/5 hover:bg-white/10 text-white/80 rounded-xl font-medium transition-all duration-300 border border-white/20 flex items-center justify-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver al inicio</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Vista principal de selección
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 p-8 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold text-white mb-2">
              Territorios App
            </h1>
            <p className="text-white/70">Selecciona tu tipo de acceso</p>
          </div>

          {/* Opciones de acceso */}
          <div className="space-y-4">
            {/* Administrador */}
            <button
              onClick={() => setView("admin")}
              className="w-full p-6 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 hover:from-blue-500/30 hover:to-cyan-500/30 border border-white/20 rounded-2xl text-white transition-all duration-300 group"
            >
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-semibold group-hover:text-cyan-300 transition-colors">
                    Soy Administrador
                  </h3>
                  <p className="text-sm text-white/70">
                    Gestión completa del sistema
                  </p>
                </div>
              </div>
            </button>

            {/* Conductor */}
            <button
              onClick={() => {
                setView("conductor");
                loadConductores();
              }}
              className="w-full p-6 bg-gradient-to-r from-emerald-500/20 to-green-500/20 hover:from-emerald-500/30 hover:to-green-500/30 border border-white/20 rounded-2xl text-white transition-all duration-300 group"
            >
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-semibold group-hover:text-emerald-300 transition-colors">
                    Soy Conductor
                  </h3>
                  <p className="text-sm text-white/70">
                    Ver programas y asignaciones
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPanel;
