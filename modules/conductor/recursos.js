export const renderRecursosSection = (container) => {
    if (!container) return;

    const recursos = [
        { title: 'Guía de Predicación', icon: 'fa-book-open', color: 'text-blue-500', bg: 'bg-blue-500/10' },
        { title: 'Cómo usar el Mapa', icon: 'fa-map-marked-alt', color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
        { title: 'Preguntas Frecuentes', icon: 'fa-question-circle', color: 'text-rose-500', bg: 'bg-rose-500/10' },
        { title: 'Contacto Soporte', icon: 'fa-headset', color: 'text-emerald-500', bg: 'bg-emerald-500/10' }
    ];

    container.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in">
            ${recursos.map(r => `
                <div class="modern-card p-6 border-slate-100 dark:border-white/5 flex items-center gap-6 group hover:translate-y-[-4px] transition-all cursor-pointer">
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
};
