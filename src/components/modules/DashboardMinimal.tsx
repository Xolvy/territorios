"use client";

import React, { useState, useEffect } from "react";
import { Territory } from "@/types";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import TerritoryManager from "./TerritoryManager";
import {
  TrendingUp,
  Users,
  MapPin,
  CheckCircle,
  Clock,
  BarChart3,
  Activity,
  Target,
  Settings,
  Crown,
} from "lucide-react";
import ModalEvolution, {
  ConfirmationModalEvolution,
} from "@/components/ui/ModalEvolution";
import AdvancedSettingsModal from "@/components/modals/AdvancedSettingsModal";

interface DashboardProps {
  territorios: Record<string, Territory>;
  onShowToast: (
    message: string,
    type: "success" | "error" | "warning" | "info"
  ) => void;
}

interface DashboardStats {
  totalTerritorios: number;
  asignados: number;
  completados: number;
  disponibles: number;
  progresoPromedio: number;
  actividadReciente: number;
}

const StatCard = ({
  icon: Icon,
  title,
  value,
  subtitle,
  trend,
  color = "blue",
}: {
  icon: any;
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  color?: "blue" | "green" | "orange" | "purple" | "pink";
}) => {
  const colorClasses = {
    blue: "from-blue-500/20 to-blue-600/20 border-blue-500/30 text-blue-400",
    green:
      "from-green-500/20 to-green-600/20 border-green-500/30 text-green-400",
    orange:
      "from-orange-500/20 to-orange-600/20 border-orange-500/30 text-orange-400",
    purple:
      "from-purple-500/20 to-purple-600/20 border-purple-500/30 text-purple-400",
    pink: "from-pink-500/20 to-pink-600/20 border-pink-500/30 text-pink-400",
  };

  return (
    <div
      className={`
      bg-gradient-to-br ${colorClasses[color]} backdrop-blur-sm
      border rounded-2xl p-6 hover:scale-105 transition-all duration-300
      hover:shadow-lg hover:shadow-${color.split("/")[0]}-500/25
      group cursor-pointer
    `}
    >
      <div className="flex items-center justify-between mb-4">
        <div
          className={`p-3 rounded-xl bg-gradient-to-br ${colorClasses[color]} group-hover:scale-110 transition-transform duration-300`}
        >
          <Icon className={`w-6 h-6 ${colorClasses[color].split(" ")[3]}`} />
        </div>
        {trend !== undefined && (
          <div
            className={`text-sm flex items-center gap-1 px-2 py-1 rounded-full ${
              trend > 0
                ? "text-green-400 bg-green-500/20"
                : trend < 0
                ? "text-red-400 bg-red-500/20"
                : "text-gray-400 bg-gray-500/20"
            }`}
          >
            <TrendingUp
              className={`w-4 h-4 ${trend < 0 ? "rotate-180" : ""}`}
            />
            {trend > 0 ? "+" : ""}
            {trend}%
          </div>
        )}
      </div>

      <div>
        <h3 className="text-white/60 text-sm font-medium mb-1">{title}</h3>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-white group-hover:text-white/90 transition-colors">
            {value}
          </span>
          {subtitle && (
            <span className="text-white/40 text-sm">{subtitle}</span>
          )}
        </div>
      </div>
    </div>
  );
};

