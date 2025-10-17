'use client';

import React, { useState, useEffect } from 'react';
import { UserRoleManager, UserRole, UserDocument } from '../../lib/userRoleManager';
import { auth, db } from '../../lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';

interface UserManagementPanelProps {
  className?: string;
}

// Función helper para obtener clases CSS del rol
const getRoleColorClass = (role: UserRole): string => {
  switch (role) {
    case 'super-admin':
      return 'bg-red-100 text-red-800';
    case 'admin':
      return 'bg-yellow-100 text-yellow-800';
    case 'conductor':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const UserManagementPanel: React.FC<UserManagementPanelProps> = ({ className = '' }) => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<UserDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  // Escuchar cambios en autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Verificar permisos del usuario actual
  useEffect(() => {
    const checkUserRole = async () => {
      if (user) {
        const role = await UserRoleManager.getCurrentUserRole();
        setCurrentUserRole(role);
      } else {
        setCurrentUserRole(null);
      }
    };
    checkUserRole();
  }, [user]);

  // Cargar lista de usuarios
  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoading(true);
        const usersQuery = query(collection(db, 'users'), orderBy('displayName'));
        const snapshot = await getDocs(usersQuery);
        
        const userList: UserDocument[] = [];
        for (const doc of snapshot.docs) {
          userList.push(doc.data() as UserDocument);
        }
        
        setUsers(userList);
      } catch (error) {
        console.error('Error loading users:', error);
      } finally {
        setLoading(false);
      }
    };

    if (currentUserRole === 'admin' || currentUserRole === 'super-admin') {
      loadUsers();
    }
  }, [currentUserRole]);

  // Cambiar rol de usuario
  const handleRoleChange = async (targetUid: string, newRole: UserRole) => {
    if (!user || currentUserRole !== 'super-admin') {
      alert('Solo los super-administradores pueden cambiar roles');
      return;
    }

    try {
      setUpdating(targetUid);
      const success = await UserRoleManager.changeUserRole(targetUid, newRole);
      
      if (success) {
        // Actualizar la lista local
        setUsers(prev => prev.map(u => 
          u.uid === targetUid ? { ...u, role: newRole } : u
        ));
        alert(`Rol cambiado exitosamente a: ${newRole}`);
      } else {
        alert('Error al cambiar el rol');
      }
    } catch (error) {
      console.error('Error changing role:', error);
      alert('Error al cambiar el rol');
    } finally {
      setUpdating(null);
    }
  };

  // Verificar si el usuario puede cambiar roles
  const canChangeRoles = currentUserRole === 'super-admin';

  if (!user) {
    return (
      <div className={`p-6 border rounded-lg ${className}`}>
        <h3 className="text-lg font-semibold mb-4">Gestión de Usuarios</h3>
        <p className="text-gray-600">Debes autenticarte para acceder a este panel.</p>
      </div>
    );
  }

  if (currentUserRole !== 'admin' && currentUserRole !== 'super-admin') {
    return (
      <div className={`p-6 border rounded-lg ${className}`}>
        <h3 className="text-lg font-semibold mb-4">Gestión de Usuarios</h3>
        <p className="text-red-600">No tienes permisos para acceder a este panel.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`p-6 border rounded-lg ${className}`}>
        <h3 className="text-lg font-semibold mb-4">Gestión de Usuarios</h3>
        <p>Cargando usuarios...</p>
      </div>
    );
  }

  return (
    <div className={`p-6 border rounded-lg ${className}`}>
      <h3 className="text-lg font-semibold mb-4">🔐 Gestión de Usuarios</h3>
      
      <div className="mb-4 p-3 bg-blue-50 rounded">
        <p className="text-sm text-blue-700">
          <strong>Tu rol:</strong> {currentUserRole}
          {canChangeRoles && ' (Puedes cambiar roles de otros usuarios)'}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-300 px-4 py-2 text-left">Usuario</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Email</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Teléfono</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Rol Actual</th>
              {canChangeRoles && <th className="border border-gray-300 px-4 py-2 text-left">Cambiar Rol</th>}
            </tr>
          </thead>
          <tbody>
            {users.map((userData) => (
              <tr key={userData.uid} className="hover:bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">
                  <div>
                    <div className="font-medium">{userData.displayName}</div>
                    <div className="text-sm text-gray-500">UID: {userData.uid.substring(0, 8)}...</div>
                  </div>
                </td>
                <td className="border border-gray-300 px-4 py-2">{userData.email || 'N/A'}</td>
                <td className="border border-gray-300 px-4 py-2">{userData.phone || 'N/A'}</td>
                <td className="border border-gray-300 px-4 py-2">
                  <span className={`px-2 py-1 rounded text-sm ${getRoleColorClass(userData.role)}`}>
                    {userData.role}
                  </span>
                </td>
                {canChangeRoles && (
                  <td className="border border-gray-300 px-4 py-2">
                    {userData.uid === user.uid ? (
                      <span className="text-gray-500 text-sm">Tu cuenta</span>
                    ) : (
                      <select
                        value={userData.role}
                        onChange={(e) => handleRoleChange(userData.uid, e.target.value as UserRole)}
                        disabled={updating === userData.uid}
                        className="border rounded px-2 py-1 text-sm"
                      >
                        <option value="conductor">Conductor</option>
                        <option value="admin">Administrador</option>
                        <option value="super-admin">Super Admin</option>
                      </select>
                    )}
                    {updating === userData.uid && (
                      <span className="ml-2 text-sm text-blue-600">Actualizando...</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <p className="text-gray-600 text-center py-4">No se encontraron usuarios.</p>
      )}

      <div className="mt-6 p-4 bg-gray-50 rounded">
        <h4 className="font-medium mb-2">Roles del Sistema:</h4>
        <ul className="text-sm space-y-1">
          <li><strong>Conductor:</strong> Solo puede ver sus asignaciones</li>
          <li><strong>Administrador:</strong> Puede gestionar usuarios, territorios y asignaciones</li>
          <li><strong>Super Admin:</strong> Acceso completo al sistema, puede cambiar roles</li>
        </ul>
      </div>
    </div>
  );
};

export default UserManagementPanel;