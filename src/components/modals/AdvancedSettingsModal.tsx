"use client";

import React, { useState } from "react";
import ModalEvolution from "@/components/ui/ModalEvolution";
import {
  Settings,
  Database,
  Shield,
  Bell,
  Palette,
  Zap,
  Crown,
  Sparkles,
  Save,
  RotateCcw,
} from "lucide-react";

interface AdvancedSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: any) => void;
}

const AdvancedSettingsModal: React.FC<AdvancedSettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState("general");
  const [settings, setSettings] = useState({
    notifications: true,
    darkMode: true,
    autoSync: true,
    soundEffects: true,
    animations: true,
  });

  const tabs = [
    { id: "general", label: "General", icon: Settings },
    { id: "database", label: "Base de Datos", icon: Database },
    { id: "security", label: "Seguridad", icon: Shield },
    { id: "mejoras", label: "Mejoras", icon: Crown },
  ];

  const handleSave = () => {
    onSave(settings);
    onClose();
  };

  const handleReset = () => {
    setSettings({
      notifications: true,
      darkMode: true,
      autoSync: true,
      soundEffects: true,
      animations: true,
    });
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "general":
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-400" />
                Configuración General
              </h3>

              <div className="space-y-4">
                {/* Toggle Switch Component */}
                {[
                  {
                    key: "notifications",
                    label: "Notificaciones",
                    desc: "Recibir alertas y recordatorios",
                  },
                  {
                    key: "soundEffects",
                    label: "Efectos de Sonido",
                    desc: "Sonidos para acciones e interacciones",
                  },
                  {
                    key: "animations",
                    label: "Animaciones",
                    desc: "Transiciones y efectos visuales",
                  },
                  {
                    key: "autoSync",
                    label: "Sincronización Automática",
                    desc: "Sincronizar datos en tiempo real",
                  },
                ].map(({ key, label, desc }) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10"
                  >
                    <div>
                      <div className="font-medium text-white">{label}</div>
                      <div className="text-sm text-white/60">{desc}</div>
                    </div>
                    <button
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          [key]: !prev[key as keyof typeof prev],
                        }))
                      }
                      className={`
                        relative w-12 h-6 rounded-full transition-colors duration-200
                        ${
                          settings[key as keyof typeof settings]
                            ? "bg-blue-500"
                            : "bg-white/20"
                        }
                      `}
                    >
                      <div
                        className={`
                        absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200
                        ${
                          settings[key as keyof typeof settings]
                            ? "translate-x-7"
                            : "translate-x-1"
                        }
                      `}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "mejoras":
        return (
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-full flex items-center justify-center mx-auto">
                <Crown className="w-10 h-10 text-yellow-400" />
              </div>
              <h3 className="text-xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                Funciones Avanzadas
              </h3>
              <p className="text-white/70">
                Desbloquea funciones avanzadas para una experiencia superior
              </p>
            </div>

            <div className="grid gap-4">
              {[
                {
                  icon: Zap,
                  title: "Análisis Avanzado",
                  desc: "Reportes detallados y métricas personalizadas",
                },
                {
                  icon: Database,
                  title: "Backup Automático",
                  desc: "Respaldo automático en la nube",
                },
                {
                  icon: Sparkles,
                  title: "Temas Personalizados",
                  desc: "Personaliza la apariencia de tu aplicación",
                },
                {
                  icon: Bell,
                  title: "Notificaciones Push",
                  desc: "Alertas en tiempo real en todos tus dispositivos",
                },
              ].map(({ icon: Icon, title, desc }, index) => (
                <div
                  key={index}
                  className="p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-xl border border-yellow-500/20"
                >
                  <div className="flex items-start gap-3">
                    <Icon className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium text-white">{title}</div>
                      <div className="text-sm text-white/70">{desc}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button className="w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 bg-white/10 text-white hover:bg-white/15">
              Mejoras del sistema
            </button>
          </div>
        );

      default:
        return (
          <div className="text-center py-12 text-white/60">
            <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Configuración en desarrollo...</p>
          </div>
        );
    }
  };

  return (
    <ModalEvolution
      isOpen={isOpen}
      onClose={onClose}
      title="Configuración Avanzada"
      size="lg"
      type="default"
      animation="zoom"
      blur="heavy"
    >
      <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="flex space-x-2 bg-white/5 p-2 rounded-xl">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg
                  transition-all duration-200 font-medium text-sm
                  ${
                    activeTab === tab.id
                      ? "bg-blue-500 text-white shadow-lg"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="min-h-[300px]">{renderTabContent()}</div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t border-white/10">
          <button
            onClick={handleReset}
            className="flex-1 py-2 px-4 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Restablecer
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2 px-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl transition-all duration-200 hover:scale-105 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Guardar Cambios
          </button>
        </div>
      </div>
    </ModalEvolution>
  );
};

export default AdvancedSettingsModal;
