/**
 * 🚀 XOLVY VISUAL ENGINE 2027 - Advanced Design Orchestrator
 * This is the SINGLE CONTAINER for absolutely all visual aspects of the application.
 * 
 * 📝 INSTRUCCIÓN PARA EL FUTURO:
 * Cuando quieras una nueva renovación (ej. "Estilo 2028"), simplemente abre 
 * modules/utils/visual-engine.js y actualiza las clases en el objeto components.
 * No es necesario modificar el código de cada módulo individualmente.
 */

export const VisualEngine = {
    // CURRENT VISUAL GENERATION: 2.0 (Renovación 2027)
    version: "2.0.2027",

    /**
     * 🟢 MODO DE USO PARA EL USUARIO:
     * Para cambiar TODO el aspecto visual de la aplicación:
     * 1. Modifica los strings en 'components' (ej. cambia 'rounded-2xl' por 'rounded-none').
     * 2. O elige un pre-ajuste en el futuro cambiando el 'activeProfile'.
     */
    activeProfile: "renovacion_2027",

    /**
     * DESIGN TOKENS - The source of truth for all visual values
     */
    tokens: {
        radius: {
            none: "0",
            sm: "0.75rem",
            md: "1.25rem",
            lg: "2rem",
            xl: "3rem",
            full: "9999px"
        },
        shadows: {
            sm: "0 2px 4px 0 rgba(0, 0, 0, 0.05)",
            md: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
            lg: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            xl: "0 35px 60px -15px rgba(0, 0, 0, 0.3)",
            premium: "0 40px 80px -20px hsla(var(--glass-shadow))"
        },
        animations: {
            fast: "150ms cubic-bezier(0.4, 0, 0.2, 1)",
            normal: "300ms cubic-bezier(0.4, 0, 0.2, 1)",
            slow: "600ms cubic-bezier(0.4, 0, 0.2, 1)",
            spring: "500ms cubic-bezier(0.175, 0.885, 0.32, 1.275)"
        }
    },

    /**
     * COMPONENT STYLES - Abstractions for all UI elements
     * Change these strings to change the look of EVERY instance of a component.
     */
    components: {
        // Main App Shell
        shell: {
            container: "min-h-screen bg-hsl(var(--bg-main)) transition-all duration-700 ease-out",
            mainOrder: "max-w-[1600px] mx-auto p-2 md:p-8 animate-fade-in"
        },

        // Header System
        header: {
            wrapper: "flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 lg:mb-10 p-5 md:p-8 glass-morphism rounded-[3rem] gap-6 relative overflow-hidden group",
            glow: "absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none group-hover:from-primary/10 transition-all duration-1000"
        },

        // Card System (The core of 2027 layout)
        card: {
            base: "modern-card transition-all duration-500",
            premium: "modern-card bg-white dark:bg-[#0f1420]/75 backdrop-blur-3xl border border-white/20 dark:border-white/[0.05] rounded-[2.5rem] shadow-premium transition-transform",
            flat: "bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.05] rounded-3xl p-6",
            interactive: "cursor-pointer group hover:border-primary/40 active:scale-[0.98] transition-all"
        },

        // Button System
        button: {
            base: "btn-pro inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all active:scale-95 whitespace-nowrap",
            primary: "bg-primary text-white shadow-xl shadow-primary/20 hover:bg-primary-dark hover:shadow-primary/30",
            secondary: "bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10",
            danger: "bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white border border-rose-500/20",
            ghost: "bg-transparent text-slate-400 hover:text-primary hover:bg-primary/5"
        },

        // Input & Form System
        form: {
            input: "input-premium",
            label: "label-premium",
            select: "input-premium cursor-pointer appearance-none",
            group: "flex flex-col gap-2 relative"
        },

        // HUD & Feedback
        status: {
            badge: "px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg flex items-center gap-2",
            online: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
            offline: "bg-rose-500/10 text-rose-500 border border-rose-500/20 animate-pulse",
            pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
        }
    },

    /**
     * Utility to stringify styles for a component
     */
    get(path) {
        const parts = path.split('.');
        let current = this.components;
        for (const part of parts) {
            if (current[part] === undefined) return "";
            current = current[part];
        }
        return typeof current === 'string' ? current : "";
    },

    /**
     * Orchestrates the 2027 visual injection
     * Call this in app boot to ensure everything is synced.
     */
    applyGlobalEcosystem() {
        console.log(`🚀 XOLVY VISUAL ENGINE [${this.version}] Active`);

        // Inject 2027 Tokens into CSS Variables
        const root = document.documentElement;

        // Radius
        Object.keys(this.tokens.radius).forEach(key => {
            root.style.setProperty(`--radius-xolvy-${key}`, this.tokens.radius[key]);
        });

        // Shadows
        Object.keys(this.tokens.shadows).forEach(key => {
            root.style.setProperty(`--shadow-xolvy-${key}`, this.tokens.shadows[key]);
        });

        // Speed
        Object.keys(this.tokens.animations).forEach(key => {
            root.style.setProperty(`--speed-xolvy-${key}`, this.tokens.animations[key]);
        });
    }
};

// Global Exposure for debugging/runtime tweaks by user
window.VisualEngine = VisualEngine;
