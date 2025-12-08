import React from 'react';

interface Anuncio {
  id: string;
  mensaje: string;
  tipo?: 'info' | 'warning' | 'success';
  activo?: boolean;
}

interface AnunciosBannerProps {
  anuncios?: Anuncio[];
}

export function AnunciosBanner({ anuncios = [] }: AnunciosBannerProps) {
  const anunciosActivos = anuncios.filter(a => a.activo !== false);
  
  if (anunciosActivos.length === 0) return null;

  return (
    <div className="space-y-3 mb-4">
      {anunciosActivos.map((anuncio) => (
        <div key={anuncio.id} className="anuncio-banner">
          <p>{anuncio.mensaje}</p>
        </div>
      ))}
    </div>
  );
}

export default AnunciosBanner;
