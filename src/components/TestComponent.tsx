"use client";

import React from "react";

export default function TestComponent() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-green-600">
        ¡Componente de prueba funcionando!
      </h1>
      <p className="mt-2">
        Este es un componente simple para probar que la aplicación está
        funcionando.
      </p>
      <div className="mt-4 p-4 bg-blue-100 rounded-lg">
        <p>
          Si puedes ver esto, React y Next.js están funcionando correctamente.
        </p>
      </div>
    </div>
  );
}
