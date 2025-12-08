"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Territory,
  Conductor,
  Assignment,
  HistoryAssignment,
  ProgramaReunion,
  Lugar,
  Faceta,
} from "@/types";
import {
  firebaseService,
  TOTAL_TERRITORIES,
  MANZANAS_POR_TERRITORIO,
  todayISO,
} from "@/lib/firebaseService";
import {
  useHeavyComputation,
  useDebounce,
  useVirtualList,
} from "@/hooks/usePerformanceOptimization";
import { useSmartCache } from "@/hooks/useSmartCache";

interface TerritoryManagerProps {
  conductores: Conductor[];
  lugares: Lugar[];
  facetas: Faceta[];
  isAdmin: boolean;
  selectedConductor?: string;
  onShowToast: (
    message: string,
    type: "success" | "error" | "warning" | "info"
  ) => void;
  onProgramCreated?: (programa: ProgramaReunion) => void;
}

// Territory Button Component - Optimizado con React.memo
const TerritoryButton = React.memo(
  ({
    territoryNum,
    territory,
    isSelected,
    onClick,
    isAdmin = false,
  }: {
    territoryNum: number;
    territory?: Territory;
    isSelected: boolean;
    onClick: () => void;
    isAdmin?: boolean;
  }) => {
    const status = useMemo(() => {
      if (!territory) return "available";

      const activeAssignments =
        territory.asignaciones?.filter((a) => a.estado === "activo") || [];
      if (activeAssignments.length > 0) return "assigned";
      if (territory.historialAsignaciones?.length > 0) return "completed";
      return "available";
    }, [territory]);
    const statusClasses = {
      available: "bg-white/5 border-white/20 text-white/80 hover:bg-white/10",
      assigned:
        "bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-amber-400/40 text-amber-200",
      completed:
        "bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-400/40 text-green-200",
    };

    const selectedClass = isSelected
      ? "ring-2 ring-cyan-400 bg-cyan-500/20 border-cyan-400"
      : "";

    return (
      <button
        onClick={onClick}
        disabled={!isAdmin}
        className={`
        relative p-3 rounded-xl border text-center font-semibold text-xs
        transition-all duration-200 aspect-square flex items-center justify-center
        ${statusClasses[status]} ${selectedClass}
        ${!isAdmin ? "cursor-default" : "cursor-pointer"}
      `}
      >
        {territoryNum}
      </button>
    );
  },
  (prevProps, nextProps) => {
    // Comparación optimizada para React.memo - evita re-renders innecesarios
    return (
      prevProps.territoryNum === nextProps.territoryNum &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.isAdmin === nextProps.isAdmin &&
      // Comparación profunda del territorio para detectar cambios relevantes
      prevProps.territory?.asignaciones?.length ===
        nextProps.territory?.asignaciones?.length &&
      prevProps.territory?.historialAsignaciones?.length ===
        nextProps.territory?.historialAsignaciones?.length &&
      JSON.stringify(
        prevProps.territory?.asignaciones?.filter((a) => a.estado === "activo")
      ) ===
        JSON.stringify(
          nextProps.territory?.asignaciones?.filter(
            (a) => a.estado === "activo"
          )
        )
    );
  }
);

TerritoryButton.displayName = "TerritoryButton";

// Manzana Button Component - Optimizado con React.memo
const ManzanaButton = React.memo(
  ({
    territoryNum,
    manzanaNum,
    manzanaId,
    isSelected,
    onClick,
  }: {
    territoryNum: number;
    manzanaNum: number;
    manzanaId: string;
    isSelected: boolean;
    onClick: () => void;
  }) => {
    const selectedClass = useMemo(
      () =>
        isSelected ? "ring-2 ring-cyan-400 bg-cyan-500/20 border-cyan-400" : "",
      [isSelected]
    );

    return (
      <button
        onClick={onClick}
        className={`
        p-2 rounded-lg border text-center font-medium text-xs
        bg-white/5 border-white/20 text-white/80 hover:bg-white/10
        transition-all duration-200 ${selectedClass}
      `}
      >
        {manzanaNum}
      </button>
    );
  },
  (prevProps, nextProps) => {
    // Comparación optimizada para evitar re-renders innecesarios
    return (
      prevProps.territoryNum === nextProps.territoryNum &&
      prevProps.manzanaNum === nextProps.manzanaNum &&
      prevProps.manzanaId === nextProps.manzanaId &&
      prevProps.isSelected === nextProps.isSelected
    );
  }
);

ManzanaButton.displayName = "ManzanaButton";

