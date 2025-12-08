"use client";

import React, { useState, useEffect } from "react";
import { MapPin, Users, Plus, Check, X } from "lucide-react";
import { MANZANAS_POR_TERRITORIO } from "@/lib/adminServices";
import { Conductor } from "@/types";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

interface TerritoryMultiSelector {
  isOpen: boolean;
  onClose: () => void;
  conductores: Conductor[];
  estadoTerritorios: any;
  onAssignTerritorios: (assignments: {
    conductorId: string;
    conductorNombre: string;
    asignaciones: Array<{
      territorioId: number;
      manzanas: number[];
    }>;
  }) => Promise<void>;
}

interface TerritoryAssignment {
  territorioId: number;
  manzanas: number[];
}

export default function TerritoryMultiSelector({
  isOpen,
  onClose,
  conductores,
  estadoTerritorios,
  onAssignTerritorios,
}: TerritoryMultiSelector) {
  // Estados del componente
  const [selectedConductor, setSelectedConductor] = useState<string>("");
  const [territoryAssignments, setTerritoryAssignments] = useState<
    TerritoryAssignment[]
  >([]);
  const [expandedTerritorios, setExpandedTerritorios] = useState<Set<number>>(
    new Set()
  );
  const [selectedTerritories, setSelectedTerritories] = useState<Set<number>>(
    new Set()
  );
  const [loading, setLoading] = useState(false);

  // Reset cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      setSelectedConductor("");
      setTerritoryAssignments([]);
      setExpandedTerritorios(new Set());
      setSelectedTerritories(new Set());
    }
  }, [isOpen]);

  // Obtener territorios disponibles (que tienen manzanas disponibles)
  const getAvailableTerritories = () => {
    const territorios = [];
    for (let i = 1; i <= 22; i++) {
      const territorioData = estadoTerritorios[i];
      const totalManzanas =
        MANZANAS_POR_TERRITORIO[i as keyof typeof MANZANAS_POR_TERRITORIO] || 1;

      // Obtener manzanas disponibles
      const manzanasDisponibles = [];
      for (let j = 1; j <= totalManzanas; j++) {
        const isAsignada = territorioData?.manzanas?.some(
          (m: any) => m.numero === j && m.estado === "asignada"
        );
        if (!isAsignada) {
          manzanasDisponibles.push(j);
        }
      }

      if (manzanasDisponibles.length > 0) {
        territorios.push({
          id: i,
          totalManzanas,
          manzanasDisponibles,
          manzanasAsignadas:
            territorioData?.manzanas?.filter(
              (m: any) => m.estado === "asignada"
            ) || [],
        });
      }
    }
    return territorios;
  };

  const availableTerritories = getAvailableTerritories();

  // Toggle expansión de territorio
  const toggleTerritoryExpansion = (territorioId: number) => {
    const newExpanded = new Set(expandedTerritorios);
    if (newExpanded.has(territorioId)) {
      newExpanded.delete(territorioId);
    } else {
      newExpanded.add(territorioId);
    }
    setExpandedTerritorios(newExpanded);
  };

  // Selección rápida por territorio (botón de ficha)
  const toggleTerritoryQuickSelect = (territorioId: number) => {
    const exists = territoryAssignments.find(
      (t) => t.territorioId === territorioId
    );
    if (exists) {
      // Si ya está en la selección, lo removemos completamente
      deselectAllManzanas(territorioId);
      setSelectedTerritories((prev) => {
        const s = new Set(prev);
        s.delete(territorioId);
        return s;
      });
      return;
    }
    // Seleccionar todas las manzanas disponibles para ese territorio
    selectAllManzanas(territorioId);
    setSelectedTerritories((prev) => new Set(prev).add(territorioId));
  };

  // Acciones globales
  const selectAllForAllTerritories = () => {
    const s = new Set<number>();
    const next: TerritoryAssignment[] = [];
    for (const t of availableTerritories) {
      if (t.manzanasDisponibles.length === 0) continue;
      s.add(t.id);
      next.push({
        territorioId: t.id,
        manzanas: [...t.manzanasDisponibles].sort((a, b) => a - b),
      });
    }
    setSelectedTerritories(s);
    setTerritoryAssignments(
      next.sort((a, b) => a.territorioId - b.territorioId)
    );
  };

  const clearAllSelections = () => {
    setSelectedTerritories(new Set());
    setTerritoryAssignments([]);
    setExpandedTerritorios(new Set());
  };

  // Seleccionar/deseleccionar manzana
  const toggleManzanaSelection = (territorioId: number, manzana: number) => {
    setTerritoryAssignments((prev) => {
      const existingTerritoryIndex = prev.findIndex(
        (t) => t.territorioId === territorioId
      );

      if (existingTerritoryIndex >= 0) {
        // Territorio ya existe en las asignaciones
        const existingTerritory = prev[existingTerritoryIndex];
        const manzanaIndex = existingTerritory.manzanas.indexOf(manzana);

        let newManzanas;
        if (manzanaIndex >= 0) {
          // Remover manzana
          newManzanas = existingTerritory.manzanas.filter((m) => m !== manzana);
        } else {
          // Agregar manzana
          newManzanas = [...existingTerritory.manzanas, manzana].sort(
            (a, b) => a - b
          );
        }

        const newAssignments = [...prev];
        if (newManzanas.length === 0) {
          // Si no hay manzanas, remover el territorio
          newAssignments.splice(existingTerritoryIndex, 1);
        } else {
          // Actualizar manzanas
          newAssignments[existingTerritoryIndex] = {
            ...existingTerritory,
            manzanas: newManzanas,
          };
        }

        // Mantener sincronizada la selección rápida
        setSelectedTerritories(
          new Set(newAssignments.map((t) => t.territorioId))
        );
        return newAssignments;
      } else {
        // Nuevo territorio
        const next = [
          ...prev,
          {
            territorioId,
            manzanas: [manzana],
          },
        ].sort((a, b) => a.territorioId - b.territorioId);
        setSelectedTerritories(new Set(next.map((t) => t.territorioId)));
        return next;
      }
    });
  };

  // Seleccionar todas las manzanas disponibles de un territorio
  const selectAllManzanas = (territorioId: number) => {
    const territory = availableTerritories.find((t) => t.id === territorioId);
    if (!territory) return;

    setTerritoryAssignments((prev) => {
      const existingIndex = prev.findIndex(
        (t) => t.territorioId === territorioId
      );
      const newAssignments = [...prev];

      if (existingIndex >= 0) {
        newAssignments[existingIndex] = {
          territorioId,
          manzanas: territory.manzanasDisponibles.sort((a, b) => a - b),
        };
      } else {
        newAssignments.push({
          territorioId,
          manzanas: territory.manzanasDisponibles.sort((a, b) => a - b),
        });
      }

      return newAssignments.sort((a, b) => a.territorioId - b.territorioId);
    });
  };

  // Deseleccionar todas las manzanas de un territorio
  const deselectAllManzanas = (territorioId: number) => {
    setTerritoryAssignments((prev) =>
      prev.filter((t) => t.territorioId !== territorioId)
    );
  };

  // Verificar si una manzana está seleccionada
  const isManzanaSelected = (territorioId: number, manzana: number) => {
    const assignment = territoryAssignments.find(
      (t) => t.territorioId === territorioId
    );
    return assignment?.manzanas.includes(manzana) || false;
  };

  // Verificar si todas las manzanas de un territorio están seleccionadas
  const areAllManzanasSelected = (territorioId: number) => {
    const territory = availableTerritories.find((t) => t.id === territorioId);
    const assignment = territoryAssignments.find(
      (t) => t.territorioId === territorioId
    );

    if (!territory || !assignment) return false;

    return (
      territory.manzanasDisponibles.length === assignment.manzanas.length &&
      territory.manzanasDisponibles.every((m) =>
        assignment.manzanas.includes(m)
      )
    );
  };

  // Obtener resumen de la selección
  const getSelectionSummary = () => {
    const totalTerritorios = territoryAssignments.length;
    const totalManzanas = territoryAssignments.reduce(
      (sum, t) => sum + t.manzanas.length,
      0
    );
    return { totalTerritorios, totalManzanas };
  };

  // Manejar asignación
  const handleAssignment = async () => {
    if (!selectedConductor || territoryAssignments.length === 0) {
      return;
    }

    const conductor = conductores.find((c) => c.id === selectedConductor);
    if (!conductor) return;

    setLoading(true);
    try {
      await onAssignTerritorios({
        conductorId: selectedConductor,
        conductorNombre: conductor.nombre,
        asignaciones: territoryAssignments,
      });
      onClose();
    } catch (error) {
      console.error("Error en asignación:", error);
    } finally {
      setLoading(false);
    }
  };

  const { totalTerritorios, totalManzanas } = getSelectionSummary();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/90 backdrop-blur-xl border border-white/40 rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-white/30 bg-gradient-to-r from-blue-600 to-purple-600">
          <div className="flex justify-between items-center">
            <div className="text-white">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <MapPin size={28} />
                Asignación Múltiple de Territorios
              </h2>
              <p className="text-blue-100 mt-2">
                Selecciona territorios y manzanas para asignar a un conductor
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-300 text-3xl font-bold leading-none"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex h-[calc(90vh-140px)]">
          {/* Panel de selección (lado izquierdo) */}
          <div className="flex-1 p-0 overflow-hidden border-r border-white/40">
            <div className="sticky top-0 z-10 p-4 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b border-white/40">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-800">
                  Selección rápida
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={selectAllForAllTerritories}
                    className="px-3 py-1.5 rounded-lg text-sm bg-green-600 text-white hover:bg-green-700 shadow"
                  >
                    Seleccionar todo
                  </button>
                  <button
                    onClick={clearAllSelections}
                    className="px-3 py-1.5 rounded-lg text-sm bg-gray-200 text-gray-800 hover:bg-gray-300"
                  >
                    Limpiar
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Pulsa un territorio para seleccionar todas sus manzanas
                disponibles. Expándelo para elegir manzanas específicas.
              </p>
            </div>
            <div className="p-4 overflow-y-auto h-full">
              {availableTerritories.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <MapPin size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>No hay territorios con manzanas disponibles</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 mb-4">
                  {availableTerritories.map((t) => {
                    const selected = !!territoryAssignments.find(
                      (a) => a.territorioId === t.id
                    );
                    const selectedCount =
                      territoryAssignments.find((a) => a.territorioId === t.id)
                        ?.manzanas.length || 0;
                    return (
                      <button
                        key={t.id}
                        onClick={() => toggleTerritoryQuickSelect(t.id)}
                        className={`px-3 py-2 rounded-xl text-sm font-semibold transition-all border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          selected
                            ? "bg-blue-600 text-white border-blue-600 shadow-md hover:brightness-110"
                            : "bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200"
                        }`}
                        title={`Disponibles: ${t.manzanasDisponibles.length}/${t.totalManzanas}`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span>T{t.id}</span>
                          {selected && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 border border-white/30">
                              {selectedCount}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {territoryAssignments.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-slate-700 mb-2">
                    Seleccionados:
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {territoryAssignments.map((a) => (
                      <span
                        key={a.territorioId}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-blue-100 text-blue-800 border border-blue-200"
                      >
                        T{a.territorioId}
                        <span className="opacity-70">
                          ({a.manzanas.length})
                        </span>
                        <button
                          onClick={() => deselectAllManzanas(a.territorioId)}
                          className="ml-1 text-blue-700 hover:text-blue-900"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <h3 className="text-base font-semibold mb-3 text-slate-800">
                Manzanas por territorio
              </h3>
              <div className="space-y-3">
                {availableTerritories.map((territorio) => (
                  <div
                    key={territorio.id}
                    className="border border-gray-200 rounded-lg overflow-hidden"
                  >
                    <div
                      className={`p-4 cursor-pointer transition-colors ${
                        expandedTerritorios.has(territorio.id)
                          ? "bg-blue-50 border-l-4 border-l-blue-500"
                          : "bg-gray-50 hover:bg-gray-100"
                      }`}
                      onClick={() => toggleTerritoryExpansion(territorio.id)}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-semibold">
                            Territorio {territorio.id}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {territorio.manzanasDisponibles.length} de{" "}
                            {territorio.totalManzanas} disponibles
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {areAllManzanasSelected(territorio.id) ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deselectAllManzanas(territorio.id);
                              }}
                              className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200"
                            >
                              Deseleccionar Todo
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                selectAllManzanas(territorio.id);
                              }}
                              className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm hover:bg-green-200"
                            >
                              Seleccionar Todo
                            </button>
                          )}
                          <span className="text-gray-400">
                            {expandedTerritorios.has(territorio.id) ? "−" : "+"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {expandedTerritorios.has(territorio.id) && (
                      <div className="p-4 bg-white">
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                          {territorio.manzanasDisponibles.map((manzana) => (
                            <button
                              key={manzana}
                              onClick={() =>
                                toggleManzanaSelection(territorio.id, manzana)
                              }
                              className={`p-2 rounded-lg text-sm font-medium transition-colors ${
                                isManzanaSelected(territorio.id, manzana)
                                  ? "bg-blue-500 text-white"
                                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                              }`}
                            >
                              M{manzana}
                            </button>
                          ))}
                        </div>

                        {territorio.manzanasAsignadas.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <p className="text-xs text-gray-500 mb-2">
                              Manzanas ya asignadas:
                            </p>
                            <div className="grid grid-cols-6 gap-2">
                              {territorio.manzanasAsignadas.map((m: any) => (
                                <div
                                  key={m.numero}
                                  className="p-2 rounded-lg text-sm bg-red-100 text-red-700 text-center"
                                  title={`Asignada a: ${m.conductorNombre}`}
                                >
                                  M{m.numero}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Panel de resumen (lado derecho) */}
          <div className="w-[380px] p-6 bg-white/60 backdrop-blur border-l border-white/40">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Users size={20} />
              Resumen de Asignación
            </h3>

            {/* Selector de conductor */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Conductor:
              </label>
              <select
                value={selectedConductor}
                onChange={(e) => setSelectedConductor(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar conductor</option>
                {conductores.map((conductor) => (
                  <option key={conductor.id} value={conductor.id}>
                    {conductor.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* Estadísticas */}
            <div className="mb-6 p-4 bg-blue-50/70 rounded-lg border border-blue-100">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {totalTerritorios}
                  </div>
                  <div className="text-xs text-blue-800">Territorios</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">
                    {totalManzanas}
                  </div>
                  <div className="text-xs text-purple-800">Manzanas</div>
                </div>
              </div>
            </div>

            {/* Lista de asignaciones */}
            {territoryAssignments.length > 0 && (
              <div className="mb-6">
                <h4 className="font-medium text-gray-700 mb-3">Selecciones:</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {territoryAssignments.map((assignment) => (
                    <div
                      key={assignment.territorioId}
                      className="p-3 bg-white rounded-lg border border-gray-200"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">
                            Territorio {assignment.territorioId}
                          </div>
                          <div className="text-sm text-gray-600">
                            {assignment.manzanas.length} manzana
                            {assignment.manzanas.length !== 1 ? "s" : ""}
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            deselectAllManzanas(assignment.territorioId)
                          }
                          className="text-red-500 hover:text-red-700"
                          title="Remover territorio"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {assignment.manzanas.map((manzana) => (
                          <span
                            key={manzana}
                            className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                          >
                            M{manzana}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex flex-col gap-3">
              <Button
                onClick={handleAssignment}
                disabled={
                  !selectedConductor ||
                  territoryAssignments.length === 0 ||
                  loading
                }
                className="w-full bg-gradient-to-r from-blue-500 to-purple-500"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Asignando...
                  </>
                ) : (
                  <>
                    <Check size={16} className="mr-2" />
                    Asignar Selección
                  </>
                )}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={clearAllSelections}
                  variant="secondary"
                  className="w-full"
                >
                  Limpiar selección
                </Button>
                <Button onClick={onClose} variant="secondary" className="w-full">
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
