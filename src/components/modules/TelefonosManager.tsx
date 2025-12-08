"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Phone,
  Plus,
  Upload,
  Download,
  Edit2,
  Trash2,
  Search,
  RotateCcw,
  Filter,
  X,
  AlertTriangle,
  CheckCircle,
  Loader,
} from "lucide-react";
import { adminTelephoneService } from "@/lib/adminServices";
import { TelephoneRecord, TelephoneStatus } from "@/types";
import { useToast } from "@/components/ui/ToastProvider";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

interface TelefonosManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

const ESTADOS_TELEFONICOS: TelephoneStatus[] = [
  "",
  "Colgaron",
  "Contestaron",
  "No contestaron",
  "No llamar",
  "Revisita",
  "Suspendido",
  "Testigo",
];

const ESTADOS_ESPECIALES = [
  "No Asignados", // Para números sin estado y sin publicador
];

export default function TelefonosManager({
  isOpen,
  onClose,
}: TelefonosManagerProps) {
  const { showSuccess, showError, showWarning } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Función auxiliar para compatibilidad con el API anterior
  const addToast = useCallback(
    (message: string, type: "success" | "error" | "warning" | "info") => {
      if (type === "success") {
        showSuccess(message);
      } else if (type === "error") {
        showError(message);
      } else if (type === "warning") {
        showWarning(message);
      } else if (type === "info") {
        showSuccess(message); // Usar success para info como fallback
      }
    },
    [showSuccess, showError, showWarning]
  );

  // Estados del componente
  const [telefonos, setTelefonos] = useState<TelephoneRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<
    TelephoneStatus | "No Asignados" | ""
  >("");
  const [filtroTipoBusqueda, setFiltroTipoBusqueda] = useState<
    "general" | "nombre" | "direccion" | "telefono"
  >("general");
  const [mostrarEstadisticas, setMostrarEstadisticas] = useState(true);
  const [mostrarDuplicados, setMostrarDuplicados] = useState(false);

  // Estado para tracking de eliminaciones en curso
  const [telefonosEliminando, setTelefonosEliminando] = useState<Set<string>>(
    new Set()
  );

  // Modal states
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    telefono: TelephoneRecord | null;
  }>({
    isOpen: false,
    telefono: null,
  });
  const [newTelefono, setNewTelefono] = useState({
    nombre: "",
    direccion: "",
    telefono: "",
    estado: "" as TelephoneStatus,
    comentarios: "",
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [importData, setImportData] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);

  // Cargar teléfonos
  const cargarTelefonos = async () => {
    setLoading(true);
    try {
      const data = await adminTelephoneService.obtenerTelefonos();
      setTelefonos(data);
    } catch (error) {
      console.error("Error cargando teléfonos:", error);
      addToast("Error al cargar los teléfonos", "error");
    } finally {
      setLoading(false);
    }
  };

  // Efecto para cargar datos
  useEffect(() => {
    const cargarDatos = async () => {
      if (!isOpen) return;

      setLoading(true);
      try {
        const data = await adminTelephoneService.obtenerTelefonos();
        setTelefonos(data);
      } catch (error) {
        console.error("Error cargando teléfonos:", error);
        addToast("Error al cargar los teléfonos", "error");
      } finally {
        setLoading(false);
      }
    };

    cargarDatos();
  }, [isOpen, addToast]);

  // Filtrar teléfonos con búsqueda mejorada
  const telefonosFiltrados = telefonos.filter((telefono) => {
    // Si está activado el filtro de duplicados, mostrar solo duplicados
    if (mostrarDuplicados) {
      return numerosDuplicados.includes(telefono);
    }

    if (!searchTerm && !filtroEstado) return true;

    // Determinar si es "NO ASIGNADO"
    const esNoAsignado =
      (!telefono.estado || (telefono.estado as any) === "") &&
      (!telefono.publicador || telefono.publicador === "");

    // Filtro por estado (incluyendo No Asignados)
    let matchEstado = true;
    if (filtroEstado) {
      if (filtroEstado === "No Asignados") {
        matchEstado = esNoAsignado;
      } else {
        matchEstado = telefono.estado === filtroEstado;
      }
    }

    // Filtro por búsqueda mejorada
    let matchSearch = true;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase().trim();
      // Limpiar número telefónico para comparación (solo dígitos)
      const telefonoLimpio = telefono.telefono.replace(/\D/g, "");
      const searchLimpio = searchTerm.replace(/\D/g, "");

      switch (filtroTipoBusqueda) {
        case "nombre":
          matchSearch = telefono.nombre.toLowerCase().includes(searchLower);
          break;
        case "direccion":
          matchSearch = telefono.direccion.toLowerCase().includes(searchLower);
          break;
        case "telefono":
          matchSearch =
            telefonoLimpio.includes(searchLimpio) ||
            telefono.telefono.includes(searchTerm);
          break;
        case "general":
        default:
          matchSearch =
            telefono.nombre.toLowerCase().includes(searchLower) ||
            telefono.direccion.toLowerCase().includes(searchLower) ||
            telefonoLimpio.includes(searchLimpio) ||
            telefono.telefono.includes(searchTerm) ||
            (telefono.comentarios
              ? telefono.comentarios.toLowerCase().includes(searchLower)
              : false) ||
            (telefono.publicador
              ? telefono.publicador.toLowerCase().includes(searchLower)
              : false);
          break;
      }
    }

    return matchSearch && matchEstado;
  });

  // Calcular estadísticas por estado (incluyendo No Asignados)
  const estadisticas = telefonos.reduce((acc, telefono) => {
    // Determinar si es "No Asignado"
    const esNoAsignado =
      (!telefono.estado || (telefono.estado as any) === "") &&
      (!telefono.publicador || telefono.publicador === "");

    if (esNoAsignado) {
      acc["No Asignados"] = (acc["No Asignados"] || 0) + 1;
    } else {
      const estado = telefono.estado || "Sin estado";
      acc[estado] = (acc[estado] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Agregar nuevo teléfono
  const handleAgregarTelefono = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !newTelefono.nombre ||
      !newTelefono.direccion ||
      !newTelefono.telefono
    ) {
      addToast("Todos los campos son obligatorios", "error");
      return;
    }

    try {
      const result = await adminTelephoneService.crearTelefono(newTelefono);
      if (result.success) {
        addToast(result.message, "success");
        setNewTelefono({
          nombre: "",
          direccion: "",
          telefono: "",
          estado: "",
          comentarios: "",
        });
        setShowAddForm(false);
        cargarTelefonos();
      } else {
        addToast(result.message, "error");
      }
    } catch (error) {
      addToast("Error al agregar teléfono", "error");
    }
  };

  // Editar teléfono
  const handleEditarTelefono = async (telefono: TelephoneRecord) => {
    try {
      const result = await adminTelephoneService.editarTelefono(
        telefono.id,
        telefono
      );
      if (result.success) {
        addToast(result.message, "success");
        setEditModal({ isOpen: false, telefono: null });
        cargarTelefonos();
      } else {
        addToast(result.message, "error");
      }
    } catch (error) {
      addToast("Error al editar teléfono", "error");
    }
  };

  // Eliminar teléfono con confirmación moderna
  const handleEliminarTelefono = async (id: string, nombreTelefono: string) => {
    const telefono = telefonos.find((t) => t.id === id);
    if (!telefono) return;

    // Crear modal de confirmación personalizado
    const modalId = Date.now().toString();

    const confirmModal = document.createElement("div");
    confirmModal.className =
      "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4";
    confirmModal.innerHTML = `
      <div class="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
            <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900">Eliminar Teléfono</h3>
            <p class="text-sm text-gray-500">Esta acción no se puede deshacer</p>
          </div>
        </div>
        
        <div class="mb-6 p-4 bg-gray-50 rounded-lg">
          <div class="text-sm space-y-1">
            <p><span class="font-medium">Nombre:</span> ${
              telefono.nombre || "Sin nombre"
            }</p>
            <p><span class="font-medium">Teléfono:</span> ${
              telefono.telefono
            }</p>
            <p><span class="font-medium">Dirección:</span> ${
              telefono.direccion || "Sin dirección"
            }</p>
            <p><span class="font-medium">Estado:</span> ${
              telefono.estado || "Sin estado"
            }</p>
          </div>
        </div>
        
        <p class="text-gray-700 mb-6">
          ¿Estás seguro de que quieres eliminar este número telefónico? Esta acción eliminará permanentemente el registro de la base de datos.
        </p>
        
        <div class="flex gap-3">
          <button id="cancel-${modalId}" class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button id="confirm-${modalId}" class="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
            Eliminar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(confirmModal);

    // Manejar eventos
    const cancelButton = document.getElementById(`cancel-${modalId}`);
    const confirmButton = document.getElementById(`confirm-${modalId}`);

    const cleanup = () => {
      document.body.removeChild(confirmModal);
    };

    cancelButton?.addEventListener("click", cleanup);
    confirmModal.addEventListener("click", (e) => {
      if (e.target === confirmModal) cleanup();
    });

    confirmButton?.addEventListener("click", async () => {
      const originalText = confirmButton.innerHTML;
      confirmButton.innerHTML = `
        <svg class="w-4 h-4 animate-spin mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
        </svg>
        Eliminando...
      `;
      (confirmButton as HTMLButtonElement).disabled = true;

      // Marcar teléfono como eliminándose
      setTelefonosEliminando((prev) => new Set(prev).add(id));

      try {
        const result = await adminTelephoneService.eliminarTelefono(id);
        if (result.success) {
          addToast(`✅ ${result.message}`, "success");

          // Efecto de fade out visual antes de recargar
          const row = document.getElementById(`telefono-row-${id}`);
          if (row) {
            row.style.transform = "translateX(-100%)";
            row.style.opacity = "0";

            setTimeout(() => {
              cargarTelefonos(); // Recargar la lista
            }, 300);
          } else {
            cargarTelefonos(); // Recargar inmediatamente si no hay elemento visual
          }
        } else {
          addToast(`❌ ${result.message}`, "error");
          setTelefonosEliminando((prev) => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
          });
        }
      } catch (error) {
        console.error("Error al eliminar teléfono:", error);
        addToast("❌ Error al eliminar teléfono", "error");
        setTelefonosEliminando((prev) => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      }

      cleanup();
    });
  };

  // Eliminar todos los teléfonos con confirmación moderna
  const handleEliminarTodos = async () => {
    if (telefonos.length === 0) {
      addToast("No hay teléfonos para eliminar", "warning");
      return;
    }

    const modalId = Date.now().toString();

    const confirmModal = document.createElement("div");
    confirmModal.className =
      "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4";
    confirmModal.innerHTML = `
      <div class="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
            <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
            </svg>
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900">⚠️ Eliminar TODOS los Teléfonos</h3>
            <p class="text-sm text-red-600 font-medium">¡ACCIÓN IRREVERSIBLE!</p>
          </div>
        </div>
        
        <div class="mb-6 p-4 bg-red-50 border-l-4 border-red-400 rounded-lg">
          <div class="flex items-center gap-2 mb-2">
            <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <span class="font-medium text-red-700">Datos que se eliminarán:</span>
          </div>
          <div class="text-sm text-red-700 space-y-1">
            <p>📱 <span class="font-medium">${telefonos.length.toLocaleString()}</span> números telefónicos</p>
            <p>📋 Todos los estados y asignaciones</p>
            <p>📝 Todos los comentarios y notas</p>
            <p>📊 Todo el historial telefónico</p>
          </div>
        </div>
        
        <div class="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-lg">
          <div class="flex items-start gap-2">
            <svg class="w-5 h-5 text-yellow-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
            </svg>
            <div class="text-sm text-yellow-700">
              <p class="font-medium mb-1">Esta acción:</p>
              <ul class="space-y-1 list-disc list-inside">
                <li>NO se puede deshacer</li>
                <li>Eliminará PERMANENTEMENTE todos los registros</li>
                <li>Afectará a todo el sistema telefónico</li>
                <li>Puede tardar varios minutos en completarse</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div class="mb-6">
          <label class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input type="checkbox" id="confirm-checkbox-${modalId}" class="w-4 h-4 text-red-600">
            <span class="text-sm font-medium text-gray-700">
              Entiendo que esta acción eliminará PERMANENTEMENTE todos los ${
                telefonos.length
              } números telefónicos
            </span>
          </label>
        </div>
        
        <div class="flex gap-3">
          <button id="cancel-${modalId}" class="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
            Cancelar
          </button>
          <button id="confirm-${modalId}" disabled class="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
            Eliminar TODOS (${telefonos.length})
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(confirmModal);

    // Manejar eventos
    const cancelButton = document.getElementById(`cancel-${modalId}`);
    const confirmButton = document.getElementById(`confirm-${modalId}`);
    const checkbox = document.getElementById(
      `confirm-checkbox-${modalId}`
    ) as HTMLInputElement;

    const cleanup = () => {
      document.body.removeChild(confirmModal);
    };

    // Habilitar botón solo cuando se marque el checkbox
    checkbox?.addEventListener("change", () => {
      if (confirmButton) {
        (confirmButton as HTMLButtonElement).disabled = !checkbox.checked;
      }
    });

    cancelButton?.addEventListener("click", cleanup);
    confirmModal.addEventListener("click", (e) => {
      if (e.target === confirmModal) cleanup();
    });

    confirmButton?.addEventListener("click", async () => {
      if (!checkbox.checked) return;

      const originalText = confirmButton.innerHTML;
      confirmButton.innerHTML = `
        <svg class="w-4 h-4 animate-spin mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
        </svg>
        Eliminando... 0/${telefonos.length}
      `;
      (confirmButton as HTMLButtonElement).disabled = true;

      try {
        let eliminados = 0;
        const total = telefonos.length;

        for (const telefono of telefonos) {
          try {
            await adminTelephoneService.eliminarTelefono(telefono.id);
            eliminados++;

            // Actualizar progreso en el botón
            confirmButton.innerHTML = `
              <svg class="w-4 h-4 animate-spin mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
              Eliminando... ${eliminados}/${total}
            `;

            // Mostrar progreso cada 10 eliminaciones
            if (eliminados % 10 === 0) {
              addToast(
                `🔄 Progreso: ${eliminados}/${total} eliminados`,
                "info"
              );
            }
          } catch (error) {
            console.error(`Error eliminando teléfono ${telefono.id}:`, error);
          }
        }

        addToast(
          `🗑️ Eliminación completada: ${eliminados} de ${total} registros eliminados`,
          eliminados === total ? "success" : "warning"
        );

        cargarTelefonos(); // Recargar la lista
      } catch (error) {
        console.error("Error en eliminación masiva:", error);
        addToast("❌ Error durante la eliminación masiva", "error");
      }

      cleanup();
    });
  };

  // Procesar importación masiva
  const procesarImportacion = async () => {
    if (!importData.trim()) {
      addToast("Ingresa los datos para importar", "error");
      return;
    }

    try {
      // Parsear CSV (Nombre, Dirección, Teléfono, Estado)
      const lines = importData.trim().split("\n");
      const telefonosParaImportar = lines.map((line, index) => {
        const [nombre, direccion, telefono, estado] = line
          .split(",")
          .map((s) => s.trim());

        if (!nombre || !direccion || !telefono) {
          throw new Error(`Línea ${index + 1}: Datos incompletos`);
        }

        return {
          nombre,
          direccion,
          telefono,
          estado:
            estado && ESTADOS_TELEFONICOS.includes(estado as TelephoneStatus)
              ? (estado as TelephoneStatus)
              : "",
        };
      });

      const result = await adminTelephoneService.importarTelefonosMasa(
        telefonosParaImportar
      );
      addToast(result.message, result.success ? "success" : "error");

      if (result.success) {
        setImportData("");
        setShowImportModal(false);
        cargarTelefonos();
      }
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "Error en la importación",
        "error"
      );
    }
  };

  // Detectar números duplicados
  const detectarDuplicados = () => {
    const duplicados: TelephoneRecord[] = [];
    const numerosVistos = new Set<string>();

    telefonos.forEach((telefono) => {
      const numeroLimpio = telefono.telefono.replace(/\D/g, "");
      if (numerosVistos.has(numeroLimpio)) {
        // Encontrar el duplicado original
        const original = telefonos.find(
          (t) =>
            t.telefono.replace(/\D/g, "") === numeroLimpio &&
            !duplicados.includes(t)
        );
        if (original && !duplicados.includes(original)) {
          duplicados.push(original);
        }
        duplicados.push(telefono);
      } else {
        numerosVistos.add(numeroLimpio);
      }
    });

    return duplicados;
  };

  // Obtener números duplicados
  const numerosDuplicados = detectarDuplicados();

  // Exportar a CSV (datos filtrados)
  const exportarCSV = () => {
    if (telefonosFiltrados.length === 0) {
      addToast("No hay datos para exportar", "warning");
      return;
    }

    const csv = [
      "Nombre,Dirección,Teléfono,Estado,Publicador,Comentarios,Fecha Creación",
      ...telefonosFiltrados.map(
        (t) =>
          `"${t.nombre}","${t.direccion}","${t.telefono}","${t.estado}","${
            t.publicador || ""
          }","${t.comentarios || ""}","${
            t.creadoEn
              ? t.creadoEn instanceof Date
                ? t.creadoEn.toLocaleDateString()
                : typeof t.creadoEn === "object" && "seconds" in t.creadoEn
                ? new Date(
                    (t.creadoEn as any).seconds * 1000
                  ).toLocaleDateString()
                : String(t.creadoEn)
              : ""
          }"`
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;

    // Nombre del archivo con información de filtros
    let fileName = `telefonos_${new Date().toISOString().split("T")[0]}`;
    if (searchTerm || filtroEstado) {
      fileName += "_filtrado";
      if (filtroEstado) fileName += `_${filtroEstado.replace(/\s+/g, "_")}`;
    }
    fileName += ".csv";

    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    const mensaje =
      searchTerm || filtroEstado
        ? `📁 Exportados ${telefonosFiltrados.length} números filtrados`
        : `📁 Exportados ${telefonosFiltrados.length} números`;
    addToast(mensaje, "success");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-7xl max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Phone className="text-blue-600" size={24} />
            <h2 className="text-xl font-bold">Gestionar Teléfonos</h2>
            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm">
              {telefonosFiltrados.length} números
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Estadísticas por estado */}
          {mostrarEstadisticas && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-blue-800">
                  📊 Distribución por Estado ({telefonos.length} total)
                </h3>
                <button
                  onClick={() => setMostrarEstadisticas(false)}
                  className="text-blue-600 hover:text-blue-800 text-xs"
                >
                  Ocultar
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
                {Object.entries(estadisticas).map(([estado, cantidad]) => (
                  <div
                    key={estado}
                    className="bg-white rounded px-2 py-1 text-center border"
                  >
                    <div
                      className="font-medium text-gray-700 truncate"
                      title={estado}
                    >
                      {estado === "" ? "Sin estado" : estado}
                    </div>
                    <div className="text-blue-600 font-bold">{cantidad}</div>
                  </div>
                ))}
              </div>

              {/* Información de duplicados */}
              {numerosDuplicados.length > 0 && (
                <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-red-600 text-sm font-medium">
                        ⚠️ {numerosDuplicados.length} números duplicados
                        detectados
                      </span>
                    </div>
                    <button
                      onClick={() => setMostrarDuplicados(!mostrarDuplicados)}
                      className={`text-xs px-3 py-1 rounded-full transition-colors ${
                        mostrarDuplicados
                          ? "bg-red-600 text-white"
                          : "bg-red-100 text-red-700 hover:bg-red-200"
                      }`}
                    >
                      {mostrarDuplicados ? "Ver todos" : "Ver duplicados"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {!mostrarEstadisticas && (
            <div className="flex justify-start">
              <button
                onClick={() => setMostrarEstadisticas(true)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                📊 Mostrar estadísticas
              </button>
            </div>
          )}

          {/* Barra de herramientas */}
          <div className="space-y-4">
            {/* Búsqueda y filtros mejorados */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                🔍 Filtros de Búsqueda
              </h3>

              {/* Tipo de búsqueda */}
              <div className="flex flex-wrap gap-2">
                <span className="text-xs font-medium text-gray-600 self-center">
                  Buscar en:
                </span>
                {[
                  { value: "general", label: "Todo" },
                  { value: "nombre", label: "Nombre" },
                  { value: "direccion", label: "Dirección" },
                  { value: "telefono", label: "Teléfono" },
                ].map((tipo) => (
                  <button
                    key={tipo.value}
                    onClick={() => setFiltroTipoBusqueda(tipo.value as any)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      filtroTipoBusqueda === tipo.value
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-600 hover:bg-blue-50"
                    }`}
                  >
                    {tipo.label}
                  </button>
                ))}
              </div>

              {/* Campos de búsqueda */}
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[300px]">
                  <div className="relative">
                    <Search
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                      size={20}
                    />
                    <input
                      type="text"
                      placeholder={`Buscar ${
                        filtroTipoBusqueda === "general"
                          ? "en nombre, dirección, teléfono..."
                          : filtroTipoBusqueda === "telefono"
                          ? "número específico (ej: 123456789)"
                          : `por ${filtroTipoBusqueda}...`
                      }`}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm("")}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {/* Filtro por estado */}
                <div className="min-w-[200px]">
                  <select
                    value={filtroEstado}
                    onChange={(e) =>
                      setFiltroEstado(
                        e.target.value as TelephoneStatus | "No Asignados"
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">📋 Todos los estados</option>
                    {/* Opción especial para No Asignados */}
                    <option value="No Asignados">
                      🚫 No Asignados
                      {estadisticas["No Asignados"]
                        ? ` (${estadisticas["No Asignados"]})`
                        : " (0)"}
                    </option>
                    {/* Estados normales */}
                    {ESTADOS_TELEFONICOS.map((estado) => (
                      <option key={estado} value={estado}>
                        {estado || "Sin estado"}
                        {estadisticas[estado || "Sin estado"]
                          ? ` (${estadisticas[estado || "Sin estado"]})`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Botón limpiar filtros */}
                <Button
                  onClick={() => {
                    setSearchTerm("");
                    setFiltroEstado("");
                    setFiltroTipoBusqueda("general");
                  }}
                  variant="secondary"
                  className="flex items-center gap-2 px-4"
                >
                  <RotateCcw size={16} />
                  Limpiar
                </Button>
              </div>

              {/* Mostrar resultados de filtros */}
              {(searchTerm || filtroEstado) && (
                <div className="text-xs text-gray-600 bg-blue-50 rounded px-3 py-2">
                  📊 Mostrando <strong>{telefonosFiltrados.length}</strong> de{" "}
                  <strong>{telefonos.length}</strong> números
                  {searchTerm && (
                    <span>
                      {" "}
                      | Búsqueda: &ldquo;<strong>{searchTerm}</strong>&rdquo; en{" "}
                      <strong>{filtroTipoBusqueda}</strong>
                    </span>
                  )}
                  {filtroEstado && (
                    <span>
                      {" "}
                      | Estado: <strong>{filtroEstado || "Sin estado"}</strong>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Botones de acción */}
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2"
              >
                <Plus size={16} />
                Agregar Teléfono
              </Button>
              <Button
                onClick={() => setShowImportModal(true)}
                variant="secondary"
                className="flex items-center gap-2"
              >
                <Upload size={16} />
                Importar CSV
              </Button>
              <Button
                onClick={exportarCSV}
                variant="secondary"
                className="flex items-center gap-2"
                disabled={telefonosFiltrados.length === 0}
              >
                <Download size={16} />
                Exportar CSV ({telefonosFiltrados.length})
                {(searchTerm || filtroEstado) && (
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full ml-1">
                    Filtrado
                  </span>
                )}
              </Button>
              <Button
                onClick={cargarTelefonos}
                variant="secondary"
                className="flex items-center gap-2"
              >
                <RotateCcw size={16} />
                Recargar
              </Button>
              <Button
                onClick={handleEliminarTodos}
                variant="error"
                className="flex items-center gap-2"
                disabled={telefonos.length === 0 || loading}
                title={`Eliminar todos los ${telefonos.length} registros telefónicos`}
              >
                <Trash2 size={16} />
                Eliminar Todo ({telefonos.length})
              </Button>
            </div>
          </div>

          {/* Formulario agregar teléfono */}
          {showAddForm && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-medium mb-4">Agregar Nuevo Teléfono</h3>
              <form
                onSubmit={handleAgregarTelefono}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                <input
                  type="text"
                  placeholder="Nombre completo"
                  value={newTelefono.nombre}
                  onChange={(e) =>
                    setNewTelefono((prev) => ({
                      ...prev,
                      nombre: e.target.value,
                    }))
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <input
                  type="text"
                  placeholder="Dirección"
                  value={newTelefono.direccion}
                  onChange={(e) =>
                    setNewTelefono((prev) => ({
                      ...prev,
                      direccion: e.target.value,
                    }))
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <input
                  type="tel"
                  placeholder="Número de teléfono"
                  value={newTelefono.telefono}
                  onChange={(e) =>
                    setNewTelefono((prev) => ({
                      ...prev,
                      telefono: e.target.value,
                    }))
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <select
                  value={newTelefono.estado}
                  onChange={(e) =>
                    setNewTelefono((prev) => ({
                      ...prev,
                      estado: e.target.value as TelephoneStatus,
                    }))
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar estado</option>
                  {ESTADOS_TELEFONICOS.slice(1).map((estado) => (
                    <option key={estado} value={estado}>
                      {estado}
                    </option>
                  ))}
                </select>
                <div className="md:col-span-2">
                  <input
                    type="text"
                    placeholder="Comentarios (opcional)"
                    value={newTelefono.comentarios}
                    onChange={(e) =>
                      setNewTelefono((prev) => ({
                        ...prev,
                        comentarios: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2 flex gap-3">
                  <Button type="submit">Agregar Teléfono</Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowAddForm(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Tabla de teléfonos modernizada */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center gap-3 px-6 py-3 bg-blue-50 rounded-lg border border-blue-200">
                <Loader className="animate-spin text-blue-600" size={20} />
                <span className="text-blue-700 font-medium">
                  Cargando teléfonos...
                </span>
              </div>
            </div>
          ) : telefonosFiltrados.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex flex-col items-center gap-4 p-8 bg-gray-50 rounded-xl border border-gray-200">
                <Phone size={48} className="text-gray-400" />
                <div>
                  <h3 className="text-lg font-medium text-gray-700 mb-1">
                    {searchTerm || filtroEstado
                      ? "No se encontraron resultados"
                      : "No hay teléfonos registrados"}
                  </h3>
                  <p className="text-gray-500 text-sm">
                    {searchTerm || filtroEstado
                      ? "Intenta cambiar los filtros de búsqueda"
                      : "Comienza agregando números telefónicos o importando desde CSV"}
                  </p>
                </div>
                {!searchTerm && !filtroEstado && (
                  <div className="flex gap-2 mt-2">
                    <Button
                      onClick={() => setShowAddForm(true)}
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Plus size={16} />
                      Agregar Teléfono
                    </Button>
                    <Button
                      onClick={() => setShowImportModal(true)}
                      variant="secondary"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Upload size={16} />
                      Importar CSV
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Información de Contacto
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Publicador
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {telefonosFiltrados.map((telefono, index) => {
                      const isDeleting = telefonosEliminando.has(telefono.id);
                      return (
                        <tr
                          key={telefono.id}
                          className={`hover:bg-blue-50 transition-all duration-300 ${
                            index % 2 === 0 ? "bg-white" : "bg-gray-25"
                          } ${isDeleting ? "opacity-50 bg-red-50" : ""}`}
                          id={`telefono-row-${telefono.id}`}
                          style={{
                            transform: isDeleting ? "scale(0.98)" : "scale(1)",
                            transition: "all 0.3s ease",
                          }}
                        >
                          <td className="px-4 py-4">
                            <div className="space-y-1">
                              <div className="font-medium text-gray-900">
                                {telefono.nombre || "Sin nombre"}
                              </div>
                              <div className="text-sm text-blue-600 font-mono">
                                📞 {telefono.telefono}
                              </div>
                              <div className="text-sm text-gray-500">
                                📍 {telefono.direccion || "Sin dirección"}
                              </div>
                              {telefono.comentarios && (
                                <div className="text-xs text-gray-400 italic">
                                  💬 {telefono.comentarios}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                telefono.estado === "Contestaron"
                                  ? "bg-green-100 text-green-800"
                                  : telefono.estado === "Revisita"
                                  ? "bg-blue-100 text-blue-800"
                                  : telefono.estado === "No llamar"
                                  ? "bg-red-100 text-red-800"
                                  : telefono.estado === "Colgaron"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : telefono.estado === "Suspendido"
                                  ? "bg-purple-100 text-purple-800"
                                  : telefono.estado === "Testigo"
                                  ? "bg-indigo-100 text-indigo-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {telefono.estado || "Sin estado"}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-900">
                            {telefono.publicador ? (
                              <span className="inline-flex items-center gap-1">
                                👤 {telefono.publicador}
                              </span>
                            ) : (
                              <span className="text-gray-400 italic">
                                Sin asignar
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex justify-center gap-1">
                              <button
                                onClick={() =>
                                  setEditModal({ isOpen: true, telefono })
                                }
                                disabled={isDeleting}
                                className={`text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50 transition-colors ${
                                  isDeleting
                                    ? "opacity-50 cursor-not-allowed"
                                    : ""
                                }`}
                                title="Editar teléfono"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() =>
                                  handleEliminarTelefono(
                                    telefono.id,
                                    telefono.nombre
                                  )
                                }
                                disabled={isDeleting}
                                className={`text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition-colors ${
                                  isDeleting
                                    ? "opacity-50 cursor-not-allowed"
                                    : ""
                                }`}
                                title={
                                  isDeleting
                                    ? "Eliminando..."
                                    : "Eliminar teléfono"
                                }
                              >
                                {isDeleting ? (
                                  <Loader className="animate-spin" size={16} />
                                ) : (
                                  <Trash2 size={16} />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer con información adicional */}
              <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>
                    Mostrando {telefonosFiltrados.length} de {telefonos.length}{" "}
                    teléfonos
                  </span>
                  {(searchTerm || filtroEstado) && (
                    <span className="text-blue-600">🔍 Filtros aplicados</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de edición */}
      {editModal.isOpen && editModal.telefono && (
        <Modal
          isOpen={editModal.isOpen}
          onClose={() => setEditModal({ isOpen: false, telefono: null })}
          title="Editar Teléfono"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleEditarTelefono(editModal.telefono!);
            }}
            className="space-y-4"
          >
            <Input
              label="Nombre"
              value={editModal.telefono.nombre}
              onChange={(e) =>
                setEditModal((prev) => ({
                  ...prev,
                  telefono: prev.telefono
                    ? { ...prev.telefono, nombre: e.target.value }
                    : null,
                }))
              }
              required
            />
            <Input
              label="Dirección"
              value={editModal.telefono.direccion}
              onChange={(e) =>
                setEditModal((prev) => ({
                  ...prev,
                  telefono: prev.telefono
                    ? { ...prev.telefono, direccion: e.target.value }
                    : null,
                }))
              }
              required
            />
            <Input
              label="Teléfono"
              value={editModal.telefono.telefono}
              onChange={(e) =>
                setEditModal((prev) => ({
                  ...prev,
                  telefono: prev.telefono
                    ? { ...prev.telefono, telefono: e.target.value }
                    : null,
                }))
              }
              required
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estado
              </label>
              <select
                value={editModal.telefono.estado}
                onChange={(e) =>
                  setEditModal((prev) => ({
                    ...prev,
                    telefono: prev.telefono
                      ? {
                          ...prev.telefono,
                          estado: e.target.value as TelephoneStatus,
                        }
                      : null,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ESTADOS_TELEFONICOS.map((estado) => (
                  <option key={estado} value={estado}>
                    {estado || "Sin estado"}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Comentarios"
              value={editModal.telefono.comentarios || ""}
              onChange={(e) =>
                setEditModal((prev) => ({
                  ...prev,
                  telefono: prev.telefono
                    ? { ...prev.telefono, comentarios: e.target.value }
                    : null,
                }))
              }
            />
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditModal({ isOpen: false, telefono: null })}
              >
                Cancelar
              </Button>
              <Button type="submit">Guardar Cambios</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal de importación */}
      {showImportModal && (
        <Modal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          title="Importar Teléfonos en Masa"
        >
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">
                Formato CSV:{" "}
                <strong>Nombre, Dirección, Teléfono, Estado</strong>
              </p>
              <p className="text-xs text-gray-500 mb-4">
                Estados válidos: {ESTADOS_TELEFONICOS.slice(1).join(", ")}
              </p>
              <textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder="Juan Pérez, Calle 123, 555-1234, Contestaron
Maria García, Avenida 456, 555-5678,
Pedro López, Carrera 789, 555-9012, No llamar"
                className="w-full h-40 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowImportModal(false)}
              >
                Cancelar
              </Button>
              <Button onClick={procesarImportacion}>Importar</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