// Assignment History Modal
const AssignmentHistoryModal = ({
  territory,
  onClose,
  onDeleteAssignment,
  onShowToast,
}: {
  territory: Territory;
  onClose: () => void;
  onDeleteAssignment: (
    territoryNum: number,
    assignment: Assignment | HistoryAssignment,
    isActive: boolean
  ) => void;
  onShowToast: (
    message: string,
    type: "success" | "error" | "warning" | "info"
  ) => void;
}) => {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl border border-white/20 rounded-3xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white">
              Historial - Territorio {territory.numero}
            </h3>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Active Assignments */}
          {territory.asignaciones && territory.asignaciones.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold text-white mb-4">
                Asignaciones Activas
              </h4>
              <div className="space-y-3">
                {territory.asignaciones.map((assignment, index) => (
                  <div
                    key={index}
                    className="bg-white/5 rounded-xl p-4 border border-white/10"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-white font-medium">
                          {assignment.conductor}
                        </p>
                        <p className="text-white/60 text-sm">
                          Asignado: {assignment.fechaAsignacion}
                        </p>
                        {assignment.manzanas && (
                          <p className="text-white/60 text-sm">
                            Manzanas: {assignment.manzanas.join(", ")}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() =>
                          onDeleteAssignment(territory.numero, assignment, true)
                        }
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Devolver
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* History */}
          {territory.historialAsignaciones &&
            territory.historialAsignaciones.length > 0 && (
              <div>
                <h4 className="text-lg font-semibold text-white mb-4">
                  Historial Completo
                </h4>
                <div className="space-y-3">
                  {territory.historialAsignaciones.map((hist, index) => (
                    <div
                      key={index}
                      className="bg-white/5 rounded-xl p-4 border border-white/10"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-white font-medium">
                            {hist.conductor}
                          </p>
                          <p className="text-white/60 text-sm">
                            Devuelto: {hist.fechaDevolucion}
                          </p>
                          {hist.manzanas && (
                            <p className="text-white/60 text-sm">
                              Manzanas: {hist.manzanas.join(", ")}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() =>
                            onDeleteAssignment(territory.numero, hist, false)
                          }
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export const TerritoryManager: React.FC<TerritoryManagerProps> = ({
  conductores,
  lugares,
  facetas,
  isAdmin,
  selectedConductor,
  onShowToast,
  onProgramCreated,
}) => {
  // Main states
  const [territorios, setTerritorios] = useState<Record<string, Territory>>({});
  const [selectedTerritories, setSelectedTerritories] = useState<Set<number>>(
    new Set()
  );
  const [selectedManzanas, setSelectedManzanas] = useState<Set<string>>(
    new Set()
  );
  const [historyModalTerritory, setHistoryModalTerritory] =
    useState<Territory | null>(null);
  const [assignmentConductor, setAssignmentConductor] = useState("");
  const [assignmentDate, setAssignmentDate] = useState(todayISO());
  const [showTerritorySelector, setShowTerritorySelector] =
    useState<boolean>(false);

  // Program states
  const [viewMode, setViewMode] = useState<"territories" | "program">(
    "territories"
  );
  const [programas, setProgramas] = useState<ProgramaReunion[]>([]);
  // Eliminado showProgramForm: formulario ahora siempre en sección Asignaciones
  const [programFormData, setProgramFormData] = useState<{
    fecha: string;
    hora: string;
    lugar: string;
    conductor: string;
    auxiliar: string;
    faceta: string;
    territorios: { territorio: number; manzanas: number[] }[];
  }>({
    fecha: todayISO(),
    hora: "09:30",
    lugar: "",
    conductor: "",
    auxiliar: "",
    faceta: "",
    territorios: [],
  });

  // Smart caching para datos de Firebase - Optimización de rendimiento
  const {
    data: cachedTerritorios,
    isLoading: territoriosLoading,
    error: territoriosError,
  } = useSmartCache(
    "territorios",
    async () => {
      return new Promise((resolve) => {
        const unsubscribe = firebaseService.subscribeToTerritorios((data) => {
          resolve(data);
          unsubscribe();
        });
      });
    },
    { ttl: 30000, staleWhileRevalidate: true } // Cache por 30 segundos
  );

  const {
    data: cachedProgramas,
    isLoading: programasLoading,
    error: programasError,
  } = useSmartCache(
    "programas",
    async () => {
      return new Promise((resolve) => {
        const unsubscribe = firebaseService.subscribeToProgram((data) => {
          resolve(data);
          unsubscribe();
        });
      });
    },
    { ttl: 60000, staleWhileRevalidate: true } // Cache por 1 minuto
  );

  // Actualizar estados cuando el cache cambie
  useEffect(() => {
    if (cachedTerritorios && typeof cachedTerritorios === "object") {
      setTerritorios(cachedTerritorios as Record<string, Territory>);
    }
  }, [cachedTerritorios]);

  useEffect(() => {
    if (cachedProgramas && Array.isArray(cachedProgramas)) {
      setProgramas(cachedProgramas as ProgramaReunion[]);
    }
  }, [cachedProgramas]);

  // Territory handlers - Optimizados con debouncing para mejor rendimiento
  const debouncedTerritoryUpdate = useDebounce(
    (newTerritories: Set<number>) => {
      setSelectedTerritories(newTerritories);
    },
    150
  );

  const debouncedManzanaUpdate = useDebounce((newManzanas: Set<string>) => {
    setSelectedManzanas(newManzanas);
  }, 150);

  const handleTerritoryClick = useCallback(
    (territoryNum: number) => {
      if (!isAdmin) return;

      const newSelected = new Set(selectedTerritories);
      if (newSelected.has(territoryNum)) {
        newSelected.delete(territoryNum);
        const updatedManzanas = new Set(selectedManzanas);
        Array.from(selectedManzanas).forEach((manzanaId) => {
          if (manzanaId.startsWith(`${territoryNum}-`)) {
            updatedManzanas.delete(manzanaId);
          }
        });
        debouncedManzanaUpdate(updatedManzanas);
      } else {
        newSelected.add(territoryNum);
      }
      debouncedTerritoryUpdate(newSelected);
    },
    [
      selectedTerritories,
      selectedManzanas,
      isAdmin,
      debouncedTerritoryUpdate,
      debouncedManzanaUpdate,
    ]
  );

  const handleManzanaClick = useCallback(
    (manzanaId: string) => {
      const newSelected = new Set(selectedManzanas);
      if (newSelected.has(manzanaId)) {
        newSelected.delete(manzanaId);
      } else {
        newSelected.add(manzanaId);
      }
      debouncedManzanaUpdate(newSelected);
    },
    [selectedManzanas, debouncedManzanaUpdate]
  );

  const handleAssignTerritories = async () => {
    if (!assignmentConductor) {
      onShowToast("Selecciona un conductor", "error");
      return;
    }

    if (selectedManzanas.size === 0) {
      onShowToast("Selecciona al menos una manzana", "error");
      return;
    }

    try {
      const territoryManzanas: Record<string, string[]> = {};
      Array.from(selectedManzanas).forEach((manzanaId) => {
        const [territoryStr, manzanaStr] = manzanaId.split("-");
        if (!territoryManzanas[territoryStr]) {
          territoryManzanas[territoryStr] = [];
        }
        territoryManzanas[territoryStr].push(manzanaStr);
      });

      const assignmentPromises = Object.entries(territoryManzanas).map(
        ([terrNum, manzanas]) =>
          firebaseService.assignTerritory(
            parseInt(terrNum),
            assignmentConductor,
            manzanas.map((m) => parseInt(m)),
            assignmentDate
          )
      );

      await Promise.all(assignmentPromises);

      onShowToast("Territorios asignados exitosamente", "success");

      setSelectedTerritories(new Set());
      setSelectedManzanas(new Set());
      setAssignmentConductor("");
      setAssignmentDate(todayISO());
    } catch (error) {
      onShowToast("Error al asignar territorios", "error");
      console.error(error);
    }
  };

  const handleDeleteAssignment = async (
    territoryNum: number,
    assignment: Assignment | HistoryAssignment,
    isActive: boolean
  ) => {
    try {
      if (isActive) {
        // Para asignaciones activas, necesitamos encontrar el índice y proporcionar fecha de devolución
        const territory = territorios[territoryNum.toString()];
        if (!territory) {
          throw new Error("Territorio no encontrado");
        }

        const assignmentIndex = territory.asignaciones.findIndex(
          (a: Assignment) =>
            a.conductor === assignment.conductor &&
            a.fechaAsignacion === (assignment as Assignment).fechaAsignacion
        );

        if (assignmentIndex === -1) {
          throw new Error("Asignación no encontrada");
        }

        const fechaDevolucion = new Date().toLocaleDateString("es-ES");

        await firebaseService.returnTerritory(
          territoryNum,
          assignmentIndex,
          fechaDevolucion,
          assignment.conductor
        );
        onShowToast("Territorio devuelto exitosamente", "success");
      } else {
        await firebaseService.deleteAssignment(
          territoryNum,
          assignment as HistoryAssignment,
          false
        );
        onShowToast("Asignación eliminada del historial", "success");
      }
    } catch (error) {
      onShowToast("Error al procesar la operación", "error");
      console.error(error);
    }
  };

  // Program handlers
  const handleCreateProgram = async () => {
    if (
      !programFormData.fecha ||
      !programFormData.lugar ||
      !programFormData.conductor
    ) {
      onShowToast("Completa al menos fecha, lugar y conductor", "error");
      return;
    }

    try {
      const programData: Omit<ProgramaReunion, "id"> = {
        ...programFormData,
        faceta: programFormData.faceta,
        timestamp: new Date(),
      };

      await firebaseService.addProgram(programData);
      onShowToast("Programa creado exitosamente", "success");

      setProgramFormData({
        fecha: todayISO(),
        hora: "09:30",
        lugar: "",
        conductor: "",
        auxiliar: "",
        faceta: "",
        territorios: [],
      });
      // setShowProgramForm eliminado

      if (onProgramCreated) {
        onProgramCreated(programData as ProgramaReunion);
      }
    } catch (error) {
      onShowToast("Error al crear programa", "error");
      console.error(error);
    }
  };

  const handleProgramFormChange = (
    field: string,
    value: string | { territorio: number; manzanas: number[] }[]
  ) => {
    setProgramFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Virtual scrolling para la grilla de territorios - Optimización de rendimiento
  const territoryList = useMemo(
    () => Array.from({ length: TOTAL_TERRITORIES }, (_, i) => i + 1),
    []
  );

  const {
    visibleItems: visibleTerritories,
    onScroll,
    totalHeight,
    offsetY,
  } = useVirtualList(territoryList, {
    itemHeight: 60, // Altura aproximada de cada botón de territorio
    containerHeight: 400, // Altura del contenedor
    overscan: 10, // Elementos adicionales para renderizar fuera del viewport
  });

  // Render functions - Optimizado con virtual scrolling
  const renderTerritoryGrid = () => (
    <div className="bg-white/5 rounded-3xl border border-white/10 p-6">
      <div
        className="h-96 overflow-auto"
        style={{ height: "400px" }}
        onScroll={onScroll}
      >
        <div style={{ height: totalHeight, position: "relative" }}>
          <div
            style={{ transform: `translateY(${offsetY}px)` }}
            className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-15 gap-3"
          >
            {visibleTerritories.map((terrNum) => {
              const territory = territorios[terrNum.toString()];
              return (
                <TerritoryButton
                  key={terrNum}
                  territoryNum={terrNum}
                  territory={territory}
                  isSelected={selectedTerritories.has(terrNum)}
                  onClick={() => handleTerritoryClick(terrNum)}
                  isAdmin={isAdmin}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  const renderManzanas = () => (
    <div className="space-y-4">
      {Array.from(selectedTerritories).map((terrNum) => {
        const totalManzanas = MANZANAS_POR_TERRITORIO[terrNum] || 0;
        if (totalManzanas === 0) return null;

        return (
          <div
            key={terrNum}
            className="bg-white/5 rounded-2xl border border-white/10 p-4"
          >
            <h4 className="text-white font-semibold mb-3">
              Territorio {terrNum} - {totalManzanas} manzanas
            </h4>
            <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 gap-2">
              {Array.from({ length: totalManzanas }, (_, i) => i + 1).map(
                (manzanaNum) => {
                  const manzanaId = `${terrNum}-${manzanaNum}`;
                  return (
                    <ManzanaButton
                      key={manzanaId}
                      territoryNum={terrNum}
                      manzanaNum={manzanaNum}
                      manzanaId={manzanaId}
                      isSelected={selectedManzanas.has(manzanaId)}
                      onClick={() => handleManzanaClick(manzanaId)}
                    />
                  );
                }
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // Eliminada función renderProgramForm (el formulario reside en vista territorios)

  const renderProgramList = () => (
    <div className="bg-white/5 rounded-3xl border border-white/10 overflow-hidden">
      <div className="p-6 border-b border-white/10 flex justify-between items-center">
        <h3 className="text-xl font-semibold text-white">Programas Creados</h3>
        {/* Botón eliminado: formulario siempre visible en Asignaciones */}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-white/5">
            <tr>
              <th className="text-left p-4 text-white/80">Fecha</th>
              <th className="text-left p-4 text-white/80">Hora</th>
              <th className="text-left p-4 text-white/80">Lugar</th>
              <th className="text-left p-4 text-white/80">Conductor</th>
              <th className="text-left p-4 text-white/80">Auxiliar</th>
              <th className="text-left p-4 text-white/80">Faceta</th>
              <th className="text-left p-4 text-white/80">Territorio</th>
            </tr>
          </thead>
          <tbody>
            {programas.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-white/60 py-8">
                  No hay programas creados
                </td>
              </tr>
            ) : (
              programas.map((programa) => (
                <tr
                  key={programa.id}
                  className="border-b border-white/5 hover:bg-white/[0.02]"
                >
                  <td className="p-4 text-white">{programa.fecha}</td>
                  <td className="p-4 text-white">{programa.hora}</td>
                  <td className="p-4 text-white">{programa.lugar}</td>
                  <td className="p-4 text-white">{programa.conductor}</td>
                  <td className="p-4 text-white/70">
                    {programa.auxiliar || "---"}
                  </td>
                  <td className="p-4 text-white/70">
                    {programa.faceta || "---"}
                  </td>
                  <td className="p-4 text-white/70">
                    {programa.territorio || "---"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Get assigned territories for conductor view
  const getAssignedTerritories = () => {
    if (!selectedConductor) return [];

    const assigned: Array<{
      territory: Territory;
      assignment: Assignment;
    }> = [];

    Object.values(territorios).forEach((territory) => {
      territory.asignaciones?.forEach((assignment) => {
        if (
          assignment.conductor === selectedConductor &&
          assignment.estado === "activo"
        ) {
          assigned.push({ territory, assignment });
        }
      });
    });

    return assigned;
  };

  if (isAdmin) {
    return (
      <div className="space-y-6">
        {/* Conditional Rendering based on viewMode */}
        {viewMode === "territories" ? (
          <>
            {/* Botón flotante para seleccionar territorios */}
            <div className="fixed bottom-6 right-6 z-50">
              <button
                onClick={() => setShowTerritorySelector(true)}
                className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-full shadow-2xl flex items-center justify-center text-white font-bold text-lg transform hover:scale-105 transition-all duration-200"
              >
                🗺️
              </button>
            </div>

            {selectedTerritories.size > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-white">
                    Manzanas de los territorios seleccionados
                  </h3>
                  <button
                    onClick={() => setShowTerritorySelector(true)}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white/80 text-sm transition-colors"
                  >
                    ✏️ Cambiar territorios ({selectedTerritories.size})
                  </button>
                </div>
                {renderManzanas()}
              </div>
            )}

            {selectedTerritories.size === 0 && (
              <div className="text-center py-12">
                <div className="w-20 h-20 mx-auto mb-4 bg-white/10 rounded-full flex items-center justify-center">
                  <span className="text-3xl">🗺️</span>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Selecciona un territorio
                </h3>
                <p className="text-white/60 mb-6">
                  Usa el botón flotante para elegir territorios y asignar
                  manzanas
                </p>
                <button
                  onClick={() => setShowTerritorySelector(true)}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-xl text-white font-medium transition-all duration-200"
                >
                  Seleccionar Territorios
                </button>
              </div>
            )}

            {/* Assignment Form */}
            {selectedManzanas.size > 0 && (
              <div className="bg-white/5 rounded-3xl border border-white/10 p-6">
                <h3 className="text-xl font-semibold text-white mb-4">
                  Asignar Territorios Seleccionados
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-white/80 mb-2">
                      Conductor
                    </label>
                    <select
                      value={assignmentConductor}
                      onChange={(e) => setAssignmentConductor(e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    >
                      <option value="">Seleccionar conductor...</option>
                      {conductores.map((conductor) => (
                        <option
                          key={conductor.id}
                          value={conductor.nombre}
                          style={{ color: "#000", background: "#fff" }}
                        >
                          {conductor.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-white/80 mb-2">
                      Fecha de Asignación
                    </label>
                    <input
                      type="date"
                      value={assignmentDate}
                      onChange={(e) => setAssignmentDate(e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    />
                  </div>

                  <div className="bg-cyan-500/10 border border-cyan-400/20 rounded-xl p-4">
                    <h4 className="text-cyan-300 font-semibold mb-2">
                      Resumen de Asignación:
                    </h4>
                    <p className="text-white/80">
                      {selectedTerritories.size} territorio(s) con{" "}
                      {selectedManzanas.size} manzana(s) seleccionadas
                    </p>
                    <div className="text-sm text-white/60 mt-2">
                      Territorios: {Array.from(selectedTerritories).join(", ")}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleAssignTerritories}
                      disabled={!assignmentConductor}
                      className="px-6 py-3 bg-gradient-to-r from-emerald-500/80 to-green-500/80 text-white rounded-xl hover:from-emerald-400/80 hover:to-green-400/80 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Asignar Territorios
                    </button>
                    <button
                      onClick={() => {
                        setSelectedTerritories(new Set());
                        setSelectedManzanas(new Set());
                        setAssignmentConductor("");
                        setAssignmentDate(todayISO());
                      }}
                      className="px-6 py-3 bg-gradient-to-r from-slate-600/80 to-slate-700/80 text-white rounded-xl hover:from-slate-500/80 hover:to-slate-600/80 transition-all"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Programa de Predicación (movido desde vista 'program') */}
            <div className="bg-white/5 rounded-3xl border border-white/10 p-6 mt-8">
              <h3 className="text-xl font-semibold text-white mb-4">
                Crear Programa de Predicación
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/80 mb-2">Fecha</label>
                  <input
                    type="date"
                    value={programFormData.fecha}
                    onChange={(e) =>
                      handleProgramFormChange("fecha", e.target.value)
                    }
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-white/80 mb-2">Hora</label>
                  <input
                    type="time"
                    value={programFormData.hora}
                    onChange={(e) =>
                      handleProgramFormChange("hora", e.target.value)
                    }
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-white/80 mb-2">Lugar</label>
                  <select
                    value={programFormData.lugar}
                    onChange={(e) =>
                      handleProgramFormChange("lugar", e.target.value)
                    }
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  >
                    <option value="">Seleccionar lugar...</option>
                    {lugares.map((lugar) => (
                      <option
                        key={lugar.id}
                        value={lugar.nombre}
                        style={{ color: "#000", background: "#fff" }}
                      >
                        {lugar.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-white/80 mb-2">Conductor</label>
                  <select
                    value={programFormData.conductor}
                    onChange={(e) =>
                      handleProgramFormChange("conductor", e.target.value)
                    }
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  >
                    <option value="">Seleccionar conductor...</option>
                    {conductores.map((conductor) => (
                      <option
                        key={conductor.id}
                        value={conductor.nombre}
                        style={{ color: "#000", background: "#fff" }}
                      >
                        {conductor.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-white/80 mb-2">
                    Auxiliar (Opcional)
                  </label>
                  <select
                    value={programFormData.auxiliar}
                    onChange={(e) =>
                      handleProgramFormChange("auxiliar", e.target.value)
                    }
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  >
                    <option value="">Sin auxiliar</option>
                    {conductores.map((conductor) => (
                      <option
                        key={conductor.id}
                        value={conductor.nombre}
                        style={{ color: "#000", background: "#fff" }}
                      >
                        {conductor.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-white/80 mb-2">Faceta</label>
                  <select
                    value={programFormData.faceta}
                    onChange={(e) =>
                      handleProgramFormChange("faceta", e.target.value)
                    }
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  >
                    <option value="">Seleccionar faceta...</option>
                    {facetas.map((faceta) => (
                      <option
                        key={faceta.id}
                        value={faceta.nombre}
                        style={{ color: "#000", background: "#fff" }}
                      >
                        {faceta.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-white/80 mb-2">
                    Territorios y Manzanas
                  </label>
                  <details className="mb-2">
                    <summary className="cursor-pointer px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white/80 hover:bg-white/15 select-none">
                      Seleccionar Territorios y Manzanas
                    </summary>
                    <div className="mt-4">
                      <h3 className="text-xl font-semibold text-white mb-4">
                        Selección de Territorios (1–{TOTAL_TERRITORIES})
                      </h3>
                      <div className="bg-white/5 rounded-3xl border border-white/10 p-6">
                        <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-15 gap-3">
                          {Array.from(
                            { length: TOTAL_TERRITORIES },
                            (_, i) => i + 1
                          ).map((terrNum) => {
                            const selectedTerritorios =
                              programFormData.territorios || [];
                            const isSelected = selectedTerritorios.some(
                              (t) => t.territorio === terrNum
                            );
                            return (
                              <button
                                key={terrNum}
                                type="button"
                                className={`
                                  relative p-3 rounded-xl border text-center font-semibold text-xs
                                  transition-all duration-200 aspect-square flex items-center justify-center
                                  ${
                                    isSelected
                                      ? "bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-amber-400/40 text-amber-200"
                                      : "bg-white/5 border-white/20 text-white/80 hover:bg-white/10"
                                  }
                                  cursor-pointer
                                `}
                                onClick={() => {
                                  let territorios =
                                    programFormData.territorios || [];
                                  if (isSelected) {
                                    territorios = territorios.filter(
                                      (t) => t.territorio !== terrNum
                                    );
                                  } else {
                                    territorios = [
                                      ...territorios,
                                      { territorio: terrNum, manzanas: [] },
                                    ];
                                  }
                                  handleProgramFormChange(
                                    "territorios",
                                    territorios
                                  );
                                }}
                              >
                                {terrNum}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      {/* Manzanas por territorio seleccionado */}
                      {programFormData.territorios &&
                        programFormData.territorios.length > 0 && (
                          <div className="mt-4 space-y-6">
                            {programFormData.territorios.map(
                              ({ territorio, manzanas }) => {
                                const totalManzanas =
                                  MANZANAS_POR_TERRITORIO[territorio] || 0;
                                const allManzanasSelected =
                                  manzanas.length === totalManzanas &&
                                  totalManzanas > 0;

                                return (
                                  <div
                                    key={territorio}
                                    className="bg-white/5 rounded-2xl border border-white/10 p-4"
                                  >
                                    <div className="flex items-center justify-between mb-3">
                                      <h4 className="text-white font-semibold">
                                        Territorio {territorio} -{" "}
                                        {totalManzanas} manzanas
                                      </h4>
                                      <button
                                        type="button"
                                        className={`
                                      px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
                                      ${
                                        allManzanasSelected
                                          ? "bg-red-500/20 border border-red-400 text-red-200 hover:bg-red-500/30"
                                          : "bg-cyan-500/20 border border-cyan-400 text-cyan-200 hover:bg-cyan-500/30"
                                      }
                                    `}
                                        onClick={() => {
                                          let territorios =
                                            programFormData.territorios || [];
                                          territorios = territorios.map((t) => {
                                            if (t.territorio !== territorio)
                                              return t;
                                            const manzanasNew =
                                              allManzanasSelected
                                                ? [] // Deseleccionar todas
                                                : Array.from(
                                                    { length: totalManzanas },
                                                    (_, i) => i + 1
                                                  ); // Seleccionar todas
                                            return {
                                              ...t,
                                              manzanas: manzanasNew,
                                            };
                                          });
                                          handleProgramFormChange(
                                            "territorios",
                                            territorios
                                          );
                                        }}
                                      >
                                        {allManzanasSelected
                                          ? "Deseleccionar todas"
                                          : "Seleccionar todas"}
                                      </button>
                                    </div>
                                    <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 gap-2">
                                      {Array.from(
                                        {
                                          length:
                                            MANZANAS_POR_TERRITORIO[
                                              territorio
                                            ] || 0,
                                        },
                                        (_, i) => i + 1
                                      ).map((manzanaNum) => {
                                        const isSelected =
                                          manzanas.includes(manzanaNum);
                                        return (
                                          <button
                                            key={territorio + "-" + manzanaNum}
                                            type="button"
                                            className={`
                                        p-2 rounded-lg border text-center font-medium text-xs
                                        transition-all duration-200
                                        ${
                                          isSelected
                                            ? "ring-2 ring-cyan-400 bg-cyan-500/20 border-cyan-400 text-cyan-200"
                                            : "bg-white/5 border-white/20 text-white/80 hover:bg-white/10"
                                        }
                                      `}
                                            onClick={() => {
                                              let territorios =
                                                programFormData.territorios ||
                                                [];
                                              territorios = territorios.map(
                                                (t) => {
                                                  if (
                                                    t.territorio !== territorio
                                                  )
                                                    return t;
                                                  const manzanasNew = isSelected
                                                    ? t.manzanas.filter(
                                                        (m) => m !== manzanaNum
                                                      )
                                                    : [
                                                        ...t.manzanas,
                                                        manzanaNum,
                                                      ];
                                                  return {
                                                    ...t,
                                                    manzanas: manzanasNew,
                                                  };
                                                }
                                              );
                                              handleProgramFormChange(
                                                "territorios",
                                                territorios
                                              );
                                            }}
                                          >
                                            {manzanaNum}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              }
                            )}
                          </div>
                        )}
                    </div>
                  </details>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleCreateProgram}
                  disabled={
                    !programFormData.fecha ||
                    !programFormData.lugar ||
                    !programFormData.conductor
                  }
                  className="px-6 py-3 bg-gradient-to-r from-cyan-500/80 to-blue-500/80 text-white rounded-xl hover:from-cyan-400/80 hover:to-blue-400/80 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Asignar
                </button>
                <button
                  onClick={() => {
                    setProgramFormData({
                      fecha: todayISO(),
                      hora: "09:30",
                      lugar: "",
                      conductor: "",
                      auxiliar: "",
                      faceta: "",
                      territorios: [],
                    });
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-slate-600/80 to-slate-700/80 text-white rounded-xl hover:from-slate-500/80 hover:to-slate-600/80 transition-all"
                >
                  Limpiar
                </button>
              </div>
            </div>

            {/* Territory Management Table */}
            <div className="bg-white/5 rounded-3xl border border-white/10 overflow-hidden">
              <div className="p-6 border-b border-white/10">
                <h3 className="text-xl font-semibold text-white">
                  Estado General de Territorios
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="text-left p-4 text-white/80">
                        Territorio
                      </th>
                      <th className="text-left p-4 text-white/80">Progreso</th>
                      <th className="text-left p-4 text-white/80">Estado</th>
                      <th className="text-left p-4 text-white/80">
                        Asignado a
                      </th>
                      <th className="text-left p-4 text-white/80">
                        Fecha Asignación
                      </th>
                      <th className="text-left p-4 text-white/80">
                        Última Completada
                      </th>
                      <th className="text-left p-4 text-white/80">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(
                      { length: TOTAL_TERRITORIES },
                      (_, i) => i + 1
                    ).map((territoryNum) => {
                      const territory = territorios[territoryNum.toString()];
                      const activeAssignments =
                        territory?.asignaciones?.filter(
                          (a) => a.estado === "activo"
                        ) || [];
                      const lastCompleted =
                        territory?.historialAsignaciones?.length > 0
                          ? territory.historialAsignaciones
                              .slice()
                              .sort(
                                (a, b) =>
                                  new Date(b.fechaDevolucion).getTime() -
                                  new Date(a.fechaDevolucion).getTime()
                              )[0]?.fechaDevolucion || "---"
                          : "---";

                      let status = "No asignado";
                      let progress = "0%";
                      let assignedTo = "---";
                      let assignmentDate = "---";

                      if (activeAssignments.length > 0) {
                        status = "Asignado";
                        assignedTo = activeAssignments
                          .map((a) => a.conductor)
                          .join(", ");
                        assignmentDate = activeAssignments[0].fechaAsignacion;
                        const totalManzanas =
                          MANZANAS_POR_TERRITORIO[territoryNum] || 1;
                        const assignedManzanas = activeAssignments.reduce(
                          (acc, a) => acc + (a.manzanas?.length || 0),
                          0
                        );
                        progress = `${Math.round(
                          (assignedManzanas / totalManzanas) * 100
                        )}%`;
                      } else if (territory?.historialAsignaciones?.length > 0) {
                        status = "Completado";
                        progress = "100%";
                      }

                      return (
                        <tr
                          key={territoryNum}
                          className="border-b border-white/5 hover:bg-white/[0.02]"
                        >
                          <td className="p-4 text-white">
                            Territorio {territoryNum}
                          </td>
                          <td className="p-4 text-white">{progress}</td>
                          <td className="p-4">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                status === "Asignado"
                                  ? "bg-amber-500/20 text-amber-200"
                                  : status === "Completado"
                                  ? "bg-green-500/20 text-green-200"
                                  : "bg-gray-500/20 text-gray-300"
                              }`}
                            >
                              {status}
                            </span>
                          </td>
                          <td className="p-4 text-white/80">{assignedTo}</td>
                          <td className="p-4 text-white/60">
                            {assignmentDate}
                          </td>
                          <td className="p-4 text-white/60">{lastCompleted}</td>
                          <td className="p-4">
                            <button
                              onClick={() =>
                                setHistoryModalTerritory(territory)
                              }
                              className="text-cyan-400 hover:text-cyan-300 transition-colors text-sm"
                            >
                              Ver historial
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Program View (solo lista, formulario movido a Asignaciones) */}
            {renderProgramList()}
          </>
        )}

        {/* History Modal */}
        {historyModalTerritory && (
          <AssignmentHistoryModal
            territory={historyModalTerritory}
            onClose={() => setHistoryModalTerritory(null)}
            onDeleteAssignment={handleDeleteAssignment}
            onShowToast={onShowToast}
          />
        )}

        {/* Territory Selector Modal */}
        {showTerritorySelector && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900/95 backdrop-blur-md rounded-3xl border border-white/20 w-full max-w-4xl max-h-[80vh] overflow-hidden">
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white">
                  Seleccionar Territorios (1–{TOTAL_TERRITORIES})
                </h3>
                <button
                  onClick={() => setShowTerritorySelector(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {renderTerritoryGrid()}
                <div className="mt-4 text-center text-white/60 text-sm">
                  {selectedTerritories.size > 0
                    ? `${selectedTerritories.size} territorio(s) seleccionado(s)`
                    : "Selecciona uno o más territorios"}
                </div>
              </div>
              <div className="p-6 border-t border-white/10 flex justify-between items-center">
                <button
                  onClick={() => {
                    setSelectedTerritories(new Set());
                    setSelectedManzanas(new Set());
                  }}
                  className="px-4 py-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  Limpiar selección
                </button>
                <button
                  onClick={() => setShowTerritorySelector(false)}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-xl text-white font-medium transition-all duration-200"
                >
                  Confirmar selección
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Conductor view
  const assignedTerritories = getAssignedTerritories();

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-white">Mis Asignaciones</h3>

      {selectedConductor ? (
        assignedTerritories.length > 0 ? (
          <div className="grid gap-4">
            {assignedTerritories.map(({ territory, assignment }, index) => (
              <div
                key={`${territory.id}-${index}`}
                className="bg-white/5 rounded-2xl border border-white/10 p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-white">
                    Territorio {territory.numero}
                  </h4>
                  <span className="px-3 py-1 bg-amber-500/20 text-amber-200 rounded-lg text-sm">
                    Asignado
                  </span>
                </div>
                <p className="text-white/70 mb-2">
                  <span className="font-medium">Manzanas:</span>{" "}
                  {assignment.manzanas?.join(", ") || "N/A"}
                </p>
                <p className="text-white/60 text-sm">
                  Asignado el {assignment.fechaAsignacion}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-white/60 py-12">
            <p>No tienes territorios asignados actualmente.</p>
          </div>
        )
      ) : (
        <div className="text-center text-white/60 py-12">
          <p>Selecciona tu nombre para ver tus asignaciones.</p>
        </div>
      )}
    </div>
  );
};

export default TerritoryManager;
