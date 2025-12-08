'use client';

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { UserRoleManager, UserRole } from '@/lib/userRoleManager';
import { ToastProvider } from './ui/ToastProfessional';
import Card from './ui/Card';
import Button from './ui/Button';
import Badge from './ui/Badge';

// Importar iconos de Lucide React
import { 
  Users, 
  MapPin, 
  Phone, 
  Settings, 
  BarChart3, 
  Shield,
  UserPlus,
  Activity,
  Clock,
  CheckCircle
} from 'lucide-react';

interface DashboardData {
  totalUsers: number;
  totalConductors: number;
  totalAdmins: number;
  totalTerritories: number;
  activeAssignments: number;
  completedAssignments: number;
}

const ProfessionalDashboard: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    totalUsers: 0,
    totalConductors: 0,
    totalAdmins: 0,
    totalTerritories: 0,
    activeAssignments: 0,
    completedAssignments: 0,
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

  const handleSignOut = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-secondary-50 to-primary-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-secondary-600">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-secondary-50 to-primary-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <div className="text-center">
            <Shield className="mx-auto h-12 w-12 text-primary-600 mb-4" />
            <h2 className="text-xl font-semibold text-secondary-900 mb-2">
              Acceso Requerido
            </h2>
            <p className="text-secondary-600 mb-4">
              Debes autenticarte para acceder al sistema
            </p>
            <Button variant="primary" size="lg" className="w-full">
              Iniciar Sesión
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const getRoleInfo = (role: UserRole | null) => {
    switch (role) {
      case 'super-admin':
        return { 
          label: 'Super Administrador', 
          variant: 'superadmin' as const,
          description: 'Acceso completo al sistema'
        };
      case 'admin':
        return { 
          label: 'Administrador', 
          variant: 'admin' as const,
          description: 'Gestión de usuarios y territorios'
        };
      case 'conductor':
        return { 
          label: 'Conductor', 
          variant: 'conductor' as const,
          description: 'Acceso a asignaciones'
        };
      default:
        return { 
          label: 'Sin rol', 
          variant: 'secondary' as const,
          description: 'Rol no asignado'
        };
    }
  };

  const roleInfo = getRoleInfo(userRole);

  const statCards = [
    {
      title: 'Total Usuarios',
      value: dashboardData.totalUsers,
      icon: Users,
      color: 'primary',
      change: '+12%',
    },
    {
      title: 'Conductores',
      value: dashboardData.totalConductors,
      icon: UserPlus,
      color: 'success',
      change: '+8%',
    },
    {
      title: 'Territorios',
      value: dashboardData.totalTerritories,
      icon: MapPin,
      color: 'warning',
      change: '+3%',
    },
    {
      title: 'Asignaciones Activas',
      value: dashboardData.activeAssignments,
      icon: Activity,
      color: 'error',
      change: '+15%',
    },
  ];

  return (
    <ToastProvider>
      <div className="min-h-screen bg-gradient-to-br from-secondary-50 to-primary-50">
        {/* Header */}
        <header className="bg-white shadow-soft border-b border-secondary-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <Shield className="h-8 w-8 text-primary-600 mr-3" />
                <h1 className="text-xl font-bold text-secondary-900">
                  Sistema de Conductores
                </h1>
              </div>
              <div className="flex items-center space-x-4">
                <Badge variant={roleInfo.variant}>
                  {roleInfo.label}
                </Badge>
                <div className="text-right">
                  <p className="text-sm font-medium text-secondary-900">
                    {user.displayName || user.email}
                  </p>
                  <p className="text-xs text-secondary-500">
                    {roleInfo.description}
                  </p>
                </div>
                <Button variant="ghost" onClick={handleSignOut}>
                  Cerrar Sesión
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Welcome Section */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-secondary-900 mb-2">
              Bienvenido, {user.displayName || 'Usuario'}
            </h2>
            <p className="text-secondary-600">
              Resumen del sistema y métricas principales
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {statCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Card key={index} hover className="relative overflow-hidden">
                  <div className="flex items-center">
                    <div className={`p-3 rounded-lg bg-${stat.color}-100`}>
                      <Icon className={`h-6 w-6 text-${stat.color}-600`} />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-secondary-600">
                        {stat.title}
                      </p>
                      <p className="text-2xl font-bold text-secondary-900">
                        {stat.value}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center">
                    <span className="text-success-600 text-sm font-medium">
                      {stat.change}
                    </span>
                    <span className="text-secondary-500 text-sm ml-2">
                      vs mes anterior
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Actions Panel */}
            <Card>
              <h3 className="text-lg font-semibold text-secondary-900 mb-4">
                Acciones Rápidas
              </h3>
              <div className="space-y-3">
                {(userRole === 'super-admin' || userRole === 'admin') && (
                  <>
                    <Button 
                      variant="primary" 
                      size="lg" 
                      className="w-full justify-start"
                      leftIcon={<UserPlus className="h-5 w-5" />}
                    >
                      Crear Usuario
                    </Button>
                    <Button 
                      variant="secondary" 
                      size="lg" 
                      className="w-full justify-start"
                      leftIcon={<MapPin className="h-5 w-5" />}
                    >
                      Gestionar Territorios
                    </Button>
                    <Button 
                      variant="secondary" 
                      size="lg" 
                      className="w-full justify-start"
                      leftIcon={<Phone className="h-5 w-5" />}
                    >
                      Asignar Números
                    </Button>
                  </>
                )}
                {userRole === 'super-admin' && (
                  <Button 
                    variant="warning" 
                    size="lg" 
                    className="w-full justify-start"
                    leftIcon={<Settings className="h-5 w-5" />}
                  >
                    Configuración del Sistema
                  </Button>
                )}
              </div>
            </Card>

            {/* Recent Activity */}
            <Card>
              <h3 className="text-lg font-semibold text-secondary-900 mb-4">
                Actividad Reciente
              </h3>
              <div className="space-y-4">
                <div className="flex items-center">
                  <div className="p-2 rounded-lg bg-success-100">
                    <CheckCircle className="h-4 w-4 text-success-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-secondary-900">
                      Nuevo usuario creado
                    </p>
                    <p className="text-xs text-secondary-500">Hace 2 minutos</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="p-2 rounded-lg bg-primary-100">
                    <MapPin className="h-4 w-4 text-primary-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-secondary-900">
                      Territorio actualizado
                    </p>
                    <p className="text-xs text-secondary-500">Hace 1 hora</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="p-2 rounded-lg bg-warning-100">
                    <Clock className="h-4 w-4 text-warning-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-secondary-900">
                      Asignación pendiente
                    </p>
                    <p className="text-xs text-secondary-500">Hace 3 horas</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </main>
      </div>
    </ToastProvider>
  );
};

export default ProfessionalDashboard;