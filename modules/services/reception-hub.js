import { startLivePool, returnTerritorio, updateTerritorio, returnTerritorioParcial } from '../../data/firestore-services.js';
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
        this.selections = {}; // Estado temporal: { [tId]: { mode: 'full'|'partial'|'return', manzanas: [], notes: '', conductorFinal: string } }
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
                <header class="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-900">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 text-lg">
                            <i class="fas ${this.viewMode === 'admin' ? 'fa-id-card' : 'fa-truck-active'}"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-none">${this.viewMode === 'admin' ? 'Gestión HUB' : 'Mis Entregas'}</h3>
                            <p class="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-1">Live Pool S-13</p>
                        </div>
                    </div>
                    <button onclick="ReceptionHub.closeModal()" class="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400 transition-all active:scale-90">
                        <i class="fas fa-times"></i>
                    </button>
                </header>
                
                <div id="reception-hub-list" class="flex-1 min-w-0 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/50 dark:bg-black/10">
                    <!-- Contenido dinámico -->
                </div>

                <footer class="p-6 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-900 flex justify-center">
                    <button onclick="ReceptionHub.closeModal()" class="w-full py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-rose-500 transition-all">Regresar al Panel</button>
                </footer>
            </div>
        `;

        document.body.appendChild(modal);
    }

    /**
     * Renderiza la lista de tarjetas con filtro RBAC basado en viewMode.
     */
    renderList() {
        const list = document.getElementById('reception-hub-list');
        if (!list) return;

        // --- 2. INTERCEPTAR LOS DATOS Y APLICAR FILTRO ---
        const data = this.territories || [];
        // CAMBIO B: Filtro ampliado — ocultar TODOS los estados inactivos, no solo 'Disponible'
        const INACTIVE_STATES = ['Disponible', 'Predicado', 'Sin asignar', 'Extraviado', 'Libre'];
        let territoriosParaMostrar = data.filter(t => !INACTIVE_STATES.includes(t.estado) && !INACTIVE_STATES.includes(t.status));

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
                    <div class="w-16 h-16 bg-slate-200 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto text-slate-600 dark:text-slate-400">
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
                    <div class="h-px bg-slate-200 dark:bg-white/5 flex-1 min-w-0"></div>
                    <span class="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap">${conductor}</span>
                    <div class="h-px bg-slate-200 dark:bg-white/5 flex-1 min-w-0"></div>
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
                mode: t.id === preSelectedId ? 'full' : 'partial',
                manzanas: [],
                notes: '',
                conductorFinal: t.asignado_a || ''
            };
        }

        const sel = this.selections[t.id];
        const mzs = t.manzanas ? t.manzanas.split(',').map(m => m.trim()).filter(Boolean) : [];
        const isAdminMode = this.viewMode === 'admin';

        return `
            <div class="modern-card territory-item-card p-6 border-slate-200 dark:border-white/10 space-y-5 bg-white dark:bg-white/[0.03] animate-fade-in" data-id="${t.id}" data-manzanas="${t.manzanas || ''}">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center font-black text-xs shadow-lg shadow-emerald-500/20 shrink-0">
                        ${t.numero}
                    </div>
                    <div class="flex-1 min-w-0">
                        <h4 class="text-[13px] font-black text-slate-800 dark:text-white uppercase truncate">${t.localidad || 'Territorio'}</h4>
                        <p class="text-[9px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest mt-0.5">${mzs.length} Manzanas</p>
                    </div>
                </div>

                <div class="grid grid-cols-3 gap-2">
                    <button class="mode-btn flex flex-col items-center justify-center gap-1 py-3 px-1 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${sel.mode === 'full' ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400'}" data-mode="full">
                        <i class="fas fa-check-double"></i> Total
                    </button>
                    <button class="mode-btn flex flex-col items-center justify-center gap-1 py-3 px-1 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${sel.mode === 'partial' ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400'}" data-mode="partial">
                        <i class="fas fa-scissors"></i> Parcial
                    </button>
                    <button class="mode-btn flex flex-col items-center justify-center gap-1 py-3 px-1 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${sel.mode === 'return' ? 'bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400'}" data-mode="return">
                        <i class="fas fa-undo"></i> Devolver
                    </button>
                </div>

                ${sel.mode === 'partial' ? `
                    <div class="animate-fade-in space-y-3">
                        <label class="text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Manzanas cerradas:</label>
                        <div class="flex flex-wrap gap-2">
                            ${mzs.map(m => `
                                <button class="mz-chip px-3 py-2 rounded-lg border text-[10px] font-bold ${sel.manzanas.includes(m) ? 'bg-amber-500 border-amber-500 text-white' : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400'}" data-val="${m}">
                                    ${m}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <div class="space-y-4 pt-1">
                    ${sel.mode === 'return' ? `
                    <div class="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
                        <i class="fas fa-info-circle text-rose-500 text-sm shrink-0"></i>
                        <p class="text-[9px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest leading-relaxed">El territorio volverá al pozo sin actualizar fechas de predicación.</p>
                    </div>
                    ` : ''}
                    <div class="space-y-2">
                        <label class="text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 block">Responsable de Entrega (S-13)</label>
                        <select class="conductor-final w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 p-4 rounded-xl text-[11px] font-bold text-slate-700 dark:text-white outline-none focus:border-emerald-500/40 transition-all ${isAdminMode ? 'cursor-pointer' : 'opacity-60 bg-slate-100 dark:bg-white/5 cursor-not-allowed'}" 
                                ${isAdminMode ? '' : 'disabled'}>
                            <option value="">Seleccionar...</option>
                            ${this.conductores.map(c => `
                                <option value="${c.nombre}" ${sel.conductorFinal === c.nombre ? 'selected' : ''}>${c.nombre}</option>
                            `).join('')}
                            ${(!this.conductores.find(c => c.nombre === sel.conductorFinal) && sel.conductorFinal) ? `<option value="${sel.conductorFinal}" selected>${sel.conductorFinal}</option>` : ''}
                        </select>
                    </div>

                    <div class="space-y-2">
                        <label class="text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 block">Notas / Observaciones</label>
                        <textarea class="note-input w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 p-4 rounded-2xl text-[11px] font-medium text-slate-700 dark:text-white outline-none focus:border-emerald-500/40 transition-all resize-none" rows="2" placeholder="Escribe aquí novedades relevantes...">${sel.notes}</textarea>
                    </div>

                    <button class="btn-process-single w-full mt-5 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center justify-center gap-2" data-tid="${t.id}">
                        <i class="fas fa-check-circle"></i> Confirmar T-${t.numero}
                    </button>
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

        list.querySelectorAll('.territory-item-card').forEach(card => {
            const id = card.dataset.id;

            // --- 1. SELECCIÓN DE MODO ---
            card.querySelectorAll('.mode-btn').forEach(btn => {
                btn.onclick = () => {
                    this.selections[id].mode = btn.dataset.mode;
                    this.renderList();
                };
            });

            // --- 2. SELECCIÓN DE MANZANAS (MODO PARCIAL) ---
            card.querySelectorAll('.mz-chip').forEach(chip => {
                chip.onclick = () => {
                    const val = chip.dataset.val;
                    const idx = this.selections[id].manzanas.indexOf(val);
                    if (idx > -1) this.selections[id].manzanas.splice(idx, 1);
                    else this.selections[id].manzanas.push(val);
                    this.renderList();
                };
            });

            // --- 3. INPUTS DE TEXTO ---
            const textarea = card.querySelector('.note-input');
            textarea.oninput = (e) => {
                this.selections[id].notes = e.target.value;
            };

            const inputConductor = card.querySelector('.conductor-final');
            if (inputConductor) {
                inputConductor.onchange = (e) => {
                    this.selections[id].conductorFinal = e.target.value;
                };
            }

            // --- 4. PROCESAMIENTO INDIVIDUAL (Optimistic UI) ---
            const processBtn = card.querySelector('.btn-process-single');
            processBtn.onclick = async () => {
                const tid = processBtn.dataset.tid;
                processBtn.disabled = true;
                processBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> PROCESANDO...';

                try {
                    const sel = this.selections[tid];
                    const t = this.territories.find(x => x.id === tid);
                    if (!t) return;

                    const mode = sel.mode;
                    const notas = sel.notes || '';
                    const responsable = sel.conductorFinal || window.XolvyApp?.identity?.nombreCanonico || 'Anónimo';
                    const date = new Date().toISOString().split('T')[0];

                    if (mode === 'partial') {
                        const checksMz = sel.manzanas;
                        const originalMzs = card.dataset.manzanas ? card.dataset.manzanas.split(',').map(m => m.trim()) : [];
                        const remaining = originalMzs.filter(x => !checksMz.includes(x));
                        
                        if (checksMz.length === 0) throw new Error("Selecciona al menos una manzana.");
                        await returnTerritorioParcial(tid, checksMz, remaining, true, notas || 'Avance parcial', date, null, responsable);
                        window.dispatchEvent(new CustomEvent('territorio-actualizado', { detail: { id: tid, numero: t.numero } }));
                    } else if (mode === 'return') {
                        await returnTerritorio(tid, notas || 'Devuelto sin predicar', null, 'Disponible');
                        window.dispatchEvent(new CustomEvent('territorio-liberado', { detail: { id: tid, numero: t.numero } }));
                    } else {
                        await returnTerritorio(tid, notas || 'Completado', date, 'Completado', null, responsable);
                        window.dispatchEvent(new CustomEvent('territorio-liberado', { detail: { id: tid, numero: t.numero } }));
                    }

                    // Optimistic UI: Desaparecer la tarjeta con animación
                    card.style.transition = 'all 0.4s ease';
                    card.style.opacity = '0';
                    card.style.transform = 'scale(0.95)';
                    setTimeout(() => {
                        card.remove();
                        showNotification('Territorio actualizado correctamente', 'success');
                        
                        // Si ya no hay tarjetas, cerrar el modal automáticamente
                        if (document.querySelectorAll('.territory-item-card').length === 0) {
                            this.closeModal();
                        }
                    }, 400);

                } catch (error) {
                    console.error(error);
                    showNotification(error.message || "Error al procesar", "error");
                    processBtn.disabled = false;
                    processBtn.innerHTML = '<i class="fas fa-check-circle"></i> REINTENTAR';
                }
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


}

// Exponer al scope global
window.ReceptionHub = ReceptionHub;
window.closeReceptionHub = () => ReceptionHub.closeModal();
