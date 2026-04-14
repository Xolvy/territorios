import { startLivePool, returnTerritorio, updateTerritorio } from '../../data/firestore-services.js';
import { showNotification } from '../utils/helpers.js';
import { where } from "firebase/firestore";

/**
 * Singleton instance tracker to prevent memory leaks and state contamination.
 */
let runningHubInstance = null;

/**
 * @class ReceptionHub
 * @description Centro unificado de recepción y entrega de territorios (Live Pool).
 *              Sincroniza en tiempo real las asignaciones para Administradores y Conductores.
 */
export class ReceptionHub {
    constructor(config = {}) {
        // --- 1. PERSISTENCIA ESTRICTA DEL ESTADO ---
        this.viewMode = config.viewMode || 'conductor'; // 'admin' | 'conductor'
        this.displayName = config.displayName || '';
        this.isAdmin = config.isAdmin || false;
        this.preSelectedId = config.preSelectedId || null;

        this.unsubscribe = null;
        this.territories = [];
        this.selections = {}; // Estado temporal: { [tId]: { isFull: bool, manzanas: [], notes: '', conductorFinal: string } }
        this.conductores = [];
    }

    /**
     * Punto de entrada principal estático que maneja el ciclo de vida de la instancia.
     * @param {Object} config - Configuración de la vista ({ viewMode, displayName, isAdmin, preSelectedId })
     */
    static async openModal(config = {}) {
        // Matar instancia previa (Fuga de memoria y contaminación de estado)
        if (runningHubInstance) runningHubInstance.closeModal();

        // Crear instancia limpia
        runningHubInstance = new ReceptionHub(config);
        await runningHubInstance.init();
    }

    /**
     * Inicialización de la instancia y carga de datos.
     */
    async init() {
        let user = window.XolvyApp?.user;

        // Si no se pasaron datos, intentar resolver del contexto global
        if (!this.displayName && user) {
            this.displayName = user.nombre;
            this.isAdmin = user.role === 'Administrador' || user.role === 'SuperAdmin';
        }

        // Cargar conductores para el dropdown
        const { getConductores } = await import('../../data/firestore-services.js');
        getConductores().then(list => {
            this.conductores = list;
            this.renderList();
        });

        // --- 3. FILTRO DE SERVIDOR (RBAC S-13) ---
        // Identity Shield: Use canonical identity for absolute resolution
        const identity = window.XolvyApp?.identity;
        const myCanonicalName = identity?.nombreCanonico || this.displayName;

        const filtros = (this.isAdmin || !myCanonicalName)
            ? []
            : [where("asignado_a", "==", myCanonicalName)];

        this.unsubscribe = startLivePool("territorios", filtros, (data) => {
            this.territories = data;
            this.renderList();
        });

        this.renderShell();
    }

    /**
     * Renderiza el contenedor base del modal (Shell).
     */
    renderShell() {
        let modal = document.getElementById('reception-hub-modal');
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.id = 'reception-hub-modal';
        modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm animate-fade-in';

        modal.onclick = (e) => {
            if (e.target.id === 'reception-hub-modal') this.closeModal();
        };

        modal.innerHTML = `
            <div class="bg-white dark:bg-[#0b0e14] rounded-[20px] w-full max-w-[500px] max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-slide-up border border-slate-200 dark:border-white/10">
                <header class="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 text-lg">
                            <i class="fas ${this.viewMode === 'admin' ? 'fa-id-card' : 'fa-truck-active'}"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-none">${this.viewMode === 'admin' ? 'Gestión HUB' : 'Mis Entregas'}</h3>
                            <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Live Pool S-13</p>
                        </div>
                    </div>
                    <button onclick="ReceptionHub.closeModal()" class="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 transition-all active:scale-90">
                        <i class="fas fa-times"></i>
                    </button>
                </header>
                
                <div id="reception-hub-list" class="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/50 dark:bg-black/10">
                    <!-- Contenido dinámico -->
                </div>

                <footer class="p-6 border-t border-slate-100 dark:border-white/5 flex gap-4 shrink-0 bg-white dark:bg-slate-900">
                    <button onclick="ReceptionHub.closeModal()" class="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 transition-all">Regresar</button>
                    <button id="reception-hub-confirm" class="flex-[3] py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none">
                        Finalizar Actividad
                    </button>
                </footer>
            </div>
        `;

        document.body.appendChild(modal);
        modal.querySelector('#reception-hub-confirm').onclick = () => this.confirmar();
    }

