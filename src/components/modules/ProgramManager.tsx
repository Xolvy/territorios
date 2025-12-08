"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ProgramaReunion, Conductor, Lugar, Faceta } from "@/types";
import { firebaseService, todayISO } from "@/lib/firebaseService";

interface ProgramManagerProps {
  conductores: Conductor[];
  lugares: Lugar[];
  facetas: Faceta[];
  isAdmin: boolean;
  onShowToast: (
    message: string,
    type: "success" | "error" | "warning" | "info"
  ) => void;
  onProgramCreated?: (programa: ProgramaReunion) => void;
}

// PDF Export utility for program
const exportProgramToPDF = (programa: ProgramaReunion[], weekRange: string) => {
  if (typeof window !== "undefined" && (window as any).jspdf) {
    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF({ orientation: "landscape" });

    doc.setFontSize(18);
    doc.text("Programa de Predicación", 14, 20);
    doc.setFontSize(12);
    doc.text(weekRange, 14, 27);

    // Group meetings by date and create table
    const programByDate = programa.reduce((acc, meeting) => {
      if (!acc[meeting.fecha]) acc[meeting.fecha] = [];
      acc[meeting.fecha].push(meeting);
      return acc;
    }, {} as Record<string, ProgramaReunion[]>);

    let yPosition = 35;
    const pageHeight = doc.internal.pageSize.height;

    Object.keys(programByDate)
      .sort()
      .forEach((fecha) => {
        const meetings = programByDate[fecha];
        const dateObj = new Date(fecha + "T00:00:00");
        const dayName = dateObj.toLocaleDateString("es-ES", {
          weekday: "long",
        });
        const day = dateObj.getDate();

        if (yPosition > pageHeight - 60) {
          doc.addPage();
          yPosition = 20;
        }

        // Date header
        doc.setFontSize(14);
        doc.text(`${dayName.toUpperCase()} ${day}`, 14, yPosition);
        yPosition += 10;

        // Meetings table
        if (doc.autoTable) {
          const tableData = meetings.map((m) => [
            m.lugar,
            m.hora,
            m.conductor,
            m.auxiliar || "---",
            m.faceta,
            m.territorio || "---",
          ]);

          doc.autoTable({
            head: [
              [
                "LUGAR",
                "HORA",
                "CONDUCTOR",
                "AUXILIAR",
                "FACETA",
                "TERRITORIO",
              ],
            ],
            body: tableData,
            startY: yPosition,
            theme: "grid",
            headStyles: { fillColor: [22, 160, 133] },
            styles: { fontSize: 10 },
          });

          yPosition = (doc as any).lastAutoTable.finalY + 15;
        }
      });

    doc.save(`Programa_Predicacion_${weekRange.replace(/\s/g, "_")}.pdf`);
    return true;
  }
  return false;
};

