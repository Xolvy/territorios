"use client";

import React, { useState } from "react";
import UnifiedAdminPanel from "./UnifiedAdminPanel";
import { LoginPanel } from "./LoginPanel";
import { AnunciosBanner } from "./AnunciosBanner";
import { ToastProvider } from "./ui/ToastProvider";
import { ConfirmationProvider } from "./ui/ConfirmationProvider";
import { UnifiedAppProvider } from "@/context/UnifiedAppContext";
import { AppUser } from "../types/user";

export type AppMode = "login" | "admin" | "conductor";

interface ReadonlyRoleBasedAppProps {
  readonly onShowToast?: (
    message: string,
    type: "success" | "error" | "warning"
  ) => void;
}

const RoleBasedApp: React.FC<ReadonlyRoleBasedAppProps> = ({ onShowToast }) => {
  const [currentMode, setCurrentMode] = useState<AppMode>("login");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedConductor, setSelectedConductor] = useState<AppUser | null>(
    null
  );

  // Manejar login de administrador
  const handleAdminLogin = (user: any) => {
    setCurrentUser(user);
    setCurrentMode("admin");
  };

  // Manejar selección de conductor
  const handleConductorLogin = (conductor: AppUser) => {
    setSelectedConductor(conductor);
    setCurrentMode("conductor");
  };

  // Manejar logout
  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedConductor(null);
    setCurrentMode("login");
  };

  // Mostrar panel de login
  if (currentMode === "login") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <AnunciosBanner />
        <LoginPanel
          onLogin={handleAdminLogin}
          onConductorLogin={handleConductorLogin}
          onShowToast={onShowToast}
        />
      </div>
    );
  }

  return (
    <UnifiedAppProvider>
      <AnunciosBanner />
      <div className="pt-12">
        {(currentMode === "admin" || currentMode === "conductor") && (
          <UnifiedAdminPanel />
        )}
      </div>
    </UnifiedAppProvider>
  );
};

export default RoleBasedApp;
