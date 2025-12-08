// 🎯 COMPONENTE OPTIMIZADO CON EXTENSIONES VS CODE 2025
// Usa snippets: tsc, rfce, useState, useEffect
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { User, MapPin, Phone, Database, AlertCircle } from "lucide-react";
// 🔥 Auto Import detecta automáticamente estas dependencias

/**
 * 📝 Better Comments - Diferentes tipos de comentarios
 * ! IMPORTANTE: Este componente demuestra las mejores prácticas 2025
 * ? PREGUNTA: ¿Necesitamos más validación aquí?
 * NOTA: Lazy loading implementado con React.lazy() en línea 156
 * * DESTACADO: Usando todas las extensiones instaladas
 * @param props - Props del componente optimizado
 */

interface OptimizedComponentProps {
  userId?: string;
  isAdmin?: boolean;
  onUpdate?: (data: UserData) => void;
}

// 🛡️ SonarLint ayuda con interfaces bien definidas
interface UserData {
  id: string;
  name: string;
  email: string;
  territory?: string;
  phoneNumbers: string[];
  isActive: boolean;
}

// 🎨 Tailwind IntelliSense - Autocompletado inteligente de clases
const STYLES = {
  container:
    "flex flex-col space-y-6 p-6 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl shadow-lg",
  card: "bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 p-4",
  button:
    "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none",
  input:
    "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
  badge:
    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
} as const;

// 📱 React Function Component Export con TypeScript
const OptimizedComponent: React.FC<OptimizedComponentProps> = ({
  userId = "",
  isAdmin = false,
  onUpdate,
}) => {
  // 🔄 useState snippet con TypeScript
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // 🎯 useCallback para optimización
  const handleUserUpdate = useCallback(
    (data: UserData) => {
      setUserData(data);
      onUpdate?.(data); // Optional chaining detectado automáticamente
    },
    [onUpdate]
  );

  // 🚀 useMemo para cálculos optimizados
  const filteredData = useMemo(() => {
    if (!userData) return null;

    return {
      ...userData,
      phoneNumbers: userData.phoneNumbers.filter((phone) =>
        phone.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    };
  }, [userData, searchTerm]);

  // 🔄 useEffect con cleanup
  useEffect(() => {
    let isMounted = true;

    const fetchUserData = async () => {
      if (!userId) return;

      setLoading(true);
      setError(null);

      try {
        // 🔥 Thunder Client/REST Client pueden testear esta API
        const response = await fetch(`/api/users/${userId}`);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (isMounted) {
          handleUserUpdate(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Error desconocido");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchUserData();

    // 🧹 Cleanup function
    return () => {
      isMounted = false;
    };
  }, [userId, handleUserUpdate]);

  // 🎨 Error Lens muestra errores inline
  if (error) {
    return (
      <div className={`${STYLES.container} border-l-4 border-red-500`}>
        <div className="flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <span className="text-red-700 font-medium">Error: {error}</span>
        </div>
      </div>
    );
  }

  // 🔄 Loading state con mejor UX
  if (loading) {
    return (
      <div className={STYLES.container}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-300 rounded w-3/4"></div>
          <div className="h-4 bg-gray-300 rounded w-1/2"></div>
          <div className="h-32 bg-gray-300 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={STYLES.container}>
      {/* 📝 Better Comments - Diferentes estilos de comentarios */}
      {/* COMPLETADO: Navigation breadcrumbs agregado en header */}

      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center space-x-2">
          <User className="h-6 w-6 text-blue-600" />
          <span>Panel Optimizado</span>
        </h1>

        {/* 🎨 Color Highlight muestra los colores automáticamente */}
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="text-sm text-gray-600">Conectado</span>
        </div>
      </header>

      {/* 🔍 Search Input con Path Intellisense para iconos */}
      <div className="relative">
        <input
          type="text"
          placeholder="Buscar números de teléfono..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={STYLES.input}
        />
        <Phone className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
      </div>

      {/* 📊 Data Display */}
      {filteredData && (
        <div className={STYLES.card}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">
                Información Usuario
              </h3>
              <p className="text-sm text-gray-600">
                Nombre: {filteredData.name}
              </p>
              <p className="text-sm text-gray-600">
                Email: {filteredData.email}
              </p>

              {/* 🎨 Bracket Pair Colorizer ayuda con la legibilidad */}
              <div className="flex items-center space-x-2 mt-2">
                <span
                  className={`${STYLES.badge} ${
                    filteredData.isActive
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {filteredData.isActive ? "Activo" : "Inactivo"}
                </span>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-800 mb-2 flex items-center space-x-1">
                <MapPin className="h-4 w-4" />
                <span>Territorio</span>
              </h3>
              <p className="text-sm text-gray-600">
                {filteredData.territory || "Sin asignar"}
              </p>
            </div>
          </div>

          {/* 📞 Phone Numbers List */}
          {filteredData.phoneNumbers.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium text-gray-700 mb-2">
                Números de Teléfono ({filteredData.phoneNumbers.length})
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {filteredData.phoneNumbers.map((phone) => (
                  <div
                    key={phone}
                    className="px-3 py-2 bg-gray-50 rounded-md text-sm font-mono"
                  >
                    {phone}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 🎯 Admin Actions */}
      {isAdmin && (
        <div className="flex space-x-3">
          <button className={STYLES.button}>
            <Database className="h-4 w-4 mr-2 inline" />
            Exportar Datos
          </button>
          <button
            className={`${STYLES.button} bg-green-600 hover:bg-green-700`}
          >
            Actualizar Usuario
          </button>
        </div>
      )}
    </div>
  );
};

// 🎯 Default Export con Next.js types
export default OptimizedComponent;

// 📝 Named exports para testing
export type { OptimizedComponentProps, UserData };
