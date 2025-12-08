import { Suspense } from 'react';
import Link from 'next/link';
import RoleTestComponent from '@/components/RoleTestComponent';
import UserManagementPanel from '@/components/admin/UserManagementPanel';

export default function TestRolesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">
          🔐 Sistema de Roles y Permisos
        </h1>
        
        <Suspense fallback={
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-lg">Cargando sistema de roles...</p>
          </div>
        }>
          <RoleTestComponent />
        </Suspense>

        {/* Panel de Gestión de Usuarios */}
        <div className="mt-8">
          <Suspense fallback={<div className="p-6 text-center">Cargando panel de usuarios...</div>}>
            <UserManagementPanel className="bg-white shadow-lg" />
          </Suspense>
        </div>
        
        <div className="mt-8 text-center space-x-4">
          <Link 
            href="/" 
            className="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            ← Volver al App Principal
          </Link>
          
          <Link 
            href="/test-firebase" 
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            🔥 Prueba Firebase
          </Link>
        </div>
      </div>
    </div>
  );
}