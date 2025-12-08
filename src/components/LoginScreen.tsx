"use client";

import React, { useState } from "react";
import { useUnifiedApp } from "@/context/UnifiedAppContext";
import { Shield, Users, Phone, ArrowLeft } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

type LoginMode = "selection" | "admin" | "conductor";

const LoginScreen: React.FC = () => {
  const {
    state,
    signInWithPhone,
    verifyCode,
    signInAsSuperAdmin,
    signInAsConductor,
  } = useUnifiedApp();
  const [loginMode, setLoginMode] = useState<LoginMode>("selection");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [showVerification, setShowVerification] = useState(false);
  const [selectedConductor, setSelectedConductor] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  // Filtrar solo conductores activos
  const conductores = Object.values(state.users).filter(
    (user) => user.role === "conductor" && user.isActive
  );

  const handleAdminLogin = async () => {
    if (!phoneNumber || !password) {
      setError("Por favor complete todos los campos");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Verificar credenciales de super admin
      if (phoneNumber === "0994749286" && password === "Sonita.09") {
        await signInAsSuperAdmin(phoneNumber, password);
        console.log("Login de super admin exitoso");
      } else {
        // Para otros admins, usar autenticación con Firebase
        await signInWithPhone(phoneNumber);
        setShowVerification(true);
      }
    } catch (error) {
      setError("Error en el login. Verifique sus credenciales.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) {
      e.preventDefault();
      if (!showVerification) {
        handleAdminLogin();
      } else {
        handleVerifyCode();
      }
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode) {
      setError("Por favor ingrese el código de verificación");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await verifyCode(verificationCode);
    } catch (error) {
      setError("Código de verificación inválido");
    } finally {
      setLoading(false);
    }
  };

  const handleConductorSelect = async (conductorUid: string) => {
    setLoading(true);
    setError("");

    try {
      await signInAsConductor(conductorUid);
      console.log("Conductor seleccionado:", conductorUid);
    } catch (error) {
      setError("Error al seleccionar conductor");
    } finally {
      setLoading(false);
    }
  };

  const renderModeSelection = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Sistema de Territorios JW
          </h1>
          <p className="text-gray-600">Seleccione su modo de acceso</p>
        </div>

        <div className="space-y-4">
          <Button
            onClick={() => setLoginMode("admin")}
            className="w-full h-16 bg-blue-600 hover:bg-blue-700 flex items-center justify-center space-x-3"
          >
            <Shield className="w-6 h-6" />
            <span className="text-lg font-medium">Administrador</span>
          </Button>

          <Button
            onClick={() => setLoginMode("conductor")}
            className="w-full h-16 bg-green-600 hover:bg-green-700 flex items-center justify-center space-x-3"
          >
            <Users className="w-6 h-6" />
            <span className="text-lg font-medium">Conductor</span>
          </Button>
        </div>
      </div>
    </div>
  );

  const renderAdminLogin = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
        <div className="flex items-center mb-6">
          <Button
            onClick={() => {
              setLoginMode("selection");
              setError("");
              setShowVerification(false);
            }}
            className="mr-3 p-2 bg-gray-100 hover:bg-gray-200 text-gray-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="text-xl font-bold text-gray-900">
            Acceso de Administrador
          </h2>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {!showVerification ? (
          <form 
            className="space-y-4" 
            onSubmit={(e) => {
              e.preventDefault();
              handleAdminLogin();
            }}
            onKeyDown={handleKeyDown}
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Phone className="w-4 h-4 inline mr-2" />
                Número de Teléfono
              </label>
              <Input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Ej: 0994749286"
                className="w-full"
                autoComplete="tel"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contraseña
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingrese su contraseña"
                className="w-full"
                autoComplete="current-password"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
            </Button>
          </form>
        ) : (
          <form 
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleVerifyCode();
            }}
            onKeyDown={handleKeyDown}
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Código de Verificación
              </label>
              <Input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="Ingrese el código recibido"
                className="w-full"
                autoComplete="one-time-code"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {loading ? "Verificando..." : "Verificar Código"}
            </Button>
          </form>
        )}

        {/* Contenedor invisible para reCAPTCHA */}
        <div id="recaptcha-container" style={{ display: "none" }}></div>
      </div>
    </div>
  );

  const renderConductorSelection = () => (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
        <div className="flex items-center mb-6">
          <Button
            onClick={() => setLoginMode("selection")}
            className="mr-3 p-2 bg-gray-100 hover:bg-gray-200 text-gray-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="text-xl font-bold text-gray-900">
            Seleccionar Conductor
          </h2>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {conductores.length > 0 ? (
            conductores.map((conductor) => (
              <Button
                key={conductor.uid}
                onClick={() => handleConductorSelect(conductor.uid)}
                className="w-full p-4 text-left bg-gray-50 hover:bg-green-50 border border-gray-200 rounded-lg"
              >
                <div>
                  <div className="font-medium text-gray-900">
                    {conductor.displayName ||
                      conductor.fullName ||
                      conductor.email}
                  </div>
                  {conductor.phoneNumber && (
                    <div className="text-sm text-gray-500">
                      {conductor.phoneNumber}
                    </div>
                  )}
                </div>
              </Button>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No hay conductores registrados</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  switch (loginMode) {
    case "selection":
      return renderModeSelection();
    case "admin":
      return renderAdminLogin();
    case "conductor":
      return renderConductorSelection();
    default:
      return renderModeSelection();
  }
};

export default LoginScreen;
