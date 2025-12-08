"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useUnifiedApp } from "@/context/UnifiedAppContext";
import LoginScreen from "@/components/LoginScreen";
import ExportTools from "@/components/utilities/ExportTools";
import AdvancedStats from "@/components/utilities/AdvancedStats";
import {
  Territory,
  Block,
  Address,
  PhoneNumber,
  AppUser,
  Assignment,
  UserRole,
  CreateTerritoryRequest,
  CreateBlockRequest,
  CreateAddressRequest,
  CreateUserRequest,
  CreateAssignmentRequest,
  TelephoneBulkImport,
  TelephoneStatus,
} from "@/types/unified";

interface UnifiedAdminPanelProps {
  className?: string;
}

type AdminView =
  | "dashboard"
  | "territories"
  | "users"
  | "assignments"
  | "phones"
  | "statistics"
  | "tools"
  | "settings";

const UnifiedAdminPanel: React.FC<UnifiedAdminPanelProps> = ({ className }) => {
  const {
    state,
    createTerritory,
    updateTerritory,
    deleteTerritory,
    createBlock,
    updateBlock,
    deleteBlock,
    createAddress,
    updateAddress,
    deleteAddress,
    createPhone,
    updatePhone,
    deletePhone,
    bulkImportPhones,
    createUser,
    updateUser,
    deleteUser,
    promoteUser,
    updateUserCredentials,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    returnAssignment,
    getStats,
    checkUserPermission,
  } = useUnifiedApp();

  const [currentView, setCurrentView] = useState<AdminView>("dashboard");
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<string>("");
  const [selectedBlockId, setSelectedBlockId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  // Form states
  const [showCreateTerritoryForm, setShowCreateTerritoryForm] = useState(false);
  const [showCreateBlockForm, setShowCreateBlockForm] = useState(false);
  const [showCreateAddressForm, setShowCreateAddressForm] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userModalMode, setUserModalMode] = useState<"create" | "edit">(
    "create"
  );
  const [selectedUserForEdit, setSelectedUserForEdit] =
    useState<AppUser | null>(null);
  const [showCreateAssignmentForm, setShowCreateAssignmentForm] =
    useState(false);
  const [showBulkImportForm, setShowBulkImportForm] = useState(false);

  const [territoryForm, setTerritoryForm] = useState<CreateTerritoryRequest>({
    numero: 0,
    descripcion: "",
  });

  const [blockForm, setBlockForm] = useState<CreateBlockRequest>({
    numero: 0,
    territoryId: "",
    notas: "",
  });

  const [addressForm, setAddressForm] = useState<CreateAddressRequest>({
    direccion: "",
    blockId: "",
    notas: "",
  });

  const [userForm, setUserForm] = useState<CreateUserRequest>({
    phoneNumber: "",
    fullName: "",
    role: "conductor",
    notes: "",
  });

  const [assignmentForm, setAssignmentForm] = useState<CreateAssignmentRequest>(
    {
      conductorId: "",
      territoryId: "",
      blockIds: [],
      notas: "",
    }
  );

  const [bulkImportText, setBulkImportText] = useState("");

  const stats = getStats();

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [territoryFilter, setTerritoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Reset error/success messages after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError("");
        setSuccess("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  const handleError = (message: string) => {
    setError(message);
    setIsLoading(false);
  };

  const handleSuccess = (message: string) => {
    setSuccess(message);
    setIsLoading(false);
  };

  // Territory functions
  const handleCreateTerritory = async () => {
    if (!territoryForm.numero) {
      handleError("El número del territorio es requerido");
      return;
    }

    setIsLoading(true);
    try {
      await createTerritory(territoryForm);
      handleSuccess("Territorio creado exitosamente");
      setShowCreateTerritoryForm(false);
      setTerritoryForm({ numero: 0, descripcion: "" });
    } catch (err) {
      handleError(`Error al crear territorio: ${err}`);
    }
  };

  const handleDeleteTerritory = async (territoryId: string) => {
    if (
      !confirm(
        "¿Está seguro de eliminar este territorio? Esta acción no se puede deshacer."
      )
    ) {
      return;
    }

    setIsLoading(true);
    try {
      await deleteTerritory(territoryId);
      handleSuccess("Territorio eliminado exitosamente");
    } catch (err) {
      handleError(`Error al eliminar territorio: ${err}`);
    }
  };

  // Block functions
  const handleCreateBlock = async () => {
    if (!blockForm.numero || !blockForm.territoryId) {
      handleError("El número y territorio son requeridos");
      return;
    }

    setIsLoading(true);
    try {
      await createBlock(blockForm);
      handleSuccess("Manzana creada exitosamente");
      setShowCreateBlockForm(false);
      setBlockForm({ numero: 0, territoryId: "", notas: "" });
    } catch (err) {
      handleError(`Error al crear manzana: ${err}`);
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    if (!confirm("¿Está seguro de eliminar esta manzana?")) {
      return;
    }

    setIsLoading(true);
    try {
      await deleteBlock(blockId);
      handleSuccess("Manzana eliminada exitosamente");
    } catch (err) {
      handleError(`Error al eliminar manzana: ${err}`);
    }
  };

  // Address functions
  const handleCreateAddress = async () => {
    if (!addressForm.direccion || !addressForm.blockId) {
      handleError("La dirección y manzana son requeridas");
      return;
    }

    setIsLoading(true);
    try {
      await createAddress(addressForm);
      handleSuccess("Dirección creada exitosamente");
      setShowCreateAddressForm(false);
      setAddressForm({ direccion: "", blockId: "", notas: "" });
    } catch (err) {
      handleError(`Error al crear dirección: ${err}`);
    }
  };

  // User functions
  const handleCreateUser = async () => {
    if (!userForm.phoneNumber || !userForm.fullName) {
      handleError("El teléfono y nombre completo son requeridos");
      return;
    }

    setIsLoading(true);
    try {
      await createUser(userForm);
      handleSuccess("Usuario creado exitosamente");
      setShowUserModal(false);
      setUserForm({
        phoneNumber: "",
        fullName: "",
        role: "conductor",
        notes: "",
      });
    } catch (err) {
      handleError(`Error al crear usuario: ${err}`);
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUserForEdit || !userForm.phoneNumber || !userForm.fullName) {
      handleError("El teléfono y nombre completo son requeridos");
      return;
    }

    setIsLoading(true);
    try {
      // Update user information using updateUser
      await updateUser({
        uid: selectedUserForEdit.uid,
        phoneNumber: userForm.phoneNumber,
        fullName: userForm.fullName,
        role: userForm.role as UserRole,
        notes: userForm.notes,
      });

      handleSuccess("Usuario actualizado exitosamente");
      setShowUserModal(false);
      setSelectedUserForEdit(null);
      setUserForm({
        phoneNumber: "",
        fullName: "",
        role: "conductor",
        notes: "",
      });
    } catch (err) {
      handleError(`Error al actualizar usuario: ${err}`);
    }
  };

  const handlePromoteUser = async (uid: string, newRole: UserRole) => {
    if (
      !confirm(`¿Está seguro de cambiar el rol de este usuario a ${newRole}?`)
    ) {
      return;
    }

    setIsLoading(true);
    try {
      await promoteUser(uid, newRole);
      handleSuccess("Rol actualizado exitosamente");
    } catch (err) {
      handleError(`Error al actualizar rol: ${err}`);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (!confirm("¿Está seguro de eliminar este usuario?")) {
      return;
    }

    setIsLoading(true);
    try {
      await deleteUser(uid);
      handleSuccess("Usuario eliminado exitosamente");
    } catch (err) {
      handleError(`Error al eliminar usuario: ${err}`);
    }
  };

  // Assignment functions
  const handleCreateAssignment = async () => {
    if (
      !assignmentForm.conductorId ||
      !assignmentForm.territoryId ||
      assignmentForm.blockIds.length === 0
    ) {
      handleError(
        "Conductor, territorio y al menos una manzana son requeridos"
      );
      return;
    }

    setIsLoading(true);
    try {
      await createAssignment(assignmentForm);
      handleSuccess("Asignación creada exitosamente");
      setShowCreateAssignmentForm(false);
      setAssignmentForm({
        conductorId: "",
        territoryId: "",
        blockIds: [],
        notas: "",
      });
    } catch (err) {
      handleError(`Error al crear asignación: ${err}`);
    }
  };

  const handleReturnAssignment = async (assignmentId: string) => {
    const reason = prompt("Razón de devolución (opcional):");

    setIsLoading(true);
    try {
      await returnAssignment(assignmentId, reason || undefined);
      handleSuccess("Asignación devuelta exitosamente");
    } catch (err) {
      handleError(`Error al devolver asignación: ${err}`);
    }
  };

  // Bulk import functions
  const handleBulkImport = async () => {
    if (!bulkImportText.trim()) {
      handleError("Debe ingresar datos para importar");
      return;
    }

    const lines = bulkImportText.trim().split("\n");
    const phones: TelephoneBulkImport[] = [];

    for (const line of lines) {
      const parts = line.split("\t"); // Tab-separated
      if (parts.length >= 3) {
        phones.push({
          nombre: parts[0].trim(),
          direccion: parts[1].trim(),
          telefono: parts[2].trim(),
          estado: (parts[3]?.trim() as TelephoneStatus) || "",
          notas: parts[4]?.trim(),
        });
      }
    }

    if (phones.length === 0) {
      handleError("No se encontraron registros válidos para importar");
      return;
    }

    setIsLoading(true);
    try {
      await bulkImportPhones(phones);
      handleSuccess(`${phones.length} teléfonos importados exitosamente`);
      setShowBulkImportForm(false);
      setBulkImportText("");
    } catch (err) {
      handleError(`Error al importar teléfonos: ${err}`);
    }
  };

  // Phone functions
  const handleUpdatePhoneStatus = async (
    phoneId: string,
    status: TelephoneStatus
  ) => {
    setIsLoading(true);
    try {
      await updatePhone(phoneId, { estado: status, modificadoEn: new Date() });
      handleSuccess("Estado actualizado exitosamente");
    } catch (err) {
      handleError(`Error al actualizar estado: ${err}`);
    }
  };

  // Render functions
  const renderNavigation = () => {
    const menuItems = [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: "📊",
        description: "Vista general del sistema",
      },
      {
        id: "territories",
        label: "Territorios",
        icon: "🗺️",
        description: "Gestión de territorios",
      },
      ...(checkUserPermission("users.read")
        ? [
            {
              id: "users",
              label: "Usuarios",
              icon: "👥",
              description: "Administrar usuarios",
            },
          ]
        : []),
      {
        id: "assignments",
        label: "Asignaciones",
        icon: "📋",
        description: "Gestión de asignaciones",
      },
      {
        id: "phones",
        label: "Teléfonos",
        icon: "📞",
        description: "Números telefónicos",
      },
      {
        id: "statistics",
        label: "Estadísticas",
        icon: "📈",
        description: "Análisis y reportes",
      },
      {
        id: "tools",
        label: "Herramientas",
        icon: "🔧",
        description: "Exportación y utilidades",
      },
      {
        id: "settings",
        label: "Configuración",
        icon: "⚙️",
        description: "Configuración del sistema",
      },
    ];

    return (
      <nav className="bg-gradient-to-r from-blue-50 to-indigo-50 shadow-lg border-b border-blue-100">
        <div className="max-w-7xl mx-auto px-6">
          {/* Header Section */}
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <div className="bg-blue-600 p-3 rounded-xl shadow-md">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Panel de Administración
                </h1>
                <p className="text-sm text-gray-600">
                  Sistema de Gestión Territorial
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center space-x-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
                />
                <svg
                  className="w-5 h-5 text-gray-400 absolute left-3 top-2.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>

              <button
                onClick={() => window.location.reload()}
                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-white rounded-lg transition-colors"
                title="Actualizar"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex space-x-1 pb-4">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id as AdminView)}
                className={`group relative px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  currentView === item.id
                    ? "bg-white text-blue-700 shadow-md border border-blue-100"
                    : "text-gray-700 hover:text-blue-600 hover:bg-white/50 hover:shadow-sm"
                }`}
                title={item.description}
              >
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                  {currentView === item.id && (
                    <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-1 bg-blue-600 rounded-full"></div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </nav>
    );
  };

  const renderDashboard = () => (
    <div className="bg-gray-50 min-h-screen">
      {/* Header Section */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Dashboard Administrativo
              </h1>
              <p className="text-lg text-gray-600">
                Bienvenido al panel de control del sistema
              </p>
            </div>
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-4 rounded-xl shadow-lg">
              <div className="text-2xl font-bold">
                {new Date().toLocaleDateString()}
              </div>
              <div className="text-sm opacity-90">
                Última actualización: {new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          {/* Territorios Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-blue-100 p-3 rounded-xl">
                <svg
                  className="w-6 h-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                  />
                </svg>
              </div>
              <button
                onClick={() => setCurrentView("territories")}
                className="text-blue-600 hover:text-blue-700 font-medium text-sm"
              >
                Ver todos →
              </button>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-1">
                Territorios
              </h3>
              <p className="text-3xl font-bold text-gray-900 mb-2">
                {stats.territories.total}
              </p>
              <div className="flex items-center space-x-4 text-sm">
                <span className="text-green-600 font-medium">
                  ✓ {stats.territories.active} activos
                </span>
                <span className="text-gray-500">
                  • {stats.territories.total - stats.territories.active}{" "}
                  inactivos
                </span>
              </div>
            </div>
          </div>

          {/* Usuarios Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-green-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-green-100 p-3 rounded-xl">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
                  />
                </svg>
              </div>
              <button
                onClick={() => setCurrentView("users")}
                className="text-green-600 hover:text-green-700 font-medium text-sm"
              >
                Gestionar →
              </button>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-1">
                Usuarios
              </h3>
              <p className="text-3xl font-bold text-gray-900 mb-2">
                {stats.users.total}
              </p>
              <div className="flex items-center space-x-4 text-sm">
                <span className="text-green-600 font-medium">
                  ✓ {stats.users.active} activos
                </span>
                <span className="text-gray-500">
                  • {stats.users.total - stats.users.active} inactivos
                </span>
              </div>
            </div>
          </div>

          {/* Asignaciones Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-purple-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-purple-100 p-3 rounded-xl">
                <svg
                  className="w-6 h-6 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                  />
                </svg>
              </div>
              <button
                onClick={() => setCurrentView("assignments")}
                className="text-purple-600 hover:text-purple-700 font-medium text-sm"
              >
                Ver todas →
              </button>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-1">
                Asignaciones
              </h3>
              <p className="text-3xl font-bold text-gray-900 mb-2">
                {stats.assignments.active}
              </p>
              <div className="flex items-center space-x-4 text-sm">
                <span className="text-green-600 font-medium">
                  ✓ {stats.assignments.completed} completadas
                </span>
                <span className="text-gray-500">
                  • {stats.assignments.active} activas
                </span>
              </div>
            </div>
          </div>

          {/* Teléfonos Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-orange-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-orange-100 p-3 rounded-xl">
                <svg
                  className="w-6 h-6 text-orange-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
              </div>
              <button
                onClick={() => setCurrentView("phones")}
                className="text-orange-600 hover:text-orange-700 font-medium text-sm"
              >
                Gestionar →
              </button>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-1">
                Teléfonos
              </h3>
              <p className="text-3xl font-bold text-gray-900 mb-2">
                {stats.phones.total}
              </p>
              <div className="flex items-center space-x-4 text-sm">
                <span className="text-green-600 font-medium">
                  ✓ {stats.phones.contacted} contactados
                </span>
                <span className="text-gray-500">
                  • {stats.phones.total - stats.phones.contacted} pendientes
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Quick Actions */}
          <div className="bg-white rounded-2xl shadow-sm border">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                🚀 Acciones Rápidas
              </h2>
              <p className="text-gray-600">
                Operaciones más frecuentes del sistema
              </p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    setCurrentView("territories");
                    setShowCreateTerritoryForm(true);
                  }}
                  className="group p-4 border-2 border-dashed border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all"
                >
                  <div className="text-center">
                    <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">
                      🗺️
                    </div>
                    <p className="font-semibold text-gray-900 mb-1">
                      Crear Territorio
                    </p>
                    <p className="text-sm text-gray-500">
                      Agregar nuevo territorio al sistema
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setCurrentView("users");
                    setUserModalMode("create");
                    setShowUserModal(true);
                  }}
                  className="group p-4 border-2 border-dashed border-gray-200 rounded-xl hover:border-green-300 hover:bg-green-50 transition-all"
                >
                  <div className="text-center">
                    <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">
                      👤
                    </div>
                    <p className="font-semibold text-gray-900 mb-1">
                      Crear Usuario
                    </p>
                    <p className="text-sm text-gray-500">
                      Agregar nuevo usuario al sistema
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setCurrentView("phones");
                    setShowBulkImportForm(true);
                  }}
                  className="group p-4 border-2 border-dashed border-gray-200 rounded-xl hover:border-orange-300 hover:bg-orange-50 transition-all"
                >
                  <div className="text-center">
                    <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">
                      📞
                    </div>
                    <p className="font-semibold text-gray-900 mb-1">
                      Importar Teléfonos
                    </p>
                    <p className="text-sm text-gray-500">
                      Importación masiva de números
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => setCurrentView("statistics")}
                  className="group p-4 border-2 border-dashed border-gray-200 rounded-xl hover:border-purple-300 hover:bg-purple-50 transition-all"
                >
                  <div className="text-center">
                    <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">
                      📈
                    </div>
                    <p className="font-semibold text-gray-900 mb-1">
                      Ver Estadísticas
                    </p>
                    <p className="text-sm text-gray-500">Análisis y reportes</p>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Recent Activity Panel */}
          <div className="bg-white rounded-2xl shadow-sm border">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                📋 Actividad Reciente
              </h2>
              <p className="text-gray-600">Últimas acciones en el sistema</p>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-4 p-3 bg-blue-50 rounded-lg">
                  <div className="bg-blue-100 p-2 rounded-full">
                    <svg
                      className="w-4 h-4 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      Sistema inicializado
                    </p>
                    <p className="text-xs text-gray-500">
                      Panel administrativo cargado correctamente
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">Ahora</span>
                </div>

                <div className="flex items-center space-x-4 p-3 bg-green-50 rounded-lg">
                  <div className="bg-green-100 p-2 rounded-full">
                    <svg
                      className="w-4 h-4 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      Estadísticas actualizadas
                    </p>
                    <p className="text-xs text-gray-500">
                      Datos del sistema sincronizados
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">Hace 1 min</span>
                </div>

                <div className="flex items-center justify-center py-4">
                  <button
                    onClick={() => setCurrentView("statistics")}
                    className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                  >
                    Ver todo el historial →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="bg-white rounded-2xl shadow-sm border">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              🛡️ Estado del Sistema
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-xl">
                <div className="text-2xl mb-2">✅</div>
                <div className="font-medium text-green-700">Sistema Activo</div>
                <div className="text-sm text-green-600">
                  Funcionando correctamente
                </div>
              </div>

              <div className="text-center p-4 bg-blue-50 rounded-xl">
                <div className="text-2xl mb-2">🔄</div>
                <div className="font-medium text-blue-700">Sincronización</div>
                <div className="text-sm text-blue-600">Datos actualizados</div>
              </div>

              <div className="text-center p-4 bg-purple-50 rounded-xl">
                <div className="text-2xl mb-2">🎯</div>
                <div className="font-medium text-purple-700">Rendimiento</div>
                <div className="text-sm text-purple-600">Óptimo</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTerritories = () => (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Gestión de Territorios
          </h2>
          <p className="text-gray-600">Administrar territorios y manzanas</p>
        </div>
        <button
          onClick={() => setShowCreateTerritoryForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Crear Territorio
        </button>
      </div>

      {/* Territory Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Seleccionar Territorio
        </label>
        <select
          value={selectedTerritoryId}
          onChange={(e) => setSelectedTerritoryId(e.target.value)}
          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">-- Seleccionar Territorio --</option>
          {Object.values(state.territories).map((territory) => (
            <option key={territory.id} value={territory.id}>
              Territorio {territory.numero} -{" "}
              {territory.descripcion || "Sin descripción"}
            </option>
          ))}
        </select>
      </div>

      {/* Territory Details */}
      {selectedTerritoryId && state.territories[selectedTerritoryId] && (
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="p-6 border-b">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Territorio {state.territories[selectedTerritoryId].numero}
              </h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowCreateBlockForm(true)}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                >
                  + Agregar Manzana
                </button>
                <button
                  onClick={() => handleDeleteTerritory(selectedTerritoryId)}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Eliminar Territorio
                </button>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Información</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <strong>Número:</strong>{" "}
                    {state.territories[selectedTerritoryId].numero}
                  </div>
                  <div>
                    <strong>Descripción:</strong>{" "}
                    {state.territories[selectedTerritoryId].descripcion ||
                      "No disponible"}
                  </div>
                  <div>
                    <strong>Total Manzanas:</strong>{" "}
                    {state.territories[selectedTerritoryId].totalManzanas}
                  </div>
                  <div>
                    <strong>Estado:</strong>
                    <span
                      className={`ml-1 px-2 py-1 rounded text-xs ${
                        state.territories[selectedTerritoryId].activo
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {state.territories[selectedTerritoryId].activo
                        ? "Activo"
                        : "Inactivo"}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Manzanas</h4>
                <div className="max-h-40 overflow-y-auto">
                  {Object.values(state.blocks)
                    .filter(
                      (block) => block.territoryId === selectedTerritoryId
                    )
                    .map((block) => (
                      <div
                        key={block.id}
                        className="flex justify-between items-center p-2 border-b"
                      >
                        <span>Manzana {block.numero}</span>
                        <div className="flex space-x-1">
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              block.estado === "pendiente"
                                ? "bg-gray-100 text-gray-800"
                                : block.estado === "asignado"
                                ? "bg-blue-100 text-blue-800"
                                : block.estado === "trabajado"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            {block.estado}
                          </span>
                          <button
                            onClick={() => handleDeleteBlock(block.id)}
                            className="text-red-600 hover:text-red-800 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Territory Form */}
      {showCreateTerritoryForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">
              Crear Nuevo Territorio
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número del Territorio *
                </label>
                <input
                  type="number"
                  value={territoryForm.numero || ""}
                  onChange={(e) =>
                    setTerritoryForm({
                      ...territoryForm,
                      numero: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej: 1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <textarea
                  value={territoryForm.descripcion || ""}
                  onChange={(e) =>
                    setTerritoryForm({
                      ...territoryForm,
                      descripcion: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Descripción del territorio..."
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateTerritoryForm(false);
                  setTerritoryForm({ numero: 0, descripcion: "" });
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateTerritory}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? "Creando..." : "Crear Territorio"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Block Form */}
      {showCreateBlockForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Crear Nueva Manzana</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de Manzana *
                </label>
                <input
                  type="number"
                  value={blockForm.numero || ""}
                  onChange={(e) =>
                    setBlockForm({
                      ...blockForm,
                      numero: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej: 1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Territorio *
                </label>
                <select
                  value={blockForm.territoryId}
                  onChange={(e) =>
                    setBlockForm({
                      ...blockForm,
                      territoryId: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">-- Seleccionar Territorio --</option>
                  {Object.values(state.territories).map((territory) => (
                    <option key={territory.id} value={territory.id}>
                      Territorio {territory.numero}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas
                </label>
                <textarea
                  value={blockForm.notas || ""}
                  onChange={(e) =>
                    setBlockForm({
                      ...blockForm,
                      notas: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                  placeholder="Notas adicionales..."
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateBlockForm(false);
                  setBlockForm({ numero: 0, territoryId: "", notas: "" });
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateBlock}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? "Creando..." : "Crear Manzana"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderUsers = () => (
    <div className="bg-gradient-to-br from-gray-50 to-white min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="bg-white rounded-lg p-6 shadow-md border border-gray-200">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              Gestión de Usuarios
            </h2>
            <p className="text-gray-600 mt-2">
              {checkUserPermission("users.create")
                ? "Administrar usuarios y roles (Solo Super Admin)"
                : "Visualizar usuarios (Solo lectura)"}
            </p>
          </div>
          {checkUserPermission("users.create") && (
            <button
              onClick={() => {
                setUserModalMode("create");
                setSelectedUserForEdit(null);
                setShowUserModal(true);
              }}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
            >
              + Crear Usuario
            </button>
          )}
        </div>

        {/* Users List */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-gray-100 to-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">
                    Usuario
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">
                    Rol
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {Object.values(state.users).map((user, index) => (
                  <tr
                    key={user.uid}
                    className={`hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 ${
                      index % 2 === 0 ? "bg-gray-50" : "bg-white"
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                          {(user.fullName || user.displayName)
                            ?.charAt(0)
                            ?.toUpperCase() || "U"}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">
                            {user.fullName || user.displayName}
                          </div>
                          <div className="text-sm text-gray-600 font-medium">
                            {user.phoneNumber || user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-3 py-1 text-sm font-bold rounded-full shadow-sm ${
                          user.role === "super-admin"
                            ? "bg-gradient-to-r from-purple-500 to-purple-600 text-white"
                            : user.role === "admin"
                            ? "bg-gradient-to-r from-red-500 to-red-600 text-white"
                            : user.role === "conductor"
                            ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white"
                            : "bg-gradient-to-r from-green-500 to-green-600 text-white"
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-3 py-1 text-sm font-bold rounded-full shadow-sm ${
                          user.isActive
                            ? "bg-gradient-to-r from-green-500 to-green-600 text-white"
                            : "bg-gradient-to-r from-red-500 to-red-600 text-white"
                        }`}
                      >
                        <div
                          className={`w-2 h-2 rounded-full mr-2 ${
                            user.isActive ? "bg-green-200" : "bg-red-200"
                          }`}
                        ></div>
                        {user.isActive ? "Activo" : "Inactivo"}
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {checkUserPermission("users.promote") ? (
                          <select
                            onChange={(e) => {
                              if (e.target.value !== user.role) {
                                handlePromoteUser(
                                  user.uid,
                                  e.target.value as UserRole
                                );
                              }
                            }}
                            defaultValue={user.role}
                            className="text-xs border rounded px-2 py-1"
                          >
                            <option value="conductor">Conductor</option>
                            <option value="admin">Admin</option>
                            <option value="super-admin">Super Admin</option>
                          </select>
                        ) : (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {user.role}
                          </span>
                        )}

                        {checkUserPermission("users.update") && (
                          <button
                            onClick={() => {
                              setSelectedUserForEdit(user);
                              setUserForm({
                                phoneNumber: user.phoneNumber || "",
                                fullName: user.fullName || "",
                                role: user.role || "conductor",
                                notes: user.notes || "",
                              });
                              setUserModalMode("edit");
                              setShowUserModal(true);
                            }}
                            className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 hover:text-blue-800 text-sm font-medium rounded-md transition-all duration-200 shadow-sm hover:shadow-md"
                          >
                            Editar
                          </button>
                        )}

                        {checkUserPermission("users.delete") && (
                          <button
                            onClick={() => handleDeleteUser(user.uid)}
                            className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 hover:text-red-800 text-sm font-medium rounded-md transition-all duration-200 shadow-sm hover:shadow-md"
                          >
                            Eliminar
                          </button>
                        )}

                        {!checkUserPermission("users.delete") &&
                          !checkUserPermission("users.update") && (
                            <span className="px-3 py-1 bg-gray-100 text-gray-500 text-sm font-medium rounded-md">
                              Solo lectura
                            </span>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Unified User Modal */}
        {showUserModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-6 w-full max-w-md mx-4 shadow-2xl border border-gray-200">
              <h3 className="text-xl font-bold mb-6 text-gray-800 border-b border-gray-300 pb-3">
                {userModalMode === "create"
                  ? "Crear Nuevo Usuario"
                  : "Editar Usuario"}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Número de Teléfono *
                  </label>
                  <input
                    type="tel"
                    value={userForm.phoneNumber}
                    onChange={(e) =>
                      setUserForm({
                        ...userForm,
                        phoneNumber: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm transition-all duration-200"
                    placeholder="+593987654321"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    value={userForm.fullName}
                    onChange={(e) =>
                      setUserForm({
                        ...userForm,
                        fullName: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm transition-all duration-200"
                    placeholder="Nombre completo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Rol
                  </label>
                  <select
                    value={userForm.role}
                    onChange={(e) =>
                      setUserForm({
                        ...userForm,
                        role: e.target.value as UserRole,
                      })
                    }
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm transition-all duration-200"
                  >
                    <option value="conductor">Conductor</option>
                    <option value="admin">Admin</option>
                    <option value="super-admin">Super Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Notas
                  </label>
                  <textarea
                    value={userForm.notes || ""}
                    onChange={(e) =>
                      setUserForm({
                        ...userForm,
                        notes: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm transition-all duration-200 resize-none"
                    rows={3}
                    placeholder="Notas adicionales..."
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-4 mt-8 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowUserModal(false);
                    setUserForm({
                      phoneNumber: "",
                      fullName: "",
                      role: "conductor",
                      notes: "",
                    });
                  }}
                  className="px-6 py-3 text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-all duration-200 shadow-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={
                    userModalMode === "create"
                      ? handleCreateUser
                      : handleUpdateUser
                  }
                  disabled={isLoading}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  {isLoading
                    ? userModalMode === "create"
                      ? "Creando..."
                      : "Actualizando..."
                    : userModalMode === "create"
                    ? "Crear Usuario"
                    : "Actualizar Usuario"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit User Credentials Form - REMOVED - Now using unified modal */}
      </div>
    </div>
  );

  const renderPhones = () => (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Gestión de Teléfonos
          </h2>
          <p className="text-gray-600">Administrar números telefónicos</p>
        </div>
        <button
          onClick={() => setShowBulkImportForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          📁 Importar Teléfonos
        </button>
      </div>

      {/* Phone Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-semibold text-gray-900">
            {stats.phones.total}
          </div>
          <div className="text-sm text-gray-600">Total Teléfonos</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-semibold text-green-600">
            {stats.phones.contacted}
          </div>
          <div className="text-sm text-gray-600">Contactados</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-semibold text-yellow-600">
            {stats.phones.pending}
          </div>
          <div className="text-sm text-gray-600">Pendientes</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-semibold text-red-600">
            {stats.phones.blocked}
          </div>
          <div className="text-sm text-gray-600">Bloqueados</div>
        </div>
      </div>

      {/* Phones List */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Teléfono
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dirección
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Object.values(state.phoneNumbers)
                .slice(0, 50)
                .map((phone) => (
                  <tr key={phone.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {phone.nombre}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {phone.telefono}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {phone.direccion}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={phone.estado}
                        onChange={(e) =>
                          handleUpdatePhoneStatus(
                            phone.id,
                            e.target.value as TelephoneStatus
                          )
                        }
                        className="text-xs border rounded px-2 py-1"
                      >
                        <option value="">Sin estado</option>
                        <option value="Contestaron">Contestaron</option>
                        <option value="No contestaron">No contestaron</option>
                        <option value="Colgaron">Colgaron</option>
                        <option value="No llamar">No llamar</option>
                        <option value="Revisita">Revisita</option>
                        <option value="Estudio">Estudio</option>
                        <option value="Testigo">Testigo</option>
                        <option value="Suspendido">Suspendido</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => deletePhone(phone.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Import Form */}
      {showBulkImportForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              Importar Teléfonos Masivamente
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Pegue los datos separados por tabulaciones en el formato: Nombre |
              Dirección | Teléfono | Estado | Notas
            </p>
            <textarea
              value={bulkImportText}
              onChange={(e) => setBulkImportText(e.target.value)}
              className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              placeholder="Juan Pérez	Av. Principal 123	0987654321	Contestaron	Interesado&#10;María García	Calle Secundaria 456	0998765432		&#10;..."
            />
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowBulkImportForm(false);
                  setBulkImportText("");
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkImport}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? "Importando..." : "Importar Teléfonos"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderStatistics = () => (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto p-6">
        <AdvancedStats />
      </div>
    </div>
  );

  const renderTools = () => (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            � Herramientas Avanzadas
          </h1>
          <p className="text-lg text-gray-600">
            Exportación de datos y utilidades del sistema
          </p>
        </div>

        <div className="space-y-8">
          <ExportTools />

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-blue-100 p-3 rounded-xl">
                  <svg
                    className="w-6 h-6 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Backup Sistema
                </h3>
              </div>
              <p className="text-gray-600 mb-4">
                Crear respaldo completo de todos los datos del sistema
              </p>
              <button className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                Crear Backup
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-green-100 p-3 rounded-xl">
                  <svg
                    className="w-6 h-6 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Validar Datos
                </h3>
              </div>
              <p className="text-gray-600 mb-4">
                Verificar integridad y consistencia de datos
              </p>
              <button className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
                Ejecutar Validación
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-purple-100 p-3 rounded-xl">
                  <svg
                    className="w-6 h-6 text-purple-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Optimización
                </h3>
              </div>
              <p className="text-gray-600 mb-4">
                Optimizar rendimiento y limpiar datos obsoletos
              </p>
              <button className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
                Optimizar Sistema
              </button>
            </div>
          </div>

          {/* System Information */}
          <div className="bg-white rounded-2xl shadow-sm border">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                � Información del Sistema
              </h2>
              <p className="text-gray-600">Estado actual y detalles técnicos</p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 mb-1">
                    v2.1.0
                  </div>
                  <div className="text-sm text-gray-600">
                    Versión del Sistema
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 mb-1">
                    99.9%
                  </div>
                  <div className="text-sm text-gray-600">Tiempo Activo</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600 mb-1">
                    {new Date().toLocaleDateString()}
                  </div>
                  <div className="text-sm text-gray-600">
                    Última Actualización
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600 mb-1">
                    PWA
                  </div>
                  <div className="text-sm text-gray-600">
                    Tipo de Aplicación
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Configuración del Sistema
            </h2>
            <p className="text-gray-600 mt-1">
              Administra las configuraciones generales de la aplicación
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Configuración de Usuario */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-100">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-semibold">👤</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 ml-3">
                  Perfil de Usuario
                </h3>
              </div>
              <p className="text-gray-700 mb-4">
                Gestiona tu información personal y preferencias de cuenta
              </p>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                Editar Perfil
              </button>
            </div>

            {/* Configuración de Seguridad */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-6 border border-green-100">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-semibold">🔒</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 ml-3">
                  Seguridad
                </h3>
              </div>
              <p className="text-gray-700 mb-4">
                Administra contraseñas y configuraciones de seguridad
              </p>
              <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
                Configurar
              </button>
            </div>

            {/* Configuración de Notificaciones */}
            <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-lg p-6 border border-purple-100">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-semibold">🔔</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 ml-3">
                  Notificaciones
                </h3>
              </div>
              <p className="text-gray-700 mb-4">
                Controla qué notificaciones recibes y cómo
              </p>
              <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
                Personalizar
              </button>
            </div>

            {/* Configuración del Sistema */}
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg p-6 border border-orange-100">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-semibold">⚙️</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 ml-3">
                  Sistema
                </h3>
              </div>
              <p className="text-gray-700 mb-4">
                Configuraciones avanzadas del sistema y base de datos
              </p>
              <button className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors">
                Avanzado
              </button>
            </div>
          </div>

          {/* Información del Sistema */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Información del Sistema
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <span className="text-sm font-medium text-gray-500">
                  Versión
                </span>
                <p className="text-lg font-semibold text-gray-900">1.0.0</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <span className="text-sm font-medium text-gray-500">
                  Usuario Actual
                </span>
                <p className="text-lg font-semibold text-gray-900">
                  {state.currentUser?.fullName ||
                    state.currentUser?.displayName ||
                    "N/A"}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <span className="text-sm font-medium text-gray-500">Rol</span>
                <p className="text-lg font-semibold text-gray-900">
                  {state.currentUser?.role || "N/A"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (currentView) {
      case "dashboard":
        return renderDashboard();
      case "territories":
        return renderTerritories();
      case "users":
        return renderUsers();
      case "assignments":
        return renderDashboard(); // TODO: Implement renderAssignments
      case "phones":
        return renderPhones();
      case "statistics":
        return renderStatistics();
      case "tools":
        return renderTools();
      case "settings":
        return renderSettings();
      default:
        return renderDashboard();
    }
  };

  // Mostrar pantalla de login si no hay usuario autenticado
  if (!state.currentUser || !state.isAuthenticated) {
    return <LoginScreen />;
  }

  // Verificar permisos solo después de estar autenticado
  if (!checkUserPermission("users.read")) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Acceso Denegado
          </h2>
          <p className="text-gray-600">
            No tiene permisos para acceder al panel de administración.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-50 ${className}`}>
      {renderNavigation()}

      {/* Error/Success Messages */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          <div className="flex items-center">
            <span className="mr-2">❌</span>
            {error}
          </div>
        </div>
      )}

      {success && (
        <div className="mx-6 mt-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          <div className="flex items-center">
            <span className="mr-2">✅</span>
            {success}
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-40">
          <div className="bg-white p-6 rounded-lg flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-gray-700">Procesando...</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      {renderContent()}
    </div>
  );
};

export default UnifiedAdminPanel;
