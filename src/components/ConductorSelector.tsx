"use client";

import React, { useState } from "react";
import { Conductor } from "@/types";
import TerritoryManager from "@/components/modules/TerritoryManager";

interface ConductorSelectorProps {
  conductores: Conductor[];
  selectedConductor: string;
  onConductorSelect: (conductorName: string) => void;
}

export const ConductorSelector: React.FC<ConductorSelectorProps> = ({
  conductores,
  selectedConductor,
  onConductorSelect,
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-white/5 rounded-xl border border-white/20 p-6">
        <div className="flex flex-col gap-4">
          <label className="text-white/80 font-medium">
            Selecciona tu nombre para ver tus asignaciones
          </label>
          <select
            value={selectedConductor}
            onChange={(e) => onConductorSelect(e.target.value)}
            className="w-full max-w-md px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
          >
            <option value="">Seleccionar conductor...</option>
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
      </div>

      {selectedConductor && (
        <TerritoryManager
          conductores={conductores}
          lugares={[]}
          facetas={[]}
          isAdmin={false}
          selectedConductor={selectedConductor}
          onShowToast={() => {}}
        />
      )}
    </div>
  );
};

export default ConductorSelector;
