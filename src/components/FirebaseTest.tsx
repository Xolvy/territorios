"use client";

import React, { useEffect, useState } from "react";

export const FirebaseTest: React.FC = () => {
  const [status, setStatus] = useState<string>("Verificando Firebase...");
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${message}`,
    ]);
  };

  useEffect(() => {
    const testFirebase = async () => {
      try {
        addLog("🚀 Iniciando prueba de Firebase");
        
        // Import Firebase dynamically to avoid SSR issues
        const { auth, db } = await import("@/lib/firebase");
        const { collection, addDoc, getDocs } = await import("firebase/firestore");
        const { signInAnonymously } = await import("firebase/auth");
        
        // Test 1: Verificar inicialización
        if (!auth || !db) {
          setStatus("❌ Firebase no está inicializado");
          addLog("❌ Firebase no está disponible");
          return;
        }
        
        addLog("✅ Firebase inicializado correctamente");
        
        // Test 2: Verificar autenticación anónima
        addLog("🔐 Probando autenticación anónima...");
        await signInAnonymously(auth);
        addLog("✅ Autenticación anónima exitosa");
        
        // Test 3: Verificar Firestore
        addLog("📊 Probando conexión a Firestore...");
        const testCollection = collection(db, "test");
        
        // Intentar escribir un documento de prueba
        const docRef = await addDoc(testCollection, {
          message: "Prueba de conexión Firebase",
          timestamp: new Date(),
          app: "conductores-app-v2",
        });
        
        addLog(`✅ Documento creado con ID: ${docRef.id}`);
        
        // Intentar leer documentos
        const querySnapshot = await getDocs(testCollection);
        addLog(`✅ Documentos leídos: ${querySnapshot.size}`);
        
        setStatus("✅ Firebase funcionando perfectamente");
        addLog("🎉 Todas las pruebas de Firebase exitosas");
        
      } catch (error: any) {
        setStatus(`❌ Error: ${error.message}`);
        addLog(`❌ Error en prueba: ${error.message}`);
        console.error("Firebase test error:", error);
      }
    };

    testFirebase();
  }, []);

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4 text-center">
        🔥 Prueba de Firebase
      </h2>

      <div className="mb-4 p-3 rounded-lg bg-gray-100">
        <h3 className="font-semibold text-lg mb-2">Estado:</h3>
        <p className="text-lg">{status}</p>
      </div>

      <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm max-h-64 overflow-y-auto">
        <h3 className="text-white font-semibold mb-2">📋 Logs de Prueba:</h3>
        {logs.map((log, index) => (
          <div key={index} className="mb-1">
            {log}
          </div>
        ))}
      </div>

      <div className="mt-4 text-sm text-gray-600">
        <p>
          <strong>Proyecto:</strong> conductores-9oct
        </p>
        <p>
          <strong>API Key:</strong>{" "}
          {process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.substring(0, 10)}...
        </p>
      </div>
    </div>
  );
};

export default FirebaseTest;
