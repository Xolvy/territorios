import React from "react";
import { AppUser } from "@/types/unified";
import { ConductorDashboard } from "./modules/ConductorDashboard";
import { LogOut } from "lucide-react";

interface ConductorPanelsProps {
  conductor: AppUser;
  onLogout: () => void;
}

export const ConductorPanels: React.FC<ConductorPanelsProps> = ({
  conductor,
  onLogout,
}) => {
  if (!conductor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mx-auto mb-4"></div>
          <p className="text-white/80 text-lg">Cargando tus asignaciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-r from-emerald-400 to-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">
                  {(conductor.fullName || conductor.displayName || "C")
                    .charAt(0)
                    .toUpperCase()}
                </span>
              </div>
              <div>
                <h1 className="text-white font-bold text-xl">
                  {conductor.fullName || conductor.displayName}
                </h1>
                <p className="text-white/60 text-sm">Modo Conductor</p>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="flex items-center space-x-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200 rounded-lg transition-all duration-200"
            >
              <LogOut size={18} />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <ConductorDashboard conductor={conductor} />
      </main>
    </div>
  );
};
