"use client";

import React, { useState, useEffect, useCallback } from "react";
import { phoneService } from "@/lib/phoneServiceAdvanced";
import {
  uploadPhoneNumbersFromCSV,
  clearAllPhoneNumbers,
  checkPhoneNumbersStatus,
  formatPhoneNumber,
} from "@/lib/phoneNumberManager";
import { useConfirmation } from "../ui/ConfirmationProvider";
import { useToast } from "../ui/ToastProvider";

interface PhoneNumberUtilitiesProps {
  onShowToast: (message: string, type: "success" | "error" | "warning") => void;
}

interface PhoneRecord {
  id: string;
  propietario: string;
  direccion: string;
  numero: string;
  publicador?: string;
  estado?: string;
  comentarios?: string;
  fechaAsignacion?: any;
  fechaEstado?: any;
}

interface DataStatus {
  totalNumbers: number;
  assignedNumbers: number;
  hasData: boolean;
}

const PhoneNumberUtilities: React.FC<PhoneNumberUtilitiesProps> = ({
  onShowToast,
}) => {
  const { showConfirmation } = useConfirmation();
  const { showSuccess, showError, showWarning } = useToast();

  const [csvData, setCsvData] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<DataStatus | null>(null);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneRecord[]>([]);
  const [showAllNumbers, setShowAllNumbers] = useState(false);
  const [editingPhone, setEditingPhone] = useState<PhoneRecord | null>(null);
  const [activeTab, setActiveTab] = useState<"upload" | "manage" | "view">(
    "upload"
  );

  // Estados para progreso de subida
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentItem, setCurrentItem] = useState(0);
  const [totalItems, setTotalItems] = useState(0);

  // Verificar estado actual de la base de datos
  const checkStatus = useCallback(async () => {
    try {
      const currentStatus = await checkPhoneNumbersStatus();
      setStatus(currentStatus);
    } catch (error) {
      console.error("Error verificando estado:", error);
      onShowToast("❌ Error verificando estado de la base de datos", "error");
    }
  }, [onShowToast]);

  // Actualización en tiempo real cada 30 segundos
  useEffect(() => {
    // Cargar estado inicial
    checkStatus();

    // Configurar actualización automática cada 30 segundos
    const intervalId = setInterval(() => {
      checkStatus();
    }, 30000); // 30 segundos

    // Limpiar intervalo al desmontar el componente
    return () => {
      clearInterval(intervalId);
    };
  }, [checkStatus]);

  // Cargar todos los números telefónicos
  const loadAllNumbers = useCallback(async () => {
    setIsLoading(true);
    try {
      const numbers = await phoneService.getAllPhoneNumbers();
      setPhoneNumbers(numbers);
    } catch (error) {
      console.error("Error cargando números:", error);
      onShowToast("❌ Error cargando números telefónicos", "error");
    } finally {
      setIsLoading(false);
    }
  }, [onShowToast]);

  // Subir números nuevos a Firebase
  const handleUpload = async () => {
    if (!csvData.trim()) {
      showWarning("Datos requeridos", "Por favor ingresa datos CSV para subir");
      return;
    }

    const confirmed = await showConfirmation({
      title: "Confirmar subida",
      message: "¿Proceder con la subida de números a Firebase?",
      type: "info",
      confirmText: "Sí, proceder",
      cancelText: "Cancelar",
    });

    if (!confirmed) {
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setCurrentItem(0);
    setTotalItems(0);

    try {
      await uploadPhoneNumbersFromCSV(csvData, (current, total, percentage) => {
        setCurrentItem(current);
        setTotalItems(total);
        setUploadProgress(percentage);
      });

      onShowToast(
        "✅ Números telefónicos subidos exitosamente a Firebase",
        "success"
      );
      setCsvData("");
      setUploadProgress(0);
      setCurrentItem(0);
      setTotalItems(0);
      await checkStatus();
      if (activeTab === "view" || activeTab === "manage") {
        await loadAllNumbers();
      }
      showSuccess(
        "Subida completada",
        "Números telefónicos subidos exitosamente"
      );
    } catch (error) {
      console.error("Error subiendo:", error);
      showError(
        "Error en la subida",
        "No se pudieron subir los números a Firebase"
      );
    } finally {
      setIsUploading(false);
    }
  };

  // Limpiar todos los números existentes
  const handleClearAll = async () => {
    const confirmed = await showConfirmation({
      title: "⚠️ Eliminar TODOS los números",
      message:
        "¿Estás seguro de que quieres eliminar TODOS los números telefónicos de Firebase? Esta acción no se puede deshacer.",
      type: "error",
      confirmText: "Sí, eliminar todo",
      cancelText: "Cancelar",
    });

    if (!confirmed) {
      return;
    }

    setIsClearing(true);

    try {
      await clearAllPhoneNumbers();
      showSuccess(
        "Limpieza completada",
        "Todos los números telefónicos han sido eliminados"
      );
      await checkStatus();
      setPhoneNumbers([]);
    } catch (error) {
      console.error("Error limpiando:", error);
      showError(
        "Error en la limpieza",
        "No se pudieron eliminar los números de Firebase"
      );
    } finally {
      setIsClearing(false);
    }
  };

  // Eliminar un número específico
  const handleDeletePhone = async (phoneId: string) => {
    const confirmed = await showConfirmation({
      title: "Eliminar número",
      message: "¿Estás seguro de que quieres eliminar este número?",
      type: "warning",
      confirmText: "Sí, eliminar",
      cancelText: "Cancelar",
    });

    if (!confirmed) {
      return;
    }

    try {
      await phoneService.deletePhoneNumber(phoneId);
      showSuccess("Número eliminado", "El número fue eliminado exitosamente");
      await loadAllNumbers();
      await checkStatus();
    } catch (error) {
      console.error("Error eliminando número:", error);
      showError("Error al eliminar", "No se pudo eliminar el número");
    }
  };

  // Actualizar un número específico
  const handleUpdatePhone = async (phone: PhoneRecord) => {
    try {
      await phoneService.updatePhoneNumber(phone.id, {
        propietario: phone.propietario,
        direccion: phone.direccion,
        numero: phone.numero,
        publicador: phone.publicador,
        estado: phone.estado as any,
        comentarios: phone.comentarios,
      });
      onShowToast("✅ Número actualizado exitosamente", "success");
      setEditingPhone(null);
      await loadAllNumbers();
    } catch (error) {
      console.error("Error actualizando número:", error);
      onShowToast("❌ Error actualizando número", "error");
    }
  };

  // Cargar estado al montar el componente
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Cargar números cuando se activa la vista
  useEffect(() => {
    if (activeTab === "view" || activeTab === "manage") {
      loadAllNumbers();
    }
  }, [activeTab, loadAllNumbers]);

  return (
    <div className="space-y-6">
      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-2xl">
        <h2 className="text-2xl font-semibold text-white mb-6">
          📱 Gestión de Predicación Telefónica
        </h2>

        {/* Estado actual */}
        <div className="mb-6 p-4 bg-blue-500/20 border border-blue-400/50 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-blue-300 font-medium">
              Estado Actual de la Base de Datos
            </h3>
            <button
              onClick={checkStatus}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
              title="Actualizar manualmente"
            >
              🔄 Actualizar
            </button>
          </div>
          {status ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="text-center p-3 bg-white/10 rounded-lg">
                  <p className="text-3xl font-bold text-white">
                    {status.totalNumbers.toLocaleString()}
                  </p>
                  <p className="text-sm text-blue-200">Total de números</p>
                </div>
                <div className="text-center p-3 bg-green-500/20 rounded-lg border border-green-400/30">
                  <p className="text-3xl font-bold text-green-300">
                    {status.assignedNumbers.toLocaleString()}
                  </p>
                  <p className="text-sm text-green-200">Números asignados</p>
                  <p className="text-xs text-green-300 mt-1">
                    📋 Revisitas + 📄 PDF en cooldown (15 días)
                  </p>
                </div>
              </div>
              <div className="text-center">
                <p
                  className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                    status.hasData
                      ? "bg-green-500/20 text-green-300 border border-green-400/30"
                      : "bg-gray-500/20 text-gray-300 border border-gray-400/30"
                  }`}
                >
                  {status.hasData
                    ? "✅ Base de datos poblada"
                    : "⚪ Sin datos asignados"}
                </p>
                <p className="text-xs text-blue-200 mt-2">
                  🔄 Actualización automática cada 30 segundos
                </p>
              </div>
            </div>
          ) : (
            <p className="text-gray-300 text-center py-4">
              <span className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-2"></span>
              Cargando estado...
            </p>
          )}
        </div>

        {/* Navegación por pestañas */}
        <div className="mb-6 border-b border-white/20">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab("upload")}
              className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "upload"
                  ? "border-blue-500 text-blue-300"
                  : "border-transparent text-gray-300 hover:text-white hover:border-gray-300"
              }`}
            >
              📤 Subir Números
            </button>
            <button
              onClick={() => setActiveTab("manage")}
              className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "manage"
                  ? "border-blue-500 text-blue-300"
                  : "border-transparent text-gray-300 hover:text-white hover:border-gray-300"
              }`}
            >
              ⚙️ Gestionar
            </button>
            <button
              onClick={() => setActiveTab("view")}
              className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "view"
                  ? "border-blue-500 text-blue-300"
                  : "border-transparent text-gray-300 hover:text-white hover:border-gray-300"
              }`}
            >
              📋 Ver Todos
            </button>
          </nav>
        </div>

        {/* Contenido de las pestañas */}
        {activeTab === "upload" && (
          <div className="space-y-6">
            <h3 className="text-green-300 font-medium mb-3">
              Subir Números a Firebase
            </h3>
            <p className="text-gray-300 text-sm mb-3">
              Pega aquí tus datos CSV. Formato esperado: <br />
              <code className="text-yellow-300">
                Nombre, Dirección, Teléfono, Asignado A, Estado
              </code>
            </p>
            <textarea
              value={csvData}
              onChange={(e) => setCsvData(e.target.value)}
              placeholder="GARCIA LOPEZ MARIA, AV. PRINCIPAL 123, 2987654, Juan Perez, No contestaron"
              className="w-full h-32 p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 resize-vertical"
              disabled={isUploading}
            />

            {/* Barra de progreso */}
            {isUploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-300">
                  <span>Subiendo números...</span>
                  <span>
                    {currentItem} / {totalItems} ({uploadProgress}%)
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-green-500 to-green-400 h-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleUpload}
                disabled={isUploading || !csvData.trim()}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded transition-colors"
              >
                {isUploading ? "📤 Subiendo..." : "📤 Subir a Firebase"}
              </button>
              <button
                onClick={() => setCsvData("")}
                disabled={isUploading}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 text-white rounded transition-colors"
              >
                🧹 Limpiar Texto
              </button>
            </div>
          </div>
        )}

        {activeTab === "manage" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-red-300 font-medium">
                Gestionar Base de Datos
              </h3>
              <button
                onClick={handleClearAll}
                disabled={isClearing}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded transition-colors"
              >
                {isClearing ? "🧹 Eliminando..." : "🗑️ Eliminar Todos"}
              </button>
            </div>

            {isLoading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                <p className="text-gray-300 mt-2">Cargando números...</p>
              </div>
            ) : (
              <div className="bg-white/5 rounded-lg p-4 max-h-96 overflow-y-auto">
                {phoneNumbers.length === 0 ? (
                  <p className="text-gray-300 text-center py-4">
                    No hay números telefónicos
                  </p>
                ) : (
                  <div className="space-y-2">
                    {phoneNumbers.map((phone) => (
                      <div
                        key={phone.id}
                        className="bg-white/5 p-3 rounded border border-white/10"
                      >
                        {editingPhone?.id === phone.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editingPhone.propietario}
                              onChange={(e) =>
                                setEditingPhone({
                                  ...editingPhone,
                                  propietario: e.target.value,
                                })
                              }
                              className="w-full p-2 bg-white/10 border border-white/20 rounded text-white"
                              placeholder="Nombre"
                            />
                            <input
                              type="text"
                              value={editingPhone.numero}
                              onChange={(e) =>
                                setEditingPhone({
                                  ...editingPhone,
                                  numero: e.target.value,
                                })
                              }
                              className="w-full p-2 bg-white/10 border border-white/20 rounded text-white"
                              placeholder="Teléfono"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleUpdatePhone(editingPhone)}
                                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                              >
                                ✅ Guardar
                              </button>
                              <button
                                onClick={() => setEditingPhone(null)}
                                className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm"
                              >
                                ❌ Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium text-white">
                                {phone.propietario}
                              </p>
                              <p className="text-sm text-gray-300">
                                {formatPhoneNumber(phone.numero)} -{" "}
                                {phone.estado}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setEditingPhone(phone)}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                              >
                                ✏️ Editar
                              </button>
                              <button
                                onClick={() => handleDeletePhone(phone.id)}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                              >
                                🗑️ Eliminar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "view" && (
          <div className="space-y-6">
            <h3 className="text-blue-300 font-medium">
              Todos los Números Telefónicos
            </h3>

            {isLoading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                <p className="text-gray-300 mt-2">Cargando números...</p>
              </div>
            ) : (
              <div className="bg-white/5 rounded-lg p-4 max-h-96 overflow-y-auto">
                {phoneNumbers.length === 0 ? (
                  <p className="text-gray-300 text-center py-4">
                    No hay números telefónicos
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {phoneNumbers.map((phone) => (
                        <div
                          key={phone.id}
                          className="bg-white/5 p-3 rounded border border-white/10"
                        >
                          <h4 className="font-medium text-white">
                            {phone.propietario}
                          </h4>
                          <p className="text-sm text-gray-300">
                            {formatPhoneNumber(phone.numero)}
                          </p>
                          <p className="text-sm text-gray-400">
                            {phone.direccion}
                          </p>
                          <div className="mt-2 flex justify-between items-center">
                            <span
                              className={`px-2 py-1 rounded text-xs ${
                                phone.estado === "Contestaron"
                                  ? "bg-green-500/20 text-green-300"
                                  : phone.estado === "No contestaron"
                                  ? "bg-orange-500/20 text-orange-300"
                                  : phone.estado === "Colgaron"
                                  ? "bg-red-500/20 text-red-300"
                                  : "bg-gray-500/20 text-gray-300"
                              }`}
                            >
                              {phone.estado || "Sin estado"}
                            </span>
                            {phone.publicador && (
                              <span className="text-xs text-blue-300">
                                {phone.publicador}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PhoneNumberUtilities;
