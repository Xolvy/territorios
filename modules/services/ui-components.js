
export const GlassCard = (content, className = '') => `
    <div class="glass-morphism p-6 rounded-[2rem] border border-white/10 shadow-xl ${className}">
        ${content}
    </div>
`;

export const GlassButton = (text, icon = '', variant = 'primary', className = '', id = '') => {
    const variants = {
        primary: 'bg-primary hover:bg-primary-light text-white shadow-primary/20',
        secondary: 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10',
        danger: 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20'
    };

    return `
        <button ${id ? `id="${id}"` : ''} class="px-6 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 ${variants[variant]} ${className}">
            ${icon ? `<i class="${icon}"></i>` : ''}
            ${text}
        </button>
    `;
};

export const GlassInput = (label, id, type = 'text', value = '', placeholder = '') => `
    <div class="space-y-2">
        <label class="block text-[10px] uppercase text-slate-400 font-black tracking-widest ml-1">${label}</label>
        <input type="${type}" id="${id}" value="${value}" placeholder="${placeholder}" 
            class="w-full bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-xs text-slate-700 dark:text-slate-200 focus:border-primary outline-none font-bold transition-all shadow-sm">
    </div>
`;
