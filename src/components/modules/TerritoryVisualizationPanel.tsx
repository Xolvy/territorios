"use client";

import React, { useState, useMemo } from "react";
import { useUnifiedApp } from "@/context/UnifiedAppContext";
import { formatDate } from "@/utils";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  Eye,
  MapPin,
  User,
} from "lucide-react";

interface TerritoryCardProps {
  terrNum: string;
  data: any;
  onClick: (terrNum: string) => void;
}

interface TerritoryDetailModalProps {
  terrNum: string | null;
  isOpen: boolean;
  onClose: () => void;
}

function TerritoryCard({ terrNum, data, onClick }: TerritoryCardProps) {
  if (!data) {
    // Territorio disponible
    return (
      <button
        onClick={() => onClick(terrNum)}
        className="territory-card territory-card-available group"
      >
        <div className="territory-number">{terrNum}</div>
        <div className="territory-status">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span className="text-green-600">Disponible</span>
        </div>
        <div className="territory-info">
          <p className="text-gray-500 text-sm">Listo para asignar</p>
        </div>
      </button>
    );
  }

  const activeAssignment = data.asignaciones?.find(
    (a: any) => a.estado === "activo"
  );

  if (activeAssignment) {
    // Territorio asignado
    return (
      <button
        onClick={() => onClick(terrNum)}
        className="territory-card territory-card-assigned group"
      >
        <div className="territory-number">{terrNum}</div>
        <div className="territory-status">
          <Clock className="w-4 h-4 text-blue-500" />
          <span className="text-blue-600">Asignado</span>
        </div>
        <div className="territory-info">
          <p className="text-gray-700 text-sm font-medium">
            {activeAssignment.conductor}
          </p>
          <p className="text-gray-500 text-xs">
            {activeAssignment.blockIds?.length || 0} manzanas
          </p>
        </div>
      </button>
    );
  }

  // Territorio completado
  return (
    <button
      onClick={() => onClick(terrNum)}
      className="territory-card territory-card-completed group"
    >
      <div className="territory-number">{terrNum}</div>
      <div className="territory-status">
        <AlertTriangle className="w-4 h-4 text-orange-500" />
        <span className="text-orange-600">Completado</span>
      </div>
      <div className="territory-info">
        <p className="text-gray-500 text-sm">Para devolver</p>
      </div>
    </button>
  );
}