    /**
     * Renderiza la lista de tarjetas con filtro RBAC basado en viewMode.
     */
    renderList() {
        const list = document.getElementById('reception-hub-list');
        if (!list) return;

        // --- 2. INTERCEPTAR LOS DATOS Y APLICAR FILTRO ---
        const data = this.territories || [];
        let territoriosParaMostrar = data.filter(t => t.estado !== 'Disponible' && t.status !== 'Disponible');

        // REGLA DE ORO: Si estoy en modo conductor (o no soy admin), solo veo LO MÍO.
        if (this.viewMode === 'conductor' || !this.isAdmin) {
            const myName = (window.XolvyApp?.identity?.nombreCanonico || this.displayName || '').trim().toLowerCase();
            territoriosParaMostrar = territoriosParaMostrar.filter(t => {
                const asignado = (t.asignado_a || '').trim().toLowerCase();
                const auxiliar = (t.auxiliar || '').trim().toLowerCase();
                return asignado === myName || auxiliar === myName;
            });
        }

        // --- DEPURACIÓN OBLIGATORIA (F12) ---
        console.log(`[RBAC S-13] Mode: ${this.viewMode} | User: ${this.displayName} | Total: ${data.length} | Mostrando: ${territoriosParaMostrar.length}`);

        if (territoriosParaMostrar.length === 0) {
            const emptyMsg = (this.viewMode === 'conductor') ? "No tienes asignaciones pendientes de informar" : "No hay territorios asignados en este momento";
            list.innerHTML = `
                <div class="py-20 text-center space-y-4 animate-fade-in opacity-50">
                    <div class="w-16 h-16 bg-slate-200 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto text-slate-400">
                        <i class="fas fa-check-circle text-2xl"></i>
                    </div>
                    <p class="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 px-8">${emptyMsg}</p>
                </div>`;
            return;
        }

        let html = '';
        const preSelectedId = this.preSelectedId;

        if (this.viewMode === 'admin') {
            const groups = territoriosParaMostrar.reduce((acc, t) => {
                const c = t.asignado_a || 'Sin Asignar';
                if (!acc[c]) acc[c] = [];
                acc[c].push(t);
                return acc;
            }, {});

            html = Object.keys(groups).sort().map(conductor => {
                const groupHeader = `
                <div class="flex items-center gap-3 mb-4 mt-10 first:mt-0">
                    <div class="h-px bg-slate-200 dark:bg-white/5 flex-1"></div>
                    <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">${conductor}</span>
                    <div class="h-px bg-slate-200 dark:bg-white/5 flex-1"></div>
                </div>`;
                const groupCards = groups[conductor].map(t => this.renderCard(t, preSelectedId)).join('');
                return groupHeader + groupCards;
            }).join('');
        } else {
            html = territoriosParaMostrar.map(t => this.renderCard(t, preSelectedId)).join('');
        }

        list.innerHTML = html;
        this.attachEvents();
    }

