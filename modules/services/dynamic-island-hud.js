/**
 * @file modules/services/dynamic-island-hud.js
 * @description Dynamic Island HUD - Componente de Notificaciones e Indicadores de Estado
 * Adaptado para Android (Punch-Hole / Samsung NowBar) e iOS (Notch / Dynamic Island).
 */

export class DynamicIslandHUD {
    static instance = null;

    static init() {
        if (this.instance) return this.instance;
        this.instance = new DynamicIslandHUD();
        return this.instance;
    }

    constructor() {
        this.hudEl = null;
        this.timeoutId = null;
        this.activeState = "idle";
        this.createDOM();
        this.listenNetworkEvents();
    }

    createDOM() {
        if (document.getElementById("xolvy-dynamic-island-hud")) return;

        const container = document.createElement("div");
        container.id = "xolvy-dynamic-island-hud";
        container.className =
            "fixed top-2 left-1/2 -translate-x-1/2 z-[10005] pointer-events-auto transition-all duration-500 ease-out max-w-[90vw] sm:max-w-md select-none";
        
        // CSS custom properties for safe-area top
        container.style.top = "calc(0.5rem + env(safe-area-inset-top, 0px))";

        container.innerHTML = `
            <div id="dynamic-island-pill" 
                 class="group relative flex items-center justify-between gap-3 px-4 py-2 bg-slate-900/90 dark:bg-black/90 text-white rounded-full border border-white/15 shadow-2xl backdrop-blur-2xl transition-all duration-500 ease-spring scale-95 opacity-0 cursor-pointer overflow-hidden min-h-[38px] max-w-[320px]">
                
                <!-- Glow Effect -->
                <div id="dynamic-island-glow" class="absolute inset-0 bg-gradient-to-r from-emerald-500/20 via-indigo-500/20 to-purple-500/20 opacity-0 transition-opacity duration-500 pointer-events-none"></div>

                <!-- Left Icon -->
                <div id="dynamic-island-icon" class="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs shrink-0 transition-transform duration-300">
                    <i class="fas fa-signal text-[10px]"></i>
                </div>

                <!-- Center Message -->
                <div class="flex flex-col min-w-0 flex-1">
                    <span id="dynamic-island-title" class="font-extrabold text-[10px] sm:text-[11px] uppercase tracking-wider text-slate-100 truncate leading-tight">
                        Sistema Listo
                    </span>
                    <span id="dynamic-island-sub" class="font-bold text-[8px] uppercase tracking-widest text-slate-400 truncate leading-tight hidden">
                        Conectado
                    </span>
                </div>

                <!-- Right Action / Indicator -->
                <div id="dynamic-island-action" class="shrink-0 flex items-center gap-1 text-[9px] font-black uppercase text-emerald-400">
                    <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                </div>
            </div>
        `;

        document.body.appendChild(container);
        this.hudEl = container.querySelector("#dynamic-island-pill");
    }

    show({ title, subtitle = "", icon = "fa-info-circle", color = "emerald", duration = 4000, onClick = null }) {
        if (!this.hudEl) this.createDOM();

        const iconEl = this.hudEl.querySelector("#dynamic-island-icon");
        const titleEl = this.hudEl.querySelector("#dynamic-island-title");
        const subEl = this.hudEl.querySelector("#dynamic-island-sub");
        const actionEl = this.hudEl.querySelector("#dynamic-island-action");
        const glowEl = this.hudEl.querySelector("#dynamic-island-glow");

        // Color mapping
        const colorClasses = {
            emerald: { bg: "bg-emerald-500/20", text: "text-emerald-400", dot: "bg-emerald-500" },
            indigo: { bg: "bg-indigo-500/20", text: "text-indigo-400", dot: "bg-indigo-500" },
            amber: { bg: "bg-amber-500/20", text: "text-amber-400", dot: "bg-amber-500" },
            rose: { bg: "bg-rose-500/20", text: "text-rose-400", dot: "bg-rose-500" },
            purple: { bg: "bg-purple-500/20", text: "text-purple-400", dot: "bg-purple-500" },
        }[color] || { bg: "bg-emerald-500/20", text: "text-emerald-400", dot: "bg-emerald-500" };

        if (iconEl) {
            iconEl.className = `w-6 h-6 rounded-full ${colorClasses.bg} flex items-center justify-center ${colorClasses.text} text-xs shrink-0 transition-transform duration-300`;
            iconEl.innerHTML = `<i class="fas ${icon} text-[10px]"></i>`;
        }

        if (titleEl) titleEl.textContent = title;
        
        if (subEl) {
            if (subtitle) {
                subEl.textContent = subtitle;
                subEl.classList.remove("hidden");
            } else {
                subEl.classList.add("hidden");
            }
        }

        if (actionEl) {
            actionEl.innerHTML = `<span class="w-2 h-2 rounded-full ${colorClasses.dot} animate-ping"></span>`;
        }

        if (glowEl) {
            glowEl.style.opacity = "1";
        }

        // Display transition
        this.hudEl.classList.remove("scale-95", "opacity-0");
        this.hudEl.classList.add("scale-100", "opacity-100");

        if (onClick) {
            this.hudEl.onclick = () => {
                onClick();
                this.hide();
            };
        } else {
            this.hudEl.onclick = null;
        }

        if (this.timeoutId) clearTimeout(this.timeoutId);
        if (duration > 0) {
            this.timeoutId = setTimeout(() => this.hide(), duration);
        }
    }

    hide() {
        if (!this.hudEl) return;
        this.hudEl.classList.remove("scale-100", "opacity-100");
        this.hudEl.classList.add("scale-95", "opacity-0");
        const glowEl = this.hudEl.querySelector("#dynamic-island-glow");
        if (glowEl) glowEl.style.opacity = "0";
    }

    listenNetworkEvents() {
        window.addEventListener("online", () => {
            this.show({
                title: "Conexión Restablecida",
                subtitle: "Sistema en línea",
                icon: "fa-wifi",
                color: "emerald",
                duration: 3500,
            });
        });

        window.addEventListener("offline", () => {
            this.show({
                title: "Modo Offline Activo",
                subtitle: "Datos guardados localmente",
                icon: "fa-plane",
                color: "amber",
                duration: 5000,
            });
        });
    }
}

export const initDynamicIslandHUD = () => DynamicIslandHUD.init();
window.DynamicIslandHUD = DynamicIslandHUD;
