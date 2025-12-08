"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  Plus,
  Edit3,
  Trash2,
  Shield,
  ShieldCheck,
  Crown,
  Eye,
  EyeOff,
  Phone,
  Mail,
  Calendar,
  Activity,
  Search,
  Filter,
  MoreVertical,
} from "lucide-react";
import { useFirebaseAuth } from "../../hooks/useFirebaseAuth";
import { useToast } from "../ui/ToastProvider";
import { useConfirmation } from "../ui/ConfirmationProvider";
import { userService } from "../../lib/userService";
import {
  AppUser,
  CreateUserRequest,
  UserStats,
  UserRole,
} from "../../types/user";

interface UserManagementPanelProps {
  onClose?: () => void;
}

const UserManagementPanel: React.FC<UserManagementPanelProps> = ({
  onClose,
}) => {
  const { appUser, canManageUsers } = useFirebaseAuth();
  const { showSuccess, showError, showWarning } = useToast();
  const { showConfirmation } = useConfirmation();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);

  // Estado para grupos de servicio
  const [serviceGroups, setServiceGroups] = useState<string[]>([
    "Grupo 1",
    "Grupo 2",
    "Grupo 3",
    "Grupo 4",
    "Grupo 5",
    "Grupo 6",
  ]);
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  // Formulario de creación/edición
  const [formData, setFormData] = useState<CreateUserRequest>({
    phoneNumber: "",
    fullName: "",
    serviceGroup: "",
    role: "publicador",
    notes: "",
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [usersData, statsData] = await Promise.all([
        userService.getAllUsers(),
        userService.getUserStats(),
      ]);
      setUsers(usersData);
      setStats(statsData);
    } catch (error: any) {
      console.error("Error cargando datos:", error);
      showError("Error", "No se pudieron cargar los usuarios");
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const addNewGroup = () => {
    if (newGroupName.trim() && !serviceGroups.includes(newGroupName.trim())) {
      setServiceGroups((prev) => [...prev, newGroupName.trim()]);
      setFormData({ ...formData, serviceGroup: newGroupName.trim() });
      setNewGroupName("");
      setShowNewGroupInput(false);
    }
  };

  const handleCreateUser = async () => {
    try {
      if (!appUser) return;

      const newUser = await userService.createUser(formData, appUser.uid);
      setUsers((prev) => [newUser, ...prev]);
      setShowCreateModal(false);
      setFormData({
        phoneNumber: "",
        fullName: "",
        serviceGroup: "",
        role: "publicador",
        notes: "",
      });
      showSuccess(
        "Usuario creado",
        `Usuario ${newUser.fullName} creado exitosamente`
      );

      // Actualizar estadísticas
      loadData();
    } catch (error: any) {
      console.error("Error creando usuario:", error);
      showError("Error", error.message || "No se pudo crear el usuario");
    }
  };

  const handleEditUser = async () => {
    try {
      if (!selectedUser) return;

      // Verificar si el número de teléfono cambió y si el usuario puede cambiarlo
      const phoneChanged = selectedUser.phoneNumber !== formData.phoneNumber;

      if (phoneChanged) {
        if (appUser?.role !== "super-admin") {
          showError(
            "Error",
            "Solo el super administrador puede cambiar números de teléfono"
          );
          return;
        }

        // Confirmar el cambio de número de teléfono
        const confirmed = await showConfirmation({
          title: "Cambiar número de teléfono",
          message: `¿Estás seguro de cambiar el número de ${selectedUser.phoneNumber} a ${formData.phoneNumber}? Esto afectará cómo el usuario inicia sesión.`,
          confirmText: "Sí, cambiar",
          cancelText: "Cancelar",
          type: "warning",
        });

        if (!confirmed) return;

        // Actualizar número de teléfono usando función especial
        await userService.updateUserPhoneNumber(
          selectedUser.uid,
          formData.phoneNumber,
          appUser.uid
        );
      }

      // Actualizar otros campos normalmente
      await userService.updateUser(selectedUser.uid, {
        uid: selectedUser.uid,
        fullName: formData.fullName,
        phoneNumber: formData.phoneNumber, // Incluir en la actualización normal también
        serviceGroup: formData.serviceGroup,
        role: formData.role,
        notes: formData.notes,
      });

      // Actualizar la lista local
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === selectedUser.uid
            ? { ...u, ...formData, updatedAt: new Date() }
            : u
        )
      );

      setShowEditModal(false);
      setSelectedUser(null);

      if (phoneChanged) {
        showSuccess(
          "Usuario actualizado",
          "Número de teléfono cambiado exitosamente. El usuario debe usar el nuevo número para iniciar sesión."
        );
      } else {
        showSuccess("Usuario actualizado", "Cambios guardados exitosamente");
      }
    } catch (error: any) {
      console.error("Error actualizando usuario:", error);
      showError("Error", error.message || "No se pudo actualizar el usuario");
    }
  };

  const handleToggleUserStatus = async (user: AppUser) => {
    const newStatus = !user.isActive;
    const action = newStatus ? "activar" : "desactivar";

    const confirmed = await showConfirmation({
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} usuario`,
      message: `¿Estás seguro de que quieres ${action} a ${user.fullName}?`,
      type: newStatus ? "info" : "warning",
      confirmText: `Sí, ${action}`,
      cancelText: "Cancelar",
    });

    if (!confirmed) return;

    try {
      if (newStatus) {
        await userService.activateUser(user.uid);
      } else {
        await userService.deactivateUser(user.uid);
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.uid === user.uid ? { ...u, isActive: newStatus } : u
        )
      );

      showSuccess(
        "Estado actualizado",
        `Usuario ${newStatus ? "activado" : "desactivado"} exitosamente`
      );
    } catch (error: any) {
      console.error("Error cambiando estado:", error);
      showError("Error", "No se pudo cambiar el estado del usuario");
    }
  };

  const handleDeleteUser = async (user: AppUser) => {
    if (user.role === "super-admin") {
      showWarning(
        "Operación no permitida",
        "No se puede eliminar al super administrador"
      );
      return;
    }

    const confirmed = await showConfirmation({
      title: "⚠️ Eliminar usuario permanentemente",
      message: `¿Estás seguro de que quieres eliminar permanentemente a ${user.fullName}? Esta acción no se puede deshacer.`,
      type: "error",
      confirmText: "Sí, eliminar",
      cancelText: "Cancelar",
    });

    if (!confirmed) return;

    try {
      await userService.deleteUser(user.uid);
      setUsers((prev) => prev.filter((u) => u.uid !== user.uid));
      showSuccess("Usuario eliminado", "Usuario eliminado permanentemente");
    } catch (error: any) {
      console.error("Error eliminando usuario:", error);
      showError("Error", "No se pudo eliminar el usuario");
    }
  };

  const openEditModal = (user: AppUser) => {
    setSelectedUser(user);
    setFormData({
      phoneNumber: user.phoneNumber || "",
      fullName: user.fullName || "",
      serviceGroup: user.serviceGroup || "",
      role: user.role,
      notes: user.notes || "",
    });
    setShowEditModal(true);
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      !searchTerm ||
      user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phoneNumber?.includes(searchTerm) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && user.isActive) ||
      (statusFilter === "inactive" && !user.isActive);

    return matchesSearch && matchesRole && matchesStatus;
  });

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case "super-admin":
        return <Crown className="w-4 h-4 text-yellow-400" />;
      case "admin":
        return <ShieldCheck className="w-4 h-4 text-blue-400" />;
      case "conductor":
        return <Shield className="w-4 h-4 text-green-400" />;
      default:
        return <Shield className="w-4 h-4 text-gray-400" />;
    }
  };

  const getRoleName = (role: UserRole) => {
    switch (role) {
      case "super-admin":
        return "Super Admin";
      case "admin":
        return "Administrador";
      case "conductor":
        return "Conductor";
      default:
        return role;
    }
  };

  if (!canManageUsers) {
    return (
      <div className="p-6 text-center">
        <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-300 mb-2">
          Acceso Restringido
        </h3>
        <p className="text-gray-400">
          No tienes permisos para gestionar usuarios
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-300">Cargando usuarios...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Gestión de Usuarios
          </h2>
          <p className="text-gray-400">
            Administra los usuarios de la aplicación
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Crear Usuario
        </button>
      </div>

      {/* Estadísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700/50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-400" />
              <div>
                <p className="text-sm text-gray-400">Total Usuarios</p>
                <p className="text-2xl font-bold text-white">
                  {stats.totalUsers}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700/50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-green-400" />
              <div>
                <p className="text-sm text-gray-400">Usuarios Activos</p>
                <p className="text-2xl font-bold text-white">
                  {stats.activeUsers}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700/50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-purple-400" />
              <div>
                <p className="text-sm text-gray-400">Administradores</p>
                <p className="text-2xl font-bold text-white">
                  {stats.adminUsers}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700/50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-orange-400" />
              <div>
                <p className="text-sm text-gray-400">Conductores</p>
                <p className="text-2xl font-bold text-white">
                  {stats.conductorUsers}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filtros y búsqueda */}
      <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700/50 rounded-xl p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por nombre, teléfono o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as UserRole | "all")}
            className="px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Todos los roles</option>
            <option value="conductor">Conductores</option>
            <option value="admin">Administradores</option>
            <option value="super-admin">Super Admins</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "all" | "active" | "inactive")
            }
            className="px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </div>
      </div>

      {/* Lista de usuarios */}
      <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700/50 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900/50 border-b border-gray-700/50">
              <tr>
                <th className="text-left p-4 text-sm font-medium text-gray-300">
                  Usuario
                </th>
                <th className="text-left p-4 text-sm font-medium text-gray-300">
                  Contacto
                </th>
                <th className="text-left p-4 text-sm font-medium text-gray-300">
                  Rol
                </th>
                <th className="text-left p-4 text-sm font-medium text-gray-300">
                  Estado
                </th>
                <th className="text-left p-4 text-sm font-medium text-gray-300">
                  Último acceso
                </th>
                <th className="text-left p-4 text-sm font-medium text-gray-300">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr
                  key={user.uid}
                  className="border-b border-gray-700/30 hover:bg-gray-700/20 transition-colors"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-medium">
                        {user.fullName?.charAt(0).toUpperCase() || "?"}
                      </div>
                      <div>
                        <p className="font-medium text-white">
                          {user.fullName || "Sin nombre"}
                        </p>
                        <p className="text-sm text-gray-400">
                          {user.serviceGroup || "Sin grupo asignado"}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="p-4">
                    <div className="space-y-1">
                      {user.phoneNumber && (
                        <div className="flex items-center gap-2 text-sm text-gray-300">
                          <Phone className="w-4 h-4" />
                          {user.phoneNumber}
                        </div>
                      )}
                      {user.email && (
                        <div className="flex items-center gap-2 text-sm text-gray-300">
                          <Mail className="w-4 h-4" />
                          {user.email}
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {getRoleIcon(user.role)}
                      <span className="text-sm font-medium text-gray-300">
                        {getRoleName(user.role)}
                      </span>
                    </div>
                  </td>

                  <td className="p-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.isActive
                          ? "bg-green-500/20 text-green-300"
                          : "bg-red-500/20 text-red-300"
                      }`}
                    >
                      {user.isActive ? "Activo" : "Inactivo"}
                    </span>
                  </td>

                  <td className="p-4">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Calendar className="w-4 h-4" />
                      {user.lastLogin
                        ? new Date(user.lastLogin).toLocaleDateString()
                        : "Nunca"}
                    </div>
                  </td>

                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(user)}
                        className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                        title="Editar usuario"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleToggleUserStatus(user)}
                        className={`p-2 rounded-lg transition-colors ${
                          user.isActive
                            ? "text-orange-400 hover:bg-orange-500/20"
                            : "text-green-400 hover:bg-green-500/20"
                        }`}
                        title={
                          user.isActive
                            ? "Desactivar usuario"
                            : "Activar usuario"
                        }
                      >
                        {user.isActive ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>

                      {user.role !== "super-admin" &&
                        appUser?.role === "super-admin" && (
                          <button
                            onClick={() => handleDeleteUser(user)}
                            className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                            title="Eliminar usuario"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredUsers.length === 0 && (
            <div className="p-8 text-center">
              <Users className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-300 mb-2">
                No hay usuarios
              </h3>
              <p className="text-gray-400">
                No se encontraron usuarios con los filtros aplicados
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de creación */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900/95 backdrop-blur-lg border border-gray-700/50 rounded-2xl shadow-2xl w-full max-w-2xl mx-2 sm:mx-4 max-h-[95vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-700/50 flex-shrink-0">
              <h3 className="text-lg font-semibold text-white">
                Crear Nuevo Usuario
              </h3>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Número de teléfono *
                </label>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, phoneNumber: e.target.value })
                  }
                  className="w-full p-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400"
                  placeholder="+593 99 123 4567"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nombre completo *
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                  className="w-full p-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400"
                  placeholder="Juan Pérez"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Grupo de servicio
                </label>
                <div className="space-y-2">
                  <select
                    value={formData.serviceGroup}
                    onChange={(e) => {
                      if (e.target.value === "new-group") {
                        setShowNewGroupInput(true);
                      } else {
                        setFormData({
                          ...formData,
                          serviceGroup: e.target.value,
                        });
                      }
                    }}
                    className="w-full p-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white"
                  >
                    <option value="">Selecciona un grupo</option>
                    {serviceGroups.map((group) => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    ))}
                    <option value="new-group">+ Agregar nuevo grupo</option>
                  </select>

                  {showNewGroupInput && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="Nombre del nuevo grupo"
                        className="flex-1 p-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400"
                      />
                      <button
                        type="button"
                        onClick={addNewGroup}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewGroupInput(false);
                          setNewGroupName("");
                        }}
                        className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                      >
                        ✗
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Rol *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value as UserRole,
                    })
                  }
                  className="w-full p-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white"
                  required
                >
                  <option value="publicador">Publicador</option>
                  <option value="conductor">Conductor</option>
                  {appUser?.role === "super-admin" && (
                    <option value="admin">Administrador</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Notas
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  className="w-full p-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400"
                  placeholder="Notas adicionales..."
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-700/50 flex-shrink-0">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700/50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateUser}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
              >
                Crear Usuario
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de edición */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900/95 backdrop-blur-lg border border-gray-700/50 rounded-2xl shadow-2xl w-full max-w-2xl mx-2 sm:mx-4 max-h-[95vh] overflow-hidden flex flex-col">
            <div className="p-4 sm:p-6 border-b border-gray-700/50 flex-shrink-0">
              <h3 className="text-lg font-semibold text-white">
                Editar Usuario
              </h3>
            </div>

            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Número de teléfono
                  {appUser?.role === "super-admin" && " *"}
                </label>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, phoneNumber: e.target.value })
                  }
                  className={`w-full p-3 border border-gray-600 rounded-lg ${
                    appUser?.role === "super-admin"
                      ? "bg-gray-800/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      : "bg-gray-700/50 text-gray-400 cursor-not-allowed"
                  }`}
                  placeholder="+593 99 123 4567"
                  disabled={appUser?.role !== "super-admin"}
                />
                {appUser?.role === "super-admin" ? (
                  <p className="text-xs text-yellow-400 mt-1">
                    ⚠️ Cambiar el número actualizará el método de login del
                    usuario
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">
                    Solo el super administrador puede cambiar números de
                    teléfono
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nombre completo *
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                  className="w-full p-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Grupo de servicio
                </label>
                <div className="space-y-2">
                  <select
                    value={formData.serviceGroup}
                    onChange={(e) => {
                      if (e.target.value === "new-group") {
                        setShowNewGroupInput(true);
                      } else {
                        setFormData({
                          ...formData,
                          serviceGroup: e.target.value,
                        });
                      }
                    }}
                    className="w-full p-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white"
                  >
                    <option value="">Selecciona un grupo</option>
                    {serviceGroups.map((group) => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    ))}
                    <option value="new-group">+ Agregar nuevo grupo</option>
                  </select>

                  {showNewGroupInput && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="Nombre del nuevo grupo"
                        className="flex-1 p-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400"
                      />
                      <button
                        type="button"
                        onClick={addNewGroup}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewGroupInput(false);
                          setNewGroupName("");
                        }}
                        className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                      >
                        ✗
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Rol *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value as UserRole,
                    })
                  }
                  className="w-full p-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white"
                  disabled={selectedUser.role === "super-admin"}
                  required
                >
                  <option value="conductor">Conductor</option>
                  {appUser?.role === "super-admin" && (
                    <>
                      <option value="admin">Administrador</option>
                      <option value="super-admin">Super Administrador</option>
                    </>
                  )}
                </select>
                {selectedUser.role === "super-admin" && (
                  <p className="text-xs text-gray-500 mt-1">
                    El rol de super administrador no se puede cambiar
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Notas
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  className="w-full p-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-3 p-4 sm:p-6 border-t border-gray-700/50 flex-shrink-0">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700/50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleEditUser}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementPanel;
