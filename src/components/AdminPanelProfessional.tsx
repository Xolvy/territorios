'use client';

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User, createUserWithEmailAndPassword, signInWithPhoneNumber } from 'firebase/auth';
import { collection, getDocs, query, orderBy, doc, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { UserRoleManager, UserRole, UserDocument } from '@/lib/userRoleManager';
import { useToast } from './ui/ToastProfessional';
import Card from './ui/Card';
import Button from './ui/Button';
import Badge from './ui/Badge';
import Modal from './ui/ModalProfessional';
import Input from './ui/InputProfessional';

import { 
  Users, 
  UserPlus, 
  Edit, 
  Trash2, 
  Search,
  Filter,
  MoreVertical,
  Mail,
  Phone,
  Shield
} from 'lucide-react';

interface AdminPanelProps {
  className?: string;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ className = '' }) => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<UserDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<UserRole | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserDocument | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const { showToast } = useToast();

  // Form states
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    password: '',
    displayName: '',
    role: 'conductor' as UserRole,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const role = await UserRoleManager.getCurrentUserRole();
        setUserRole(role);
      } else {
        setUserRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (userRole === 'admin' || userRole === 'super-admin') {
      loadUsers();
    }
  }, [userRole]);

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
      showToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudieron cargar los usuarios'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!formData.email || !formData.password || !formData.displayName) {
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Todos los campos son obligatorios'
      });
      return;
    }

    try {
      setUpdating('creating');
      
      // Crear usuario en Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        formData.email, 
        formData.password
      );

      // Crear documento en Firestore
      const success = await UserRoleManager.createOrUpdateUser(
        userCredential.user,
        formData.role,
        formData.displayName
      );

      if (success) {
        showToast({
          type: 'success',
          title: 'Usuario creado',
          message: `${formData.displayName} ha sido creado exitosamente`
        });
        
        setFormData({
          email: '',
          phone: '',
          password: '',
          displayName: '',
          role: 'conductor',
        });
        
        setShowCreateModal(false);
        loadUsers();
      } else {
        throw new Error('Error creating user document');
      }
    } catch (error: any) {
      console.error('Error creating user:', error);
      showToast({
        type: 'error',
        title: 'Error al crear usuario',
        message: error.message || 'Error desconocido'
      });
    } finally {
      setUpdating(null);
    }
  };

  const handleUpdateRole = async (targetUid: string, newRole: UserRole) => {
    if (userRole !== 'super-admin') {
      showToast({
        type: 'error',
        title: 'Sin permisos',
        message: 'Solo los super-administradores pueden cambiar roles'
      });
      return;
    }

    try {
      setUpdating(targetUid);
      const success = await UserRoleManager.changeUserRole(targetUid, newRole);
      
      if (success) {
        setUsers(prev => prev.map(u => 
          u.uid === targetUid ? { ...u, role: newRole } : u
        ));
        showToast({
          type: 'success',
          title: 'Rol actualizado',
          message: `Rol cambiado exitosamente a ${newRole}`
        });
      } else {
        throw new Error('Error updating role');
      }
    } catch (error) {
      console.error('Error updating role:', error);
      showToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo actualizar el rol'
      });
    } finally {
      setUpdating(null);
    }
  };

  const handleDeleteUser = async (targetUser: UserDocument) => {
    if (userRole !== 'super-admin') {
      showToast({
        type: 'error',
        title: 'Sin permisos',
        message: 'Solo los super-administradores pueden eliminar usuarios'
      });
      return;
    }

    if (targetUser.uid === user?.uid) {
      showToast({
        type: 'error',
        title: 'Error',
        message: 'No puedes eliminar tu propia cuenta'
      });
      return;
    }

    const confirmed = window.confirm(`¿Estás seguro de eliminar a ${targetUser.displayName}?`);
    if (!confirmed) return;

    try {
      setUpdating(targetUser.uid);
      
      // Eliminar documento de Firestore
      await deleteDoc(doc(db, 'users', targetUser.uid));
      
      // Actualizar lista local
      setUsers(prev => prev.filter(u => u.uid !== targetUser.uid));
      
      showToast({
        type: 'success',
        title: 'Usuario eliminado',
        message: `${targetUser.displayName} ha sido eliminado del sistema`
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      showToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo eliminar el usuario'
      });
    } finally {
      setUpdating(null);
    }
  };

  // Filter users
  const filteredUsers = users.filter(userData => {
    const matchesSearch = userData.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         userData.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         userData.phone?.includes(searchTerm);
    
    const matchesRole = filterRole === 'all' || userData.role === filterRole;
    
    return matchesSearch && matchesRole;
  });

  const canManageUsers = userRole === 'admin' || userRole === 'super-admin';
  const canChangeRoles = userRole === 'super-admin';

  if (!user || !canManageUsers) {
    return (
      <Card className={`p-8 text-center ${className}`}>
        <Shield className="mx-auto h-12 w-12 text-secondary-400 mb-4" />
        <h3 className="text-lg font-semibold text-secondary-900 mb-2">
          Acceso Restringido
        </h3>
        <p className="text-secondary-600">
          Necesitas permisos de administrador para acceder a este panel
        </p>
      </Card>
    );
  }

  return (
    <div className={className}>
      <Card>
        {/* Header */}
        <div className="border-b border-secondary-200 pb-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-secondary-900 flex items-center">
                <Users className="mr-2 h-6 w-6" />
                Gestión de Usuarios
              </h2>
              <p className="text-secondary-600 mt-1">
                Administra usuarios, roles y permisos del sistema
              </p>
            </div>
            <Button
              variant="primary"
              onClick={() => setShowCreateModal(true)}
              leftIcon={<UserPlus className="h-4 w-4" />}
            >
              Crear Usuario
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <Input
              placeholder="Buscar usuarios..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
          <div className="sm:w-48">
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as UserRole | 'all')}
              className="block w-full rounded-lg border border-secondary-300 bg-white px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">Todos los roles</option>
              <option value="conductor">Conductores</option>
              <option value="admin">Administradores</option>
              <option value="super-admin">Super Admins</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-2 text-secondary-600">Cargando usuarios...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-secondary-200">
                  <th className="text-left py-3 px-4 font-medium text-secondary-900">Usuario</th>
                  <th className="text-left py-3 px-4 font-medium text-secondary-900">Contacto</th>
                  <th className="text-left py-3 px-4 font-medium text-secondary-900">Rol</th>
                  <th className="text-left py-3 px-4 font-medium text-secondary-900">Estado</th>
                  {canChangeRoles && <th className="text-left py-3 px-4 font-medium text-secondary-900">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((userData) => (
                  <tr key={userData.uid} className="border-b border-secondary-100 hover:bg-secondary-50">
                    <td className="py-4 px-4">
                      <div>
                        <div className="font-medium text-secondary-900">{userData.displayName}</div>
                        <div className="text-sm text-secondary-500">ID: {userData.uid.substring(0, 8)}...</div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        {userData.email && (
                          <div className="flex items-center text-sm text-secondary-600">
                            <Mail className="h-3 w-3 mr-1" />
                            {userData.email}
                          </div>
                        )}
                        {userData.phone && (
                          <div className="flex items-center text-sm text-secondary-600">
                            <Phone className="h-3 w-3 mr-1" />
                            {userData.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <Badge variant={
                        userData.role === 'super-admin' ? 'superadmin' :
                        userData.role === 'admin' ? 'admin' : 'conductor'
                      }>
                        {userData.role}
                      </Badge>
                    </td>
                    <td className="py-4 px-4">
                      <Badge variant={userData.active ? 'success' : 'error'}>
                        {userData.active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    {canChangeRoles && (
                      <td className="py-4 px-4">
                        {userData.uid === user.uid ? (
                          <span className="text-sm text-secondary-500">Tu cuenta</span>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <select
                              value={userData.role}
                              onChange={(e) => handleUpdateRole(userData.uid, e.target.value as UserRole)}
                              disabled={updating === userData.uid}
                              className="text-sm border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                            >
                              <option value="conductor">Conductor</option>
                              <option value="admin">Admin</option>
                              <option value="super-admin">Super Admin</option>
                            </select>
                            <Button
                              variant="error"
                              size="sm"
                              onClick={() => handleDeleteUser(userData)}
                              disabled={updating === userData.uid}
                              leftIcon={<Trash2 className="h-3 w-3" />}
                            >
                              Eliminar
                            </Button>
                          </div>
                        )}
                        {updating === userData.uid && (
                          <div className="mt-2 text-xs text-primary-600">Actualizando...</div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredUsers.length === 0 && (
              <div className="text-center py-8">
                <Users className="mx-auto h-12 w-12 text-secondary-400 mb-4" />
                <p className="text-secondary-600">No se encontraron usuarios</p>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Create User Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Crear Nuevo Usuario"
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Nombre completo"
            value={formData.displayName}
            onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
            placeholder="Ej: Juan Pérez"
          />
          
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            placeholder="usuario@ejemplo.com"
          />
          
          <Input
            label="Teléfono (opcional)"
            value={formData.phone}
            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            placeholder="+593987654321"
          />
          
          <Input
            label="Contraseña"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
            placeholder="Mínimo 6 caracteres"
          />
          
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Rol del usuario
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as UserRole }))}
              className="block w-full rounded-lg border border-secondary-300 bg-white px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="conductor">Conductor</option>
              <option value="admin">Administrador</option>
              {userRole === 'super-admin' && <option value="super-admin">Super Administrador</option>}
            </select>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => setShowCreateModal(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateUser}
              isLoading={updating === 'creating'}
            >
              Crear Usuario
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminPanel;