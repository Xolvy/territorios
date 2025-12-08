'use client';

import React, { useState } from 'react';
import { 
  Calendar, 
  Map, 
  Phone, 
  Users, 
  BarChart3, 
  Settings, 
  Menu, 
  X,
  Home
} from 'lucide-react';

interface NavigationProps {
  activeView: string;
  onViewChange: (viewId: string) => void;
}

const navigationItems = [
  { 
    id: 'conductor', 
    label: 'Conductor', 
    icon: Home, 
    description: 'Vista principal del conductor'
  },
  { 
    id: 'admin', 
    label: 'Admin', 
    icon: Settings, 
    description: 'Panel de administración'
  },
  { 
    id: 'territorios', 
    label: 'Territorios', 
    icon: Map, 
    description: 'Gestión de territorios'
  },
  { 
    id: 'conductores', 
    label: 'Conductores', 
    icon: Users, 
    description: 'Gestión de conductores'
  },
  { 
    id: 'programa', 
    label: 'Programa', 
    icon: Calendar, 
    description: 'Programación de reuniones'
  },
  { 
    id: 'telefonos', 
    label: 'Teléfonos', 
    icon: Phone, 
    description: 'Listado telefónico'
  },
  { 
    id: 'reportes', 
    label: 'Reportes', 
    icon: BarChart3, 
    description: 'Estadísticas y reportes'
  }
];

export default function Navigation({ activeView, onViewChange }: NavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleViewChange = (viewId: string) => {
    onViewChange(viewId);
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden lg:flex bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-1 shadow-lg">
        <div className="flex items-center space-x-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => handleViewChange(item.id)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200
                  ${isActive 
                    ? 'bg-white text-blue-600 shadow-md' 
                    : 'text-white hover:bg-white/10 hover:text-blue-200'
                  }
                `}
                title={item.description}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium text-sm">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile Navigation */}
      <div className="lg:hidden">
        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="fixed top-4 left-4 z-50 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 text-white shadow-lg"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <>
            <div 
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            
            {/* Mobile Menu */}
            <div className="fixed top-0 left-0 h-full w-80 bg-white/95 backdrop-blur-xl border-r border-white/20 z-50 shadow-2xl">
              <div className="pt-20 px-6">
                <div className="space-y-2">
                  {navigationItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeView === item.id;
                    
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleViewChange(item.id)}
                        className={`
                          w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left
                          ${isActive 
                            ? 'bg-blue-500 text-white shadow-md' 
                            : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
                          }
                        `}
                      >
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        <div>
                          <div className="font-medium">{item.label}</div>
                          <div className="text-xs opacity-70">{item.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom Navigation for Mobile */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-white/20 shadow-lg z-30">
        <div className="grid grid-cols-4 gap-1 p-2">
          {navigationItems.slice(0, 4).map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => handleViewChange(item.id)}
                className={`
                  flex flex-col items-center gap-1 p-2 rounded-lg transition-colors
                  ${isActive 
                    ? 'text-blue-600 bg-blue-50' 
                    : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}