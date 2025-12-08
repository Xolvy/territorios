"use client";

import React, { useState, useCallback } from "react";
import { useUnifiedApp } from "@/context/UnifiedAppContext";
import { useToast } from "@/components/ui/ToastProvider";
import { todayISO, generateId } from "@/utils";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

interface FormData {
  fecha: string;
  hora: string;
  lugar: string;
  conductor: string;
  auxiliar: string;
  faceta: string;
}

export default function TerritoryProgrammingPanel() {
  const { state, createAssignment } = useUnifiedApp();

  const { showSuccess, showError } = useToast();

  // Mappear los datos del estado unificado
  const territorios = Object.values(state.territories);
  const conductores = Object.values(state.users).filter(
    (user) => user.role === "conductor"
  );
  const isLoading = state.isLoading;

  // Función auxiliar para toast
  const addToast = useCallback(
    (message: string, type: "success" | "error") => {
      if (type === "success") {
        showSuccess(message);
      } else if (type === "error") {
        showError(message);
      }
    },
    [showSuccess, showError]
  );

  // Estados locales
  const [territoriosSeleccionados, setTerritoriosSeleccionados] = useState<
    Set<string>
  >(new Set());
  const [manzanasSeleccionadas, setManzanasSeleccionadas] = useState<
    Set<string>
  >(new Set());
  const [formData, setFormData] = useState<FormData>({
    fecha: todayISO(),
    hora: "",
    lugar: "",
    conductor: "",
    auxiliar: "",
    faceta: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalState, setModalState] = useState({
    isOpen: false,
    type: "",
    title: "",
    data: null,
  });

  // Manejadores de eventos - todos los hooks deben estar antes del early return
  const handleTerritorioClick = useCallback(
    (terrNum: string) => {
      const newSelection = new Set(territoriosSeleccionados);
      if (newSelection.has(terrNum)) {
        newSelection.delete(terrNum);
      } else {
        newSelection.add(terrNum);
      }
      setTerritoriosSeleccionados(newSelection);
      setManzanasSeleccionadas(new Set());
    },
    [territoriosSeleccionados]
  );

  const handleManzanaClick = useCallback(
    (manzanaId: string) => {
      const newSelection = new Set(manzanasSeleccionadas);
      if (newSelection.has(manzanaId)) {
        newSelection.delete(manzanaId);
      } else {
        newSelection.add(manzanaId);
      }
      setManzanasSeleccionadas(newSelection);
    },
    [manzanasSeleccionadas]
  );

  const handleSelectAllManzanas = useCallback(() => {
    if (!territoriosSeleccionados.size) return;

    const currentTerritorio = Array.from(territoriosSeleccionados)[0];
    // Simulamos 20 manzanas por territorio para simplicidad
    const totalManzanas = 20;
    const allManzanas = Array.from(
      { length: totalManzanas },
      (_, i) => `${currentTerritorio}-${i + 1}`
    );
    setManzanasSeleccionadas(new Set(allManzanas));
  }, [territoriosSeleccionados]);

  const handleFormChange = useCallback(
    (field: keyof FormData) => (value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const limpiarFormulario = useCallback(() => {
    setFormData({
      fecha: todayISO(),
      hora: "",
      lugar: "",
      conductor: "",
      auxiliar: "",
      faceta: "",
    });
    setTerritoriosSeleccionados(new Set());
    setManzanasSeleccionadas(new Set());
  }, []);

  // Validación del formulario - antes del handleSubmit
  const isFormValid =
    formData.fecha &&
    formData.hora &&
    formData.lugar &&
    formData.conductor &&
    formData.faceta &&
    manzanasSeleccionadas.size > 0;

  const handleSubmit = useCallback(async () => {
    if (!isFormValid) return;

    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      const programaId = generateId();

      // Crear documento del programa
      const programaRef = doc(collection(db, "programa"), programaId);
      await setDoc(programaRef, {
        ...formData,
        territorios: Array.from(territoriosSeleccionados),
        manzanas: Array.from(manzanasSeleccionadas),
        timestamp: serverTimestamp(),
        id: programaId,
      });

      await batch.commit();

      addToast("Programa asignado exitosamente", "success");
      limpiarFormulario();
    } catch (error) {
      console.error("Error al guardar programa:", error);
      addToast("Error al guardar el programa", "error");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    formData,
    territoriosSeleccionados,
    manzanasSeleccionadas,
    addToast,
    limpiarFormulario,
    isFormValid,
  ]);

  // Guardia de carga - después de los hooks
  if (isLoading) {
    return (
      <div className="glass-card text-center">
        <LoadingSpinner size="lg" text="Cargando datos del panel..." />
      </div>
    );
  }

  // Datos de ejemplo para lugares y facetas
  const lugares = [
    { id: "1", nombre: "Salón del Reino Principal" },
    { id: "2", nombre: "Salón del Reino Norte" },
    { id: "3", nombre: "Salón del Reino Sur" },
  ];

  const facetas = [
    { id: "1", nombre: "Primera Conversación" },
    { id: "2", nombre: "Revisita" },
    { id: "3", nombre: "Curso Bíblico" },
    { id: "4", nombre: "Discurso" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold">P</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              Panel de Programación
            </h2>
            <p className="text-gray-600">
              Asigna territorios y manzanas para el programa
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulario */}
        <div className="glass-card">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Datos del Programa
          </h3>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Fecha"
                type="date"
                value={formData.fecha}
                onChange={(e) => handleFormChange("fecha")(e.target.value)}
                required
              />
              <Input
                label="Hora"
                type="time"
                value={formData.hora}
                onChange={(e) => handleFormChange("hora")(e.target.value)}
                required
              />
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lugar
                </label>
                <select
                  value={formData.lugar}
                  onChange={(e) => handleFormChange("lugar")(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Seleccionar lugar</option>
                  {lugares.map((lugar) => (
                    <option key={lugar.id} value={lugar.nombre}>
                      {lugar.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Conductor
                </label>
                <select
                  value={formData.conductor}
                  onChange={(e) =>
                    handleFormChange("conductor")(e.target.value)
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Seleccionar conductor</option>
                  {conductores.map((conductor) => (
                    <option
                      key={conductor.uid}
                      value={
                        conductor.displayName ||
                        conductor.fullName ||
                        conductor.email
                      }
                    >
                      {conductor.displayName ||
                        conductor.fullName ||
                        conductor.email}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Auxiliar (opcional)"
                value={formData.auxiliar}
                onChange={(e) => handleFormChange("auxiliar")(e.target.value)}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Faceta
                </label>
                <select
                  value={formData.faceta}
                  onChange={(e) => handleFormChange("faceta")(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Seleccionar faceta</option>
                  {facetas.map((faceta) => (
                    <option key={faceta.id} value={faceta.nombre}>
                      {faceta.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Selección de Territorios */}
        <div className="glass-card">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Selección de Territorio
            {territoriosSeleccionados.size > 0 && (
              <span className="text-sm font-normal text-blue-600 ml-2">
                ({territoriosSeleccionados.size} seleccionado
                {territoriosSeleccionados.size !== 1 ? "s" : ""})
              </span>
            )}
          </h3>

          <div className="grid grid-cols-4 gap-2 mb-4">
            {Array.from({ length: 22 }, (_, i) => i + 1).map((num) => (
              <button
                key={num}
                onClick={() => handleTerritorioClick(num.toString())}
                className={`p-2 rounded-lg text-sm font-medium transition-colors ${
                  territoriosSeleccionados.has(num.toString())
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                }`}
              >
                T{num}
              </button>
            ))}
          </div>

          {territoriosSeleccionados.size > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-md font-medium text-gray-800">
                  Manzanas - Territorio{" "}
                  {Array.from(territoriosSeleccionados)[0]}
                </h4>
                <button
                  onClick={handleSelectAllManzanas}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Seleccionar todas
                </button>
              </div>

              <div className="grid grid-cols-5 gap-1">
                {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => {
                  const manzanaId = `${
                    Array.from(territoriosSeleccionados)[0]
                  }-${num}`;
                  return (
                    <button
                      key={manzanaId}
                      onClick={() => handleManzanaClick(manzanaId)}
                      className={`p-1 rounded text-xs font-medium transition-colors ${
                        manzanasSeleccionadas.has(manzanaId)
                          ? "bg-green-500 text-white"
                          : "bg-gray-50 hover:bg-gray-100 text-gray-600"
                      }`}
                    >
                      {num}
                    </button>
                  );
                })}
              </div>

              {manzanasSeleccionadas.size > 0 && (
                <p className="text-sm text-green-600 mt-2">
                  {manzanasSeleccionadas.size} manzana
                  {manzanasSeleccionadas.size !== 1 ? "s" : ""} seleccionada
                  {manzanasSeleccionadas.size !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Botones de Acción */}
      <div className="glass-card">
        <div className="flex gap-4">
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting}
            className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50"
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <LoadingSpinner size="sm" />
                <span>Guardando...</span>
              </div>
            ) : (
              "Asignar Programa"
            )}
          </Button>

          <Button
            onClick={limpiarFormulario}
            variant="secondary"
            className="flex-1"
          >
            Limpiar Formulario
          </Button>
        </div>
      </div>

      {/* Modal */}
      {modalState.isOpen && (
        <Modal
          isOpen={modalState.isOpen}
          onClose={() => setModalState({ ...modalState, isOpen: false })}
          title={modalState.title}
        >
          <div className="p-4">
            <p>Contenido del modal</p>
          </div>
        </Modal>
      )}
    </div>
  );
}
