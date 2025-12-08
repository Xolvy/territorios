'use client';

import React from 'react';

interface MainLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
}

export default function MainLayout({ 
  children, 
  title,
  subtitle,
  className = ''
}: MainLayoutProps) {
  return (
    <main className={`main-container ${className}`}>
      {title && (
        <div className="mb-6">
          <h1 className="heading-responsive text-center mb-2">
            {title}
          </h1>
          {subtitle && (
            <p className="text-center text-muted opacity-90">
              {subtitle}
            </p>
          )}
        </div>
      )}
      
      {/* App container con estilos del original */}
      <div className="app">
        {children}
      </div>
    </main>
  );
}

// Componente para el contenedor principal de la aplicación
interface AppContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function AppContainer({ children, className = '' }: AppContainerProps) {
  return (
    <div className={`app ${className}`}>
      {children}
    </div>
  );
}
