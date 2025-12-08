"use client";

import React, { useState, useEffect } from "react";
import {
  Phone,
  Download,
  RefreshCw,
  Users,
  FileText,
  Calendar,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Edit3,
  Save,
  X,
} from "lucide-react";
import {
  phoneService,
  PhoneRecord,
  PhoneStats,
  PhoneRequestResult,
  PhoneCallStatus,
  PHONE_CALL_STATUSES,
} from "@/lib/phoneServiceAdvanced";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

interface TelephonePreachingModuleProps {
  userRole: "admin" | "conductor";
  currentUser: any;
}

const TelephonePreachingModule: React.FC<TelephonePreachingModuleProps> = ({
  userRole,
  currentUser,
}) => {
  // States
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneRecord[]>([]);
  const [stats, setStats] = useState<PhoneStats | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<{
    publicador: string;
    estado: PhoneCallStatus | "";
    comentarios: string;
  }>({
    publicador: "",
    estado: "",
    comentarios: "",
  });

  // Load initial data
  useEffect(() => {
    if (userRole === "conductor") {
      // Los conductores empiezan sin números, deben solicitarlos
      setPhoneNumbers([]);
    }
  }, [userRole]);

  // Calculate stats whenever phone numbers change
  useEffect(() => {
    const calculateStats = async () => {
      if (phoneNumbers.length > 0) {
        try {
          const calculatedStats = await phoneService.getPhoneStats(
            phoneNumbers
          );
          setStats(calculatedStats);
        } catch (error) {
          console.error("Error calculating stats:", error);
        }
      }
    };

    calculateStats();
  }, [phoneNumbers]);

  const showMessage = (message: string, type: "success" | "error") => {
    if (type === "success") {
      setSuccess(message);
      setError(null);
    } else {
      setError(message);
      setSuccess(null);
    }

    setTimeout(() => {
      setSuccess(null);
      setError(null);
    }, 5000);
  };

  // Solicitar 50 números aleatorios
  const handleRequestNumbers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log("🔄 Solicitando números telefónicos...");
      const result = await phoneService.requestPhoneNumbers();

      setPhoneNumbers(result.numbers);

      if (result.needsReset) {
        showMessage(
          `Se resetearon todos los estados. Obtenidos ${result.numbers.length} números.`,
          "success"
        );
      } else {
        showMessage(
          `¡${result.numbers.length} números telefónicos obtenidos exitosamente!`,
          "success"
        );
      }

      console.log(`✅ ${result.numbers.length} números obtenidos`);
    } catch (error: any) {
      console.error("❌ Error solicitando números:", error);
      showMessage(
        error.message || "Error al solicitar números telefónicos",
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Exportar 30 números a PDF
  const handleExportPDF = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log("📑 Exportando números a PDF...");
      const selectedNumbers = await phoneService.exportPhoneNumbersPDF();

      // Generar y descargar PDF
      await generatePhonePDF(selectedNumbers);

      showMessage(
        `¡${selectedNumbers.length} números exportados a PDF y bloqueados por 15 días!`,
        "success"
      );

      // Actualizar la lista actual removiendo los números exportados
      const exportedIds = selectedNumbers.map((n) => n.id);
      setPhoneNumbers((prev) =>
        prev.filter((phone) => !exportedIds.includes(phone.id))
      );
    } catch (error: any) {
      console.error("❌ Error exportando PDF:", error);
      showMessage(error.message || "Error al exportar PDF", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Generar PDF con los números telefónicos
  const generatePhonePDF = async (numbers: PhoneRecord[]) => {
    const stats = await phoneService.getPhoneStats(numbers);

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Registro de Territorio Telefónico</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
            body { font-family: 'Inter', sans-serif; }
            @media print {
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .no-print { display: none; }
                .print-container { box-shadow: none; border: none; margin: 0; max-width: 100%; }
            }
        </style>
    </head>
    <body class="bg-gray-100 p-4 sm:p-8">
        <div class="print-container max-w-7xl mx-auto bg-white p-6 sm:p-8 rounded-lg shadow-lg">
            <!-- Encabezado y Resumen -->
            <div class="mb-8">
                <div class="flex flex-wrap justify-between items-start mb-6 gap-4">
                    <div>
                        <h1 class="text-xl sm:text-2xl font-bold text-gray-800">CONGREGACIÓN NUEVE DE OCTUBRE</h1>
                        <p class="text-md text-gray-600">REGISTRO DE ASIGNACIÓN DE TERRITORIO TELEFÓNICO</p>
                        <p class="text-sm text-gray-500 mt-2">Generado el ${new Date().toLocaleDateString(
                          "es-ES"
                        )}</p>
                    </div>
                    <div class="w-full sm:w-auto bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                        <div class="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1">
                            <div class="font-bold">TOTAL: <span class="font-normal">${
                              stats.total
                            }</span></div>
                            <div><span class="font-semibold text-gray-700">Contestaron:</span> ${
                              stats.contestaron
                            }</div>
                            <div><span class="font-semibold text-gray-700">Colgaron:</span> ${
                              stats.colgaron
                            }</div>
                            <div><span class="font-semibold text-gray-700">Revisita:</span> ${
                              stats.revisita
                            }</div>
                            <div><span class="font-semibold text-gray-700">No llamar:</span> ${
                              stats.noLlamar
                            }</div>
                            <div><span class="font-semibold text-gray-700">Suspendido:</span> ${
                              stats.suspendido
                            }</div>
                            <div><span class="font-semibold text-gray-700">Devuelto:</span> ${
                              stats.devuelto
                            }</div>
                            <div><span class="font-semibold text-gray-700">No contestaron:</span> ${
                              stats.noContestaron
                            }</div>
                            <div><span class="font-semibold text-gray-700">Testigo:</span> ${
                              stats.testigo
                            }</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tabla de Registros -->
            <div class="overflow-x-auto">
                <table class="w-full border-collapse text-left text-xs sm:text-sm">
                    <thead class="bg-gray-100">
                        <tr>
                            <th class="border-b-2 border-gray-300 p-3 font-semibold text-gray-700">PROPIETARIO</th>
                            <th class="border-b-2 border-gray-300 p-3 font-semibold text-gray-700">DIRECCIÓN</th>
                            <th class="border-b-2 border-gray-300 p-3 font-semibold text-gray-700">NÚMERO</th>
                            <th class="border-b-2 border-gray-300 p-3 font-semibold text-gray-700">PUBLICADOR</th>
                            <th class="border-b-2 border-gray-300 p-3 font-semibold text-gray-700">ESTADO</th>
                            <th class="border-b-2 border-gray-300 p-3 font-semibold text-gray-700">COMENTARIOS</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${numbers
                          .map(
                            (phone) => `
                            <tr class="hover:bg-gray-50">
                                <td class="border-b border-gray-200 p-3">${
                                  phone.propietario || ""
                                }</td>
                                <td class="border-b border-gray-200 p-3">${
                                  phone.direccion || ""
                                }</td>
                                <td class="border-b border-gray-200 p-3">${
                                  phone.numero || ""
                                }</td>
                                <td class="border-b border-gray-200 p-3">${
                                  phone.publicador || ""
                                }</td>
                                <td class="border-b border-gray-200 p-3">${
                                  phone.estado || ""
                                }</td>
                                <td class="border-b border-gray-200 p-3">${
                                  phone.comentarios || ""
                                }</td>
                            </tr>
                        `
                          )
                          .join("")}
                    </tbody>
                </table>
            </div>
            
            <div class="mt-8 text-center no-print">
                <button onclick="window.print()" class="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-300">
                    Imprimir Formulario
                </button>
            </div>
        </div>
    </body>
    </html>
    `;

    // Crear y descargar el archivo
    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `territorio-telefonico-${
      new Date().toISOString().split("T")[0]
    }.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Iniciar edición de un número
  const startEditing = (phone: PhoneRecord) => {
    setEditingId(phone.id);
    setEditingData({
      publicador: phone.publicador || "",
      estado: phone.estado || "",
      comentarios: phone.comentarios || "",
    });
  };

  // Cancelar edición
  const cancelEditing = () => {
    setEditingId(null);
    setEditingData({ publicador: "", estado: "", comentarios: "" });
  };

  // Guardar cambios
  const saveChanges = async (phoneId: string) => {
    if (!editingData.publicador.trim()) {
      showMessage("El publicador es requerido", "error");
      return;
    }

    try {
      await phoneService.updatePhoneStatus(phoneId, {
        publicador: editingData.publicador,
        estado: editingData.estado || undefined,
        comentarios: editingData.comentarios,
      });

      // Actualizar en la lista local
      setPhoneNumbers((prev) =>
        prev.map((phone) =>
          phone.id === phoneId
            ? {
                ...phone,
                publicador: editingData.publicador,
                estado: editingData.estado || undefined,
                comentarios: editingData.comentarios,
              }
            : phone
        )
      );

      cancelEditing();
      showMessage("Cambios guardados exitosamente", "success");
    } catch (error: any) {
      showMessage(error.message || "Error al guardar cambios", "error");
    }
  };

  if (userRole !== "conductor" && userRole !== "admin") {
    return (
      <div className="text-center p-8">
        <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Acceso Restringido
        </h3>
        <p className="text-gray-600">
          Este módulo requiere permisos de conductor o administrador
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <Phone className="w-8 h-8" />
          <div>
            <h2 className="text-2xl font-bold">Predicación Telefónica</h2>
            <p className="text-blue-100">
              Gestión de números telefónicos para predicar
            </p>
          </div>
        </div>

        {/* Action Buttons (Conductor only) */}
        {userRole === "conductor" && (
          <div className="flex flex-wrap gap-4">
            <button
              onClick={handleRequestNumbers}
              disabled={isLoading}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-6 py-3 rounded-lg transition-all duration-300 disabled:opacity-50"
            >
              {isLoading ? (
                <LoadingSpinner className="w-5 h-5" />
              ) : (
                <RefreshCw className="w-5 h-5" />
              )}
              <span className="font-medium">Solicitar Números</span>
              <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
                50 números
              </span>
            </button>

            <button
              onClick={handleExportPDF}
              disabled={isLoading || phoneNumbers.length < 30}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-6 py-3 rounded-lg transition-all duration-300 disabled:opacity-50"
            >
              <Download className="w-5 h-5" />
              <span className="font-medium">Exportar PDF</span>
              <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
                30 números
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
          <span className="text-green-700">{success}</span>
        </div>
      )}

      {/* Stats Dashboard */}
      {stats && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Estadísticas de Números
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {stats.total}
              </div>
              <div className="text-sm text-gray-600">Total</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {stats.contestaron}
              </div>
              <div className="text-sm text-gray-600">Contestaron</div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {stats.noContestaron}
              </div>
              <div className="text-sm text-gray-600">No contestaron</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {stats.revisita}
              </div>
              <div className="text-sm text-gray-600">Revisitas</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {stats.suspendido}
              </div>
              <div className="text-sm text-gray-600">Suspendidos</div>
            </div>
          </div>
        </div>
      )}

      {/* Phone Numbers Table */}
      {phoneNumbers.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-green-600" />
              Números Asignados ({phoneNumbers.length})
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Actualiza el estado de cada número conforme vayas predicando
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Propietario
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dirección
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Número
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Publicador
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Comentarios
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {phoneNumbers.map((phone) => (
                  <tr key={phone.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {phone.propietario}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {phone.direccion}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {phone.numero}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {editingId === phone.id ? (
                        <input
                          type="text"
                          value={editingData.publicador}
                          onChange={(e) =>
                            setEditingData((prev) => ({
                              ...prev,
                              publicador: e.target.value,
                            }))
                          }
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Nombre del publicador"
                        />
                      ) : (
                        phone.publicador || (
                          <span className="text-gray-400 italic">
                            Sin asignar
                          </span>
                        )
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {editingId === phone.id ? (
                        <select
                          value={editingData.estado}
                          onChange={(e) =>
                            setEditingData((prev) => ({
                              ...prev,
                              estado: e.target.value as PhoneCallStatus,
                            }))
                          }
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Sin estado</option>
                          {PHONE_CALL_STATUSES.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                      ) : phone.estado ? (
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            PHONE_CALL_STATUSES.find(
                              (s) => s.value === phone.estado
                            )?.color || "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {phone.estado}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">Sin estado</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {editingId === phone.id ? (
                        <input
                          type="text"
                          value={editingData.comentarios}
                          onChange={(e) =>
                            setEditingData((prev) => ({
                              ...prev,
                              comentarios: e.target.value,
                            }))
                          }
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Comentarios"
                        />
                      ) : (
                        phone.comentarios || (
                          <span className="text-gray-400 italic">
                            Sin comentarios
                          </span>
                        )
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {editingId === phone.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => saveChanges(phone.id)}
                            className="text-green-600 hover:text-green-900"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditing(phone)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : userRole === "conductor" ? (
        <div className="text-center p-12 bg-white rounded-xl border border-gray-200">
          <Phone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No hay números asignados
          </h3>
          <p className="text-gray-600 mb-6">
            Presiona &quot;Solicitar Números&quot; para obtener 50 números
            telefónicos aleatorios
          </p>
          <button
            onClick={handleRequestNumbers}
            disabled={isLoading}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-all duration-300 disabled:opacity-50"
          >
            {isLoading ? (
              <LoadingSpinner className="w-5 h-5" />
            ) : (
              <RefreshCw className="w-5 h-5" />
            )}
            <span>Solicitar Números</span>
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default TelephonePreachingModule;
