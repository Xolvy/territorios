"use client";

import React, { useState } from "react";
import AuthModal from "../ui/AuthModal";
import { useToast } from "../ui/ToastProvider";
import { useFirebaseAuth } from "../../hooks/useFirebaseAuth";
import { User, LogOut, Shield, Phone, Mail, Key } from "lucide-react";

const AuthExample: React.FC = () => {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMethod, setAuthMethod] = useState<
    "all" | "phone" | "email" | "admin"
  >("all");
  const { showSuccess, showInfo } = useToast();
  const { appUser, loading, signOut, isAuthenticated } = useFirebaseAuth();

  const handleAuthSuccess = (
    method: "google" | "email" | "phone" | "password",
    credential?: any
  ) => {
    console.log("Auth success:", method, credential);
    showSuccess(
      "Autenticación exitosa",
      `Sesión iniciada con ${
        method === "google"
          ? "Google"
          : method === "email"
          ? "Email"
          : method === "phone"
          ? "Teléfono"
          : "Contraseña"
      }`
    );
    setIsAuthModalOpen(false);
  };

  const handleSignOut = async () => {
    await signOut();
    showInfo("Sesión cerrada", "Has cerrado sesión exitosamente");
  };

  const getMethodsForType = (type: string) => {
    switch (type) {
      case "phone":
        return ["phone"];
      case "email":
        return ["email", "google"];
      case "admin":
        return ["password"];
      default:
        return ["google", "email", "phone", "password"];
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="text-gray-300 mt-4">Verificando autenticación...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-white mb-6">
        Sistema de Autenticación Firebase
      </h2>

      {isAuthenticated ? (
        <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-green-500/20 rounded-full">
              <User className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">
                Usuario Autenticado
              </h3>
              <p className="text-gray-300">Sesión activa</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-900/50 p-4 rounded-lg">
              <h4 className="font-medium text-white mb-2">
                Información del Usuario
              </h4>
              <div className="space-y-2 text-sm text-gray-300">
                <p>
                  <strong>UID:</strong> {appUser?.uid}
                </p>
                <p>
                  <strong>Email:</strong> {appUser?.email || "No disponible"}
                </p>
                <p>
                  <strong>Teléfono:</strong>{" "}
                  {appUser?.phoneNumber || "No disponible"}
                </p>
                <p>
                  <strong>Nombre:</strong>{" "}
                  {appUser?.fullName || "No disponible"}
                </p>
                <p>
                  <strong>Rol:</strong> {appUser?.role || "Desconocido"}
                </p>
              </div>
            </div>

            <div className="bg-gray-900/50 p-4 rounded-lg">
              <h4 className="font-medium text-white mb-2">
                Estado de Verificación
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      appUser?.email ? "bg-green-500" : "bg-yellow-500"
                    }`}
                  ></div>
                  <span className="text-gray-300">
                    Email {appUser?.email ? "disponible" : "no disponible"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      appUser?.phoneNumber ? "bg-green-500" : "bg-gray-500"
                    }`}
                  ></div>
                  <span className="text-gray-300">
                    Teléfono{" "}
                    {appUser?.phoneNumber ? "vinculado" : "no vinculado"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>
      ) : (
        <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-6 mb-6">
          <div className="text-center mb-6">
            <div className="p-4 bg-gray-700/50 rounded-full w-16 h-16 mx-auto mb-4">
              <Shield className="w-8 h-8 text-gray-400 mx-auto" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              No autenticado
            </h3>
            <p className="text-gray-300">
              Selecciona un método de autenticación para continuar
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <button
          onClick={() => {
            setAuthMethod("all");
            setIsAuthModalOpen(true);
          }}
          disabled={isAuthenticated}
          className="flex flex-col items-center gap-3 p-6 bg-blue-600/20 border border-blue-600/50 text-blue-300 rounded-xl hover:bg-blue-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Shield className="w-8 h-8" />
          <div className="text-center">
            <h4 className="font-semibold">Completo</h4>
            <p className="text-xs opacity-80">Todos los métodos</p>
          </div>
        </button>

        <button
          onClick={() => {
            setAuthMethod("phone");
            setIsAuthModalOpen(true);
          }}
          disabled={isAuthenticated}
          className="flex flex-col items-center gap-3 p-6 bg-green-600/20 border border-green-600/50 text-green-300 rounded-xl hover:bg-green-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Phone className="w-8 h-8" />
          <div className="text-center">
            <h4 className="font-semibold">Teléfono</h4>
            <p className="text-xs opacity-80">SMS verificación</p>
          </div>
        </button>

        <button
          onClick={() => {
            setAuthMethod("email");
            setIsAuthModalOpen(true);
          }}
          disabled={isAuthenticated}
          className="flex flex-col items-center gap-3 p-6 bg-purple-600/20 border border-purple-600/50 text-purple-300 rounded-xl hover:bg-purple-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Mail className="w-8 h-8" />
          <div className="text-center">
            <h4 className="font-semibold">Email</h4>
            <p className="text-xs opacity-80">Email + Google</p>
          </div>
        </button>

        <button
          onClick={() => {
            setAuthMethod("admin");
            setIsAuthModalOpen(true);
          }}
          disabled={isAuthenticated}
          className="flex flex-col items-center gap-3 p-6 bg-red-600/20 border border-red-600/50 text-red-300 rounded-xl hover:bg-red-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Key className="w-8 h-8" />
          <div className="text-center">
            <h4 className="font-semibold">Admin</h4>
            <p className="text-xs opacity-80">Solo contraseña</p>
          </div>
        </button>
      </div>

      <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Números de Prueba
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="bg-gray-900/50 p-4 rounded-lg">
            <h4 className="font-medium text-green-400 mb-2">
              Teléfono de Prueba
            </h4>
            <p className="text-gray-300 mb-1">
              <strong>Número:</strong> +1 650-555-3434
            </p>
            <p className="text-gray-300">
              <strong>Código:</strong> 654321
            </p>
          </div>
          <div className="bg-gray-900/50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-400 mb-2">Email de Prueba</h4>
            <p className="text-gray-300 mb-1">
              <strong>Email:</strong> test@example.com
            </p>
            <p className="text-gray-300">
              <strong>Password:</strong> test123456
            </p>
          </div>
        </div>
      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
        title={
          authMethod === "admin" ? "Centro de Administración" : "Iniciar Sesión"
        }
        allowedMethods={getMethodsForType(authMethod) as any}
        requireAdmin={authMethod === "admin"}
      />
    </div>
  );
};

export default AuthExample;
