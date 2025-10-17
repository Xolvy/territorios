import { Suspense } from 'react';
import Link from 'next/link';
import FirebaseTest from '@/components/FirebaseTest';

export default function TestFirebasePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">
          🔥 Prueba de Configuración Firebase
        </h1>
        
        <Suspense fallback={
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-lg">Cargando prueba de Firebase...</p>
          </div>
        }>
          <FirebaseTest />
        </Suspense>
        
        <div className="mt-8 text-center">
          <Link 
            href="/" 
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Volver al App Principal
          </Link>
        </div>
      </div>
    </div>
  );
}