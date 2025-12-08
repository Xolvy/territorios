"use client";

import React, { useMemo } from "react";
import { AppUser } from "../../types/user";
import { Territory, Assignment } from "../../types";
import { MapPin, Calendar, Clock } from "lucide-react";

interface ConductorDashboardProps {
  conductor: AppUser;
  territorios?: Territory[];
}

export const ConductorDashboard: React.FC<ConductorDashboardProps> = ({
  conductor,
  territorios,
}) => {
  // Filtrar las asignaciones del conductor específico
  const conductorAssignments = useMemo(() => {
    const assignments: Array<{
      territory: Territory;
      assignment: Assignment;
    }> = [];

    // Si no hay territorios disponibles, retornar array vacío
    if (!territorios || territorios.length === 0) {
      return assignments;
    }

    const conductorName = conductor.displayName || conductor.fullName;

    territorios.forEach((territory) => {
      territory.asignaciones?.forEach((assignment) => {
        if (
          assignment.conductor === conductorName &&
          assignment.estado === "activo"
        ) {
          assignments.push({ territory, assignment });
        }
      });
    });

    return assignments;
  }, [territorios, conductor]);

  // Calcular estadísticas
  const stats = useMemo(() => {
    let totalTerritories = conductorAssignments.length;
    let totalManzanas = 0;

    conductorAssignments.forEach(({ assignment }) => {
      totalManzanas += assignment.manzanas?.length || 0;
    });

    return {
      totalTerritories,
      totalManzanas,
    };
  }, [conductorAssignments]);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header con información del conductor */}
      <div className="bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-400/30 rounded-2xl p-6">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full flex items-center justify-center">
            <span className="text-2xl font-bold text-white">
              {(conductor.fullName || conductor.displayName || "C")
                .charAt(0)
                .toUpperCase()}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {conductor.displayName || conductor.fullName}
            </h1>
            <p className="text-emerald-300">{conductor.phoneNumber}</p>
            {conductor.serviceGroup && (
              <p className="text-white/70 text-sm">{conductor.serviceGroup}</p>
            )}
          </div>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <MapPin className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {stats.totalTerritories}
              </p>
              <p className="text-white/60">Territorios Asignados</p>
            </div>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {stats.totalManzanas}
              </p>
              <p className="text-white/60">Manzanas Asignadas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Asignaciones Activas */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">
          Mis Asignaciones Actuales
        </h2>

        {conductorAssignments.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-8 text-center">
            <MapPin className="w-16 h-16 text-white/30 mx-auto mb-4" />
            <p className="text-white/80 text-lg">
              No tienes territorios asignados actualmente
            </p>
            <p className="text-white/50 text-sm mt-2">
              Contacta al administrador para obtener nuevas asignaciones
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {conductorAssignments.map(({ territory, assignment }, index) => (
              <div
                key={`${territory.id}-${index}`}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center">
                      <span className="text-white font-bold text-lg">
                        {territory.numero}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        Territorio {territory.numero}
                      </h3>
                      <span className="inline-flex items-center px-3 py-1 bg-emerald-500/20 text-emerald-200 rounded-lg text-sm">
                        <Clock className="w-4 h-4 mr-1" />
                        Activo
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-white/60 mb-1">Manzanas Asignadas:</p>
                    <div className="flex flex-wrap gap-1">
                      {assignment.manzanas?.map((manzana, idx) => (
                        <span
                          key={`${territory.id}-manzana-${manzana}-${idx}`}
                          className="px-2 py-1 bg-blue-500/20 text-blue-200 rounded text-xs"
                        >
                          {manzana}
                        </span>
                      )) || (
                        <span className="text-white/40 text-xs">
                          No especificadas
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-white/60 mb-1">Fecha de Asignación:</p>
                    <p className="text-white">
                      {formatDate(assignment.fechaAsignacion)}
                    </p>
                  </div>
                  {assignment.turno && (
                    <div>
                      <p className="text-white/60 mb-1">Turno:</p>
                      <p className="text-white">{assignment.turno}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConductorDashboard;