function TerritoryDetailModal({
  terrNum,
  isOpen,
  onClose,
}: TerritoryDetailModalProps) {
  const { state } = useUnifiedApp();

  // Mapear datos del estado unificado
  const territorios = Object.values(state.territories);

  if (!terrNum || !isOpen) return null;

  const data = territorios.find((t) => t.numero === Number(terrNum));
  const totalManzanas = 20; // Simplified
  const activeAssignment = data?.asignaciones?.find(
    (a: any) => a.estado === "activo"
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Territorio ${terrNum} - Detalles`}
    >
      <div className="space-y-6">
        {/* Información General */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-800 mb-2">
            Información General
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Número:</span>
              <span className="ml-2 font-medium">{terrNum}</span>
            </div>
            <div>
              <span className="text-gray-600">Total Manzanas:</span>
              <span className="ml-2 font-medium">{totalManzanas}</span>
            </div>
          </div>
        </div>

        {/* Estado Actual */}
        <div className="bg-blue-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-800 mb-2">Estado Actual</h4>
          {activeAssignment ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <span className="text-blue-600 font-medium">Asignado</span>
              </div>
              <div className="text-sm text-gray-700">
                <p>
                  <strong>Conductor:</strong> {activeAssignment.conductorName}
                </p>
                <p>
                  <strong>Fecha:</strong>{" "}
                  {formatDate(activeAssignment.fechaAsignacion)}
                </p>
                <p>
                  <strong>Manzanas:</strong>{" "}
                  {activeAssignment.blockIds?.length || 0}
                </p>
              </div>
            </div>
          ) : data ? (
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-green-600 font-medium">Disponible</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <span className="text-orange-600 font-medium">Completado</span>
            </div>
          )}
        </div>

        {/* Historial */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-800 mb-2">
            Historial de Asignaciones
          </h4>
          <div className="max-h-40 overflow-y-auto">
            {data?.historialAsignaciones &&
            data.historialAsignaciones.length > 0 ? (
              <div className="space-y-2">
                {data.historialAsignaciones.map((hist: any, index: number) => (
                  <div
                    key={index}
                    className="text-sm border-b border-gray-200 pb-2"
                  >
                    <p>
                      <strong>{hist.conductor}</strong>
                    </p>
                    <p className="text-gray-600">
                      Devuelto: {formatDate(hist.fechaDevolucion)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Sin historial previo</p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function TerritoryVisualizationPanel() {
  const { state } = useUnifiedApp();

  // Mapear datos del estado unificado
  const territorios = Object.values(state.territories);
  const conductores = Object.values(state.users).filter(
    (user) => user.role === "conductor"
  );
  const isLoading = state.isLoading;
  const [selectedTerritory, setSelectedTerritory] = useState<string | null>(
    null
  );

  // Helper function to find territory by number
  const findTerritoryByNumber = (terrNum: string | number) => {
    return territorios.find((t) => t.numero === Number(terrNum));
  };

  // Calculate statistics - move before early return
  const stats = useMemo(() => {
    const stats = {
      available: 0,
      assigned: 0,
      completed: 0,
    };

    // Generate 22 territories for display
    for (let i = 1; i <= 22; i++) {
      const terrNum = String(i);
      const data = territorios.find((t) => t.numero === Number(terrNum));

      if (!data) {
        stats.available++;
      } else {
        const activeAssignment = data.asignaciones?.find(
          (a: any) => a.estado === "activo"
        );
        if (activeAssignment) {
          stats.assigned++;
        } else if (data.historialAsignaciones?.length > 0) {
          stats.completed++;
        } else {
          stats.available++;
        }
      }
    }

    return stats;
  }, [territorios]);

  if (isLoading) {
    return (
      <div className="glass-card text-center">
        <LoadingSpinner
          size="lg"
          text="Cargando visualización de territorios..."
        />
      </div>
    );
  }

  const handleTerritoryClick = (terrNum: string) => {
    setSelectedTerritory(terrNum);
  };

  const handleCloseModal = () => {
    setSelectedTerritory(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg flex items-center justify-center">
            <MapPin className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              Visualización de Territorios
            </h2>
            <p className="text-gray-600">
              Estado actual de todos los territorios
            </p>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card text-center">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.available}</p>
          <p className="text-gray-600">Disponibles</p>
        </div>

        <div className="glass-card text-center">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
            <Clock className="w-6 h-6 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-blue-600">{stats.assigned}</p>
          <p className="text-gray-600">Asignados</p>
        </div>

        <div className="glass-card text-center">
          <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-2">
            <AlertTriangle className="w-6 h-6 text-orange-600" />
          </div>
          <p className="text-2xl font-bold text-orange-600">
            {stats.completed}
          </p>
          <p className="text-gray-600">Completados</p>
        </div>
      </div>

      {/* Territory Grid */}
      <div className="glass-card">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Mapa de Territorios
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {Array.from({ length: 22 }, (_, index) => {
            const terrNum = String(index + 1);
            const data = findTerritoryByNumber(terrNum);

            return (
              <TerritoryCard
                key={terrNum}
                terrNum={terrNum}
                data={data}
                onClick={handleTerritoryClick}
              />
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="glass-card">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Leyenda</h3>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 rounded border-green-500 border-2"></div>
            <span className="text-sm text-gray-600">Disponible</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-100 rounded border-blue-500 border-2"></div>
            <span className="text-sm text-gray-600">Asignado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-100 rounded border-orange-500 border-2"></div>
            <span className="text-sm text-gray-600">Completado</span>
          </div>
        </div>
      </div>

      {/* Territory Detail Modal */}
      <TerritoryDetailModal
        terrNum={selectedTerritory}
        isOpen={selectedTerritory !== null}
        onClose={handleCloseModal}
      />

      {/* Custom Styles */}
      <style jsx>{`
        .territory-card {
          @apply bg-white border border-gray-200 rounded-lg p-3 text-left hover:shadow-md transition-all duration-200 w-full min-h-20;
        }

        .territory-card-available {
          @apply border-green-300 hover:border-green-500 hover:bg-green-50;
        }

        .territory-card-assigned {
          @apply border-blue-300 hover:border-blue-500 hover:bg-blue-50;
        }

        .territory-card-completed {
          @apply border-orange-300 hover:border-orange-500 hover:bg-orange-50;
        }

        .territory-number {
          @apply text-lg font-bold text-gray-800 mb-1;
        }

        .territory-status {
          @apply flex items-center gap-1 mb-2;
        }

        .territory-info {
          @apply space-y-1;
        }
      `}</style>
    </div>
  );
}
