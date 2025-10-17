"use client";

import React, { useState } from "react";
import {
  User,
  MapPin,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  LogOut,
  Phone,
  Map,
  Building,
  Users,
} from "lucide-react";

interface ConductorDashboardProps {
  conductor: any;
  onLogout: () => void;
}

interface Asignacion {
  id: number;
  territorio: string;
  direccion: string;
  fechaAsignacion: string;
  fechaVencimiento: string;
  estado: "pendiente" | "en_progreso" | "completada" | "vencida";
  prioridad: "alta" | "media" | "baja";
  notas?: string;
}

const ConductorDashboard: React.FC<ConductorDashboardProps> = ({
  conductor,
  onLogout,
}) => {
  const [asignaciones] = useState<Asignacion[]>([
    {
      id: 1,
      territorio: "Territorio 15-A",
      direccion: "Sector Los Pinos, Manzanas 1-5",
      fechaAsignacion: "2024-01-15",
      fechaVencimiento: "2024-02-15",
      estado: "en_progreso",
      prioridad: "alta",
      notas: "Priorizar visitas en horario matutino",
    },
    {
      id: 2,
      territorio: "Territorio 12-B",
      direccion: "Av. Principal, Cuadras 8-12",
      fechaAsignacion: "2024-01-10",
      fechaVencimiento: "2024-02-10",
      estado: "completada",
      prioridad: "media",
    },
    {
      id: 3,
      territorio: "Territorio 18-C",
      direccion: "Barrio Centro, Manzanas 3-7",
      fechaAsignacion: "2024-01-20",
      fechaVencimiento: "2024-02-20",
      estado: "pendiente",
      prioridad: "baja",
      notas: "Territorio con acceso limitado los fines de semana",
    },
  ]);

  const [filterEstado, setFilterEstado] = useState<string>("todos");

  const filteredAsignaciones = asignaciones.filter((asignacion) => {
    if (filterEstado === "todos") return true;
    return asignacion.estado === filterEstado;
  });

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case "pendiente":
        return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
      case "en_progreso":
        return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case "completada":
        return "bg-green-500/20 text-green-300 border-green-500/30";
      case "vencida":
        return "bg-red-500/20 text-red-300 border-red-500/30";
      default:
        return "bg-gray-500/20 text-gray-300 border-gray-500/30";
    }
  };

  const getPrioridadColor = (prioridad: string) => {
    switch (prioridad) {
      case "alta":
        return "bg-red-500/20 text-red-300";
      case "media":
        return "bg-yellow-500/20 text-yellow-300";
      case "baja":
        return "bg-green-500/20 text-green-300";
      default:
        return "bg-gray-500/20 text-gray-300";
    }
  };

  const getEstadoIcon = (estado: string) => {
    switch (estado) {
      case "pendiente":
        return <Clock className="w-4 h-4" />;
      case "en_progreso":
        return <AlertCircle className="w-4 h-4" />;
      case "completada":
        return <CheckCircle className="w-4 h-4" />;
      case "vencida":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const estadosCount = {
    todos: asignaciones.length,
    pendiente: asignaciones.filter((a) => a.estado === "pendiente").length,
    en_progreso: asignaciones.filter((a) => a.estado === "en_progreso").length,
    completada: asignaciones.filter((a) => a.estado === "completada").length,
    vencida: asignaciones.filter((a) => a.estado === "vencida").length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-green-900 to-slate-900">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-xl border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">
                  Dashboard Conductor
                </h1>
                <p className="text-white/60 text-sm">Mis Asignaciones</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-white font-medium text-sm">{conductor.nombre}</p>
                <p className="text-white/60 text-xs">{conductor.telefono}</p>
              </div>
              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <MapPin className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-white/60 text-xs">Total</p>
                <p className="text-xl font-bold text-white">{estadosCount.todos}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-white/60 text-xs">Pendientes</p>
                <p className="text-xl font-bold text-white">{estadosCount.pendiente}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-white/60 text-xs">En Progreso</p>
                <p className="text-xl font-bold text-white">{estadosCount.en_progreso}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-white/60 text-xs">Completadas</p>
                <p className="text-xl font-bold text-white">{estadosCount.completada}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Filtros</h3>
          <div className="flex flex-wrap gap-2">
            {[
              { key: "todos", label: "Todos", count: estadosCount.todos },
              { key: "pendiente", label: "Pendientes", count: estadosCount.pendiente },
              { key: "en_progreso", label: "En Progreso", count: estadosCount.en_progreso },
              { key: "completada", label: "Completadas", count: estadosCount.completada },
            ].map((filter) => (
              <button
                key={filter.key}
                onClick={() => setFilterEstado(filter.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filterEstado === filter.key
                    ? "bg-green-500/30 text-green-200 border border-green-500/50"
                    : "bg-white/5 text-white/70 hover:bg-white/10 border border-white/20"
                }`}
              >
                {filter.label} ({filter.count})
              </button>
            ))}
          </div>
        </div>

        {/* Asignaciones */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl">
          <div className="p-6 border-b border-white/10">
            <h2 className="text-xl font-semibold text-white">Mis Asignaciones</h2>
          </div>

          <div className="p-6">
            {filteredAsignaciones.length === 0 ? (
              <div className="text-center py-12">
                <MapPin className="w-12 h-12 text-white/20 mx-auto mb-4" />
                <p className="text-white/60">No hay asignaciones para mostrar</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredAsignaciones.map((asignacion) => (
                  <div
                    key={asignacion.id}
                    className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      {/* Main Info */}
                      <div className="flex-1">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                            <Map className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-white mb-1">
                              {asignacion.territorio}
                            </h3>
                            <div className="flex items-center gap-2 text-white/70 mb-2">
                              <Building className="w-4 h-4" />
                              <span className="text-sm">{asignacion.direccion}</span>
                            </div>
                          </div>
                        </div>

                        {/* Dates */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-white/40" />
                            <div>
                              <p className="text-xs text-white/60">Asignado</p>
                              <p className="text-sm text-white">{asignacion.fechaAsignacion}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-white/40" />
                            <div>
                              <p className="text-xs text-white/60">Vence</p>
                              <p className="text-sm text-white">{asignacion.fechaVencimiento}</p>
                            </div>
                          </div>
                        </div>

                        {/* Notes */}
                        {asignacion.notas && (
                          <p className="text-sm text-white/70 bg-white/5 rounded-lg p-3">
                            {asignacion.notas}
                          </p>
                        )}
                      </div>

                      {/* Status & Priority */}
                      <div className="flex flex-col gap-3 lg:items-end">
                        <div className="flex items-center gap-3">
                          {/* Estado */}
                          <div
                            className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${getEstadoColor(
                              asignacion.estado
                            )}`}
                          >
                            {getEstadoIcon(asignacion.estado)}
                            <span className="capitalize">
                              {asignacion.estado.replace("_", " ")}
                            </span>
                          </div>

                          {/* Prioridad */}
                          <div
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getPrioridadColor(
                              asignacion.prioridad
                            )}`}
                          >
                            {asignacion.prioridad.toUpperCase()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ConductorDashboard;