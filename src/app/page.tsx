"use client";

import React, { useState, useEffect } from "react";
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { UserRoleManager, UserRole } from '@/lib/userRoleManager';
import ProfessionalDashboard from '@/components/ProfessionalDashboard';
import AdminPanelProfessional from '@/components/AdminPanelProfessional';
import { ToastProvider } from '@/components/ui/ToastProfessional';

export default function HomePage() {
  return (
    <ToastProvider>
      <div className="min-h-screen">
        <ProfessionalDashboard />
        
        {/* Admin Panel - Will be shown within the dashboard for admins */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
          <AdminPanelProfessional />
        </div>
      </div>
    </ToastProvider>
  );
}
