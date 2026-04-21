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
            title: 'Tutorial Interactivo',
            icon: 'fa-magic',
            color: 'text-emerald-500',
            bg: 'bg-emerald-500/10',
            action: () => window.startOnboarding()
        }
    ];

    container.innerHTML = resources.map((r, i) => `
        <div onclick="window.handleRecursoBtn(${i})" class="modern-card p-6 border-slate-100 dark:border-white/5 flex items-center gap-6 group hover:translate-y-[-4px] transition-all cursor-pointer bg-white dark:bg-slate-900/40 w-full mb-4 md:mb-0">
            <div class="w-14 h-14 ${r.bg} ${r.color} rounded-2xl flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform shrink-0">
                <i class="fas ${r.icon}"></i>
            </div>
            <div class="flex-1">
                <h4 class="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-tight group-hover:text-primary transition-colors line-clamp-2">${r.title}</h4>
                <p class="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-1 opacity-80">Recurso de Ayuda</p>
            </div>
        </div>
    `).join('');

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
            { q: '¿Cómo informo un territorio?', a: 'En tu Agenda Inteligente, pulsa "Informar". Ahora puedes adjuntar fotos de evidencia, dictar notas por voz y reportar avances por manzanas (informe parcial) si no terminaste todo el sector.' },
            { q: '¿Cómo solicito números telefónicos?', a: 'En "Predicación Telefónica" pulsa "Solicitar". El sistema te asignará un bloque. Al terminar, usa el botón "Finalizar Sesión" para registrar tu actividad y liberar los números pendientes.' },
            { q: '¿Qué es el botón "TERRITORIOS DISPONIBLES"?', a: 'Muestra territorios libres (DISPONIBLE) o que han quedado a medias (INCOMPLETO). Puedes tomarlos voluntariamente para ayudar a terminar el sector de la congregación.' },
            { q: '¿Cómo funcionan las Revisitas telefónicas?', a: 'Usa el botón "Revisitas" en el módulo de teléfonos para ver contactos interesados. Puedes llamarlos directamente o devolverlos al pozo general si ya no son necesarios.' },
            { q: '¿Se pueden informar varios territorios a la vez?', a: '¡Sí! Al abrir el modal de informe, puedes marcar las casillas de varios territorios y enviar un reporte masivo con una sola nota, ahorrando tiempo.' }
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
                                <p class="text-[12px] text-slate-500 dark:text-slate-400 font-bold leading-relaxed">Usa el mapa individual para tu sector o el <b>Explorador Global</b> (disponible en vista Imagen o Satélite) para ver toda la congregación con sus polígonos actualizados.</p>
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

    window.startOnboarding = () => {
        try {
            const steps = [
                { id: 'agenda-section', title: '¡Hola! Soy Nexo', text: '¡Hola! Soy Nexo, la IA de tu plataforma preparada para ayudarte. Hoy seré tu guía en este recorrido por tu nuevo panel de control.' },
                { id: 'agenda-section', title: 'Agenda Inteligente', text: 'Aquí en la Agenda Inteligente, yo te mostraré tus próximas asignaciones, como los territorios y compañeros de servicio que tienes para hoy.' },
                { id: 'programa-semanal-section', title: 'Cronograma Semanal', text: 'Esta es nuestra base de operaciones. Aquí organizo toda la predicación de la semana para que sepas exactamente a quién le toca y en qué punto reunirse.' },
                { id: 'interactive-maps-module', title: 'Explorador de Mapas', text: '¿Necesitas ver un sector? Utiliza mi explorador para buscar manzanas o territorios específicos con una vista satelital técnica y precisa.' },
                { id: 'phone-module-card', title: 'Predicación Telefónica', text: 'Si estás predicando por Zoom, esta es tu área. Solicítame números de teléfono y yo te asignaré un bloque activo de inmediato.' }
            ];

            let currentStep = 0;

            // 1. Eliminar instancias previas si existen
            const oldOverlay = document.getElementById('nexo-tour-overlay');
            const oldTooltip = document.getElementById('nexo-tour-tooltip');
            if (oldOverlay) oldOverlay.remove();
            if (oldTooltip) oldTooltip.remove();

            // 2. Crear Overlay
            const overlay = document.createElement('div');
            overlay.id = 'nexo-tour-overlay';
            overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15, 23, 42, 0.8); z-index: 999998; transition: opacity 0.5s; opacity: 0; pointer-events: auto;';

            // 3. Crear Highlight Box
            const highlightBox = document.createElement('div');
            highlightBox.id = 'nexo-tour-highlight';
            highlightBox.style.cssText = 'position: absolute; border: 2px solid #10B981; border-radius: 16px; box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.8), 0 0 30px rgba(16, 185, 129, 0.5); transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1); z-index: 999998; pointer-events: none;';

            // 4. Crear Tooltip (Inyección directa al Body)
            const tooltip = document.createElement('div');
            tooltip.id = 'nexo-tour-tooltip';
            tooltip.style.cssText = 'position: fixed; z-index: 999999; background: white; color: #333; padding: 24px; border-radius: 20px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); min-width: 280px; max-width: 350px; transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1); opacity: 0; transform: scale(0.9); font-family: sans-serif;';

            const finishTour = () => {
                overlay.style.opacity = '0';
                tooltip.style.opacity = '0';
                tooltip.style.transform = 'scale(0.9)';
                setTimeout(() => {
                    if (overlay.parentNode) overlay.remove();
                    if (tooltip.parentNode) tooltip.remove();
                }, 500);
            };

            const goToStep = (index) => {
                try {
                    if (index >= steps.length) return finishTour();

                    const step = steps[index];
                    const target = document.getElementById(step.id);

                    if (!target || target.offsetParent === null) {
                        return goToStep(index + 1);
                    }

                    target.scrollIntoView({ behavior: 'smooth', block: 'center' });

                    setTimeout(() => {
                        const rect = target.getBoundingClientRect();

                        // Posicionar Highlight
                        highlightBox.style.top = `${rect.top + window.scrollY - 10}px`;
                        highlightBox.style.left = `${rect.left + window.scrollX - 10}px`;
                        highlightBox.style.width = `${rect.width + 20}px`;
                        highlightBox.style.height = `${rect.height + 20}px`;

                        // Contenido del Tooltip
                        tooltip.innerHTML = `
                            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                                <div style="width: 40px; height: 40px; background: rgba(79, 70, 229, 0.1); color: #4F46E5; border-radius: 12px; display: flex; align-items: center; justify-center; font-size: 20px;">
                                    <i class="fas fa-robot"></i>
                                </div>
                                <strong style="color: #4F46E5; font-size: 16px; text-transform: uppercase; letter-spacing: -0.5px;">🤖 Nexo:</strong>
                            </div>
                            <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 900; color: #1e293b; text-transform: uppercase;">${step.title}</h4>
                            <p style="margin: 0; font-size: 13px; color: #64748b; font-weight: 500; line-height: 1.6;">${step.text}</p>
                            
                            <div style="display: flex; justify-between; align-items: center; margin-top: 24px; gap: 15px;">
                                <span style="font-size: 10px; font-weight: 900; color: #cbd5e1; text-transform: uppercase; letter-spacing: 1px;">${index + 1} / ${steps.length}</span>
                                <div style="display: flex; gap: 8px; margin-left: auto;">
                                    <button id="nexo-tour-skip" style="background: none; border: none; font-size: 10px; font-weight: 900; color: #94a3b8; cursor: pointer; text-transform: uppercase; padding: 8px;">Saltar</button>
                                    <button id="nexo-tour-next" style="background: #4F46E5; color: white; border: none; border-radius: 10px; padding: 8px 20px; font-size: 10px; font-weight: 900; cursor: pointer; text-transform: uppercase; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3); transition: all 0.2s;">
                                        ${index === steps.length - 1 ? 'Finalizar' : 'Siguiente'}
                                    </button>
                                </div>
                            </div>
                        `;

                        // Posicionar Tooltip (Fixed)
                        let top = rect.bottom + 20;
                        let left = rect.left + (rect.width / 2) - 175;

                        // Ajustes de pantalla
                        if (top + 250 > window.innerHeight) top = rect.top - 280;
                        if (left < 20) left = 20;
                        if (left + 350 > window.innerWidth) left = window.innerWidth - 370;

                        tooltip.style.top = `${top}px`;
                        tooltip.style.left = `${left}px`;
                        tooltip.style.opacity = '1';
                        tooltip.style.transform = 'scale(1)';

                        // Eventos
                        tooltip.querySelector('#nexo-tour-next').onclick = () => {
                            tooltip.style.opacity = '0';
                            tooltip.style.transform = 'scale(0.9)';
                            currentStep++;
                            goToStep(currentStep);
                        };
                        tooltip.querySelector('#nexo-tour-skip').onclick = finishTour;

                    }, 600);
                } catch (err) {
                    console.error("Error en paso de Onboarding:", err);
                    finishTour();
                }
            };

            // Inicializar
            document.body.appendChild(overlay);
            overlay.appendChild(highlightBox);
            document.body.appendChild(tooltip); // Inyección directa al body

            setTimeout(() => {
                overlay.style.opacity = '1';
                goToStep(0);
            }, 50);

        } catch (error) {
            console.error("Error crítico en Onboarding:", error);
        }
    };
};
