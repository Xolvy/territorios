"use client";

import React from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { Shield, User, Settings, Database, Eye, EyeOff } from 'lucide-react';

export const RoleTestComponent: React.FC = () => {
  const {
    user,
    userDocument,
    role,
    isAdmin,
    isSuperAdmin,
    loading,
    error,
    hasPermission,
    refreshUserData
  } = useUserRole();

  const [permissions, setPermissions] = React.useState<Record<string, boolean>>({});
  const [testingPermissions, setTestingPermissions] = React.useState(false);

  // Lista de permisos para probar
  const permissionsToTest = [
    'read:users',
    'write:users',
    'read:territories',
    'write:territories',
    'read:settings',
    'write:settings',
    'admin:system',
    'manage:roles'
  ];

  // Probar permisos del usuario
  const testPermissions = async () => {
    if (!user) return;
    
    setTestingPermissions(true);
    const permissionResults: Record<string, boolean> = {};
    
    for (const permission of permissionsToTest) {
      try {
        permissionResults[permission] = await hasPermission(permission);
      } catch (error) {
        permissionResults[permission] = false;
      }
    }
    
    setPermissions(permissionResults);
    setTestingPermissions(false);
  };

  React.useEffect(() => {
    if (user && !loading) {
      testPermissions();
    }
  }, [user, loading, role]);

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-lg max-w-2xl mx-auto">
        <div className="flex items-center justify-center space-x-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span>Cargando información del usuario...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-lg max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold flex items-center">
            <EyeOff className="mr-2 h-5 w-5" />
            Error al cargar datos del usuario
          </h3>
          <p className="text-red-700 mt-2">{error}</p>
          <button
            onClick={refreshUserData}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-lg max-w-2xl mx-auto">
        <div className="text-center">
          <User className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-lg font-semibold text-gray-900">
            No hay usuario autenticado
          </h3>
          <p className="text-gray-600">
            Inicia sesión para ver la información de roles y permisos
          </p>
        </div>
      </div>
    );
  }

  const getRoleColor = (userRole: string) => {
    switch (userRole) {
      case 'super-admin': return 'bg-red-100 text-red-800 border-red-200';
      case 'admin': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'conductor': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRoleIcon = (userRole: string) => {
    switch (userRole) {
      case 'super-admin': return <Settings className="h-4 w-4" />;
      case 'admin': return <Shield className="h-4 w-4" />;
      case 'conductor': return <User className="h-4 w-4" />;
      default: return <User className="h-4 w-4" />;
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-center flex items-center justify-center">
        <Database className="mr-2 h-6 w-6" />
        Sistema de Roles y Permisos Firebase
      </h2>

      {/* Información del Usuario */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg mb-3 flex items-center">
            <User className="mr-2 h-5 w-5" />
            Información del Usuario
          </h3>
          <div className="space-y-2 text-sm">
            <p><strong>UID:</strong> {user.uid}</p>
            <p><strong>Email:</strong> {user.email || 'No disponible'}</p>
            <p><strong>Teléfono:</strong> {user.phoneNumber || 'No disponible'}</p>
            <p><strong>Display Name:</strong> {userDocument?.displayName || user.displayName || 'No disponible'}</p>
            <p><strong>Último Login:</strong> {userDocument?.lastLoginAt ? new Date(userDocument.lastLoginAt).toLocaleString() : 'No disponible'}</p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg mb-3 flex items-center">
            <Shield className="mr-2 h-5 w-5" />
            Roles y Estado
          </h3>
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">Rol:</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium border flex items-center space-x-1 ${getRoleColor(role || 'unknown')}`}>
                {getRoleIcon(role || 'unknown')}
                <span>{role || 'No asignado'}</span>
              </span>
            </div>
            
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-1">
                {isAdmin ? <Eye className="h-4 w-4 text-green-600" /> : <EyeOff className="h-4 w-4 text-gray-400" />}
                <span className={isAdmin ? 'text-green-600 font-medium' : 'text-gray-400'}>
                  Administrador
                </span>
              </div>
              
              <div className="flex items-center space-x-1">
                {isSuperAdmin ? <Eye className="h-4 w-4 text-red-600" /> : <EyeOff className="h-4 w-4 text-gray-400" />}
                <span className={isSuperAdmin ? 'text-red-600 font-medium' : 'text-gray-400'}>
                  Super Admin
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-1 text-sm">
              <div className={`w-2 h-2 rounded-full ${userDocument?.active ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className={userDocument?.active ? 'text-green-600' : 'text-red-600'}>
                {userDocument?.active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Permisos del Usuario */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold text-lg flex items-center">
            <Settings className="mr-2 h-5 w-5" />
            Permisos del Usuario
          </h3>
          <button
            onClick={testPermissions}
            disabled={testingPermissions}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {testingPermissions ? 'Probando...' : 'Actualizar Permisos'}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {permissionsToTest.map((permission) => (
            <div
              key={permission}
              className={`p-2 rounded border text-xs flex items-center space-x-1 ${
                permissions[permission]
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {permissions[permission] ? (
                <Eye className="h-3 w-3" />
              ) : (
                <EyeOff className="h-3 w-3" />
              )}
              <span className="truncate">{permission}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Acciones */}
      <div className="mt-6 flex justify-center space-x-3">
        <button
          onClick={refreshUserData}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Actualizar Datos
        </button>
        
        <button
          onClick={() => window.location.href = '/'}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          Volver al App Principal
        </button>
      </div>
    </div>
  );
};

export default RoleTestComponent;