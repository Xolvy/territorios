import { animate } from 'animejs';

/**
 * Super Premium UI Component Library for Vite 2026
 * Optimized for tree-shaking and performance
 */

export const GlassCard = (content, className = '') => `
    <div class="glass-morphism p-6 rounded-[2rem] border border-white/10 shadow-xl ${className}">
        ${content}
    </div>
`;

export const GlassButton = (text, icon = '', variant = 'primary', className = '', id = '') => {
    const variants = {
        primary: 'bg-primary hover:bg-primary-light text-white shadow-primary/20',
        secondary: 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10',
        danger: 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20',
        ghost: 'bg-transparent border-2 border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'
    };

    return `
        <button ${id ? `id="${id}"` : ''} class="pro-button px-6 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 ${variants[variant]} ${className}">
            ${icon ? `<i class="${icon}"></i>` : ''}
            <span>${text}</span>
        </button>
    `;
};

export const GlassInput = (label, id, type = 'text', value = '', placeholder = '') => `
    <div class="space-y-2 group">
        <label class="block text-[10px] uppercase text-slate-600 dark:text-slate-400 font-black tracking-widest ml-1 transition-colors group-focus-within:text-primary">${label}</label>
        <input type="${type}" id="${id}" value="${value}" placeholder="${placeholder}" 
            class="w-full bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-xs text-slate-700 dark:text-slate-200 focus:border-primary outline-none font-bold transition-all shadow-sm focus:shadow-lg focus:shadow-primary/10">
    </div>
`;

export const Badge = (text, variant = 'teal') => {
    const variants = {
        teal: 'bg-teal-500/10 text-teal-600 border-teal-500/20',
        rose: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
        amber: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
        indigo: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
        slate: 'bg-slate-500/10 text-slate-600 border-slate-500/20'
    };
    return `<span class="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${variants[variant]}">${text}</span>`;
};

export const animateEntrance = (selector) => {
    try {
        animate(selector, {
            opacity: [0, 1],
            translateY: [20, 0],
            scale: [0.95, 1],
            duration: 800,
            delay: 50,
            ease: 'outQuart'
        });
    } catch (e) {
        console.warn("Animation failed", e);
    }
};
