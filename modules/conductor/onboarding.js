import { showNotification } from '../utils/helpers.js';

export const startOnboarding = () => {
    const steps = [
        {
            title: 'Agenda Inteligente',
            icon: 'fas fa-bolt-lightning',
            msg: 'Radar proactivo que analiza tus territorios y te sugiere por dónde empezar hoy según la urgencia y tus asignaciones.'
        },
        {
            title: 'Cronograma de Salidas',
            icon: 'fas fa-calendar-check',
            msg: 'Consulta horarios, conductores y puntos de reunión oficiales de toda la semana para coordinar las salidas del grupo.'
        },
        {
            title: 'Misiones de Rescate',
            icon: 'fas fa-life-ring',
            msg: 'Identifica territorios con más de 48 horas de retraso. Usa el botón "Misiones" para asumir ayuda y apoyar al grupo.'
        },
        {
            title: 'Mi Disponibilidad',
            icon: 'fas fa-user-clock',
            msg: 'Indica los días y turnos en los que puedes conducir para facilitar la organización de la salida al responsable.'
        },
        {
            title: 'Predicación Telefónica',
            icon: 'fas fa-phone-alt',
            msg: 'Centro de llamadas avanzado: solicita números, gestiona compañeros y registra resultados al instante en el reporte.'
        },
        {
            title: 'Mapas Interactivos',
            icon: 'fas fa-map-marked-alt',
            msg: 'Cartografía digital premium. Visualiza manzanas, calles y límites de tus territorios asignados con precisión total.'
        },
        {
            title: 'Recursos del Ministerio',
            icon: 'fas fa-book-open',
            msg: 'Biblioteca digital con videos, guías y metodologías para potenciar tu ministerio y enseñanza en el territorio.'
        },
        {
            title: 'Asistente IA (Gemini)',
            icon: 'fas fa-brain',
            msg: 'Cerebro Territorial: tu guía 24/7. Pregúntale sobre la App, gestión de territorios o pide sugerencias para tu grupo.'
        }
    ];

    let stepIndex = 0;
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[100] flex items-center justify-center p-6';

    const showStep = () => {
        const s = steps[stepIndex];
        overlay.innerHTML = `
            <div class="bg-white dark:bg-[#0f1420] p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/10 max-w-sm w-full animate-slide-up text-center shadow-2xl">
                <div class="w-20 h-20 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-3xl mb-6 mx-auto shadow-inner border border-indigo-500/20 text-indigo-600">
                    <i class="${s.icon} animate-float"></i>
                </div>
                <h3 class="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] mb-3">Tutorial Paso ${stepIndex + 1} de ${steps.length}</h3>
                <h2 class="text-2xl font-black text-slate-800 dark:text-white mb-3 tracking-tighter uppercase tabular-nums">${s.title}</h2>
                <p class="text-slate-500 dark:text-slate-400 mb-8 font-bold leading-relaxed text-xs">${s.msg}</p>
                <div class="flex flex-col gap-2.5">
                    <button id="next-guide" class="w-full py-4.5 bg-indigo-600 text-white rounded-xl font-black shadow-xl shadow-indigo-500/20 hover:bg-indigo-500 active:scale-95 transition-all uppercase tracking-widest text-[10px]">
                        ${stepIndex === steps.length - 1 ? '¡Comenzar ahora!' : 'Siguiente Paso'}
                    </button>
                    <button id="skip-guide" class="w-full py-2 text-slate-400 font-black text-[9px] uppercase tracking-widest hover:text-indigo-600 transition-colors">Saltar Tutorial</button>
                </div>
                <div class="flex justify-center gap-1.5 mt-8">
                    ${steps.map((_, i) => `<div class="h-1 rounded-full ${i === stepIndex ? 'bg-indigo-600 w-6' : 'bg-slate-200 dark:bg-white/10 w-2'} transition-all duration-500"></div>`).join('')}
                </div>
            </div>
        `;
        overlay.querySelector('#next-guide').onclick = () => {
            stepIndex++;
            if (stepIndex >= steps.length) {
                overlay.remove();
                showNotification("¡Ya estás listo para predicar!", "success");
            } else showStep();
        };
        overlay.querySelector('#skip-guide').onclick = () => overlay.remove();
    };

    document.body.appendChild(overlay);
    showStep();
};
