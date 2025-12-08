"use client";

import React, { useState } from "react";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { useToast } from "@/components/ui/ToastProvider";
import TelephonePreachingModule from "./TelephonePreachingModule";
import ConductorSelector from "../ConductorSelector";
import ProgramManager from "./ProgramManager";
import {
  MapPin,
  Phone,
  Calendar,
  User,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

type ConductorView = "telephones" | "program";

interface NavigationTabProps {
  id: ConductorView;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}

const NavigationTab: React.FC<NavigationTabProps> = ({
  id,
  label,
  icon,
  isActive,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
        isActive
          ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
          : "text-gray-400 hover:text-white hover:bg-white/5"
      }`}
    >
      {icon}
      {label}
    </button>
  );
};

const ConductorPanel: React.FC = () => {
  const { appUser } = useFirebaseAuth();
  const { showSuccess } = useToast();
  const [activeView, setActiveView] = useState<ConductorView>("telephones");

  const navigationTabs = [
    {
      id: "telephones" as ConductorView,
      label: "Predicación Telefónica",
      icon: <Phone className="w-4 h-4" />,
    },
    {
      id: "program" as ConductorView,
      label: "Programa",
      icon: <Calendar className="w-4 h-4" />,
    },
  ];

  const renderActiveView = () => {
    switch (activeView) {
      case "telephones":
        return <TelephonesView />;
      case "program":
        return <ProgramView />;
      default:
        return <TelephonesView />;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
            <User className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">
              Panel de Conductor
            </h1>
            <p className="text-gray-400">
              Bienvenido, {appUser?.fullName || "Conductor"}
            </p>
          </div>
        </div>

        {/* User Info Card */}
        <div className="bg-slate-800/50 backdrop-blur-lg border border-slate-700/50 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
              {appUser?.fullName?.charAt(0) || "C"}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white">
                {appUser?.fullName || "Conductor"}
              </h3>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                {appUser?.serviceGroup && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {appUser.serviceGroup}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-green-400" />
                  Activo
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 bg-slate-800/30 p-1 rounded-lg">
          {navigationTabs.map((tab) => (
            <NavigationTab
              key={tab.id}
              id={tab.id}
              label={tab.label}
              icon={tab.icon}
              isActive={activeView === tab.id}
              onClick={() => setActiveView(tab.id)}
            />
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="min-h-96">{renderActiveView()}</div>
    </div>
  );
};

// Componente para la vista de teléfonos
const TelephonesView: React.FC = () => {
  const { appUser } = useFirebaseAuth();

  return (
    <div className="space-y-6">
      <TelephonePreachingModule
        userRole="conductor"
        currentUser={{
          nombre: appUser?.fullName || "Conductor",
          telefono: appUser?.phoneNumber || "conductor",
          activo: true,
          fechaVencimiento: null,
        }}
      />
    </div>
  );
};

// Componente para la vista del programa
const ProgramView: React.FC = () => {
  return (
    <div className="space-y-6">
      <ProgramManager
        conductores={[]}
        lugares={[]}
        facetas={[]}
        isAdmin={false}
        onShowToast={() => {}}
      />
    </div>
  );
};

export default ConductorPanel;