// Add Modal Components
const AddLugarModal = ({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (nombre: string) => void;
}) => {
  const [nombre, setNombre] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nombre.trim()) {
      onAdd(nombre.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl border border-white/20 rounded-3xl max-w-md w-full">
        <div className="p-6 border-b border-white/10">
          <h3 className="text-xl font-bold text-white">Agregar Nuevo Lugar</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6">
            <label className="block text-white/80 mb-2">Nombre del lugar</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Familia Pérez"
              required
              className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-white/5 border border-white/20 text-white rounded-xl hover:bg-white/10 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-gradient-to-r from-emerald-500/80 to-green-500/80 text-white rounded-xl hover:from-emerald-400/80 hover:to-green-400/80 transition-all font-semibold"
            >
              Agregar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AddFacetaModal = ({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (nombre: string) => void;
}) => {
  const [nombre, setNombre] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nombre.trim()) {
      onAdd(nombre.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl border border-white/20 rounded-3xl max-w-md w-full">
        <div className="p-6 border-b border-white/10">
          <h3 className="text-xl font-bold text-white">Agregar Nueva Faceta</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6">
            <label className="block text-white/80 mb-2">
              Nombre de la faceta
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Calles principales"
              required
              className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-white/5 border border-white/20 text-white rounded-xl hover:bg-white/10 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-gradient-to-r from-emerald-500/80 to-green-500/80 text-white rounded-xl hover:from-emerald-400/80 hover:to-green-400/80 transition-all font-semibold"
            >
              Agregar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Program Form Component
const ProgramForm = ({
  conductores,
  lugares,
  facetas,
  onSubmit,
  onClear,
  onAddLugar,
  onAddFaceta,
}: {
  conductores: Conductor[];
  lugares: Lugar[];
  facetas: Faceta[];
  onSubmit: (programa: Omit<ProgramaReunion, "id" | "timestamp">) => void;
  onClear: () => void;
  onAddLugar: () => void;
  onAddFaceta: () => void;
}) => {
  const [formData, setFormData] = useState({
    fecha: todayISO(),
    hora: "",
    lugar: "",
    conductor: "",
    auxiliar: "",
    faceta: "",
    territorio: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.fecha ||
      !formData.lugar ||
      !formData.hora ||
      !formData.conductor ||
      !formData.faceta
    ) {
      return;
    }

    onSubmit({
      fecha: formData.fecha,
      hora: formData.hora,
      lugar: formData.lugar,
      conductor: formData.conductor,
      auxiliar: formData.auxiliar || undefined,
      faceta: formData.faceta,
      territorio: formData.territorio || undefined,
    });

    // Reset form
    setFormData({
      fecha: todayISO(),
      hora: "",
      lugar: "",
      conductor: "",
      auxiliar: "",
      faceta: "",
      territorio: "",
    });
  };

  const handleClear = () => {
    setFormData({
      fecha: todayISO(),
      hora: "",
      lugar: "",
      conductor: "",
      auxiliar: "",
      faceta: "",
      territorio: "",
    });
    onClear();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h3 className="text-xl font-semibold text-white">
        Detalles del Programa
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-white/80 mb-2">Fecha</label>
          <input
            type="date"
            value={formData.fecha}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, fecha: e.target.value }))
            }
            className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
          />
        </div>
        <div>
          <label className="block text-white/80 mb-2">Hora</label>
          <input
            type="text"
            value={formData.hora}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, hora: e.target.value }))
            }
            placeholder="Ej: 8:45am"
            className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          />
        </div>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-grow">
          <label className="block text-white/80 mb-2">Lugar</label>
          <select
            value={formData.lugar}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, lugar: e.target.value }))
            }
            className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
          >
            <option value="">Seleccionar...</option>
            {lugares.map((lugar) => (
              <option
                key={lugar.id}
                value={lugar.nombre}
                style={{ color: "#000", background: "#fff" }}
              >
                {lugar.nombre}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={onAddLugar}
          className="px-4 py-3 bg-gradient-to-r from-slate-600/80 to-slate-700/80 text-white rounded-xl hover:from-slate-500/80 hover:to-slate-600/80 transition-all font-semibold"
        >
          +
        </button>
      </div>

      <div>
        <label className="block text-white/80 mb-2">Conductor</label>
        <select
          value={formData.conductor}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, conductor: e.target.value }))
          }
          className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
        >
          <option value="">Seleccionar...</option>
          {conductores.map((conductor) => (
            <option
              key={conductor.id}
              value={conductor.nombre}
              style={{ color: "#000", background: "#fff" }}
            >
              {conductor.nombre}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-white/80 mb-2">Auxiliar</label>
        <select
          value={formData.auxiliar}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, auxiliar: e.target.value }))
          }
          className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
        >
          <option value="">Seleccionar...</option>
          {conductores.map((conductor) => (
            <option
              key={conductor.id}
              value={conductor.nombre}
              style={{ color: "#000", background: "#fff" }}
            >
              {conductor.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-grow">
          <label className="block text-white/80 mb-2">Faceta</label>
          <select
            value={formData.faceta}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, faceta: e.target.value }))
            }
            className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
          >
            <option value="">Seleccionar...</option>
            {facetas.map((faceta) => (
              <option
                key={faceta.id}
                value={faceta.nombre}
                style={{ color: "#000", background: "#fff" }}
              >
                {faceta.nombre}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={onAddFaceta}
          className="px-4 py-3 bg-gradient-to-r from-slate-600/80 to-slate-700/80 text-white rounded-xl hover:from-slate-500/80 hover:to-slate-600/80 transition-all font-semibold"
        >
          +
        </button>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          className="px-6 py-3 bg-gradient-to-r from-emerald-500/80 to-green-500/80 text-white rounded-xl hover:from-emerald-400/80 hover:to-green-400/80 transition-all font-semibold"
        >
          Guardar Programa
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="px-6 py-3 bg-gradient-to-r from-slate-600/80 to-slate-700/80 text-white rounded-xl hover:from-slate-500/80 hover:to-slate-600/80 transition-all"
        >
          Limpiar
        </button>
      </div>
    </form>
  );
};

// Program View Component
const ProgramView = ({
  programa,
  weekOffset = 0,
  onPreviousWeek,
  onNextWeek,
  onExportPDF,
  isAdmin = false,
}: {
  programa: ProgramaReunion[];
  weekOffset?: number;
  onPreviousWeek?: () => void;
  onNextWeek?: () => void;
  onExportPDF?: () => void;
  isAdmin?: boolean;
}) => {
  const generateWeekView = (offset: number) => {
    const today = new Date();
    today.setDate(today.getDate() + offset * 7);
    const dayOfWeek = today.getDay();
    const firstDayOfWeek = new Date(today);
    firstDayOfWeek.setDate(
      today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)
    );

    const week = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(firstDayOfWeek);
      date.setDate(firstDayOfWeek.getDate() + i);
      return date.toISOString().slice(0, 10);
    });

    const lastDayOfWeek = new Date(week[6] + "T00:00:00");
    const dateRange = `${firstDayOfWeek.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
    })} - ${lastDayOfWeek.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}`;

    const weekProgram = programa.filter((p) => week.includes(p.fecha));

    return { week, dateRange, weekProgram };
  };

  const { week, dateRange, weekProgram } = generateWeekView(weekOffset);
  const dayNames = [
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
    "Domingo",
  ];

  return (
    <div className="space-y-6">
      {isAdmin && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onPreviousWeek}
              className="px-4 py-2 bg-gradient-to-r from-slate-600/80 to-slate-700/80 text-white rounded-xl hover:from-slate-500/80 hover:to-slate-600/80 transition-all"
            >
              ‹
            </button>
            <h3 className="text-xl font-semibold text-white">{dateRange}</h3>
            <button
              onClick={onNextWeek}
              disabled={weekOffset >= 0}
              className="px-4 py-2 bg-gradient-to-r from-slate-600/80 to-slate-700/80 text-white rounded-xl hover:from-slate-500/80 hover:to-slate-600/80 transition-all disabled:opacity-50"
            >
              ›
            </button>
          </div>
          <button
            onClick={onExportPDF}
            className="px-6 py-3 bg-gradient-to-r from-blue-500/80 to-cyan-500/80 text-white rounded-xl hover:from-blue-400/80 hover:to-cyan-400/80 transition-all font-semibold"
          >
            Exportar a PDF
          </button>
        </div>
      )}

      {!isAdmin && (
        <h3 className="text-xl font-semibold text-white">
          Programa de la Semana
        </h3>
      )}

      <div className="space-y-4">
        {week.map((dateISO, index) => {
          const dayMeetings = weekProgram
            .filter((p) => p.fecha === dateISO)
            .sort((a, b) => a.hora.localeCompare(b.hora));
          if (dayMeetings.length === 0) return null;

          const date = new Date(dateISO + "T00:00:00");
          const day = date.getDate();

          return (
            <div
              key={dateISO}
              className="bg-white/5 rounded-3xl border border-white/10 overflow-hidden"
            >
              <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 p-4 text-center">
                <h4 className="text-xl font-bold text-white">
                  {dayNames[index].toUpperCase()} {day}
                </h4>
              </div>
              <div className="space-y-1">
                {dayMeetings.map((meeting, meetingIndex) => (
                  <div
                    key={meetingIndex}
                    className="grid grid-cols-2 md:grid-cols-6 bg-black/20 hover:bg-black/30 transition-colors"
                  >
                    <div className="p-3 bg-white/5 font-medium text-white/80 md:text-center">
                      <div className="md:hidden font-semibold mb-1">LUGAR</div>
                      {meeting.lugar}
                    </div>
                    <div className="p-3 text-white md:text-center">
                      <div className="md:hidden font-semibold mb-1 text-white/80">
                        HORA
                      </div>
                      {meeting.hora}
                    </div>
                    <div className="p-3 bg-white/5 text-white md:text-center">
                      <div className="md:hidden font-semibold mb-1 text-white/80">
                        CONDUCTOR
                      </div>
                      {meeting.conductor}
                    </div>
                    <div className="p-3 text-white md:text-center">
                      <div className="md:hidden font-semibold mb-1 text-white/80">
                        AUXILIAR
                      </div>
                      {meeting.auxiliar || "---"}
                    </div>
                    <div className="p-3 bg-white/5 text-white md:text-center">
                      <div className="md:hidden font-semibold mb-1 text-white/80">
                        FACETA
                      </div>
                      {meeting.faceta}
                    </div>
                    <div className="p-3 text-white md:text-center">
                      <div className="md:hidden font-semibold mb-1 text-white/80">
                        TERRITORIO
                      </div>
                      {meeting.territorio || "---"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {weekProgram.length === 0 && (
          <div className="text-center text-white/60 py-12">
            <p>No hay programa para esta semana.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Main Program Manager Component
export const ProgramManager: React.FC<ProgramManagerProps> = ({
  conductores,
  lugares,
  facetas,
  isAdmin,
  onShowToast,
  onProgramCreated,
}) => {
  const [programa, setPrograma] = useState<ProgramaReunion[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [showAddLugar, setShowAddLugar] = useState(false);
  const [showAddFaceta, setShowAddFaceta] = useState(false);

  // Subscribe to program changes
  useEffect(() => {
    const unsubscribe = firebaseService.subscribeToProgram(setPrograma);
    return unsubscribe;
  }, []);

  // Handle program submission
  const handleProgramSubmit = async (
    programaData: Omit<ProgramaReunion, "id" | "timestamp">
  ) => {
    try {
      const programaId = await firebaseService.addProgram(programaData);

      onShowToast("Programa guardado exitosamente.", "success");
      onProgramCreated?.({
        ...programaData,
        id: programaId,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Error saving program:", error);
      onShowToast("No se pudo guardar la información.", "error");
    }
  };

  // Handle adding lugar
  const handleAddLugar = async (nombre: string) => {
    try {
      await firebaseService.addLugar(nombre);
      onShowToast("Lugar añadido correctamente.", "success");
    } catch (error) {
      console.error("Error adding lugar:", error);
      onShowToast("Error al añadir el lugar.", "error");
    }
  };

  // Handle adding faceta
  const handleAddFaceta = async (nombre: string) => {
    try {
      await firebaseService.addFaceta(nombre);
      onShowToast("Faceta añadida correctamente.", "success");
    } catch (error) {
      console.error("Error adding faceta:", error);
      onShowToast("Error al añadir la faceta.", "error");
    }
  };

  // Handle PDF export
  const handleExportPDF = async () => {
    const { weekProgram, dateRange } = (() => {
      const today = new Date();
      today.setDate(today.getDate() + weekOffset * 7);
      const dayOfWeek = today.getDay();
      const firstDayOfWeek = new Date(today);
      firstDayOfWeek.setDate(
        today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)
      );

      const week = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(firstDayOfWeek);
        date.setDate(firstDayOfWeek.getDate() + i);
        return date.toISOString().slice(0, 10);
      });

      const lastDayOfWeek = new Date(week[6] + "T00:00:00");
      const dateRange = `${firstDayOfWeek.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
      })} - ${lastDayOfWeek.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}`;

      const weekProgram = programa.filter((p) => week.includes(p.fecha));

      return { weekProgram, dateRange };
    })();

    if (weekProgram.length === 0) {
      onShowToast(
        "No hay datos en el programa de esta semana para exportar.",
        "warning"
      );
      return;
    }

    try {
      // Load jsPDF if not already loaded
      if (isAdmin) {
        const script1 = document.createElement("script");
        script1.src =
          "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        await new Promise<void>((resolve, reject) => {
          script1.onload = async () => {
            const script2 = document.createElement("script");
            script2.src =
              "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf-autotable.min.js";
            script2.onload = () => resolve();
            script2.onerror = () =>
              reject(new Error("Failed to load jsPDF autotable"));
            document.head.appendChild(script2);
          };
          script1.onerror = () => reject(new Error("Failed to load jsPDF"));
          document.head.appendChild(script1);
        });
      }

      if (exportProgramToPDF(weekProgram, dateRange)) {
        onShowToast("PDF del programa exportado correctamente.", "success");
      } else {
        onShowToast("Error al generar el PDF.", "error");
      }
    } catch (error) {
      console.error("Error exporting PDF:", error);
      onShowToast("Error al exportar el PDF.", "error");
    }
  };

  if (isAdmin) {
    return (
      <div className="space-y-8">
        <ProgramForm
          conductores={conductores}
          lugares={lugares}
          facetas={facetas}
          onSubmit={handleProgramSubmit}
          onClear={() => {}} // Clear handled in parent component
          onAddLugar={() => setShowAddLugar(true)}
          onAddFaceta={() => setShowAddFaceta(true)}
        />

        <ProgramView
          programa={programa}
          weekOffset={weekOffset}
          onPreviousWeek={() => setWeekOffset((prev) => prev - 1)}
          onNextWeek={() => setWeekOffset((prev) => Math.min(0, prev + 1))}
          onExportPDF={handleExportPDF}
          isAdmin={true}
        />

        {/* Modals */}
        {showAddLugar && (
          <AddLugarModal
            onClose={() => setShowAddLugar(false)}
            onAdd={handleAddLugar}
          />
        )}

        {showAddFaceta && (
          <AddFacetaModal
            onClose={() => setShowAddFaceta(false)}
            onAdd={handleAddFaceta}
          />
        )}
      </div>
    );
  }

  // Conductor view - current week only
  return <ProgramView programa={programa} weekOffset={0} isAdmin={false} />;
};

export default ProgramManager;