const ProgressBar = ({
  label,
  value,
  max,
  color = "blue",
}: {
  label: string;
  value: number;
  max: number;
  color?: "blue" | "green" | "orange" | "purple";
}) => {
  const percentage = Math.round((value / max) * 100);

  const colors = {
    blue: "bg-blue-500",
    green: "bg-green-500",
    orange: "bg-orange-500",
    purple: "bg-purple-500",
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-white/80">{label}</span>
        <span className="text-white/60">
          {value}/{max} ({percentage}%)
        </span>
      </div>
      <div className="w-full bg-white/10 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${colors[color]} transition-all duration-1000 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

const QuickAction = ({
  icon: Icon,
  label,
  onClick,
  color = "blue",
}: {
  icon: any;
  label: string;
  onClick: () => void;
  color?: "blue" | "green" | "orange" | "purple";
}) => {
  const colors = {
    blue: "hover:bg-blue-500/20 text-blue-400 border-blue-500/30",
    green: "hover:bg-green-500/20 text-green-400 border-green-500/30",
    orange: "hover:bg-orange-500/20 text-orange-400 border-orange-500/30",
    purple: "hover:bg-purple-500/20 text-purple-400 border-purple-500/30",
  };

  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-3 p-4 rounded-xl border backdrop-blur-sm
        ${colors[color]} hover:scale-105 transition-all duration-200
        bg-white/5 hover:bg-white/10 w-full
      `}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
    </button>
  );
};

export const DashboardMinimal: React.FC<DashboardProps> = ({
  territorios,
  onShowToast,
}) => {
  const { appUser, isAdmin, isConductor } = useFirebaseAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalTerritorios: 0,
    asignados: 0,
    completados: 0,
    disponibles: 0,
    progresoPromedio: 0,
    actividadReciente: 0,
  });

  const [timeOfDay, setTimeOfDay] = useState<string>("");

  // Modal states
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    // Calculate stats
    const territoryList = Object.values(territorios);
    const total = territoryList.length;
    const assigned = territoryList.filter(
      (t) => t.asignaciones && t.asignaciones.length > 0
    ).length;
    const completed = territoryList.filter(
      (t) =>
        t.asignaciones && t.asignaciones.some((a) => a.estado === "completado")
    ).length;
    const available = total - assigned;

    // Calculate average progress
    const avgProgress =
      total > 0
        ? Math.round(
            territoryList.reduce((sum, t) => {
              if (t.asignaciones && t.asignaciones.length > 0) {
                const completedCount = t.asignaciones.filter(
                  (a) => a.estado === "completado"
                ).length;
                return sum + (completedCount / t.asignaciones.length) * 100;
              }
              return sum;
            }, 0) / total
          )
        : 0;

    // Calculate recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentActivity = territoryList.reduce((count, territory) => {
      if (territory.historialAsignaciones) {
        return (
          count +
          territory.historialAsignaciones.filter(
            (h) => new Date(h.fechaDevolucion) >= thirtyDaysAgo
          ).length
        );
      }
      return count;
    }, 0);

    setStats({
      totalTerritorios: total,
      asignados: assigned,
      completados: completed,
      disponibles: available,
      progresoPromedio: avgProgress,
      actividadReciente: recentActivity,
    });

    // Set time of day greeting
    const hour = new Date().getHours();
    if (hour < 12) setTimeOfDay("Buenos días");
    else if (hour < 18) setTimeOfDay("Buenas tardes");
    else setTimeOfDay("Buenas noches");
  }, [territorios]);

  const handleQuickAction = (action: string) => {
    switch (action) {
      case "Configuración Avanzada":
        setShowSettingsModal(true);
        break;
      case "Test Confirmación":
        setShowConfirmation(true);
        break;
      default:
        onShowToast(`Función "${action}" próximamente disponible`, "info");
    }
  };

  const handleSaveSettings = (newSettings: any) => {
    onShowToast("Configuración guardada exitosamente", "success");
    console.log("New settings:", newSettings);
  };

  const handleConfirmAction = () => {
    onShowToast("Acción confirmada con éxito", "success");
    setShowConfirmation(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">{timeOfDay} 👋</h1>
        <p className="text-white/60 text-lg">
          Gestión de Territorios - Dashboard
        </p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={MapPin}
          title="Total Territorios"
          value={stats.totalTerritorios}
          color="blue"
          trend={5}
        />
        <StatCard
          icon={Users}
          title="Asignados"
          value={stats.asignados}
          subtitle={`de ${stats.totalTerritorios}`}
          color="green"
          trend={12}
        />
        <StatCard
          icon={CheckCircle}
          title="Completados"
          value={stats.completados}
          color="purple"
          trend={8}
        />
        <StatCard
          icon={Activity}
          title="Actividad (30d)"
          value={stats.actividadReciente}
          subtitle="asignaciones"
          color="orange"
          trend={-3}
        />
      </div>

      {/* Progress Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-6 flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-400" />
            Progreso General
          </h3>
          <div className="space-y-6">
            <ProgressBar
              label="Territorios Asignados"
              value={stats.asignados}
              max={stats.totalTerritorios}
              color="blue"
            />
            <ProgressBar
              label="Territorios Completados"
              value={stats.completados}
              max={stats.totalTerritorios}
              color="green"
            />
            <ProgressBar
              label="Progreso Promedio"
              value={stats.progresoPromedio}
              max={100}
              color="purple"
            />
          </div>
        </div>

        {/* Mis Asignaciones Section */}
        {appUser?.fullName && (
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <h3 className="text-white font-semibold mb-6 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-cyan-400" />
              Mis Asignaciones
            </h3>
            <div className="max-h-96 overflow-y-auto">
              <TerritoryManager
                conductores={[]}
                lugares={[]}
                facetas={[]}
                isAdmin={false}
                selectedConductor={appUser.fullName}
                onShowToast={onShowToast}
              />
            </div>
          </div>
        )}

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-6 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-green-400" />
            Acciones Rápidas
          </h3>
          <div className="space-y-4">
            <QuickAction
              icon={MapPin}
              label="Asignar Territorio"
              onClick={() => handleQuickAction("Asignar Territorio")}
              color="blue"
            />
            <QuickAction
              icon={CheckCircle}
              label="Marcar Completado"
              onClick={() => handleQuickAction("Marcar Completado")}
              color="green"
            />
            <QuickAction
              icon={BarChart3}
              label="Ver Reportes"
              onClick={() => handleQuickAction("Ver Reportes")}
              color="purple"
            />
            <QuickAction
              icon={Activity}
              label="Historial"
              onClick={() => handleQuickAction("Ver Historial")}
              color="orange"
            />
            <QuickAction
              icon={Settings}
              label="Configuración Avanzada"
              onClick={() => handleQuickAction("Configuración Avanzada")}
              color="purple"
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-2xl p-6">
          <h3 className="text-blue-300 font-semibold mb-2">Disponibles</h3>
          <div className="text-3xl font-bold text-white mb-2">
            {stats.disponibles}
          </div>
          <p className="text-blue-200/60 text-sm">
            Territorios listos para asignar
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 rounded-2xl p-6">
          <h3 className="text-green-300 font-semibold mb-2">En Progreso</h3>
          <div className="text-3xl font-bold text-white mb-2">
            {stats.asignados - stats.completados}
          </div>
          <p className="text-green-200/60 text-sm">
            Territorios siendo trabajados
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 rounded-2xl p-6">
          <h3 className="text-purple-300 font-semibold mb-2">Eficiencia</h3>
          <div className="text-3xl font-bold text-white mb-2">
            {stats.totalTerritorios > 0
              ? Math.round((stats.completados / stats.totalTerritorios) * 100)
              : 0}
            %
          </div>
          <p className="text-purple-200/60 text-sm">Tasa de completado</p>
        </div>
      </div>

      {/* Advanced Settings Modal */}
      <AdvancedSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onSave={handleSaveSettings}
      />

      {/* Demo Features Modal */}
      <ModalEvolution
        isOpen={showDemoModal}
        onClose={() => setShowDemoModal(false)}
        title="Funciones Avanzadas Disponibles"
        size="md"
        type="highlight"
        animation="bounce"
        blur="heavy"
      >
        <div className="space-y-6 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-yellow-500/30 to-orange-500/30 rounded-full flex items-center justify-center mx-auto">
            <Crown className="w-10 h-10 text-yellow-400" />
          </div>

          <div className="space-y-3">
            <h3 className="text-xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
              Experiencia Avanzada
            </h3>
            <p className="text-white/70">
              Disfruta de características con efectos visuales mejorados,
              análisis avanzados y personalización completa.
            </p>
          </div>

          <div className="grid gap-3 text-left">
            {[
              "✨ Efectos visuales avanzados",
              "📊 Dashboard personalizable",
              "🎨 Temas exclusivos",
              "🔄 Sincronización automática",
              "📈 Análisis detallados",
            ].map((feature, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20"
              >
                <span className="text-yellow-400">{feature}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              setShowDemoModal(false);
              setShowConfirmation(true);
            }}
            className="w-full py-3 px-4 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold rounded-xl transition-all duration-200 hover:scale-105"
          >
            Probar Funciones Avanzadas
          </button>
        </div>
      </ModalEvolution>

      {/* Confirmation Modal */}
      <ConfirmationModalEvolution
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleConfirmAction}
        title="¿Activar Funciones Avanzadas?"
        message="Esto habilitará funciones avanzadas con efectos visuales mejorados. ¿Deseas continuar?"
        confirmText="Sí, Activar"
        cancelText="Quizás después"
        type="highlight"
      />
    </div>
  );
};

export default DashboardMinimal;
