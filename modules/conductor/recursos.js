import { getRecursos } from '../../data/firestore-services.js';
import { showModal } from '../services/ui-helpers.js';

export const renderRecursosSection = (container) => {
    if (!container) return;

    const resources = [
        {
            title: 'Ayudas para el ministerio',
            icon: 'fa-book-open',
            color: 'text-blue-500',
            bg: 'bg-blue-500/10',
            action: () => window.showGuiaPredicacion()
        },
        {
            title: 'Cómo usar el Mapa',
            icon: 'fa-map-marked-alt',
            color: 'text-indigo-500',
            bg: 'bg-indigo-500/10',
            action: () => window.showComoUsarMapa()
        },
        {
            title: 'Preguntas Frecuentes',
            icon: 'fa-question-circle',
            color: 'text-rose-500',
            bg: 'bg-rose-500/10',
            action: () => window.showPreguntasFrecuentes()
        },
        {
            title: 'Contacto Soporte',
            icon: 'fa-headset',
            color: 'text-emerald-500',
            bg: 'bg-emerald-500/10',
            action: () => window.open('https://wa.me/593994749286', '_blank')
        }
    ];

    container.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in mb-24">
            ${resources.map((r, i) => `
                <div onclick="window.handleRecursoBtn(${i})" class="modern-card p-6 border-slate-100 dark:border-white/5 flex items-center gap-6 group hover:translate-y-[-4px] transition-all cursor-pointer bg-white dark:bg-slate-900/40">
                    <div class="w-14 h-14 ${r.bg} ${r.color} rounded-2xl flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform">
                        <i class="fas ${r.icon}"></i>
                    </div>
                    <div>
                        <h4 class="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-tight group-hover:text-primary transition-colors">${r.title}</h4>
                        <p class="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-1 opacity-60">Recurso de Ayuda</p>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    window.handleRecursoBtn = (index) => {
        resources[index].action();
    };

    window.showGuiaPredicacion = async () => {
        const data = await getRecursos();
        showModal(`
            <div class="flex flex-col h-full bg-slate-50 dark:bg-[#0a0f18] rounded-[3rem] overflow-hidden">
                <header class="shrink-0 bg-blue-600 p-8 text-white relative overflow-hidden">
                    <div class="absolute top-0 right-0 p-8 opacity-10 text-8xl grayscale pointer-events-none">
                        <i class="fas fa-book-open"></i>
                    </div>
                    <div class="flex items-center gap-6 relative z-10">
                        <div class="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-3xl shadow-lg backdrop-blur-md">
                            <i class="fas fa-graduation-cap"></i>
                        </div>
                        <div class="space-y-1">
                            <h3 class="text-2xl font-black uppercase tracking-tighter">Ayudas para el Ministerio</h3>
                            <p class="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Material de apoyo y herramientas</p>
                        </div>
                    </div>
                </header>
                <div class="flex-1 overflow-y-auto custom-scrollbar p-8 bg-white dark:bg-black/20">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        ${data.length === 0 ? `
                            <div class="col-span-full py-20 text-center opacity-30">
                                <i class="fas fa-folder-open text-5xl mb-4"></i>
                                <p class="text-[10px] font-black uppercase tracking-widest">No hay guías registradas todavía</p>
                            </div>
                        ` : data.map(r => `
                            <div onclick="window.open('${r.url}', '_blank')" class="modern-card p-6 border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5 hover:border-blue-500/30 transition-all cursor-pointer group">
                                <div class="flex items-center gap-5">
                                    <div class="w-16 h-12 bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center text-xl group-hover:scale-105 transition-transform overflow-hidden border border-blue-500/10">
                                        ${r.imagen ?
                `<img src="${r.imagen}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity">` :
                `<i class="fas fa-file-pdf"></i>`
            }
                                    </div>
                                    <div class="flex-1">
                                        <h4 class="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tight">${r.titulo}</h4>
                                        <p class="text-[9px] text-slate-400 font-bold uppercase mt-1 line-clamp-1">${r.descripcion || 'Click para abrir recurso'}</p>
                                    </div>
                                    <i class="fas fa-chevron-right text-slate-300 text-xs"></i>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `, null, 'max-w-2xl');
    };

    window.showPreguntasFrecuentes = () => {
        const faqs = [
            { q: '¿Cómo informo un territorio?', a: 'En tu Agenda Inteligente, pulsa el botón "Informar" en la tarjeta del territorio correspondiente. Podrás marcarlo como terminado o entrega parcial.' },
            { q: '¿Cómo solicito números telefónicos?', a: 'Ve a la sección "Predicación Telefónica", elige la cantidad de números que necesitas (ej: 5, 10 o 15) y pulsa "Solicitar Números". El sistema te asignará un bloque disponible al instante.' },
            { q: '¿Cómo veo los límites del territorio?', a: 'Usa el "Explorer de Mapas" para tu sector o pulsa "Mapa Satelital" en la cabecera para ver el Explorador Global con todos los polígonos y puntos de referencia de la congregación.' },
            { q: '¿Qué es el botón "POR COMPLETAR"?', a: 'Son las Misiones de Rescate o "Bolsa de Trabajo". Aquí aparecen territorios con mucho retraso o que están libres para que cualquier publicador pueda ayudar a completarlos voluntariamente.' },
            { q: '¿Qué hacer si no puedo predicar mi turno?', a: 'Ve a "Mi Disponibilidad" y desmarca el turno. Esto avisará al sistema y al responsable para que el territorio sea liberado y pueda ser asignado a otro compañero.' }
        ];

        showModal(`
            <div class="flex flex-col h-full bg-slate-50 dark:bg-[#0a0f18] rounded-[3rem] overflow-hidden">
                <header class="shrink-0 bg-rose-600 p-8 text-white relative overflow-hidden">
                    <div class="absolute top-0 right-0 p-8 opacity-10 text-8xl grayscale pointer-events-none">
                        <i class="fas fa-question-circle"></i>
                    </div>
                    <div class="flex items-center gap-6 relative z-10">
                        <div class="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-3xl shadow-lg backdrop-blur-md">
                            <i class="fas fa-lightbulb"></i>
                        </div>
                        <div class="space-y-1">
                            <h3 class="text-2xl font-black uppercase tracking-tighter">Centro de Ayuda</h3>
                            <p class="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Preguntas frecuentes y soporte</p>
                        </div>
                    </div>
                </header>
                <div class="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-4 bg-white dark:bg-black/20">
                    ${faqs.map(f => `
                        <details class="modern-card p-6 bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/5 group">
                            <summary class="list-none cursor-pointer flex justify-between items-center outline-none">
                                <h4 class="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tight pr-6">${f.q}</h4>
                                <i class="fas fa-chevron-down text-slate-300 group-open:rotate-180 transition-transform"></i>
                            </summary>
                            <div class="mt-4 pt-4 border-t border-slate-200 dark:border-white/5">
                                <p class="text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed font-bold">${f.a}</p>
                            </div>
                        </details>
                    `).join('')}
                </div>
            </div>
        `, null, 'max-w-md');
    };

    window.showComoUsarMapa = () => {
        showModal(`
            <div class="flex flex-col h-full bg-slate-50 dark:bg-[#0a0f18] rounded-[3rem] overflow-hidden">
                <header class="shrink-0 bg-indigo-600 p-8 text-white relative overflow-hidden">
                    <div class="absolute top-0 right-0 p-8 opacity-10 text-8xl grayscale pointer-events-none">
                        <i class="fas fa-map-marked-alt"></i>
                    </div>
                    <div class="flex items-center gap-6 relative z-10">
                        <div class="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-3xl shadow-lg backdrop-blur-md">
                            <i class="fas fa-location-dot"></i>
                        </div>
                        <div class="space-y-1">
                            <h3 class="text-2xl font-black uppercase tracking-tighter">Guía del Mapa</h3>
                            <p class="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Uso del mapa interactivo satelital</p>
                        </div>
                    </div>
                </header>
                <div class="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8 bg-white dark:bg-black/20">
                    <div class="space-y-6">
                        <div class="flex gap-4">
                            <div class="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 font-black">1</div>
                            <div class="space-y-1">
                                <h5 class="text-xs font-black text-slate-800 dark:text-white uppercase">Exploración Dual</h5>
                                <p class="text-[12px] text-slate-500 dark:text-slate-400 font-bold leading-relaxed">Usa el mapa individual para tu sector o el <b>Explorador Global</b> para ver toda la congregación con sus polígonos actualizados en tiempo real.</p>
                            </div>
                        </div>
                        <div class="flex gap-4">
                            <div class="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 font-black">2</div>
                            <div class="space-y-1">
                                <h5 class="text-xs font-black text-slate-800 dark:text-white uppercase">Radar GPS Automático</h5>
                                <p class="text-[12px] text-slate-500 dark:text-slate-400 font-bold leading-relaxed">El sistema activa un <b>radar de ubicación (círculo índigo)</b> que te sigue automáticamente. Ya no necesitas pulsar botones para saber dónde estás.</p>
                            </div>
                        </div>
                        <div class="flex gap-4">
                            <div class="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 font-black">3</div>
                            <div class="space-y-1">
                                <h5 class="text-xs font-black text-slate-800 dark:text-white uppercase">Perspectiva y 3D</h5>
                                <p class="text-[12px] text-slate-500 dark:text-slate-400 font-bold leading-relaxed">Activa el <b>modo 3D</b> para identificar entradas y alturas. Toca cualquier polígono para ver información del territorio o puntos de interés.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `, null, 'max-w-md');
    };
};
