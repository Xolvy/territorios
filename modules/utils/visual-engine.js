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
    // CURRENT VISUAL GENERATION: 3.0 (Modern Professional SaaS)
    version: "3.0.2027",

    /**
     * 🟢 MODO DE USO PARA EL USUARIO:
     * El sistema ha pasado a un estilo SaaS Robusto (FinTech/CRM).
     * Fondo Gris Tenue (Slate-100) + Tarjetas Blancas (Shadow-MD).
     */
    activeProfile: "professional_saas",

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
            container: "min-h-screen bg-slate-100 dark:bg-[#0f172a] transition-colors duration-300 ease-out text-slate-900 dark:text-slate-100 tracking-tight",
            mainOrder: "max-w-full mx-auto animate-fade-in"
        },

        // Header System (Fase 2)
        header: {
            wrapper: "bg-white dark:bg-[#1e293b] h-16 w-full px-6 flex items-center justify-between sticky top-0 z-[100]",
            glow: "hidden"
        },

        // Bento Box Card System (Fase 1)
        card: {
            base: "bg-white dark:bg-[#1e293b] rounded-xl border border-slate-100 dark:border-white/5 shadow-md hover:shadow-lg transition-all duration-300",
            premium: "bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-100 dark:border-white/5 shadow-lg hover:shadow-xl transition-all duration-300",
            flat: "bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.05] rounded-xl p-5 hover:bg-white transition-all duration-300",
            interactive: "cursor-pointer group hover:border-blue-600/40 active:scale-[0.98] transition-all"
        },

        // Button System (Fase 3: Py-2, no fixed height)
        button: {
            base: "inline-flex items-center justify-center gap-2.5 px-6 py-2.5 rounded-xl font-bold text-[11px] uppercase tracking-widest transition-all active:scale-95",
            primary: "bg-blue-600 text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 hover:shadow-lg",
            secondary: "bg-slate-800 text-white shadow-sm hover:bg-slate-900",
            danger: "bg-rose-600 text-white shadow-sm hover:bg-rose-700",
            ghost: "bg-transparent text-slate-500 hover:text-blue-600 hover:bg-blue-50"
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
