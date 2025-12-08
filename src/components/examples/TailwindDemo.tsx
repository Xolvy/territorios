// 🎨 TAILWIND INTELLISENSE - DEMO DE AUTOCOMPLETE Y OPTIMIZACIÓN
"use client";

import React, { useState } from "react";

/* 
🚀 EXTENSIONES QUE MEJORAN LOS ESTILOS:

1. **Tailwind CSS IntelliSense** - Autocompletado inteligente
   - Escribe 'bg-' y ve todas las opciones
   - Hover para ver valores CSS reales
   - Warnings para clases inexistentes

2. **Color Highlight** - Ve colores en tiempo real
   - Resalta colores automáticamente
   - Funciona con hex, rgb, hsl, etc.

3. **CSS Peek** - Navega a definiciones CSS
   - Ctrl+Click para ir a definiciones
   - Útil para clases custom

CÓMO USAR TAILWIND INTELLISENSE:
- Escribe clases y ve sugerencias instantáneas
- Usa Ctrl+Space para forzar autocompletado  
- Hover sobre clases para ver CSS generado
*/

interface TailwindDemoProps {
  variant?: "primary" | "secondary" | "danger" | "success";
  size?: "sm" | "md" | "lg" | "xl";
}

const TailwindDemo: React.FC<TailwindDemoProps> = ({
  variant = "primary",
  size = "md",
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  // 🎨 Color Highlight muestra estos colores automáticamente
  const colors = {
    primary: "#3b82f6", // blue-500
    secondary: "#6b7280", // gray-500
    danger: "#ef4444", // red-500
    success: "#10b981", // emerald-500
    warning: "#f59e0b", // amber-500
  };

  // 🚀 Tailwind IntelliSense ayuda a construir estas clases dinámicamente
  const baseClasses =
    "transition-all duration-300 ease-in-out transform font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-lg shadow-sm";

  const variantClasses = {
    primary:
      "bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white focus:ring-blue-500 border-blue-500",
    secondary:
      "bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-800 focus:ring-gray-500 border-gray-300",
    danger:
      "bg-red-500 hover:bg-red-600 active:bg-red-700 text-white focus:ring-red-500 border-red-500",
    success:
      "bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white focus:ring-emerald-500 border-emerald-500",
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm h-8",
    md: "px-4 py-2 text-base h-10",
    lg: "px-6 py-3 text-lg h-12",
    xl: "px-8 py-4 text-xl h-14",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-8">
      {/* 🎯 Header con Tailwind avanzado */}
      <header className="text-center mb-12 space-y-4">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
          Tailwind IntelliSense Demo
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
          Demuestra el autocompletado inteligente y optimización de Tailwind CSS
        </p>
      </header>

      {/* 🎨 Grid responsivo con diferentes componentes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-12">
        {/* 📱 Card responsive */}
        <div className="group relative overflow-hidden rounded-2xl bg-white shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-500 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
          <div className="relative p-6">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
              <div className="w-6 h-6 bg-blue-500 rounded-full"></div>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Responsivo
            </h3>
            <p className="text-sm text-gray-600">
              Grid adaptable a diferentes pantallas
            </p>
          </div>
        </div>

        {/* 🎮 Interactive Button */}
        <div className="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-shadow">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">
            Botones Dinámicos
          </h3>
          <div className="space-y-3">
            {(["primary", "secondary", "danger", "success"] as const).map(
              (v) => (
                <button
                  key={v}
                  className={`${baseClasses} ${variantClasses[v]} ${sizeClasses[size]} w-full capitalize`}
                  onMouseEnter={() => setIsHovered(true)}
                  onMouseLeave={() => setIsHovered(false)}
                  onMouseDown={() => setIsPressed(true)}
                  onMouseUp={() => setIsPressed(false)}
                >
                  {v} Button
                </button>
              )
            )}
          </div>
        </div>

        {/* 📊 Stats Card */}
        <div className="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-shadow">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">
            Estadísticas
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Usuarios</span>
              <span className="text-2xl font-bold text-blue-600">1,234</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full w-3/4 transition-all duration-1000 ease-out"></div>
            </div>
          </div>
        </div>

        {/* 🌈 Color Palette */}
        <div className="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-shadow">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">
            Paleta de Colores
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(colors).map(([name, color]) => (
              <div key={name} className="text-center">
                <div
                  className="w-full h-12 rounded-lg mb-2 border border-gray-200 shadow-inner"
                  style={{ backgroundColor: color }}
                ></div>
                <span className="text-xs text-gray-600 capitalize">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 🎯 Advanced Layout Examples */}
      <section className="space-y-8">
        {/* 📋 Form Example */}
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 text-gray-800 text-center">
            Formulario Optimizado
          </h2>
          <form className="space-y-6">
            {/* Input con estados */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Nombre Completo
              </label>
              <input
                type="text"
                placeholder="Ingresa tu nombre..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 placeholder-gray-400 hover:border-gray-400"
              />
            </div>

            {/* Select con estilos custom */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Territorio
              </label>
              <select className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all duration-200">
                <option value="">Seleccionar territorio...</option>
                <option value="norte">Norte</option>
                <option value="sur">Sur</option>
                <option value="este">Este</option>
                <option value="oeste">Oeste</option>
              </select>
            </div>

            {/* Checkbox con animaciones */}
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="terms"
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 transition-all duration-200"
              />
              <label htmlFor="terms" className="text-sm text-gray-700">
                Acepto los términos y condiciones
              </label>
            </div>

            {/* Submit button con gradiente */}
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium py-3 rounded-lg hover:from-blue-600 hover:to-indigo-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Enviar Formulario
            </button>
          </form>
        </div>

        {/* 📱 Mobile-First Design Example */}
        <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 lg:p-8">
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-4 sm:mb-6 text-gray-800">
            Diseño Mobile-First
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="aspect-square bg-gradient-to-br from-indigo-100 to-blue-200 rounded-xl flex items-center justify-center text-2xl sm:text-3xl font-bold text-indigo-600 hover:from-indigo-200 hover:to-blue-300 transition-all duration-300 cursor-pointer transform hover:scale-105"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* 🎨 State Indicators */}
        <div className="text-center py-8">
          <div className="inline-flex items-center space-x-4 bg-white rounded-full px-6 py-3 shadow-lg">
            <div className="flex items-center space-x-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  isHovered ? "bg-green-400" : "bg-gray-300"
                } transition-colors`}
              ></div>
              <span className="text-sm text-gray-600">
                Hover: {isHovered ? "Activo" : "Inactivo"}
              </span>
            </div>
            <div className="w-px h-4 bg-gray-300"></div>
            <div className="flex items-center space-x-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  isPressed ? "bg-red-400" : "bg-gray-300"
                } transition-colors`}
              ></div>
              <span className="text-sm text-gray-600">
                Press: {isPressed ? "Presionado" : "Normal"}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default TailwindDemo;

/*
🎯 TIPS PARA USAR TAILWIND INTELLISENSE:

1. **Autocompletado Inteligente**:
   - Escribe 'bg-' → Ve todas las opciones de background
   - 'text-' → Ve colores y tamaños de texto
   - 'hover:' → Ve estados de hover

2. **Valores CSS Reales**:
   - Hover sobre 'px-4' → Ve 'padding: 1rem'
   - 'w-1/2' → Ve 'width: 50%'

3. **Detección de Errores**:
   - Clases inexistentes aparecen subrayadas
   - Sugerencias para corrección automática

4. **Breakpoints Responsivos**:
   - 'sm:' → >= 640px
   - 'md:' → >= 768px  
   - 'lg:' → >= 1024px
   - 'xl:' → >= 1280px

5. **Pseudo-selectores**:
   - 'hover:', 'focus:', 'active:'
   - 'first:', 'last:', 'even:', 'odd:'
   - 'group-hover:', 'peer-focus:'
*/
