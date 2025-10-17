"use client";

import React, { useState } from "react";
import {
  Users,
  UserPlus,
  Edit3,
  Trash2,
  Phone,
  Shield,
  LogOut,
  Save,
  X,
  Search,
  Settings,
  MapPin,
} from "lucide-react";

interface AdminDashboardProps {
  user: any;
  onLogout: () => void;
}

interface Conductor {
  id: number;
  nombre: string;
  telefono: string;
  fechaCreacion: string;
  activo: boolean;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
  const [conductores, setConductores] = useState<Conductor[]>([
    {
      id: 1,
      nombre: "Juan Pérez",
      telefono: "0991234567",
      fechaCreacion: "2024-01-15",
      activo: true,
    },
    {
      id: 2,
      nombre: "María González",
      telefono: "0987654321",
      fechaCreacion: "2024-01-20",
      activo: true,
    },
    {
      id: 3,
      nombre: "Carlos Rodriguez",
      telefono: "0999876543",
      fechaCreacion: "2024-01-25",
      activo: false,
    },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedConductor, setSelectedConductor] = useState<Conductor | null>(null);
  const [formData, setFormData] = useState({ nombre: "", telefono: "" });
  const [searchTerm, setSearchTerm] = useState("");

  const isSuperAdmin = user.role === "super-admin";

  const handleCreateConductor = () => {
    if (!isSuperAdmin) return;
    setModalMode("create");
    setFormData({ nombre: "", telefono: "" });
    setShowModal(true);
  };

  const handleEditConductor = (conductor: Conductor) => {
    if (!isSuperAdmin) return;
    setModalMode("edit");
    setSelectedConductor(conductor);
    setFormData({ nombre: conductor.nombre, telefono: conductor.telefono });
    setShowModal(true);
  };

  const handleDeleteConductor = (id: number) => {
    if (!isSuperAdmin) return;
    if (confirm("¿Estás seguro de que quieres eliminar este conductor?")) {
      setConductores(conductores.filter((c) => c.id !== id));
    }
  };

  const handleSaveConductor = () => {
    if (!formData.nombre || !formData.telefono) return;

    if (modalMode === "create") {
      const newConductor: Conductor = {
        id: Date.now(),
        nombre: formData.nombre,
        telefono: formData.telefono,
        fechaCreacion: new Date().toISOString().split("T")[0],
        activo: true,
      };
      setConductores([...conductores, newConductor]);
    } else if (modalMode === "edit" && selectedConductor) {
      setConductores(
        conductores.map((c) =>
          c.id === selectedConductor.id
            ? { ...c, nombre: formData.nombre, telefono: formData.telefono }
            : c
        )
      );
    }

    setShowModal(false);
    setFormData({ nombre: "", telefono: "" });
    setSelectedConductor(null);
  };

  const filteredConductores = conductores.filter(
    (conductor) =>
      conductor.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conductor.telefono.includes(searchTerm)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-xl border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">
                  Dashboard Administrador
                </h1>
                <p className="text-white/60 text-sm">
                  {user.role === "super-admin" ? "Super Administrador" : "Administrador"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-white/80 text-sm">{user.nombre}</span>
              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-white/60 text-sm">Total Conductores</p>
                <p className="text-2xl font-bold text-white">{conductores.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-white/60 text-sm">Activos</p>
                <p className="text-2xl font-bold text-white">
                  {conductores.filter((c) => c.activo).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <MapPin className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="text-white/60 text-sm">Asignaciones</p>
                <p className="text-2xl font-bold text-white">0</p>
              </div>
            </div>
          </div>
        </div>

        {/* Conductores Section */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl">
          {/* Section Header */}
          <div className="p-6 border-b border-white/10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-xl font-semibold text-white">
                Gestión de Conductores
              </h2>
              
              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar conductor..."
                    className="pl-10 pr-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                  />
                </div>

                {/* Create Button */}
                {isSuperAdmin && (
                  <button
                    onClick={handleCreateConductor}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-medium rounded-lg transition-all"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span className="hidden sm:inline">Nuevo Conductor</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Conductores Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-4 px-6 text-white/80 font-medium">
                    Conductor
                  </th>
                  <th className="text-left py-4 px-6 text-white/80 font-medium">
                    Teléfono
                  </th>
                  <th className="text-left py-4 px-6 text-white/80 font-medium">
                    Fecha Creación
                  </th>
                  <th className="text-left py-4 px-6 text-white/80 font-medium">
                    Estado
                  </th>
                  {isSuperAdmin && (
                    <th className="text-right py-4 px-6 text-white/80 font-medium">
                      Acciones
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredConductores.map((conductor) => (
                  <tr
                    key={conductor.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                          <Users className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-white font-medium">
                          {conductor.nombre}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-white/40" />
                        <span className="text-white/80">{conductor.telefono}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-white/60">
                      {conductor.fechaCreacion}
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          conductor.activo
                            ? "bg-green-500/20 text-green-300"
                            : "bg-gray-500/20 text-gray-400"
                        }`}
                      >
                        {conductor.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    {isSuperAdmin && (
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditConductor(conductor)}
                            className="p-2 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteConductor(conductor.id)}
                            className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredConductores.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-white/20 mx-auto mb-4" />
                <p className="text-white/60">
                  {searchTerm ? "No se encontraron conductores" : "No hay conductores registrados"}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modal for Create/Edit */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">
                  {modalMode === "create" ? "Nuevo Conductor" : "Editar Conductor"}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Nombre del conductor"
                  className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Número de Teléfono
                </label>
                <input
                  type="tel"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  placeholder="0991234567"
                  className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white/80 font-medium rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveConductor}
                  disabled={!formData.nombre || !formData.telefono}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-medium rounded-xl transition-all disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;