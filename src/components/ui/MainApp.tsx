"use client";

import React, { useState } from "react";
import WelcomeScreen from "./WelcomeScreen";
import AdminDashboard from "./AdminDashboard";
import ConductorDashboard from "./ConductorDashboard";

interface User {
  id: string;
  nombre: string;
  telefono: string;
  role: "super-admin" | "admin" | "conductor";
}

interface Conductor {
  id: number;
  nombre: string;
  telefono: string;
}

type AppState =
  | { screen: "welcome" }
  | { screen: "admin"; user: User }
  | { screen: "conductor"; conductor: Conductor };

const MainApp: React.FC = () => {
  const [appState, setAppState] = useState<AppState>({ screen: "welcome" });

  const handleAdminLogin = (user: User) => {
    setAppState({ screen: "admin", user });
  };

  const handleConductorLogin = (conductor: Conductor) => {
    setAppState({ screen: "conductor", conductor });
  };

  const handleLogout = () => {
    setAppState({ screen: "welcome" });
  };

  if (appState.screen === "welcome") {
    return (
      <WelcomeScreen
        onAdminLogin={handleAdminLogin}
        onConductorLogin={handleConductorLogin}
      />
    );
  }

  if (appState.screen === "admin") {
    return <AdminDashboard user={appState.user} onLogout={handleLogout} />;
  }

  if (appState.screen === "conductor") {
    return (
      <ConductorDashboard
        conductor={appState.conductor}
        onLogout={handleLogout}
      />
    );
  }

  return null;
};

export default MainApp;