    /**
     * Genera el HTML de una tarjeta individual.
     */
    renderCard(t, preSelectedId) {
        if (!this.selections[t.id]) {
            this.selections[t.id] = {
                isFull: t.id === preSelectedId,
                manzanas: [],
                notes: '',
                conductorFinal: t.asignado_a || ''
            };
        }

        const sel = this.selections[t.id];
        const mzs = t.manzanas ? t.manzanas.split(',').map(m => m.trim()).filter(Boolean) : [];
        const isAdminMode = this.viewMode === 'admin';

        return `
            <div class="modern-card p-6 border-slate-200 dark:border-white/10 space-y-5 bg-white dark:bg-white/[0.03] animate-fade-in" data-id="${t.id}">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center font-black text-xs shadow-lg shadow-emerald-500/20 shrink-0">
                        ${t.numero}
                    </div>
                    <div class="flex-1 min-w-0">
                        <h4 class="text-[13px] font-black text-slate-800 dark:text-white uppercase truncate">${t.localidad || 'Territorio'}</h4>
                        <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">${mzs.length} Manzanas</p>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-2">
                    <button class="mode-btn flex items-center justify-center gap-2 py-3 px-1 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${sel.isFull ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/10' : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400'}" data-mode="full">
                        <i class="fas fa-check-double rotate-3 transition-transform"></i> Entrega Total
                    </button>
                    <button class="mode-btn flex items-center justify-center gap-2 py-3 px-1 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${!sel.isFull ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/10' : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400'}" data-mode="partial">
                        <i class="fas fa-scissors -rotate-3 transition-transform"></i> Parcial
                    </button>
                </div>

                ${!sel.isFull ? `
                    <div class="animate-fade-in space-y-3">
                        <label class="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Manzanas cerradas:</label>
                        <div class="flex flex-wrap gap-2">
                            ${mzs.map(m => `
                                <button class="mz-chip px-3 py-2 rounded-lg border text-[10px] font-bold ${sel.manzanas.includes(m) ? 'bg-amber-500 border-amber-500 text-white' : 'bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/5 text-slate-500'}" data-val="${m}">
                                    ${m}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <div class="space-y-4 pt-1">
                    <div class="space-y-2">
                        <label class="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Responsable de Entrega (S-13)</label>
                        <select class="conductor-final w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 p-4 rounded-xl text-[11px] font-bold text-slate-700 dark:text-white outline-none focus:border-emerald-500/40 transition-all ${isAdminMode ? 'cursor-pointer' : 'opacity-60 bg-slate-100 cursor-not-allowed'}" 
                                ${isAdminMode ? '' : 'disabled'}>
                            <option value="">Seleccionar...</option>
                            ${this.conductores.map(c => `
                                <option value="${c.nombre}" ${sel.conductorFinal === c.nombre ? 'selected' : ''}>${c.nombre}</option>
                            `).join('')}
                            ${(!this.conductores.find(c => c.nombre === sel.conductorFinal) && sel.conductorFinal) ? `<option value="${sel.conductorFinal}" selected>${sel.conductorFinal}</option>` : ''}
                        </select>
                    </div>

                    <div class="space-y-2">
                        <label class="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Notas / Observaciones</label>
                        <textarea class="note-input w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 p-4 rounded-2xl text-[11px] font-medium text-slate-700 dark:text-white outline-none focus:border-emerald-500/40 transition-all resize-none" rows="2" placeholder="Escribe aquí novedades relevantes...">${sel.notes}</textarea>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Vincula los eventos de interacción de la instancia.
     */
    attachEvents() {
        const list = document.getElementById('reception-hub-list');
        if (!list) return;

        list.querySelectorAll('.modern-card').forEach(card => {
            const id = card.dataset.id;

            card.querySelectorAll('.mode-btn').forEach(btn => {
                btn.onclick = () => {
                    this.selections[id].isFull = btn.dataset.mode === 'full';
                    this.renderList();
                };
            });

            card.querySelectorAll('.mz-chip').forEach(chip => {
                chip.onclick = () => {
                    const val = chip.dataset.val;
                    const idx = this.selections[id].manzanas.indexOf(val);
                    if (idx > -1) this.selections[id].manzanas.splice(idx, 1);
                    else this.selections[id].manzanas.push(val);
                    this.renderList();
                };
            });

            const textarea = card.querySelector('.note-input');
            textarea.oninput = (e) => {
                this.selections[id].notes = e.target.value;
            };

            const inputConductor = card.querySelector('.conductor-final');
            inputConductor.onchange = (e) => {
                this.selections[id].conductorFinal = e.target.value;
            };
        });
    }

    /**
     * Cierra el modal y limpia la instancia global.
     */
    closeModal() {
        if (this.unsubscribe) this.unsubscribe();
        const modal = document.getElementById('reception-hub-modal');
        if (modal) modal.remove();

        this.territories = [];
        this.selections = {};
        if (runningHubInstance === this) runningHubInstance = null;
    }

    /**
     * Cierre estático para llamadas externas.
     */
    static closeModal() {
        if (runningHubInstance) runningHubInstance.closeModal();
    }

    /**
     * Ejecuta la confirmación atómica.
     */
    async confirmar() {
        const idsToProcess = Object.keys(this.selections).filter(id => {
            const s = this.selections[id];
            return s.isFull || s.manzanas.length > 0 || s.notes.trim().length > 0;
        });

        if (idsToProcess.length === 0) return showNotification("No has seleccionado ninguna acción", "warning");

        const btn = document.getElementById('reception-hub-confirm');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Procesando S-13...';

        try {
            for (const id of idsToProcess) {
                const sel = this.selections[id];
                const t = this.territories.find(x => x.id === id);
                if (!t) continue;

                if (sel.isFull) {
                    await returnTerritorio(id, sel.notes || "Entrega de territorio informada", null, 'Completado', null, sel.conductorFinal);
                    window.dispatchEvent(new CustomEvent('territorio-liberado', { detail: { id, numero: t.numero } }));
                } else {
                    await updateTerritorio(id, {
                        manzanas_trabajadas: sel.manzanas,
                        notas_parciales: sel.notes,
                        ultima_actualizacion: new Date().toISOString()
                    });
                }
            }

            showNotification(`¡Todo listo! Se informaron ${idsToProcess.length} actividades correctamente.`, "success");
            this.closeModal();
            if (window.refreshConductorView) window.refreshConductorView(true);
            if (window.renderTableCallback) window.renderTableCallback();

        } catch (e) {
            console.error("ReceptionHub Error:", e);
            showNotification("Error al procesar: " + e.message, "error");
            btn.disabled = false;
            btn.innerHTML = 'Finalizar Actividad';
        }
    }
}

// Exponer al scope global
window.ReceptionHub = ReceptionHub;
window.closeReceptionHub = () => ReceptionHub.closeModal();
