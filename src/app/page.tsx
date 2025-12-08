"use client";

import React from "react";
import { useUnifiedApp } from '@/context/UnifiedAppContext';
import ProfessionalDashboard from '@/components/ProfessionalDashboard';
import AdminPanelProfessional from '@/components/AdminPanelProfessional';
import LoginScreen from '@/components/LoginScreen';

export default function HomePage() {
  const { state } = useUnifiedApp();

  // Si no hay usuario autenticado, mostrar pantalla de login
  if (!state.currentUser) {
    return <LoginScreen />;
  }

  // Si el usuario está autenticado, mostrar el dashboard
  return (
    <div className="min-h-screen">
      <ProfessionalDashboard />
      
      {/* Admin Panel - Will be shown within the dashboard for admins */}
      {(state.currentUser.role === 'admin' || state.currentUser.role === 'super-admin') && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
          <AdminPanelProfessional />
        </div>
      )}
    </div>
  );
}
