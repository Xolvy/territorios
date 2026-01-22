import { auth } from '../firebase-config.js?v=2.2.2';
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import {
    getTerritorios, getConductores, getPublicadores, getTelefonos, updateTelefono,
    getRecursos, getConfiguracion,
    getPredicacionPublica, savePredicacionPublica,
    getProgramaSemanal, saveProgramaSemanal, syncSlotWithTerritories, getTerritoryHistory,
    addPublicador, updatePublicador, deletePublicador,
    releaseUnusedTelefonos, solicitarNumeros, updateTelefonoStatus, logSessionSummary,
    logReturn, returnTerritorio, returnTerritorioParcial, transferTerritory
} from '../data/firestore-services.js?v=2.2.2';
import { formatPhoneNumber, getStatusColor, showNotification, formatMapUrl, formatManzanas } from './utils/helpers.js?v=2.2.2';
import { TerritoryIntelligence } from './utils/intelligence.js?v=2.2.2';
import { MapViewer } from './map-viewer.js?v=2.2.2';



// --- UI HELPERS ---

// --- REUSE INTERACTIVE MAP ---
window.viewMapFromReport = async (id) => {
    // Show spinner in button if we could, but let's just fetch
    showNotification("Cargando mapa interactivo...", "info");
    const territories = await getTerritorios();
    const t = territories.find(x => x.id === id);
    if (t) {
        window.openInteractiveMap(t);
    } else {
        showNotification("No se encontró la data del territorio para el mapa.", "error");
    }
};

const showModal = (content, onOpen, maxWidth = 'max-w-md') => {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    const handleEsc = (e) => {
        if (e.key === 'Escape') closeModal();
    };

    const closeModal = () => {
        const modalBody = modalContainer.querySelector('.modal-body');
        if (modalBody) {
            if (window.innerWidth < 640) {
                modalBody.classList.remove('translate-y-0');
                modalBody.classList.add('translate-y-full');
            } else {
                modalBody.classList.add('scale-95', 'opacity-0');
            }
        }

        setTimeout(() => {
            modalContainer.classList.add('hidden');
            modalContainer.innerHTML = '';
            window.removeEventListener('keydown', handleEsc);
        }, 300);
    };

    modalContainer.innerHTML = `
        <div class="modal-body w-full ${maxWidth} relative transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] 
                    sm:rounded-[3rem] bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl flex flex-col 
                    shadow-[0_40px_100px_-20px_hsla(var(--glass-shadow))] max-h-[92vh] sm:max-h-[92vh] 
                    border border-white/20 dark:border-white/5 overflow-hidden 
                    fixed bottom-0 sm:bottom-auto sm:relative left-0 right-0 sm:left-auto sm:right-auto
                    translate-y-full sm:translate-y-0 sm:m-4 rounded-t-[3rem] sm:rounded-b-[3rem]">
            
            <!-- Mobile Pull Indicator -->
            <div class="sm:hidden w-full flex justify-center pt-4 pb-2 shrink-0">
                <div class="w-12 h-1.5 bg-slate-300 dark:bg-white/10 rounded-full animate-pulse"></div>
            </div>

            <button class="absolute top-6 right-6 text-slate-400 hover:text-teal-500 z-[60] p-2 bg-slate-100 dark:bg-slate-800 rounded-full transition-all border border-transparent hover:border-teal-500/30 group shadow-md" 
                    id="modal-close-btn">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 group-hover:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
            <div class="flex-1 overflow-y-auto custom-scrollbar flex flex-col px-8 py-10">
                ${content}
            </div>
        </div>
    `;
    modalContainer.classList.remove('hidden');
    modalContainer.className = 'fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300';

    // Trigger Slide Up
    setTimeout(() => {
        const body = modalContainer.querySelector('.modal-body');
        if (body) body.classList.remove('translate-y-full');
    }, 10);

    const closeBtn = modalContainer.querySelector('#modal-close-btn');
    if (closeBtn) closeBtn.onclick = (e) => { e.stopPropagation(); closeModal(); };

    modalContainer.onclick = (e) => { if (e.target === modalContainer) closeModal(); };

    window.addEventListener('keydown', handleEsc);

    if (onOpen) onOpen(modalContainer);
};

const showCustomAlert = (message) => {
    if (!message) return;
    const type = message.toLowerCase().includes('error') ? 'error' : 'success';
    showNotification(message, type);
};
window.showCustomAlert = showCustomAlert;

const showCustomConfirm = (message, onConfirm) => {
    showModal(`
        <div class="space-y-8 py-4">
            <div class="flex flex-col items-center text-center space-y-6">
                <div class="w-20 h-20 bg-primary/10 rounded-[2rem] flex items-center justify-center text-3xl shadow-inner border border-primary/20 text-primary">
                    <i class="fas fa-question-circle animate-pulse"></i>
                </div>
                <div class="space-y-3">
                    <h3 class="text-2xl font-black text-slate-800 dark:text-white tracking-tight leading-tight px-4">${message}</h3>
                    <p class="text-[10px] text-slate-600 dark:text-slate-400 uppercase font-black tracking-[0.3em] opacity-80">Confirmación Requerida</p>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <button id="confirm-cancel" class="p-5 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-500 font-black text-[11px] uppercase tracking-[0.2em] hover:bg-slate-200 dark:hover:bg-white/10 transition-all active:scale-95">Regresar</button>
                <button id="confirm-ok" class="p-5 rounded-2xl bg-primary text-white font-black text-[11px] uppercase tracking-[0.2em] hover:bg-primary-light shadow-xl shadow-primary/20 transition-all active:scale-95">SÍ, PROCEDER</button>
            </div>
        </div>
    `, (modal) => {
        modal.querySelector('#confirm-cancel').onclick = () => modal.classList.add('hidden');
        modal.querySelector('#confirm-ok').onclick = () => {
            modal.classList.add('hidden');
            onConfirm();
        };
    });
};
window.showCustomConfirm = showCustomConfirm;

const showCustomPrompt = (message, defaultValue, onConfirm) => {
    showModal(`
        <div class="space-y-8 py-4">
            <div class="space-y-6">
                <div class="flex items-center gap-5">
                    <div class="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-primary/20 text-primary">
                        <i class="fas fa-edit"></i>
                    </div>
                    <div class="space-y-1">
                        <h3 class="text-xl font-black text-slate-800 dark:text-white tracking-tight leading-none">${message}</h3>
                        <p class="text-[10px] text-primary uppercase font-black tracking-[0.2em]">Entrada de Datos</p>
                    </div>
                </div>
                <div class="space-y-3">
                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Respuesta Requerida</label>
                    <input type="text" id="prompt-input" value="${defaultValue || ''}" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-5 py-4 text-sm font-bold shadow-sm focus:border-primary outline-none transition-all placeholder:text-slate-300" placeholder="Escribe aquí...">
                </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <button id="prompt-cancel" class="p-5 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-500 font-black text-[11px] uppercase tracking-[0.2em] hover:bg-slate-200 dark:hover:bg-white/10 transition-all active:scale-95">Cancelar</button>
                <button id="prompt-ok" class="p-5 rounded-2xl bg-primary text-white font-black text-[11px] uppercase tracking-[0.2em] hover:bg-primary-light shadow-xl shadow-primary/20 transition-all active:scale-95">CONFIRMAR</button>
            </div>
        </div>
    `, (modal) => {
        const input = modal.querySelector('#prompt-input');
        input.focus();
        input.select();
        modal.querySelector('#prompt-cancel').onclick = () => modal.classList.add('hidden');
        modal.querySelector('#prompt-ok').onclick = () => {
            const val = input.value.trim();
            if (val) {
                modal.classList.add('hidden');
                onConfirm(val);
            }
        };
    });
};
window.showCustomPrompt = showCustomPrompt;

export const renderConductorDashboard = async (container, nameOrEmail, appVersion, userRole = null) => {
    let displayName = nameOrEmail;
    let conductorData = null;
    let config = null;
    try {
        config = await getConfiguracion();
        const allC = await getConductores();
        conductorData = allC.find(c => c.email === nameOrEmail || c.nombre === nameOrEmail || (c.telefono && c.telefono.replace(/\s+/g, '') === nameOrEmail.replace(/\s+/g, '')));
        if (conductorData) displayName = conductorData.nombre;
    } catch (err) {
        console.error("Error resolving name:", err);
    }

    // Default modules if not set (legacy or unconfigured)
    const mods = conductorData?.modulos || {
        agenda: true,
        programa: true,
        disponibilidad: true,
        telefonos: true,
        mapas: true,
        ayudas: true,
        rescue: false
    };


    const wasProgOpen = container.querySelector('.group\\/prog-details')?.open;

    container.innerHTML = `
        <div class="animate-fade-in pb-32 w-full max-w-7xl mx-auto p-4 md:p-8 space-y-12 md:space-y-20">
            <header class="flex flex-col md:flex-row justify-between items-start md:items-center px-6 py-6 modern-card !rounded-[2.5rem] border-slate-200 dark:border-white/10 shadow-xl gap-6 relative overflow-hidden group">
                <div class="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                <div class="flex items-center gap-5 relative z-10">
                    <div class="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-2xl text-white shadow-xl shadow-indigo-500/30 rotate-3 hover:rotate-0 transition-all duration-700 animate-float">
                        <i class="fas fa-user-circle"></i>
                    </div>
                    <div class="space-y-1">
                        <h1 class="text-2xl font-black text-slate-800 dark:text-white tracking-tighter uppercase">Hola, ${displayName.split(' ')[0]}</h1>
                        <div class="flex flex-col">
                            <p class="text-[9px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-[0.3em] flex items-center gap-2">
                               <span class="relative flex h-1.5 w-1.5">
                                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                               </span> <span class="text-slate-600 dark:text-slate-300 font-extrabold">Panel Conductor PRO</span>
                            </p>
                            <p class="text-[8px] font-black text-indigo-500 uppercase tracking-[0.2em] mt-0.5 opacity-70">${config.congregacion?.nombre || ''}</p>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-2.5 w-full md:w-auto relative z-10">
                    <div class="hidden sm:flex flex-col items-end mr-4 text-right">
                         <p class="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] mb-0.5">Versión</p>
                         <p class="text-[10px] font-black text-slate-800 dark:text-white tabular-nums">${appVersion || '3.6.0'}</p>
                    </div>
                    ${(userRole === 'Administrador' || userRole === 'SuperAdmin' || conductorData?.privilegios?.includes('Administrador')) ? `
                    <button id="btn-goto-admin" class="flex-1 md:flex-none bg-amber-500/10 hover:bg-amber-500 text-amber-600 hover:text-white px-4 md:px-6 py-3.5 rounded-xl border border-amber-500/20 transition-all font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm active:scale-95 min-w-0">
                        <i class="fas fa-user-shield"></i> <span class="truncate">Panel Admin</span>
                    </button>
                    ` : `
                    <button onclick="window.startOnboarding()" class="flex-1 md:flex-none bg-slate-50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 px-4 md:px-6 py-3.5 rounded-xl border border-slate-200 dark:border-white/10 transition-all font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm active:scale-95 min-w-0">
                        <i class="fas fa-circle-info text-indigo-500"></i> <span class="truncate">Ayuda</span>
                    </button>
                    `}
                    <button id="logout-btn" class="flex-1 md:flex-none bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white px-4 md:px-6 py-3.5 rounded-xl border border-rose-500/20 transition-all font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm active:scale-95 min-w-0">
                        <i class="fas fa-sign-out-alt"></i> <span class="truncate">Salir</span>
                    </button>
                </div>
            </header>
 
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 px-2 md:px-4">
                <div class="lg:col-span-2 space-y-8 animate-fade-in ${mods.agenda !== false ? '' : 'hidden'}">
                    <div class="flex flex-col md:flex-row md:items-center justify-between px-4 gap-4">
                        <h3 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] flex items-center gap-4">
                           <span class="w-12 h-1 bg-indigo-500/20 rounded-full"></span>
                           Agenda Inteligente
                        </h3>
                        <div id="agenda-intelligence-badge"></div>
                    </div>
                    <div id="calendar-container" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                        <div class="skeleton-pro h-48 rounded-[2.5rem]"></div>
                    </div>
                </div>
            </div>
 
                <!-- Module: Programa Semanal (Global Cards) -->
                <div id="programa-semanal-section" class="lg:col-span-2 ${mods.programa !== false ? '' : 'hidden'}">
                    <div class="modern-card !p-0 border-slate-200 dark:border-white/10 shadow-2xl transition-all overflow-hidden group/prog bg-white dark:bg-slate-900/40">
                        <details class="group/prog-details" ${wasProgOpen ? 'open' : ''}>
                             <summary class="flex flex-col md:flex-row justify-between items-start md:items-center p-8 cursor-pointer list-none select-none hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors border-b border-transparent group-open/prog-details:border-slate-100 dark:group-open/prog-details:border-white/5">
                                <div class="flex items-start gap-6">
                                    <div class="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-2xl text-indigo-500 shadow-inner border border-indigo-500/10 group-open/prog-details:rotate-6 transition-transform">
                                        <i class="fas fa-calendar-alt"></i>
                                    </div>
                                    <div>
                                        <div class="flex items-center gap-3">
                                            <h3 class="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Cronograma de Salidas</h3>
                                            <div class="w-6 h-6 rounded-lg bg-slate-100 dark:bg-white/10 flex items-center justify-center text-[10px] group-open/prog-details:rotate-180 transition-transform text-slate-400">
                                                <i class="fas fa-chevron-down"></i>
                                            </div>
                                        </div>
                                        <p class="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1 opacity-70">Roles y puntos de reunión generales</p>
                                    </div>
                                </div>
                            </summary>

                            <div class="p-4 md:p-8 space-y-8 animate-fade-in group-open/prog-details:block hidden">
                                <div id="program-header-controls" class="flex flex-col xl:flex-row items-center justify-between gap-6">
                                     <!-- Week Range & Nav -->
                                     <div class="flex items-center bg-slate-100 dark:bg-white/5 rounded-2xl p-1 border border-slate-200 dark:border-white/5 shadow-inner">
                                         <button id="prog-prev-week" class="p-3 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-all text-slate-400 hover:text-primary"><i class="fas fa-chevron-left"></i></button>
                                         <div class="px-6 py-2 min-w-[180px] text-center">
                                             <span id="prog-week-range" class="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">Cargando...</span>
                                         </div>
                                         <button id="prog-next-week" class="p-3 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-all text-slate-400 hover:text-primary"><i class="fas fa-chevron-right"></i></button>
                                     </div>

                                     <!-- Filter & Actions -->
                                     <div class="flex flex-wrap items-center justify-center gap-3">
                                         <button id="prog-btn-today" class="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 px-6 py-3 rounded-xl font-black hover:bg-slate-50 transition-all text-[9px] uppercase tracking-widest shadow-sm">Hoy</button>
                                         <div class="w-px h-8 bg-slate-200 dark:bg-white/10 mx-1"></div>
                                         <div id="prog-turn-filters" class="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
                                             <!-- Turn buttons -->
                                         </div>
                                         <div class="w-px h-8 bg-slate-200 dark:bg-white/10 mx-1"></div>
                                         <button id="prog-export-png" class="p-4 bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 hover:bg-indigo-500 hover:text-white rounded-xl transition-all shadow-lg shadow-indigo-500/5 group/dl" title="Descargar como Imagen">
                                            <i class="fas fa-download group-hover/dl:scale-110 transition-transform"></i>
                                            <span class="hidden sm:inline ml-2 text-[9px] font-black uppercase tracking-widest">Descargar</span>
                                         </button>
                                     </div>
                                </div>

                                <div id="prog-day-selector" class="flex flex-wrap items-center justify-center gap-1.5 p-1.5 bg-slate-100 dark:bg-white/5 rounded-[2rem] border border-slate-200 dark:border-white/10">
                                    <!-- Day buttons -->
                                </div>

                                <div id="weekly-program-cards" class="w-full relative min-h-[300px]">
                                    <div class="col-span-full py-24 flex flex-col items-center justify-center text-center space-y-6">
                                        <div class="relative">
                                            <div class="w-16 h-16 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin"></div>
                                            <div class="absolute inset-0 flex items-center justify-center text-indigo-500/20">
                                                <i class="fas fa-calendar-alt text-lg"></i>
                                            </div>
                                        </div>
                                        <div class="space-y-2">
                                            <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] animate-pulse">Cargando Programación</p>
                                            <p class="text-[9px] text-slate-300 dark:text-slate-500 font-bold uppercase tracking-widest">Sincronizando datos...</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </details>
                    </div>
                </div>

                <!-- Module: Misiones de Rescate (Reordered to be above availability) -->
                <div class="lg:col-span-2 ${mods.rescue ? '' : 'hidden'}" id="ayudas-container"></div>
                
                <div class="lg:col-span-2 ${mods.disponibilidad !== false ? '' : 'hidden'}" id="availability-container">
                </div>

                <!-- Module: Telefonos -->
                <div class="lg:col-span-2 modern-card p-6 md:p-8 ${mods.telefonos !== false ? '' : 'hidden'} border-slate-200 dark:border-white/10 shadow-2xl transition-all duration-500 bg-white dark:bg-slate-900/40" id="phone-module-card">
                    <div class="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8">
                        <div class="flex items-center gap-5 select-none group/phone-header">
                            <h3 class="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-4 uppercase tracking-tight">
                                <div class="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-500/20">
                                    <i class="fas fa-phone-alt"></i>
                                </div>
                                Predicación Telefónica
                            </h3>
                        </div>
                    </div>

                    <!-- Compact View: Banner + Basic Buttons -->
                    <div id="phone-compact-view" class="animate-fade-in px-4">
                        <div class="bg-gradient-to-br from-primary/5 to-white dark:from-primary/10 dark:to-[#0f1115] p-12 text-center rounded-[3rem] border border-slate-100 dark:border-white/5 relative overflow-hidden group shadow-2xl">
                           <div class="absolute top-0 right-0 p-12 opacity-5 text-9xl grayscale pointer-events-none">
                               <i class="fas fa-phone-volume"></i>
                           </div>
                           <div class="w-24 h-24 bg-indigo-500/10 rounded-[2.5rem] flex items-center justify-center text-5xl text-indigo-600 mx-auto mb-8 animate-float shadow-inner border border-indigo-500/10">
                               <i class="fas fa-phone-alt"></i>
                           </div>
                           <h3 class="text-3xl font-black text-slate-800 dark:text-white mb-4 uppercase tracking-tighter">¿Listo para Predicar?</h3>
                           <p class="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-10 font-bold leading-relaxed">
                               Inicia tu sesión de hoy. Solicita tus números y coordina con tu grupo para empezar la jornada.
                           </p>
                           <div class="flex flex-wrap justify-center gap-5 relative z-10">
                               <button id="btn-solicitar" class="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-5 rounded-[2rem] font-black shadow-2xl shadow-indigo-500/30 transition-all hover:scale-105 active:scale-95 flex items-center gap-4 uppercase tracking-[0.3em] text-xs">
                                   <i class="fas fa-rocket text-lg"></i> Solicitar Números
                                </button>
                               <button id="btn-zoom-compact" onclick="window.open('https://us02web.zoom.us/j/88366543094?pwd=Z2x4Qjdnck4rSjh2Q2llbXZFaTNiUT09', '_blank')" class="bg-blue-600 hover:bg-blue-500 text-white px-10 py-5 rounded-[2rem] font-black shadow-2xl shadow-blue-500/30 transition-all hover:scale-105 active:scale-95 flex items-center gap-4 uppercase tracking-[0.3em] text-xs">
                                   <i class="fas fa-video text-lg"></i> Conectar Zoom
                               </button>
                           </div>
                        </div>
                    </div>

                    <!-- Expanded View: Full Controls & Table -->
                    <div id="phone-expanded-view" class="hidden animate-fade-in space-y-10">
                        <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 w-full border-b border-slate-100 dark:border-white/5 pb-10">
                            <div class="flex flex-wrap gap-3">
                                <button id="btn-revisitas" class="btn-pro text-[10px] uppercase tracking-[0.2em] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-6 py-4 rounded-2xl hover:bg-amber-500/20 transition-all flex items-center justify-center gap-3 font-black shadow-sm">
                                    <i class="fas fa-sync-alt rotate-180"></i> <span class="hidden xs:inline">Revisitas</span>
                                </button>
                                <button id="btn-add-publicador" class="btn-pro text-[10px] uppercase tracking-[0.2em] bg-primary/10 text-primary border border-primary/20 px-6 py-4 rounded-2xl hover:bg-primary/20 transition-all flex items-center justify-center gap-3 font-black shadow-sm">
                                    <i class="fas fa-user-plus"></i> <span class="hidden xs:inline">Publicador</span>
                                </button>
                                <button id="btn-refresh" class="btn-pro text-[10px] uppercase tracking-[0.2em] bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10 px-6 py-4 rounded-2xl hover:bg-slate-200 dark:hover:bg-white/10 transition-all flex items-center justify-center gap-3 font-black shadow-sm">
                                    <i class="fas fa-sync-alt"></i> <span class="hidden xs:inline">Refrescar</span>
                                </button>
                            </div>

                            <div id="phone-progress-info" class="order-first md:order-none"></div>

                            <div class="flex gap-3">
                                <button id="btn-zoom" onclick="window.open('https://us02web.zoom.us/j/88366543094?pwd=Z2x4Qjdnck4rSjh2Q2llbXZFaTNiUT09', '_blank')" class="flex-1 md:flex-none btn-pro bg-blue-600 text-white border border-blue-400/20 px-6 py-4 rounded-2xl hover:bg-blue-500 transition-all flex items-center justify-center gap-3 font-black shadow-xl shadow-blue-500/20 uppercase tracking-[0.2em] text-[10px]">
                                    <i class="fas fa-video"></i> Zoom
                                </button>
                                <button id="btn-finalizar" class="flex-1 md:flex-none btn-pro bg-rose-600 text-white border border-rose-400/20 px-8 py-4 rounded-2xl hover:bg-rose-500 transition-all flex items-center justify-center gap-3 font-black shadow-xl shadow-rose-500/20 uppercase tracking-[0.2em] text-[10px]">
                                    <i class="fas fa-power-off"></i> Finalizar
                                </button>
                            </div>
                        </div>
<!-- Search & Filters -->
                        <div class="grid grid-cols-1 md:grid-cols-12 gap-5">
                            <div class="md:col-span-8 relative group">
                                <span class="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                    <i class="fas fa-search"></i>
                                </span>
                                <input type="text" id="search-phone" placeholder="Buscar por número o propietario..." 
                                       class="w-full bg-slate-50 dark:bg-white/5 border border-transparent focus:border-primary/20 rounded-2xl pl-14 pr-6 py-5 text-sm font-bold shadow-inner outline-none transition-all placeholder:text-slate-400">
                            </div>
                            <div class="md:col-span-4 relative group">
                                <span class="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                    <i class="fas fa-filter"></i>
                                </span>
                                <select id="filter-phone-status" class="w-full bg-slate-50 dark:bg-white/5 border border-transparent focus:border-primary/20 rounded-2xl pl-14 pr-12 py-5 text-sm font-black uppercase tracking-widest shadow-inner outline-none appearance-none transition-all cursor-pointer">
                                    <option value="">TODOS LOS ESTADOS</option>
                                    <option value="Sin asignar">Sin asignar</option>
                                    <option value="Contestaron">Contestaron</option>
                                    <option value="No contestan">No contestan</option>
                                    <option value="Colgaron">Colgaron</option>
                                    <option value="Revisita">Revisita</option>
                                    <option value="Predicado">Predicado</option>
                                    <option value="No llamar">No llamar</option>
                                    <option value="Suspendido">Suspendido</option>
                                    <option value="Testigo">Testigo</option>
                                </select>
                                <div class="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <i class="fas fa-chevron-down text-xs"></i>
                                </div>
                            </div>
                        </div>
                        
                        <div class="table-container custom-scrollbar rounded-2xl border border-black/5 dark:border-white/5 bg-white/50 dark:bg-black/20 backdrop-blur-md shadow-inner">
                            <table class="w-full text-left text-xs">
                                <thead class="bg-gray-100/50 dark:bg-white/5 border-b border-black/5 dark:border-white/5 text-gray-500 dark:text-gray-400 font-black uppercase tracking-widest text-[9px] md:text-[10px]">
                                    <tr>
                                        <th class="p-2 md:p-4 text-teal-600 dark:text-teal-400">Teléfono</th>
                                        <th class="p-2 md:p-4">Propietario</th>
                                        <th class="p-2 md:p-4 hidden sm:table-cell">Dirección</th>
                                        <th class="p-2 md:p-4">Publicador</th>
                                        <th class="p-2 md:p-4 text-center">Estado</th>
                                        <th class="p-2 md:p-4">Notas</th>
                                    </tr>
                                </thead>
                                <tbody id="phone-tbody" class="divide-y divide-black/5 dark:divide-white/5">
                                    <!-- Registros dinámicos -->
                                </tbody>
                            </table>
                        </div>

                        <div id="phone-actions" class="flex flex-col md:flex-row justify-center items-center gap-4 pt-4">
                             <button id="btn-finalizar-sesion" class="hidden w-full md:w-auto bg-red-600 hover:bg-red-500 text-white px-12 py-5 rounded-3xl font-black shadow-2xl shadow-red-500/30 transform hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs">
                                🏁 FINALIZAR PREDICACIÓN
                             </button>
                             <button id="btn-solicitar-more" class="hidden w-full md:w-auto bg-teal-600 hover:bg-teal-500 text-white px-12 py-5 rounded-3xl font-black shadow-2xl shadow-teal-500/30 transform hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 border-2 border-white/10 uppercase tracking-widest text-xs">
                                ➕ SOLICITAR MÁS
                             </button>
                        </div>
                    </div>
                </div>

                <div class="lg:col-span-2 modern-card border-slate-200 dark:border-white/10 shadow-2xl transition-all overflow-hidden !p-0 ${mods.mapas !== false ? '' : 'hidden'} bg-white dark:bg-slate-900/40" id="interactive-maps-module">
                    <details class="group/maps" ${container.querySelector('.group\\/maps')?.open ? 'open' : ''}>
                        <summary class="flex flex-col md:flex-row justify-between items-start md:items-center p-8 cursor-pointer list-none select-none hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                            <div class="flex items-start gap-6">
                                <div class="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-2xl text-indigo-600 shadow-inner border border-indigo-500/10 group-open/maps:rotate-6 transition-transform">
                                    <i class="fas fa-map-marked-alt"></i>
                                </div>
                                <div>
                                    <div class="flex items-center gap-3">
                                        <h3 class="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Explorador de Mapas</h3>
                                        <div class="w-6 h-6 rounded-lg bg-slate-100 dark:bg-white/10 flex items-center justify-center text-[10px] group-open/maps:rotate-180 transition-transform text-slate-400">
                                            <i class="fas fa-chevron-down"></i>
                                        </div>
                                    </div>
                                    <p class="text-[10px] text-slate-600 dark:text-slate-400 font-extrabold uppercase tracking-[0.3em] mt-1 ml-1">Explorador visual de Mz. y sectores</p>
                                </div>
                            </div>
                        </summary>

                        <div class="p-8 pt-0 animate-fade-in">
                            <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-8">
                                <div class="relative flex-1 max-w-md group">
                                    <span class="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                        <i class="fas fa-search text-xs"></i>
                                    </span>
                                    <input type="text" id="search-explorer-maps" placeholder="Buscar territorio por número o zona..." 
                                        class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl pl-12 pr-6 py-4 text-[13px] text-slate-700 dark:text-white focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 font-black uppercase tracking-tight">
                                </div>
                                 <div class="flex items-center gap-3 overflow-x-auto pb-2 md:pb-0">
                                    <button onclick="window.openGlobalMap('png')" class="flex-shrink-0 flex items-center gap-3 px-6 py-4 bg-slate-50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest group shadow-sm active:scale-95">
                                        <i class="fas fa-image text-lg text-primary group-hover:rotate-6 transition-transform"></i>
                                        Mapa PNG
                                    </button>
                                    <button onclick="window.openGlobalMap('satellite')" class="flex-shrink-0 flex items-center gap-3 px-6 py-4 bg-slate-50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest group shadow-sm active:scale-95">
                                        <i class="fas fa-satellite text-lg text-indigo-500 group-hover:scale-110 transition-transform"></i>
                                        Vista Satelital
                                    </button>
                                </div>
                            </div>
                            <div id="conductor-maps-grid" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                <!-- Polulated dynamically -->
                            </div>
                        </div>
                    </details>
                </div>

                <!-- Module: Ayudas Ministerio -->
                <div class="lg:col-span-2 ${mods.ayudas !== false ? '' : 'hidden'}" id="recursos-container"></div>
            </div>
        </div>
    <div id="modal-container" class="fixed inset-0 bg-black/80 backdrop-blur-sm hidden overflow-y-auto z-50 p-4 md:p-10 flex justify-center items-start"></div>
`;

    document.getElementById('logout-btn').addEventListener('click', async () => {
        localStorage.removeItem('demo_role');
        localStorage.removeItem('user_email');
        await auth.signOut();
        // window.location.reload(); // Not strictly necessary if auth state change handles it, but good for clean slate
    });

    const btnAdmin = document.getElementById('btn-goto-admin');
    if (btnAdmin) {
        btnAdmin.onclick = () => {
            window.history.pushState({}, '', '/administrador/dashboard');
            // Trigger app.js routing logic by reloading or dispatching a popstate if app.js listens for it.
            // Since app.js uses onAuthStateChanged which runs on load, reload is safest.
            window.location.reload();
        };
    }

    // Helper for Phones
    const refreshPhones = async () => {
        const allPhones = await getTelefonos();
        return allPhones.filter(t =>
            t.solicitado_por === displayName ||
            t.publicador_asignado === displayName ||
            t.asignado_a === displayName
        );
    };

    // Expose refresh function/trigger
    window.refreshConductorView = async () => {
        try {
            const config = await getConfiguracion();
            const allC = await getConductores();
            const conductorData = allC.find(c => c.nombre === displayName);
            const userMods = conductorData?.modulos || {
                agenda: true,
                programa: true,
                disponibilidad: true,
                telefonos: true,
                mapas: true,
                ayudas: true,
                rescue: false
            };

            await loadUnifiedDashboard(displayName, document.getElementById('calendar-container'), document.getElementById('territorios-container'), userMods, config, conductorData, userRole);
            const myPhones = await refreshPhones();
            const publicadores = await getPublicadores();
            initializePhoneModule(myPhones, publicadores, displayName, document.getElementById('phone-tbody'), refreshPhones);
        } catch (e) { console.error("Refresh error", e); }
    };

    try {
        // Clean up unassigned/unused numbers from previous sessions for a fresh "Solicitar" experience
        await releaseUnusedTelefonos(displayName);
        await window.refreshConductorView();
    } catch (e) {
        console.error("Error loading phones:", e);
    }
};

const loadUnifiedDashboard = async (name, agendaContainer, territoriosContainer, userMods, config, conductorData, userRole) => {
    // We no longer hide the territories container as requested ("fusionar") 
    // to allow seeing all assigned territories independently of the weekly program.

    /* --- Onboarding Logic --- */
    /* --- Power Up: Help Center & Onboarding --- */
    window.startOnboarding = () => {
        const steps = [
            {
                title: 'Agenda Inteligente',
                icon: 'fas fa-bolt-lightning',
                msg: 'Analiza tu carga semanal y te sugiere por cuál territorio empezar hoy según la urgencia y tus asignaciones.'
            },
            {
                title: 'Cronograma Grupal',
                icon: 'fas fa-calendar-check',
                msg: 'Consulta quién conduce cada salida y los puntos de reunión oficiales de toda la congregación.'
            },
            {
                title: 'Misiones de Rescate',
                icon: 'fas fa-life-ring',
                msg: 'Identifica y atiende territorios que llevan mucho tiempo sin trabajarse o que requieren atención inmediata.'
            },
            {
                title: 'Mi Disponibilidad',
                icon: 'fas fa-user-clock',
                msg: 'Indica los días y turnos en los que puedes conducir el grupo para facilitar la organización de la salida.'
            },
            {
                title: 'Predicación Telefónica',
                icon: 'fas fa-phone-alt',
                msg: 'Sistema unificado para gestionar llamadas: solicita números, asigna compañeros y registra resultados al instante.'
            },
            {
                title: 'Explorador de Mapas',
                icon: 'fas fa-map-marked-alt',
                msg: 'Cartografía digital interactiva. Visualiza manzanas, calles y límites de tus territorios asignados con precisión.'
            },
            {
                title: 'Ayudas para el Ministerio',
                icon: 'fas fa-book-open',
                msg: 'Repositorio de recursos, videos instructivos y metodologías para potenciar tu predicación y enseñanza.'
            },
            {
                title: 'Asistente de Inteligencia Artificial',
                icon: 'fas fa-brain',
                msg: 'Cerebro Territorial: tu guía 24/7. Pregúntale sobre la App, gestión de territorios o sugerencias para tu grupo.'
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

    const getMonday = (d) => {
        d = new Date(d);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    };

    const getSafeDateId = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const currentWeekId = getSafeDateId(getMonday(new Date()));

    let currentWeekStart = getMonday(new Date());
    let activeDayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1; // 0=Lunes
    let activeTurns = new Set(['manana', 'tarde', 'noche', 'zoom']);

    let programa, allTerritorios;
    try {
        [programa, allTerritorios] = await Promise.all([
            getProgramaSemanal(currentWeekId),
            getTerritorios()
        ]);
    } catch (err) {
        console.error("Critical error loading dashboard data:", err);
        agendaContainer.innerHTML = '<div class="col-span-full py-10 text-center"><p class="text-red-500 font-bold">Error de conexión al cargar datos.</p></div>';
        if (territoriosContainer) territoriosContainer.innerHTML = '';
        return;
    }

    const territoryMap = {};
    if (allTerritorios) allTerritorios.forEach(t => territoryMap[t.numero] = t);

    const turnosArr = ['manana', 'tarde', 'noche'];
    const assignments = [];

    const shownTerritoryIds = new Set();

    if (programa && programa.dias) {
        const mondayDate = new Date(currentWeekId + 'T12:00:00Z');
        programa.dias.forEach((d, idx) => {
            if (!d.fecha) {
                const dayDate = new Date(mondayDate);
                dayDate.setDate(dayDate.getDate() + idx);
                d.fecha = getSafeDateId(dayDate);
            }
        });

        programa.dias.forEach(d => {
            turnosArr.forEach(turno => {
                const tData = d[turno];
                if (tData && (tData.conductor || tData.auxiliar || tData.lugar)) {
                    const isConductor = tData.conductor?.trim() === name?.trim();
                    const isAuxiliar = tData.auxiliar?.trim() === name?.trim();

                    // IMPORTANT: Filter Agenda Semanal to ONLY user's assignments
                    if (!isConductor && !isAuxiliar) return;

                    let assignedTerritoryIds = [];
                    if (tData.territorio) {
                        assignedTerritoryIds = tData.territorio.split(/[,/]+/).map(s => s.trim()).filter(Boolean);
                    }

                    const attachedTerritories = assignedTerritoryIds.map(num => {
                        const t = territoryMap[num] || { numero: num, isMissingData: true };
                        if (t.id) shownTerritoryIds.add(t.id);
                        return t;
                    }).filter(t => {
                        if (t.isMissingData) return false;
                        // Strict check: Territory must still be assigned to the user
                        const matchesConductor = t.asignado_a?.trim() === name?.trim();
                        const matchesAuxiliar = t.auxiliar?.trim() === name?.trim();
                        return matchesConductor || matchesAuxiliar;
                    });

                    assignments.push({
                        dia: d.nombre,
                        turno: turno === 'manana' ? '🌅 Mañana' : (turno === 'tarde' ? '☀️ Tarde' : '🌙 Noche'),
                        role: isConductor ? 'Conductor' : (isAuxiliar ? 'Auxiliar' : 'Otro'),
                        isMember: true,
                        rawDate: d.fecha || 'Fecha no definida',
                        attachedTerritories,
                        ...tData
                    });
                }
            });
        });
    }

    // Capture "Orphaned" territories (Rescued or directly assigned outside this week's program)
    const myExtraTerritories = allTerritorios.filter(t => {
        const matchesUser = t.asignado_a?.trim() === name?.trim() || t.auxiliar?.trim() === name?.trim();
        const isOrphan = !shownTerritoryIds.has(t.id);
        const isActive = t.estado === 'Asignado' || t.estado === 'Pendiente';
        return matchesUser && isOrphan && isActive;
    });

    if (myExtraTerritories.length > 0) {
        assignments.push({
            dia: 'Extras',
            turno: '🚀 Misión de Rescate / Extra',
            role: 'Responsable',
            isMember: true,
            rawDate: 'Asignación Directa',
            attachedTerritories: myExtraTerritories,
            lugar: 'Territorios bajo tu cuidado extra',
            conductor: name,
            auxiliar: '---'
        });
    }

    // Group by Day
    const groupedByDay = {};
    assignments.forEach(a => {
        if (!groupedByDay[a.dia]) {
            groupedByDay[a.dia] = {
                dia: a.dia,
                rawDate: a.rawDate,
                isMember: a.isMember,
                shifts: []
            };
        }
        groupedByDay[a.dia].shifts.push(a);
    });

    const dayCards = Object.values(groupedByDay);
    const dayOrder = { 'Lunes': 0, 'Martes': 1, 'Miércoles': 2, 'Jueves': 3, 'Viernes': 4, 'Sábado': 5, 'Domingo': 6, 'Extras': 7 };
    dayCards.sort((a, b) => dayOrder[a.dia] - dayOrder[b.dia]);

    const totalActiveTerritories = assignments.reduce((acc, a) => acc + a.attachedTerritories.length, 0);
    const hasShifts = assignments.length > 0;
    const allCompleted = hasShifts && totalActiveTerritories === 0;

    // --- INTELLIGENCE LOGIC ---
    const intelligenceBadge = document.getElementById('agenda-intelligence-badge');
    if (intelligenceBadge) {
        const pendingTotal = dayCards.reduce((acc, d) => acc + d.shifts.reduce((sAcc, s) => sAcc + s.attachedTerritories.length, 0), 0);
        const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const todayName = dayNames[new Date().getDay()];
        const todayAssignments = dayCards.find(d => d.dia === todayName);

        let suggestion = "Hoy es un buen día para organizar tu semana.";
        let colorClass = "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400 border-slate-200 dark:border-white/10";

        if (todayAssignments && todayAssignments.shifts.some(s => s.attachedTerritories.length > 0)) {
            suggestion = "¡Tienes territorios asignados para hoy!";
            colorClass = "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20";
        } else if (pendingTotal > 0) {
            suggestion = `Tienes ${pendingTotal} territorios pendientes esta semana.`;
            colorClass = "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20";
        }

        // Feature 8: Integration of Rescue Missions into Smart Agenda (Refined as requested)
        const rescueCount = allTerritorios.filter(t => {
            if (t.estado !== 'Asignado' && t.estado !== 'Pendiente') return false;
            // Overdue check: 120 days
            const days = t.fecha_asignacion ? Math.floor((new Date() - new Date(t.fecha_asignacion)) / (1000 * 60 * 60 * 24)) : 0;
            return days > 120;
        }).length;

        const rescueBtnClass = rescueCount > 0
            ? "bg-rose-600 text-white border-rose-500/20"
            : "bg-white dark:bg-white/5 text-rose-500 border-rose-500/30";

        intelligenceBadge.innerHTML = `
            <div class="flex flex-wrap items-center gap-3">
                <button onclick="const section = document.getElementById('programa-semanal-section'); if(section) { section.classList.remove('hidden'); section.style.display = 'block'; } const det = document.querySelector('.group\\\\/prog-details'); if(det) { det.open = true; setTimeout(() => { det.scrollIntoView({behavior:'smooth', block:'start'}); }, 100); }" 
                        class="flex items-center gap-3 ${colorClass} py-3.5 px-6 rounded-2xl border text-[10px] font-black uppercase tracking-[0.15em] shadow-sm backdrop-blur-md hover:scale-105 active:scale-95 transition-all">
                    <i class="fas fa-calendar-alt animate-pulse"></i> Programa de predicación
                </button>
                <button id="btn-smart-rescue-trigger" onclick="window.showRescueMissionsModal()" 
                        class="flex items-center gap-3 ${rescueBtnClass} py-3.5 px-6 rounded-2xl border-2 text-[10px] font-black uppercase tracking-[0.15em] shadow-sm backdrop-blur-md hover:scale-105 active:scale-95 transition-all">
                    <i class="fas fa-ambulance ${rescueCount > 0 ? 'animate-bounce' : ''}"></i> Misiones ${rescueCount > 0 ? `<span class="bg-white text-rose-600 px-2 py-0.5 rounded-lg ml-1 font-black">${rescueCount}</span>` : ''}
                </button>
            </div>
        `;
    }

    window.showRescueMissionsModal = async () => {
        const allT = await getTerritorios();
        const rescueCandidates = allT.filter(t => {
            if (t.estado !== 'Asignado' && t.estado !== 'Pendiente') return false;
            const days = t.fecha_asignacion ? Math.floor((new Date() - new Date(t.fecha_asignacion)) / (1000 * 60 * 60 * 24)) : 0;
            return days > 120;
        });

        showModal(`
        <div class="p-8">
            <header class="flex items-center gap-4 mb-10">
                <div class="w-14 h-14 bg-rose-500/10 rounded-2xl flex items-center justify-center text-3xl text-rose-600 shadow-inner">
                    <i class="fas fa-ambulance animate-pulse"></i>
                </div>
                <div>
                    <h3 class="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Misiones de Rescate</h3>
                    <p class="text-[9px] text-rose-500 font-bold uppercase tracking-widest mt-1">Territorios atrasados que necesitan ayuda</p>
                </div>
            </header>

            <div class="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                ${rescueCandidates.length === 0 ? `
                    <div class="py-10 text-center text-slate-400">
                        <i class="fas fa-check-circle text-4xl mb-4 opacity-20"></i>
                        <p class="text-[10px] font-black uppercase tracking-widest leading-relaxed">¡Todo al día! No hay misiones pendientes.</p>
                    </div>
                ` : rescueCandidates.map(t => `
                    <div class="modern-card !p-6 border-rose-500/10 hover:border-rose-500 transition-all group flex items-center justify-between gap-4">
                        <div>
                            <div class="flex items-baseline gap-1">
                                <span class="text-rose-600 font-black text-xs">T-</span>
                                <span class="text-2xl font-black text-slate-900 dark:text-white">${t.numero}</span>
                            </div>
                            <p class="text-[9px] text-slate-400 font-bold uppercase mt-1">A cargo de: ${t.asignado_a}</p>
                        </div>
                        <button onclick="window.handleRescueTerritory('${t.id}', '${t.numero}', '${currentConductorName}', '${t.manzanas || ''}')" 
                                class="bg-rose-600 text-white px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-rose-600/20">
                            Coger
                        </button>
                    </div>
                `).join('')}
            </div>

            <button onclick="this.closest('#modal-container').classList.add('hidden')" class="w-full mt-10 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-600 transition-colors">Cerrar</button>
        </div>
    `);
    };

    // --- RENDER MAPS GRID ---
    const mapsGrid = document.getElementById('conductor-maps-grid');
    const mapsSearch = document.getElementById('search-explorer-maps');

    const renderMapsExplorer = (filter = '') => {
        if (!mapsGrid) return;

        let territoriesToShow = allTerritorios || [];

        // Filter by search
        if (filter) {
            const f = filter.toLowerCase();
            territoriesToShow = territoriesToShow.filter(t =>
                t.numero?.toString().includes(f) ||
                t.manzanas?.toLowerCase().includes(f)
            );
        }

        // Sort by number
        territoriesToShow.sort((a, b) => {
            const numA = parseInt(a.numero) || 0;
            const numB = parseInt(b.numero) || 0;
            return numA - numB;
        });

        if (territoriesToShow.length === 0) {
            mapsGrid.innerHTML = `
                <div class="col-span-full py-20 text-center space-y-4 opacity-30 group">
                    <div class="w-20 h-20 bg-slate-100 dark:bg-white/5 rounded-3xl flex items-center justify-center text-3xl mx-auto group-hover:scale-110 transition-transform">
                        <i class="fas fa-search-location"></i>
                    </div>
                    <p class="font-black text-[10px] uppercase tracking-[0.4em]">Sin resultados</p>
                </div>
            `;
        } else {
            mapsGrid.innerHTML = territoriesToShow.map(t => `
                <div class="modern-card !p-5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-primary/40 hover:shadow-xl transition-all group/card cursor-pointer shadow-sm relative overflow-hidden" onclick="window.openInteractiveMapFromDashboard('${t.id}')">
                    <div class="absolute inset-0 bg-primary/5 opacity-0 group-hover/card:opacity-100 transition-opacity pointer-events-none"></div>
                    <div class="flex justify-between items-start mb-4 relative z-10">
                        <span class="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black rounded-lg uppercase tracking-widest">T-${t.numero}</span>
                        <div class="flex items-center gap-2">
                             <div class="w-8 h-8 rounded-lg bg-slate-50 dark:bg-white/10 flex items-center justify-center group-hover/card:bg-primary group-hover/card:text-white transition-all text-slate-400 border border-slate-100 dark:border-white/5">
                                 <i class="fas fa-location-arrow text-[10px]"></i>
                             </div>
                        </div>
                    </div>
                    <h5 class="text-[11px] font-bold text-slate-800 dark:text-gray-200 uppercase tracking-tight leading-relaxed line-clamp-2 relative z-10">${formatManzanas(t.manzanas) || 'Sin sector definido'}</h5>
                </div>
            `).join('');
        }
    };

    if (mapsSearch) {
        mapsSearch.oninput = (e) => renderMapsExplorer(e.target.value);
    }
    renderMapsExplorer();

    window.openInteractiveMapFromDashboard = (tid) => {
        const t = allTerritorios.find(x => x.id === tid);
        if (t && window.openInteractiveMap) window.openInteractiveMap(t, { readOnly: true });
    };

    window.openGlobalMap = (type) => {
        const modal = document.getElementById('modal-container');
        if (!modal) return;
        modal.classList.remove('hidden');

        if (type === 'png') {
            modal.innerHTML = `
                <div class="w-full h-full max-w-5xl mx-auto flex flex-col p-4 animate-fade-in">
                    <div class="flex justify-between items-center mb-4 bg-white/80 dark:bg-[#0f1420]/90 backdrop-blur-2xl p-6 rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-2xl">
                        <div class="flex items-center gap-5">
                            <div class="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-xl text-primary shadow-inner border border-primary/10">
                                <i class="fas fa-image"></i>
                            </div>
                            <div>
                                <h4 class="font-black text-slate-800 dark:text-white uppercase tracking-widest text-[11px]">Cartografía General</h4>
                                <p class="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] mt-0.5">Mapa Estático de la Congregación</p>
                            </div>
                        </div>
                        <button onclick="document.getElementById('modal-container').classList.add('hidden')" class="w-12 h-12 bg-slate-100 dark:bg-white/5 hover:bg-rose-500/10 hover:text-rose-500 rounded-2xl transition-all border border-transparent hover:border-rose-500/20 flex items-center justify-center shadow-sm">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="flex-1 overflow-hidden rounded-[2.5rem] bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 flex items-center justify-center relative touch-none shadow-inner" id="png-zoom-container">
                        <img id="global-png-map" src="./assets/mapa-general.jpg" class="max-w-full max-h-full object-contain transition-all duration-200 ease-out shadow-2xl origin-center" style="transform: scale(1) translate(0px, 0px);">
                        
                        <!-- Zoom Controls Floating -->
                        <div class="absolute bottom-10 right-10 flex flex-col gap-3">
                            <button onclick="window.adjustGlobalZoom(0.3)" class="w-14 h-14 rounded-2xl bg-white/95 dark:bg-[#1a1c2a]/95 backdrop-blur shadow-2xl text-primary font-black border border-slate-200 dark:border-white/10 flex items-center justify-center hover:scale-110 active:scale-90 transition-all">
                                <i class="fas fa-plus"></i>
                            </button>
                            <button onclick="window.adjustGlobalZoom(-0.3)" class="w-14 h-14 rounded-2xl bg-white/95 dark:bg-[#1a1c2a]/95 backdrop-blur shadow-2xl text-primary font-black border border-slate-200 dark:border-white/10 flex items-center justify-center hover:scale-110 active:scale-90 transition-all">
                                <i class="fas fa-minus"></i>
                            </button>
                            <button onclick="window.resetGlobalZoom()" class="w-14 h-14 rounded-2xl bg-primary text-white shadow-2xl flex items-center justify-center hover:scale-110 active:scale-90 transition-all group">
                                <i class="fas fa-undo-alt group-hover:rotate-[-45deg] transition-transform"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            // Initialize Pan and Zoom logic
            setTimeout(() => window.initPanZoom('global-png-map', 'png-zoom-container'), 100);
        } else if (type === 'satellite') {
            const mid = "13IX1r6TfV5T8ZPwU3jzGr0YeHE-AdEg";
            modal.innerHTML = `
                <div class="w-full h-full max-w-6xl mx-auto flex flex-col p-4 animate-fade-in">
                    <div class="flex justify-between items-center mb-4 bg-white/80 dark:bg-[#0f1420]/90 backdrop-blur-2xl p-6 rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-2xl">
                        <div class="flex items-center gap-5">
                            <div class="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-xl text-emerald-500 shadow-inner border border-emerald-500/10">
                                <i class="fas fa-satellite"></i>
                            </div>
                            <div>
                                <h4 class="font-black text-slate-800 dark:text-white uppercase tracking-widest text-[11px]">Explorador Satelital</h4>
                                <p class="text-[9px] text-emerald-500 font-black uppercase mt-0.5 tracking-[0.2em] animate-pulse">GPS Activo en tiempo real</p>
                            </div>
                        </div>
                        <button onclick="document.getElementById('modal-container').classList.add('hidden')" class="w-12 h-12 bg-slate-100 dark:bg-white/5 hover:bg-rose-500/10 hover:text-rose-500 rounded-2xl transition-all border border-transparent hover:border-rose-500/20 flex items-center justify-center shadow-sm">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="flex-1 rounded-[2.5rem] overflow-hidden bg-slate-100 border border-slate-200 dark:border-white/5 shadow-2xl relative">
                        <iframe id="satellite-iframe" src="https://www.google.com/maps/d/u/0/embed?mid=${mid}&ehbc=2E312F" width="100%" height="100%" style="border:0;" allow="geolocation"></iframe>
                        
                        <!-- Real-time Location Overlay Helper -->
                        <div class="absolute bottom-10 left-1/2 -translate-x-1/2 bg-white/95 dark:bg-[#0f1420]/95 backdrop-blur-md px-6 py-3 rounded-full border border-slate-200 dark:border-white/10 shadow-2xl flex items-center gap-3 pointer-events-none">
                            <span class="relative flex h-2 w-2">
                                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span class="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                            </span>
                            <span class="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest">Sincronizando con GPS del Dispositivo</span>
                        </div>
                    </div>
                </div>
            `;
        }
    };

    // --- GLOBAL MAP UTILS ---
    let zoomState = { scale: 1, x: 0, y: 0 };
    window.adjustGlobalZoom = (delta) => {
        const img = document.getElementById('global-png-map');
        if (!img) return;
        zoomState.scale = Math.max(0.5, Math.min(5, zoomState.scale + delta));
        img.style.transform = `scale(${zoomState.scale}) translate(${zoomState.x}px, ${zoomState.y}px)`;
    };

    window.resetGlobalZoom = () => {
        const img = document.getElementById('global-png-map');
        if (!img) return;
        zoomState = { scale: 1, x: 0, y: 0 };
        img.style.transform = `scale(1) translate(0px, 0px)`;
    };

    window.initPanZoom = (imgId, containerId) => {
        const img = document.getElementById(imgId);
        const container = document.getElementById(containerId);
        if (!img || !container) return;

        let isDragging = false;
        let startX, startY;
        let lastX = 0, lastY = 0;

        const updateTransform = () => {
            img.style.transform = `scale(${zoomState.scale}) translate(${zoomState.x}px, ${zoomState.y}px)`;
        };

        container.onmousedown = (e) => {
            if (zoomState.scale <= 1) return;
            isDragging = true;
            startX = e.clientX - lastX;
            startY = e.clientY - lastY;
            container.style.cursor = 'grabbing';
        };

        window.onmousemove = (e) => {
            if (!isDragging) return;
            lastX = e.clientX - startX;
            lastY = e.clientY - startY;
            zoomState.x = lastX / zoomState.scale;
            zoomState.y = lastY / zoomState.scale;
            updateTransform();
        };

        window.onmouseup = () => {
            isDragging = false;
            container.style.cursor = 'default';
        };

        // Touch Support
        let lastTouchDist = 0;
        container.ontouchstart = (e) => {
            if (e.touches.length === 1) {
                isDragging = true;
                startX = e.touches[0].clientX - lastX;
                startY = e.touches[0].clientY - lastY;
            } else if (e.touches.length === 2) {
                lastTouchDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
            }
        };

        container.ontouchmove = (e) => {
            if (e.touches.length === 1 && isDragging) {
                lastX = e.touches[0].clientX - startX;
                lastY = e.touches[0].clientY - startY;
                zoomState.x = lastX / zoomState.scale;
                zoomState.y = lastY / zoomState.scale;
                updateTransform();
            } else if (e.touches.length === 2) {
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                const delta = (dist - lastTouchDist) / 100;
                zoomState.scale = Math.max(0.5, Math.min(5, zoomState.scale + delta));
                lastTouchDist = dist;
                updateTransform();
            }
        };

        container.ontouchend = () => {
            isDragging = false;
        };

        // Mouse Wheel Zoom
        container.onwheel = (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            zoomState.scale = Math.max(0.5, Math.min(5, zoomState.scale + delta));
            updateTransform();
        };
    };

    if (!hasShifts) {
        agendaContainer.innerHTML = `
            <div class="col-span-full py-24 px-8 modern-card text-center animate-fade-in shadow-2xl bg-white dark:bg-white/[0.02] border-slate-200 dark:border-white/5 opacity-60">
                <div class="flex flex-col items-center gap-6">
                    <div class="w-24 h-24 bg-primary/10 rounded-[2.5rem] flex items-center justify-center text-5xl text-primary shadow-inner">
                        <i class="fas fa-inbox"></i>
                    </div>
                    <div class="space-y-2">
                        <h4 class="text-2xl font-black text-slate-800 dark:text-white tracking-tighter uppercase">Sin asignaciones activas</h4>
                        <p class="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] max-w-xs mx-auto leading-relaxed">
                            Revisa más tarde o contacta con el responsable
                        </p>
                    </div>
                </div>
            </div>
        `;
    } else if (allCompleted) {
        agendaContainer.innerHTML = `
            <div class="col-span-full py-28 px-8 modern-card bg-emerald-500/5 !rounded-[4rem] border-2 border-emerald-500/20 text-center animate-bounce-in shadow-2xl shadow-emerald-500/10">
                <div class="text-8xl mb-8 flex justify-center text-emerald-500">
                    <i class="fas fa-trophy animate-float"></i>
                </div>
                <h4 class="text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">¡Excelente, ${name.split(' ')[0]}!</h4>
                <p class="text-emerald-500 font-black text-xl mt-6 uppercase tracking-[0.2em]">Territorio completado al 100%</p>
                <div class="mt-12 flex justify-center">
                    <div class="px-10 py-4 bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-500/30">
                        <i class="fas fa-check-circle mr-2"></i> Misión Cumplida
                    </div>
                </div>
            </div>
        `;
    } else {
        agendaContainer.innerHTML = dayCards.map(dayData => `
            <div class="group relative modern-card !p-6 transition-all duration-500 hover:shadow-2xl flex flex-col gap-6 shadow-sm border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900/40">
                <!-- Header Minimalista -->
                <div class="flex justify-between items-center border-b border-slate-100 dark:border-white/5 pb-4">
                    <div>
                        <h3 class="font-black text-2xl text-slate-800 dark:text-white tracking-tighter uppercase leading-none mb-1">${dayData.dia}</h3> 
                        <span class="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] block opacity-60">${dayData.rawDate}</span>
                    </div>
                    <div class="w-8 h-8 flex items-center justify-center text-slate-200 dark:text-white/10">
                        <i class="fas fa-calendar-alt text-xl"></i>
                    </div>
                </div>

                <div class="flex flex-col gap-6">
                    ${dayData.shifts.map((a, shiftIdx) => `
                        <div class="shift-block space-y-4 animate-fade-in" style="animation-delay: ${shiftIdx * 100}ms">
                            <!-- Badge de Turno -->
                            <div class="flex items-center gap-2">
                                 <span class="w-1.5 h-1.5 rounded-full ${a.turno.includes('Mañana') ? 'bg-orange-400' : 'bg-indigo-500'}"></span>
                                 <h4 class="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.4em]">${a.turno}</h4>
                            </div>

                            <!-- Staff & Location Minimal -->
                            <div class="space-y-3">
                                <div class="grid grid-cols-2 gap-4 px-1">
                                    <div class="space-y-0.5 text-left border-l-2 border-slate-100 dark:border-white/5 pl-3">
                                        <p class="text-[7px] font-black text-slate-400 uppercase tracking-widest opacity-70">Conductor</p>
                                        <p class="text-[10px] font-black ${a.conductor === name ? 'text-teal-600' : 'text-slate-700 dark:text-slate-200'} leading-none">${a.conductor || '---'}</p>
                                    </div>
                                    <div class="space-y-0.5 text-left border-l-2 border-slate-100 dark:border-white/5 pl-3">
                                        <p class="text-[7px] font-black text-slate-400 uppercase tracking-widest opacity-70">Auxiliar</p>
                                        <p class="text-[10px] font-black ${a.auxiliar === name ? 'text-teal-600' : 'text-slate-700 dark:text-slate-200'} leading-none">${a.auxiliar || '---'}</p>
                                    </div>
                                </div>

                                <div class="flex items-center gap-3 px-1">
                                    <i class="fas fa-map-marker-alt text-primary/40 text-[10px]"></i>
                                    <div class="min-w-0">
                                        <p class="text-[10px] font-black text-slate-600 dark:text-slate-100 uppercase tracking-tight truncate">${a.lugar || 'Por definir'}</p>
                                    </div>
                                </div>
                            </div>

                            ${a.attachedTerritories.length > 0 ? `
                            <div class="space-y-4">
                                 <!-- Listado de Territorios Ultra-Slim -->
                                 <div class="px-1 space-y-3">
                                    ${a.attachedTerritories.map(t => `
                                        <div class="flex items-start gap-3 group/titem">
                                            <div class="mt-0.5 flex flex-col items-center">
                                                <span class="text-[12px] font-black text-slate-800 dark:text-white tracking-widest">T${t.numero}</span>
                                                <div class="w-3 h-0.5 bg-primary/20 rounded-full mt-0.5"></div>
                                            </div>
                                            <div class="flex-1 pt-0.5">
                                                <p class="text-[9px] font-bold text-slate-400 dark:text-slate-500 leading-snug uppercase tracking-tight line-clamp-2">${formatManzanas(t.manzanas) || '-'}</p>
                                            </div>
                                        </div>
                                    `).join('')}
                                 </div>
                                
                                 ${conductorData?.privilegios?.includes('Superintendente de Circuito') ? '' : `
                                <div class="pt-2">
                                    <button class="territory-report-btn w-full bg-slate-900 dark:bg-teal-600/90 hover:bg-black dark:hover:bg-teal-500 py-4 rounded-2xl text-white font-black text-[9px] uppercase tracking-[0.3em] shadow-xl shadow-slate-900/10 active:scale-95 transition-all flex items-center justify-center gap-3"
                                        data-ids="${a.attachedTerritories.map(t => t.id).join(',')}" 
                                        data-nums="${a.attachedTerritories.map(t => t.numero).join(',')}">
                                        Informar
                                    </button>
                                </div>
                                `}
                            </div>` : ''}
                            
                            ${shiftIdx < dayData.shifts.length - 1 ? '<div class="h-px bg-slate-50 dark:bg-white/5 my-2"></div>' : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
    `).join('');
    }


    // Final UI Setup
    setTimeout(() => {
        const btnsReport = agendaContainer.querySelectorAll('.territory-report-btn');
        btnsReport.forEach(btn => {
            btn.onclick = () => {
                const ids = btn.dataset.ids.split(',');
                window.openProgressModal(ids[0], ids);
            };
        });

        const btnsHistory = agendaContainer.querySelectorAll('.territory-history-btn');
        btnsHistory.forEach(btn => {
            btn.onclick = () => {
                const tid = btn.dataset.tid;
                const tnum = btn.dataset.tnum;
                window.showUnifiedTerritoryHistory(tid, tnum);
            };
        });
    }, 0);

    if (userMods.disponibilidad !== false) {
        renderAvailabilitySection(document.getElementById('availability-container'), name);
    }
    if (userRole !== 'Administrador' && userRole !== 'SuperAdmin' && userMods.agenda !== false) {
        renderAISection(name);
    }
    if (userMods.ayudas !== false) {
        renderRecursosSection(document.getElementById('recursos-container'));
    }

    // Link Rescue Module to Smart Agenda
    const showRescue = userMods?.agenda === true || (userMods?.rescue === true) || (userMods?.rescue !== false && config?.rescue_mode);
    if (showRescue) {
        renderRescueSection(document.getElementById('ayudas-container'), name, allTerritorios, config, programa, conductorData);
    } else {
        const ayudas = document.getElementById('ayudas-container');
        if (ayudas) ayudas.classList.add('hidden');
    }

    // Update Rescue Button in Smart Agenda if any
    const rescueList = (allTerritorios || []).filter(t => {
        if (t.estado !== 'Asignado' && t.estado !== 'Pendiente') return false;
        if (t.asignado_a === name) return false;
        // Logic should match renderRescueSection
        return false; // placeholder for sync
    });
    const smartRescueBtn = document.getElementById('btn-smart-rescue');
    if (smartRescueBtn && rescueList.length > 0) {
        smartRescueBtn.classList.remove('hidden');
        smartRescueBtn.classList.add('flex');
        document.getElementById('smart-rescue-count').innerText = rescueList.length;
        // If critical (e.g. any mission overdue > 4 days)
        smartRescueBtn.className = "flex items-center gap-3 bg-rose-600 text-white py-3 px-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-rose-600/30 hover:scale-105 transition-all animate-bounce-subtle";
    }

    // Module: Programa Semanal (Global)
    if (userMods.programa !== false) {
        const programCardsContainer = document.getElementById('weekly-program-cards');
        const weekRangeLabel = document.getElementById('prog-week-range');
        const daySelector = document.getElementById('prog-day-selector');
        const turnFilters = document.getElementById('prog-turn-filters');

        const loadWeekData = async () => {
            const weekId = getSafeDateId(currentWeekStart);
            const monday = new Date(currentWeekStart);
            const sunday = new Date(monday);
            sunday.setDate(sunday.getDate() + 6);

            if (weekRangeLabel) {
                const fmt = (d) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).toUpperCase();
                weekRangeLabel.innerText = `${fmt(monday)} - ${fmt(sunday)}`;
            }

            // Show loading
            programCardsContainer.innerHTML = `
                <div class="col-span-full py-20 flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                    <div class="w-16 h-16 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin"></div>
                    <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Cargando programación...</p>
                </div>`;

            try {
                const prog = await getProgramaSemanal(weekId);
                window._globalPrograma = prog;
                window._globalTerritorios = allTerritorios;
                renderFilters();
                renderDaySelector();
                renderFullProgramaCards(prog, programCardsContainer, territoryMap, name, activeDayIndex, activeTurns);
            } catch (err) {
                console.error("Error loading week:", err);
                programCardsContainer.innerHTML = '<p class="text-center text-rose-500 font-bold p-10">Error al cargar la programación</p>';
            }
        };

        const renderFilters = () => {
            if (!turnFilters) return;
            const turnosArr = [
                { id: 'manana', icon: 'fa-sun', label: 'M', color: 'text-amber-500', bg: 'bg-amber-500/10', full: 'Mañana' },
                { id: 'tarde', icon: 'fa-cloud-sun', label: 'T', color: 'text-orange-500', bg: 'bg-orange-500/10', full: 'Tarde' },
                { id: 'noche', icon: 'fa-moon', label: 'N', color: 'text-indigo-400', bg: 'bg-indigo-400/10', full: 'Noche' },
                { id: 'zoom', icon: 'fa-video', label: 'Z', color: 'text-emerald-500', bg: 'bg-emerald-500/10', full: 'Zoom' }
            ];

            turnFilters.innerHTML = turnosArr.map(t => {
                const isActive = activeTurns.has(t.id);
                return `
                    <button onclick="window.toggleProgTurn('${t.id}')" 
                            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-[9px] font-black uppercase tracking-wider ${isActive ? t.bg + ' ' + t.color : 'text-slate-400 opacity-40 hover:opacity-100'}">
                        <i class="fas ${t.icon}"></i>
                        <span class="hidden sm:inline">${t.full}</span>
                        <span class="inline sm:hidden">${t.label}</span>
                    </button>
                `;
            }).join('');
        };

        const renderDaySelector = () => {
            if (!daySelector) return;
            const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
            daySelector.innerHTML = `
                ${dayNames.map((n, i) => {
                const isActive = activeDayIndex === i;
                const isToday = new Date().getDay() === (i === 6 ? 0 : i + 1);
                return `
                    <button onclick="window.setProgActiveDay(${i})" 
                            class="relative px-4 sm:px-5 py-2 rounded-[1.25rem] text-[9px] font-black uppercase tracking-widest transition-all duration-300 ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 scale-105' : 'text-slate-500 hover:text-indigo-500 hover:bg-white dark:hover:bg-white/10'}">
                        ${n.substring(0, 3)}
                        ${isToday ? '<span class="absolute top-1 right-1 w-1.5 h-1.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-800"></span>' : ''}
                    </button>
                `;
            }).join('')}
                <div class="w-px h-5 bg-slate-200 dark:bg-white/10 mx-1"></div>
                <button onclick="window.setProgActiveDay(-1)" 
                        class="px-4 py-2 rounded-[1.25rem] text-[9px] font-black uppercase tracking-widest transition-all duration-300 ${activeDayIndex === -1 ? 'bg-slate-800 dark:bg-slate-700 text-white shadow-xl' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}">
                    Toda
                </button>
            `;
        };

        window.toggleProgTurn = (id) => {
            if (activeTurns.has(id)) {
                if (activeTurns.size > 1) activeTurns.delete(id);
            } else {
                activeTurns.add(id);
            }
            renderFilters();
            renderFullProgramaCards(window._globalPrograma, programCardsContainer, territoryMap, name, activeDayIndex, activeTurns);
        };

        window.setProgActiveDay = (idx) => {
            activeDayIndex = idx;
            renderDaySelector();
            renderFullProgramaCards(window._globalPrograma, programCardsContainer, territoryMap, name, activeDayIndex, activeTurns);
        };

        // Navigation Events
        const btnPrev = document.getElementById('prog-prev-week');
        const btnNext = document.getElementById('prog-next-week');
        const btnToday = document.getElementById('prog-btn-today');

        if (btnPrev) btnPrev.onclick = () => { currentWeekStart.setDate(currentWeekStart.getDate() - 7); loadWeekData(); };
        if (btnNext) btnNext.onclick = () => { currentWeekStart.setDate(currentWeekStart.getDate() + 7); loadWeekData(); };
        if (btnToday) btnToday.onclick = () => { currentWeekStart = getMonday(new Date()); activeDayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1; loadWeekData(); };

        document.getElementById('prog-export-png').onclick = async () => {
            const previewHTML = generateLandscapePreviewHTML(window._globalPrograma);
            const tempDiv = document.createElement('div');
            tempDiv.style.position = 'absolute'; tempDiv.style.left = '-9999px'; tempDiv.style.width = '1920px'; tempDiv.style.height = '1080px';
            tempDiv.innerHTML = previewHTML;
            document.body.appendChild(tempDiv);
            try {
                showNotification("Generando programa para descarga...", "info");
                const canvas = await html2canvas(tempDiv.querySelector('#landscape-preview-content'), {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#f8fafc'
                });
                const link = document.createElement('a');
                link.download = `Programa_${window._globalPrograma.id}.png`;
                link.href = canvas.toDataURL('image/png'); link.click();
                showNotification("Imagen descargada en alta resolución", "success");
            } catch (e) {
                console.error(e); showNotification("Error al generar imagen", "error");
            } finally { document.body.removeChild(tempDiv); }
        };

        // Initial Load
        loadWeekData();
    }
};

window.openTerritorySelector = (dayIndex, turnId, btnElement) => {
    if (!btnElement || !window._globalPrograma) return;
    const currentVal = btnElement.dataset.current;
    window.showTerritorySelectionModal(currentVal, window._globalTerritorios, (newValue) => {
        if (!window._globalPrograma.dias[dayIndex][turnId]) window._globalPrograma.dias[dayIndex][turnId] = {};
        window._globalPrograma.dias[dayIndex][turnId].territorio = newValue;
        btnElement.dataset.current = newValue;

        // Update display inside the button
        const span = btnElement.querySelector('span.truncate');
        if (span) {
            span.textContent = newValue || '—';
            span.className = `text-[10px] font-black truncate ${newValue ? 'text-primary' : 'text-slate-400 opacity-40'}`;
        }

        // Trigger save and sync
        window.updateWeekData(dayIndex, turnId, 'territorio', newValue);
    });
};

window.updateWeekData = async (dayIndex, turnoId, field, value) => {
    if (!window._globalPrograma) return;
    if (!window._globalPrograma.dias[dayIndex][turnoId]) window._globalPrograma.dias[dayIndex][turnoId] = {};
    window._globalPrograma.dias[dayIndex][turnoId][field] = value;

    try {
        const weekId = window._globalPrograma.id;
        await saveProgramaSemanal(weekId, window._globalPrograma);
        const tData = window._globalPrograma.dias[dayIndex][turnoId];
        const diaObj = window._globalPrograma.dias[dayIndex];
        const dateISO = new Date(diaObj.fecha + 'T12:00:00Z').toISOString();
        await syncSlotWithTerritories(weekId, dayIndex, turnoId, tData, dateISO);

        // Refresh local territory memory to ensure labels update correctly
        const freshTerritories = await getTerritorios();
        window._globalTerritorios = freshTerritories;

        // Re-render the program table to show synced states immediately
        const programCardsContainer = document.getElementById('weekly-program-cards');
        if (programCardsContainer) {
            renderFullProgramaCards(window._globalPrograma, programCardsContainer, {}, ""); // Map not needed for name comparison
        }

        showNotification("Asignación sincronizada exitosamente", "success");
    } catch (e) {
        console.error("Update error:", e);
        showNotification("Error al guardar revisión", "error");
    }
};

const formatGroups = (val) => {
    if (!val) return '—';
    return String(val).toUpperCase().split(/[,/]/).map(s => s.trim().split(' ')[0]).join(' / ');
};

const generateLandscapePreviewHTML = (programa) => {
    if (!programa) return '';
    const turnosArr = [
        { id: 'manana', icon: 'fa-sun', label: 'MAÑANA', color: '#b45309', bg: '#fffbeb' },
        { id: 'tarde', icon: 'fa-cloud-sun', label: 'TARDE', color: '#c2410c', bg: '#fff7ed' },
        { id: 'noche', icon: 'fa-moon', label: 'NOCHE', color: '#3730a3', bg: '#f5f3ff' },
        { id: 'zoom', icon: 'fa-video', label: 'ZOOM', color: '#065f46', bg: '#f0fdf4' }
    ];

    const hasBusyDay = (programa.dias || []).some(dia => {
        const active = turnosArr.filter(t => {
            const data = dia[t.id];
            return data && (data.conductor || data.lugar);
        });
        return active.length > 2;
    });

    let html = `
        <div id="landscape-preview-content" class="bg-slate-50 text-slate-900 font-['Outfit'] relative overflow-hidden flex flex-col p-6 pt-0" style="width: 1920px; height: 1080px; box-sizing: border-box;">
            <header class="relative z-10 flex flex-col items-center mb-3 px-10 pt-4 w-full">
                <h1 class="text-[54px] font-black uppercase tracking-[0.1em] leading-none mb-1 text-slate-900">Programa de Predicación</h1>
                <p class="text-lg font-black uppercase tracking-[0.15em] text-slate-600 mb-3">Cronograma Semanal de Salidas</p>
                <div class="w-full h-1.5 bg-slate-900 rounded-full"></div>
            </header>

            <div class="relative z-10 grid grid-cols-7 gap-3 flex-1 overflow-hidden px-4 pb-7">
                ${(programa.dias || []).map((dia, idx) => {
        const activeTurns = turnosArr.filter(t => {
            const data = dia[t.id];
            return data && (data.conductor || data.lugar);
        });

        return `
                        <div class="bg-white rounded-[2rem] flex flex-col shadow-xl shadow-slate-200/40 border border-slate-100/50 overflow-hidden relative h-full">
                            <div class="${hasBusyDay ? 'px-4 py-3 min-h-[100px]' : 'px-5 py-6 min-h-[140px]'} border-b border-slate-50 bg-slate-50/20 shrink-0 flex flex-col justify-center">
                                <h2 class="${hasBusyDay ? 'text-2xl' : 'text-3xl'} font-black uppercase tracking-tighter text-slate-900 leading-none mb-1">${dia.nombre}</h2>
                                <span class="text-[10px] font-bold uppercase tracking-widest text-slate-300 opacity-80">${dia.fecha ? dia.fecha.split('-').reverse().join('/') : ''}</span>
                            </div>
                            
                            <div class="${hasBusyDay ? 'p-2.5 space-y-5' : 'p-4 space-y-10'} flex-1 overflow-visible">
                                ${activeTurns.map(t => {
            const data = dia[t.id];
            const isSunday = dia.nombre.toLowerCase() === 'domingo';
            const hourInt = data.hora ? parseInt(data.hora) : (t.id === 'manana' ? 9 : t.id === 'tarde' ? 15 : 19);

            let labelText = t.label; let displayIcon = t.icon; let displayColor = t.color;

            if (isSunday && data.hora) {
                if (hourInt < 11) { labelText = 'MAÑANA'; displayIcon = 'fa-sun'; displayColor = '#b45309'; }
                else if (hourInt < 16) { labelText = 'MEDIODÍA'; displayIcon = 'fa-cloud-sun'; displayColor = '#c2410c'; }
                else if (hourInt < 19) { labelText = 'TARDE'; displayIcon = 'fa-sun-haze'; displayColor = '#c2410c'; }
                else { labelText = 'NOCHE'; displayIcon = 'fa-moon'; displayColor = '#3730a3'; }
            }

            return `
                                        <div class="${hasBusyDay ? 'space-y-1.5' : 'space-y-4'}">
                                            <div class="flex items-center gap-2">
                                                <i class="fas ${displayIcon} text-[18px]" style="color: ${displayColor}"></i>
                                                <span class="text-[18px] font-black uppercase tracking-[0.35em]" style="color: ${displayColor}">${labelText}</span>
                                            </div>
                                            
                                            <div class="${hasBusyDay ? 'space-y-1' : 'space-y-3'}">
                                                ${['Lugar', 'Hora', 'Conductor', 'Auxiliar', 'Faceta', 'Grupos'].map(field => {
                if (t.id === 'zoom' && field === 'Auxiliar') return '';
                let val = data[field.toLowerCase()];
                if (!val || val === '—' || val === '') return '';
                if (field === 'Grupos') { val = formatGroups(val); }
                const isKeyField = field === 'Lugar' || field === 'Hora';
                const fontSize = isKeyField ? (hasBusyDay ? '17px' : '22px') : (hasBusyDay ? '13px' : '15px');
                return `
                                                        <div class="flex flex-col leading-tight">
                                                             <span class="text-[6px] font-black uppercase tracking-widest text-slate-300 mb-0.5">${field}</span>
                                                             <span class="text-[${fontSize}] font-black uppercase tracking-tight text-slate-900">${val}</span>
                                                        </div>
                                                    `;
            }).join('')}
                                            </div>
                                        </div>
                                    `;
        }).join('')}
                            </div>
                        </div>
                    `;
    }).join('')}
            </div>
        </div>
    `;
    return html;
};

/* --- DISPONIBILIDAD --- */
async function renderAvailabilitySection(container, name) {
    if (!container) return;

    // 1. Fetch publicador data to get current availability
    const allP = await getPublicadores();
    const p = allP.find(x => x.nombre === name);
    if (!p) {
        container.innerHTML = '';
        return;
    }

    const currentAvail = p.disponibilidad || [];
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const shifts = [
        { id: 'manana', label: 'Mañana', icon: 'fas fa-sun', color: 'text-amber-500' },
        { id: 'tarde', label: 'Tarde', icon: 'fas fa-cloud-sun', color: 'text-orange-500' },
        { id: 'noche', label: 'Noche', icon: 'fas fa-moon', color: 'text-indigo-400' }
    ];

    const wasAvailOpen = container.querySelector('.group-avail')?.open;

    container.innerHTML = `
    <div class="modern-card !p-0 mt-8 animate-fade-in shadow-2xl transition-all overflow-hidden border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40">
        <details class="group-avail" ${wasAvailOpen ? 'open' : ''}>
            <summary class="flex flex-col md:flex-row justify-between items-start md:items-center p-8 cursor-pointer list-none select-none hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                <div class="flex items-start gap-6">
                    <div class="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-2xl text-indigo-500 shadow-inner border border-indigo-500/10 group-open-avail:rotate-6 transition-transform">
                        <i class="fas fa-user-clock"></i>
                    </div>
                    <div>
                        <div class="flex items-center gap-3">
                            <h3 class="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Mi Disponibilidad</h3>
                            <div class="w-6 h-6 rounded-lg bg-slate-100 dark:bg-white/10 flex items-center justify-center text-[10px] group-open/avail:rotate-180 transition-transform text-slate-400">
                                <i class="fas fa-chevron-down"></i>
                            </div>
                        </div>
                        <p class="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-[0.3em] mt-1 ml-1 opacity-80 italic">Indica tu disponibilidad para conducir un grupo de predicación</p>
                    </div>
                </div>
            </summary>

            <div class="p-8 pt-0 animate-fade-in">
                <div class="flex justify-end mb-8">
                    <button id="btn-save-availability" class="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-indigo-500/30 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3 uppercase tracking-widest text-[10px]">
                        <i class="fas fa-save mr-1"></i> Guardar Cambios
                    </button>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    ${days.map(day => `
                        <div class="bg-slate-50 dark:bg-white/[0.02] p-6 rounded-[2rem] border border-slate-100 dark:border-white/5 space-y-4">
                            <div class="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
                                <span class="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest">${day}</span>
                                <i class="fas fa-calendar-day text-slate-300 dark:text-slate-600"></i>
                            </div>
                            <div class="grid grid-cols-1 gap-2">
                                ${shifts.map(sh => {
        const val = `${day}_${sh.id}`;
        const isChecked = currentAvail.includes(val);
        return `
                                    <label class="flex items-center justify-between p-4 rounded-xl border border-black/5 dark:border-white/5 bg-white/50 dark:bg-black/20 cursor-pointer active:scale-95 transition-all group/opt">
                                        <div class="flex items-center gap-3">
                                            <div class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center text-sm ${sh.color}">
                                                <i class="${sh.icon}"></i>
                                            </div>
                                            <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">${sh.label}</span>
                                        </div>
                                        <div class="relative flex items-center">
                                            <input type="checkbox" class="avail-check w-5 h-5 accent-indigo-600 rounded-lg" value="${val}" ${isChecked ? 'checked' : ''}>
                                        </div>
                                    </label>
                                `;
    }).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </details>
        </div>
    `;

    const btnSave = document.getElementById('btn-save-availability');
    if (btnSave) {
        btnSave.onclick = async () => {
            const originalText = btnSave.innerText;
            btnSave.innerText = 'GUARDANDO...';
            btnSave.disabled = true;

            const checks = container.querySelectorAll('.avail-check:checked');
            const newAvail = Array.from(checks).map(c => c.value);

            try {
                await updatePublicador(p.id, { disponibilidad: newAvail });
                showNotification("¡Disponibilidad actualizada!", "success");
            } catch (e) {
                console.error(e);
                showNotification("Error al guardar cambios", "error");
            } finally {
                btnSave.innerText = originalText;
                btnSave.disabled = false;
            }
        };
    }
}

const renderFullProgramaCards = (programa, container, territoryMap = {}, currentConductorName, activeDayIndex = -1, activeTurns = new Set(['manana', 'tarde', 'noche', 'zoom'])) => {
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const shifts = ['manana', 'tarde', 'noche', 'zoom'];
    const shiftLabels = { 'manana': 'Mañana', 'tarde': 'Tarde', 'noche': 'Noche', 'zoom': 'Zoom' };
    const shiftIcons = { 'manana': 'fa-sun', 'tarde': 'fa-cloud-sun', 'noche': 'fa-moon', 'zoom': 'fa-video' };
    const shiftColors = { 'manana': 'text-amber-500', 'tarde': 'text-orange-500', 'noche': 'text-indigo-400', 'zoom': 'text-emerald-500' };

    if (!programa || !programa.dias || programa.dias.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-20 flex flex-col items-center justify-center text-center space-y-5 animate-fade-in opacity-30 group">
                <div class="w-24 h-24 bg-slate-100 dark:bg-white/5 rounded-[3rem] flex items-center justify-center text-4xl mb-2 transition-transform group-hover:scale-110 duration-700">
                    <i class="fas fa-calendar-day"></i>
                </div>
                <div class="space-y-2">
                    <p class="text-xs font-black text-slate-400 uppercase tracking-[0.4em]">No hay actividades para esta semana</p>
                    <p class="text-[10px] text-slate-400 italic font-bold uppercase tracking-widest">Consulta con el responsable del grupo</p>
                </div>
            </div>`;
        return;
    }

    let html = `
    <div class="col-span-full animate-fade-in">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                ${days.map((dayName, dayIdx) => {
        // Filter by activeDayIndex
        if (activeDayIndex !== -1 && activeDayIndex !== dayIdx) return '';

        const d = (programa.dias || []).find(x => x.nombre === dayName);
        if (!d) return '';

        // Check if day has any visible shift
        const hasVisibleData = shifts.some(s => {
            if (!activeTurns.has(s)) return false;
            if (s === 'zoom' && dayName !== 'Martes') return false;
            const sData = d[s];
            return sData && (sData.conductor || sData.lugar);
        });

        if (!hasVisibleData) {
            if (activeDayIndex !== -1) {
                return `
                    <div class="col-span-full py-20 flex flex-col items-center justify-center text-center opacity-30">
                        <i class="fas fa-calendar-day text-4xl mb-4"></i>
                        <p class="text-[10px] font-black uppercase tracking-widest italic">No hay salidas programadas para este día</p>
                    </div>`;
            }
            return '';
        }

        return `
                    <div class="modern-card !p-6 border-slate-100 dark:border-white/10 shadow-xl bg-white dark:bg-slate-900/40 space-y-6 hover:shadow-2xl transition-all duration-500">
                        <div class="flex justify-between items-center border-b border-slate-100 dark:border-white/5 pb-4">
                            <div>
                                <h3 class="font-black text-xl text-slate-800 dark:text-white tracking-tighter uppercase leading-none mb-1">${dayName}</h3>
                                <span class="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">${d?.fecha ? d.fecha.split('-').reverse().join('/') : '-'}</span>
                            </div>
                            <div class="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500">
                                <i class="fas fa-calendar-day"></i>
                            </div>
                        </div>

                        <div class="space-y-4">
                            ${shifts.map(shift => {
            if (!activeTurns.has(shift)) return '';
            if (shift === 'zoom' && dayName !== 'Martes') return '';

            const sData = d ? d[shift] : null;
            if (!sData || (!sData.conductor && !sData.lugar)) return '';

            const isConductor = sData.conductor === currentConductorName;
            const isAuxiliar = sData.auxiliar === currentConductorName;
            const isImpacted = isConductor || isAuxiliar;

            return `
                                <div class="p-4 rounded-2xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] ${isImpacted ? 'ring-2 ring-primary/20 bg-primary/5' : ''}">
                                    <div class="flex items-center gap-2 mb-3">
                                        <i class="fas ${shiftIcons[shift]} ${shiftColors[shift]} text-[10px]"></i>
                                        <span class="text-[9px] font-black uppercase tracking-widest text-slate-400">${shiftLabels[shift]}</span>
                                    </div>
                                    
                                    <div class="space-y-3">
                                        ${sData.lugar ? `
                                            <div class="flex items-start gap-2">
                                                <i class="fas fa-map-marker-alt text-slate-300 mt-1 text-[8px]"></i>
                                                <p class="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase leading-snug">${sData.lugar}</p>
                                            </div>` : ''}

                                        <div class="grid grid-cols-1 gap-1.5">
                                            <div class="flex items-center gap-2">
                                                <div class="w-1 h-3 ${isConductor ? 'bg-primary' : 'bg-slate-300'} rounded-full"></div>
                                                <span class="text-[10px] font-black ${isConductor ? 'text-primary' : 'text-slate-700 dark:text-slate-200'} truncate uppercase">${sData.conductor || '—'}</span>
                                            </div>
                                            ${sData.auxiliar ? `
                                            <div class="flex items-center gap-2">
                                                <div class="w-1 h-2 ${isAuxiliar ? 'bg-indigo-400' : 'bg-slate-200'} rounded-full"></div>
                                                <span class="text-[8px] font-bold ${isAuxiliar ? 'text-indigo-500' : 'text-slate-400'} truncate uppercase">${sData.auxiliar}</span>
                                            </div>` : ''}
                                        </div>

                                        <div class="mt-2 pt-2 border-t border-black/5 dark:border-white/5">
                                            <div class="flex flex-wrap gap-1">
                                                ${sData.territorio ? sData.territorio.split(',').map(num => `
                                                    <span class="px-2 py-1 bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 rounded-lg text-[8px] font-black border border-slate-200 dark:border-white/10 uppercase">${num.trim()}</span>
                                                `).join('') : '<span class="text-[8px] font-bold text-slate-300 italic uppercase">Libre</span>'}
                                            </div>
                                        </div>
                                    </div>
                                </div>`;
        }).join('')}
                        </div>
                    </div>`;
    }).join('')}
        </div>
    </div>
`;

    container.innerHTML = html;
};

const initSwipeActions = () => {
    const cards = document.querySelectorAll('.territory-card-swipe');
    cards.forEach(card => {
        const content = card.querySelector('.swipe-content');
        const leftAction = card.querySelector('.swipe-action-left');
        const rightAction = card.querySelector('.swipe-action-right');

        let startX = 0;
        let currentX = 0;
        let isMoving = false;

        card.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            isMoving = true;
            content.style.transition = 'none';
        });

        card.addEventListener('touchmove', (e) => {
            if (!isMoving) return;
            currentX = e.touches[0].clientX - startX;

            // Limit swipe
            if (Math.abs(currentX) > 100) return;

            content.style.transform = `translateX(${currentX}px)`;

            if (currentX > 30) {
                leftAction.style.opacity = Math.min(1, (currentX - 30) / 40);
                card.style.backgroundColor = 'rgba(37, 99, 235, 0.8)'; // Blue for map
            } else if (currentX < -30) {
                rightAction.style.opacity = Math.min(1, (Math.abs(currentX) - 30) / 40);
                card.style.backgroundColor = 'rgba(13, 148, 136, 0.8)'; // Teal for report
            } else {
                leftAction.style.opacity = 0;
                rightAction.style.opacity = 0;
                card.style.backgroundColor = 'transparent';
            }
        });

        card.addEventListener('touchend', () => {
            isMoving = false;
            content.style.transition = 'transform 0.3s ease';

            if (Math.abs(currentX) > 70) {
                if (currentX > 0) {
                    // Right -> Map
                    const t = {
                        id: card.dataset.id,
                        numero: card.dataset.num,
                        manzanas: card.dataset.manzanas,
                        coordenadas: card.dataset.coords ? JSON.parse(card.dataset.coords) : null
                    };
                    window.openInteractiveMap(t);
                } else {
                    // Left -> Report
                    window.openProgressModal(card.dataset.id, card.dataset.num, card.dataset.manzanas);
                }
            }

            // Reset
            content.style.transform = 'translateX(0px)';
            const leftAction = card.querySelector('.swipe-action-left');
            const rightAction = card.querySelector('.swipe-action-right');
            if (leftAction) leftAction.style.opacity = 0;
            if (rightAction) rightAction.style.opacity = 0;
            setTimeout(() => card.style.backgroundColor = 'transparent', 300);
            currentX = 0;
        });
    });
};

// Helper: Render Weekly Program Table (ReadOnly)
const renderProgramaTableHelpers = (programa) => {
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const shiftIcons = { 'manana': 'fa-sun', 'tarde': 'fa-cloud-sun', 'noche': 'fa-moon' };
    const shiftColors = { 'manana': 'text-amber-500', 'tarde': 'text-orange-500', 'noche': 'text-indigo-400' };

    let html = `
    <div class="mt-12 mb-6 animate-fade-in px-4">
        <h3 class="text-xs font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3 mb-8">
            <span class="w-8 h-[1px] bg-slate-300 dark:bg-white/10"></span>
            Detalle del Programa Semanal
        </h3>
        <div class="table-container pb-4 custom-scrollbar">
            <div class="min-w-[800px] modern-card !p-0 shadow-2xl border-slate-100 dark:border-white/5 overflow-hidden">
                <div class="grid grid-cols-[120px_1fr_1fr_1fr] bg-slate-50 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/5">
                    <div class="p-6 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 flex items-center justify-center border-r border-slate-100 dark:border-white/5">Día</div>
                    ${shifts.map(s => `<div class="p-6 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 text-center flex items-center justify-center gap-3">
                        <i class="fas ${shiftIcons[s]} ${shiftColors[s]} text-sm"></i> ${shiftLabels[s]}
                    </div>`).join('')}
                </div>
                <div class="divide-y divide-black/5 dark:divide-white/5">
                    ${days.map(dayName => {
        const dayData = (programa?.dias || []).find(d => d.nombre === dayName) || {};
        return `
                        <div class="grid grid-cols-[100px_1fr_1fr_1fr] hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors group">
                            <div class="p-4 flex items-center justify-center border-r border-black/5 dark:border-white/5 bg-slate-50/30 dark:bg-white/[0.02]">
                                <span class="text-xs font-black text-slate-700 dark:text-slate-300 uppercase -rotate-90 md:rotate-0">${dayName.substring(0, 3)}</span>
                            </div>
                            ${shifts.map(shift => {
            const sData = dayData[shift] || {};
            if (!sData.conductor && !sData.lugar) return `<div class="p-2"></div>`;
            return `
                                <div class="p-5 border-r border-slate-100 dark:border-white/5 last:border-0 relative group/cell hover:bg-white dark:hover:bg-white/[0.01] transition-colors">
                                    ${sData.lugar ? `<div class="text-[10px] font-black text-primary/80 mb-3 truncate uppercase tracking-tight flex items-center gap-2">
                                        <i class="fas fa-map-marker-alt text-[10px]"></i> ${sData.lugar}
                                    </div>` : ''}
                                    ${sData.conductor ? `<div class="text-[11px] font-black text-slate-800 dark:text-white leading-tight uppercase tabular-nums">${sData.conductor}</div>` : ''}
                                    ${sData.auxiliar ? `<div class="text-[9px] text-slate-400 font-bold leading-tight mt-1 flex items-center gap-1">
                                        <i class="fas fa-user-friends text-[8px] opacity-50"></i> ${sData.auxiliar}
                                    </div>` : ''}
                                    ${sData.territorio ? `
                                        <div class="mt-4 flex flex-wrap gap-2">
                                            ${sData.territorio.split(',').map(t => `<span class="px-2 py-1 bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 rounded-lg text-[9px] font-black border border-slate-200 dark:border-white/5 uppercase tracking-widest">${t.trim()}</span>`).join('')}
                                        </div>
                                    ` : ''}
                                </div>
                                `;
        }).join('')}
                        </div>
                        `;
    }).join('')}
                </div>
            </div>
        </div>
    </div>>
    `;
    return html;
};


// Progress / Return Modal
// Progress / Return Modal
// Progress / Return Modal - REFACTORED for Multi-Territory Logic
window.openProgressModal = async (initialId, filterIds = null) => {
    // 1. Fetch assigned territories for context
    let myTerritories = [];
    try {
        const allT = await getTerritorios();
        if (filterIds) {
            myTerritories = allT.filter(t => filterIds.includes(t.id));
        } else {
            const initialT = allT.find(t => t.id === initialId);
            if (initialT && initialT.asignado_a) {
                myTerritories = allT.filter(t => t.asignado_a === initialT.asignado_a || t.auxiliar === initialT.asignado_a);
            } else {
                myTerritories = initialT ? [initialT] : [];
            }
        }
    } catch (e) {
        console.error(e);
        myTerritories = [{ id: initialId, numero: '?', isFallback: true }];
    }

    // Sort: Initial one first
    myTerritories.sort((a, b) => a.id === initialId ? -1 : 1);

    const localDate = new Date();
    const offset = localDate.getTimezoneOffset();
    const todayStr = new Date(localDate.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];

    // Build Modal with Admin-style UI (Image 3)
    showModal(`
    <div class="flex flex-col h-full bg-slate-50 dark:bg-[#0b0e14]">
            <header class="shrink-0 bg-slate-900 dark:bg-gradient-to-br dark:from-primary dark:to-primary-dark p-6 text-white relative overflow-hidden shadow-2xl">
                <div class="absolute -right-10 -top-10 w-40 h-40 bg-white/5 rounded-full blur-3xl"></div>
                <div class="relative z-10 flex items-center justify-between">
                    <div class="flex items-center gap-5">
                        <div class="w-12 h-12 bg-white/10 backdrop-blur-xl rounded-xl flex items-center justify-center text-xl border border-white/20 shadow-inner">
                            <i class="fas fa-chart-line animate-float"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-black tracking-tighter uppercase leading-none mb-1">Informe de Actividad</h3>
                            <p class="text-[9px] opacity-60 uppercase tracking-[0.4em] font-black">Registro de Territorios Asignados</p>
                        </div>
                    </div>
                </div>
            </header>

            <div class="flex-1 p-5 md:p-8 space-y-6 overflow-y-auto custom-scrollbar">
                <!-- Top Actions -->
                <div class="flex justify-between items-center px-2">
                    <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Registros en Posesión</h4>
                    <button id="mark-all-modal" class="text-[10px] font-black text-primary uppercase tracking-[0.2em] hover:scale-105 transition-transform">
                        <i class="fas fa-check-double mr-1"></i> Marcar Todos
                    </button>
                </div>

                <!-- Main Territory List -->
                <div id="modal-territories-list" class="space-y-6">
                    ${myTerritories.map(t => {
        const rawManzanas = t.manzanas ? t.manzanas.split(',').map(s => s.trim()).filter(s => s) : [];
        return `
                        <div class="return-item-container modern-card !p-0 overflow-hidden transition-all duration-300 shadow-sm border-slate-200 relative">
                            <input type="checkbox" value="${t.id}" class="return-check absolute opacity-0 pointer-events-none">
                            <div class="modal-item-trigger p-6 flex items-center gap-5 group cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                                <div class="w-12 h-12 bg-white dark:bg-white/5 rounded-2xl flex flex-col items-center justify-center border border-slate-100 dark:border-white/10 group-[.selected]:border-teal-500/50 group-[.selected]:bg-teal-500 group-[.selected]:text-white transition-all shadow-sm shrink-0">
                                    <span class="text-[10px] font-black tracking-tight">Terr. ${t.numero}</span>
                                </div>
                                <div class="flex-1 select-none">
                                    <p class="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] opacity-70">
                                        <i class="fas fa-layer-group mr-1.5"></i> ${rawManzanas.length || '0'} Manzanas Pendientes
                                    </p>
                                </div>
                                <i class="fas fa-chevron-right text-slate-200 group-hover:translate-x-1 group-[.selected]:rotate-90 transition-all"></i>
                            </div>


                            <!-- Detail Section (Hidden by default) -->
                            <div class="return-details hidden p-6 bg-slate-50/50 dark:bg-black/40 border-t border-slate-100 dark:border-white/10 space-y-6 animate-fade-in">
                                <!-- Completion Toggle -->
                                <div class="grid grid-cols-2 gap-3">
                                    <button class="completion-toggle flex items-center justify-center gap-2 p-2 rounded-xl border-2 border-slate-200 dark:border-white/5 active transition-all group hover:bg-white dark:hover:bg-white/5" data-tid="${t.id}" data-val="full">
                                        <div class="w-6 h-6 rounded-lg bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-400 group-[.active]:bg-emerald-500 group-[.active]:text-white transition-all shadow-inner group-[.active]:shadow-lg group-[.active]:shadow-emerald-500/30">
                                            <i class="fas fa-check-circle text-xs"></i>
                                        </div>
                                        <span class="text-[8px] font-black uppercase tracking-widest text-slate-500 group-[.active]:text-emerald-600 dark:group-[.active]:text-emerald-400 group-[.active]:opacity-100 opacity-60">Lleno</span>
                                    </button>
                                    <button class="completion-toggle flex items-center justify-center gap-2 p-2 rounded-xl border-2 border-slate-200 dark:border-white/5 grayscale opacity-40 transition-all group hover:bg-white dark:hover:bg-white/5" data-tid="${t.id}" data-val="parcial">
                                        <div class="w-6 h-6 rounded-lg bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-400 group-[.active]:bg-amber-500 group-[.active]:text-white transition-all shadow-inner group-[.active]:shadow-lg group-[.active]:shadow-amber-500/30">
                                            <i class="fas fa-adjust text-xs rotate-45"></i>
                                        </div>
                                        <span class="text-[8px] font-black uppercase tracking-widest text-slate-500 group-[.active]:text-amber-600 dark:group-[.active]:text-amber-400 group-[.active]:opacity-100 opacity-60">Parcial</span>
                                    </button>
                                </div>

                                <!-- Partial Selector (Apples) -->
                                <div class="partial-selector hidden space-y-3" data-tid="${t.id}">
                                    <div class="flex items-center gap-2">
                                        <div class="h-px flex-1 bg-black/5 dark:bg-white/5"></div>
                                        <span class="text-[8px] text-slate-400 font-black uppercase tracking-widest">¿Qué se completó hoy?</span>
                                        <div class="h-px flex-1 bg-black/5 dark:bg-white/5"></div>
                                    </div>
                                    <div class="grid grid-cols-2 gap-2">
                                        ${rawManzanas.length > 0 ? rawManzanas.map(m => `
                                            <label class="flex items-center gap-3 p-3 bg-white dark:bg-black/30 rounded-xl border border-transparent hover:border-teal-500/20 cursor-pointer transition-all shadow-sm group">
                                                <input type="checkbox" value="${m}" data-tid="${t.id}" class="mz-done-check w-4 h-4 accent-teal-500 rounded group-hover:scale-110 transition-transform">
                                                <span class="font-black text-[11px] text-slate-700 dark:text-slate-300">${formatManzanas(m)}</span>
                                            </label>
                                        `).join('') : `
                                            <div class="col-span-2">
                                                <input type="text" data-tid="${t.id}" class="manual-input-modal w-full bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-xl px-4 py-3 text-center text-xs outline-none font-bold placeholder:opacity-20" placeholder="Escribir manzanas (ej: 1, 3, 5)">
                                            </div>
                                        `}
                                    </div>
                                    <button class="btn-sel-all-mz w-full py-3 border-2 border-dashed border-black/5 dark:border-white/5 rounded-xl text-[8px] font-black uppercase text-slate-400 hover:border-teal-500/30 hover:text-teal-500 transition-all" data-tid="${t.id}">Marcar todas las manzanas</button>
                                </div>

                                <!-- Per-Territory Data -->
                                <div class="space-y-6">
                                    <div class="space-y-3">
                                        <label class="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                            <i class="fas fa-comment-alt text-primary/50 text-xs text-[12px] opacity-70"></i> Notas de la actividad
                                        </label>
                                        <div class="relative group/notes">
                                            <textarea id="notes-${t.id}" data-tid="${t.id}" class="territory-notes w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-5 pr-28 text-[11px] font-bold min-h-[110px] outline-none focus:ring-4 focus:ring-primary/10 transition-all text-slate-800 dark:text-white resize-none shadow-inner dark:placeholder:text-white/20" placeholder="Escribe detalles importantes para la próxima visita..."></textarea>
                                            
                                            <div class="absolute right-3 bottom-3 flex items-center gap-2">
                                                <button onclick="window.startVoiceDictation('notes-${t.id}', 'mic-icon-${t.id}')" class="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800/80 backdrop-blur-md flex flex-col items-center justify-center text-teal-600 hover:bg-teal-500 hover:text-white transition-all shadow-sm border border-slate-200 dark:border-white/10 group/mic">
                                                    <i id="mic-icon-${t.id}" class="fas fa-microphone text-lg"></i>
                                                    <span class="text-[6px] font-black uppercase mt-1">DICTAR</span>
                                                </button>

                                                <label class="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800/80 backdrop-blur-md flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:bg-teal-500/10 hover:text-teal-600 transition-all shadow-sm border border-slate-200 dark:border-white/10">
                                                    <i class="fas fa-camera text-lg"></i>
                                                    <span class="text-[6px] font-black uppercase mt-1">Evidencia</span>
                                                    <input type="file" accept="image/*" class="hidden photo-input" data-tid="${t.id}" multiple>
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Photos Preview Grid Integration -->
                                    <div class="photos-grid flex flex-wrap gap-3 empty:hidden" data-tid="${t.id}"></div>
                                </div>
                            </div>
                        </div>
                        `;
    }).join('')}
                </div>

                <div class="pt-6 border-t border-black/5 dark:border-white/10 space-y-4">
                    <div class="grid grid-cols-1 gap-4">
                        <div class="space-y-1">
                             <label class="text-[9px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-widest ml-1">Fecha de Entrega</label>
                             <input type="date" id="bulk-return-date" value="${todayStr}" class="w-full bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-2xl p-4 text-xs font-black outline-none focus:ring-4 focus:ring-teal-500/10 transition-all text-slate-800 dark:text-white">
                        </div>
                    </div>

                    <!-- Voice Command Hint -->
                    <button id="btn-none-today" class="w-full py-2 text-rose-500 dark:text-rose-400 font-black text-[9px] uppercase tracking-[0.3em] hover:opacity-70 transition-opacity">No se pudo predicar nada hoy</button>
                </div>
            </div>

            <div class="shrink-0 p-6 border-t border-black/5 dark:border-white/5 bg-white dark:bg-[#0b0e14] z-20">
                <button id="confirm-all-reports" class="w-full group relative overflow-hidden bg-gradient-to-r from-teal-600 to-emerald-700 py-4 rounded-2xl text-white font-black shadow-xl shadow-teal-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-[0.2em] text-xs">
                    <span class="relative z-10">Confirmar Informe</span>
                    <div class="absolute inset-0 bg-white/10 translate-x-full group-hover:translate-x-0 transition-transform duration-500"></div>
                </button>
            </div>
        </div>>
    `, (modal) => {
        const checks = modal.querySelectorAll('.return-check');
        const markAll = modal.querySelector('#mark-all-modal');

        const updateVisibility = (cb) => {
            const container = cb.closest('.return-item-container');
            const details = container.querySelector('.return-details');
            const trigger = container.querySelector('.modal-item-trigger');
            if (cb.checked) {
                details.classList.remove('hidden');
                container.classList.add('ring-4', 'ring-teal-500/10', 'border-teal-500/40');
                trigger.classList.add('selected');
            } else {
                details.classList.add('hidden');
                container.classList.remove('ring-4', 'ring-teal-500/10', 'border-teal-500/40');
                trigger.classList.remove('selected');
            }
        };

        checks.forEach(cb => {
            // cb.onchange = () => updateVisibility(cb); // Trigger handles it
            const trigger = cb.closest('.return-item-container').querySelector('.modal-item-trigger');
            trigger.onclick = () => {
                cb.checked = !cb.checked;
                updateVisibility(cb);
            };
        });

        markAll.onclick = () => {
            const someUnchecked = Array.from(checks).some(c => !c.checked);
            checks.forEach(c => {
                c.checked = someUnchecked;
                updateVisibility(c);
            });
            markAll.innerText = someUnchecked ? 'Desmarcar Todos' : 'Marcar Todos';
        };

        // Complete/Partial Toggles
        modal.querySelectorAll('.completion-toggle').forEach(btn => {
            btn.onclick = () => {
                const tid = btn.dataset.tid;
                const val = btn.dataset.val;
                const siblings = modal.querySelectorAll(`.completion-toggle[data-tid="${tid}"]`);
                siblings.forEach(s => {
                    s.classList.add('opacity-40', 'grayscale');
                    s.classList.remove('active', 'border-teal-500', 'bg-teal-500/5', 'border-amber-500', 'bg-amber-500/5');
                });
                btn.classList.remove('opacity-40', 'grayscale');
                btn.classList.add('active');
                if (val === 'full') btn.classList.add('border-teal-500', 'bg-teal-500/5');
                else btn.classList.add('border-amber-500', 'bg-amber-500/5');

                const selector = modal.querySelector(`.partial-selector[data-tid="${tid}"]`);
                if (val === 'parcial') selector.classList.remove('hidden');
                else selector.classList.add('hidden');
            };
        });

        // Select All Apples for one territory
        modal.querySelectorAll('.btn-sel-all-mz').forEach(btn => {
            btn.onclick = () => {
                const tid = btn.dataset.tid;
                const mzs = modal.querySelectorAll(`.mz-done-check[data-tid="${tid}"]`);
                const someUnchecked = Array.from(mzs).some(m => !m.checked);
                mzs.forEach(m => m.checked = someUnchecked);
                btn.innerText = someUnchecked ? 'Desmarcar todas' : 'Marcar todas las manzanas';

                // Ensure the territory is selected if user marks apples
                const check = modal.querySelector(`.return-check[value="${tid}"]`);
                if (someUnchecked && !check.checked) {
                    check.checked = true;
                    updateVisibility(check);
                }
            };
        });

        // Photo Upload Logic
        modal.querySelectorAll('.photo-input').forEach(input => {
            input.onchange = (e) => {
                const tid = input.dataset.tid;
                const grid = modal.querySelector(`.photos-grid[data-tid="${tid}"]`);
                Array.from(e.target.files).forEach(file => {
                    if (file.size > 800 * 1024) return showNotification("Foto muy grande (max 800KB)", "warning");
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        const container = document.createElement('div');
                        container.className = 'relative w-16 h-16 rounded-2xl overflow-hidden border border-black/10 group animate-scale-in shadow-sm';
                        container.innerHTML = `
                            <img src="${ev.target.result}" class="w-full h-full object-cover">
                            <button onclick="this.parentElement.remove()" class="absolute inset-0 bg-rose-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <i class="fas fa-trash-alt text-xs"></i>
                            </button>
                        `;
                        grid.insertBefore(container, grid.lastElementChild);
                    };
                    reader.readAsDataURL(file);
                });
            };
        });

        // "No se pudo predicar" - Fast fail
        modal.querySelector('#btn-none-today').onclick = async (e) => {
            const targetIds = Array.from(checks).filter(c => c.checked).map(c => c.value);
            if (targetIds.length === 0) return showNotification("Selecciona al menos un territorio", "warning");

            showCustomConfirm("¿Confirmar que no se pudo predicar hoy en los territorios seleccionados? Pasarán a estar disponibles nuevamente.", async () => {
                const notes = modal.querySelector('#bulk-notes').value || 'Intento fallido (No se pudo predicar)';
                e.target.disabled = true;
                e.target.innerText = 'PROCESANDO...';

                try {
                    for (const id of targetIds) {
                        // Using 'Disponible' status to set back to 'Sin asignar'
                        await returnTerritorio(id, notes, null, 'Disponible');
                    }
                    showNotification("Reporte registrado. Territorios liberados.");
                    const mc = document.getElementById('modal-container');
                    if (mc) {
                        mc.classList.add('hidden');
                        mc.innerHTML = '';
                    }
                    if (window.refreshConductorView) await window.refreshConductorView();
                } catch (err) {
                    console.error(err);
                    showNotification("Error al liberar territorios", "error");
                    e.target.disabled = false;
                    e.target.innerText = 'No se pudo predicar nada hoy';
                }
            });
        };

        // FINAL SUBMIT (Bulk)
        modal.querySelector('#confirm-all-reports').onclick = async (e) => {
            const targetIds = Array.from(checks).filter(c => c.checked).map(c => c.value);
            if (targetIds.length === 0) return showNotification("Selecciona al menos un territorio para informar", "warning");

            const date = modal.querySelector('#bulk-return-date').value;
            const keep = true; // Default to keep in conductor mode

            e.target.disabled = true;
            e.target.innerHTML = "PROCESANDO INFORMES...";

            try {
                for (const tid of targetIds) {
                    const toggle = modal.querySelector(`.completion-toggle[data-tid="${tid}"].active`);
                    const isPartial = toggle && toggle.dataset.val === 'parcial';
                    const t = myTerritories.find(x => x.id === tid);

                    // Collect Per-Territory Observations & Photos
                    const tNotes = modal.querySelector(`.territory-notes[data-tid="${tid}"]`)?.value || '';
                    const pGrid = modal.querySelector(`.photos-grid[data-tid="${tid}"]`);
                    const tPhotos = pGrid ? Array.from(pGrid.querySelectorAll('img')).map(img => img.src) : null;

                    // Unified notes (territory specific)
                    const finalNotes = tNotes;

                    const original = t.manzanas ? t.manzanas.split(',').map(m => m.trim()).filter(Boolean) : [];

                    if (isPartial) {
                        const checksMz = Array.from(modal.querySelectorAll(`.mz-done-check[data-tid="${tid}"]:checked`)).map(c => c.value);
                        const manual = modal.querySelector(`.manual-input-modal[data-tid="${tid}"]`);
                        const manualVal = manual ? manual.value.split(',').map(s => s.trim()).filter(Boolean) : [];
                        const completed = checksMz.concat(manualVal);
                        const remaining = original.filter(x => !completed.includes(x));

                        if (completed.length === 0) {
                            showNotification(`No seleccionaste manzanas para T-${t.numero}`, "warning");
                            e.target.disabled = false;
                            e.target.innerHTML = "Confirmar Informe";
                            return;
                        }

                        await returnTerritorioParcial(tid, completed, remaining, !keep, finalNotes || 'Avance Parcial', date, tPhotos);
                    } else {
                        // Full
                        await returnTerritorio(tid, finalNotes || "Terminado", date, "Completado", tPhotos);
                        if (finalNotes) {
                            // Already logged in returnTerritorio, but let's be double sure if history needs specific log
                            // await logReturn(tid, date, 'Completado', finalNotes, tPhotos);
                        }
                    }
                }

                showNotification("¡Excelente! Informes registrados con éxito.");
                const mc = document.getElementById('modal-container');
                if (mc) {
                    mc.classList.add('hidden');
                    mc.innerHTML = '';
                }
                if (window.refreshConductorView) await window.refreshConductorView();

            } catch (err) {
                console.error(err);
                showCustomAlert("Error al procesar: " + err.message);
                e.target.disabled = false;
                e.target.innerHTML = "Confirmar Informe de Actividad";
            }
        };
    });
};

const initializePhoneModule = (initialPhones, publicadores, userId, tbody, refreshCallback) => {
    let telefonos = initialPhones; // Mutable state for AJAX updates
    publicadores.sort((a, b) => a.nombre.localeCompare(b.nombre));
    const estados = ['Sin asignar', 'Contestaron', 'No contestan', 'Colgaron', 'Revisita', 'Predicado', 'No llamar', 'Suspendido', 'Testigo'];

    // UI Elements
    const compactView = document.getElementById('phone-compact-view');
    const expandedView = document.getElementById('phone-expanded-view');

    // State Tracking
    let activeRequests = telefonos.filter(t => t.solicitado_por === userId);
    let isExpanded = activeRequests.length > 0;

    const setPhoneOpen = (open) => {
        isExpanded = open;
        if (open) {
            compactView?.classList.add('hidden');
            expandedView?.classList.remove('hidden');
        } else {
            compactView?.classList.remove('hidden');
            expandedView?.classList.add('hidden');
        }
    };
    setPhoneOpen(isExpanded);

    window.updatePhoneAssignment = async (id, newPubName) => {
        const pub = publicadores.find(p => p.nombre === newPubName);
        const resolvedId = pub ? pub.id : newPubName;
        const resolvedName = pub ? pub.nombre : newPubName;

        const telIndex = telefonos.findIndex(t => t.id === id);
        if (telIndex !== -1) {
            telefonos[telIndex].publicador_asignado = resolvedId;
            telefonos[telIndex].asignado_a = resolvedName;
        }

        try {
            await updateTelefono(id, {
                publicador_asignado: resolvedId,
                asignado_a: resolvedName,
                fecha_asignacion: new Date().toISOString()
            });
        } catch (e) {
            console.error(e);
            showNotification("Error al guardar asignación", "error");
        }
    };

    window.updatePhoneStatus = async (id, status) => {
        const telIndex = telefonos.findIndex(t => t.id === id);
        if (telIndex !== -1) {
            telefonos[telIndex].estado = status;
            if (status === 'Sin asignar') {
                telefonos[telIndex].publicador_asignado = null;
                telefonos[telIndex].asignado_a = null;
                telefonos[telIndex].fecha_asignacion = null;
                telefonos[telIndex].solicitado_por = null;
            }
            render();
        }
        await updateTelefonoStatus(id, status, (telIndex !== -1 ? telefonos[telIndex].asignado_a : null));
    };

    window.updatePhoneComment = async (id, comment, inputElement, publicadorName) => {
        const telIndex = telefonos.findIndex(t => t.id === id);
        if (telIndex !== -1) {
            telefonos[telIndex].comentario = comment;
        }

        inputElement.classList.add('border-teal-500', 'bg-teal-900/20');

        try {
            // Use updateTelefonoStatus so it logs to history
            await updateTelefonoStatus(id, (telIndex !== -1 ? telefonos[telIndex].estado : 'Contestaron'), publicadorName, comment);

            setTimeout(() => {
                inputElement.classList.remove('bg-teal-900/20', 'border-teal-500');
            }, 1000);
        } catch (e) {
            console.error("Error saving comment:", e);
            inputElement.classList.add('border-red-500');
            showNotification("Error al guardar comentario", "error");
        }
    };

    window.showPhoneHistory = (historial, numero) => {
        const modal = document.getElementById('modal-container');
        modal.innerHTML = `
    <div class="flex flex-col h-full bg-slate-50 dark:bg-[#0b0e14]">
                <header class="shrink-0 flex justify-between items-center bg-gradient-to-r from-amber-500 to-amber-600 p-8 text-white shadow-2xl relative overflow-hidden">
                    <div class="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                    <div class="relative z-10">
                        <h3 class="font-black uppercase tracking-[0.4em] text-sm">Historial de Notas</h3>
                        <p class="text-[10px] opacity-70 font-black uppercase mt-1 tracking-widest tabular-nums">${formatPhoneNumber(numero)}</p>
                    </div>
                    <div class="relative z-10 w-14 h-14 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-white/20">
                        <i class="fas fa-history animate-pulse-slow"></i>
                    </div>
                </header>

                <div class="flex-1 p-8 space-y-6 overflow-y-auto custom-scrollbar">
                    ${historial.length === 0 ? `
                        <div class="flex flex-col items-center justify-center py-20 opacity-20 text-slate-400">
                            <i class="fas fa-comment-slash text-6xl mb-6"></i>
                            <p class="text-[10px] font-black uppercase tracking-[0.5em]">Sin registros previos</p>
                        </div>
                    ` : historial.map(h => `
                        <div class="bg-white dark:bg-white/5 p-6 rounded-[2rem] border border-slate-200 dark:border-white/5 relative group hover:border-amber-500/30 transition-all shadow-sm">
                            <div class="flex justify-between items-center mb-3">
                                <span class="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em]">${h.publicador}</span>
                                <span class="text-[9px] text-slate-400 font-black uppercase tracking-widest">${new Date(h.fecha).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p class="text-[13px] text-slate-600 dark:text-slate-300 font-bold leading-relaxed">${h.nota}</p>
                        </div>
                    `).reverse().join('')}
                </div>

                <div class="shrink-0 p-8 border-t border-slate-100 dark:border-white/5 bg-white dark:bg-[#0b0e14]">
                    <button onclick="document.getElementById('modal-container').classList.add('hidden')" class="w-full bg-slate-100 dark:bg-white/5 py-5 rounded-[2rem] text-[10px] font-black text-slate-400 hover:text-amber-500 transition-all uppercase tracking-[0.4em] border border-slate-200 dark:border-white/10 hover:border-amber-500/30">
                        Regresar
                    </button>
                </div>
            </div>
    `;
        modal.classList.remove('hidden');
    };

    window.copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            showNotification("Número copiado al portapapeles", "success", 1500);
        });
    };

    const render = () => {
        const searchInput = document.getElementById('search-phone');
        const statusFilter = document.getElementById('filter-phone-status');
        const searchVal = searchInput ? searchInput.value.toLowerCase() : '';
        const statusVal = statusFilter ? statusFilter.value : '';

        // Filter and Sort
        let filtered = activeRequests.filter(t => {
            const matchSearch = !searchVal || t.numero.includes(searchVal) || (t.propietario && t.propietario.toLowerCase().includes(searchVal));
            const matchStatus = !statusVal || t.estado === statusVal;
            return matchSearch && matchStatus;
        });

        filtered.sort((a, b) => {
            const dateA = a.fecha_asignacion ? new Date(a.fecha_asignacion) : new Date(0);
            const dateB = b.fecha_asignacion ? new Date(b.fecha_asignacion) : new Date(0);
            return dateB - dateA;
        });

        if (activeRequests.length === 0) {
            tbody.innerHTML = `<tr> <td colspan="6" class="p-20 text-center text-gray-400 dark:text-gray-500 italic font-bold">No tienes números solicitados. Usa el botón "Solicitar" en la vista compacta o arriba.</td></tr> `;
            return;
        }

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr> <td colspan="6" class="p-8 text-center text-gray-500 italic">No se encontraron números que coincidan con la búsqueda.</td></tr> `;
            return;
        }

        tbody.innerHTML = filtered.map(t => {
            const rawAssigned = t.asignado_a || t.publicador_asignado;
            let currentPubDisplay = rawAssigned || '';
            if (rawAssigned) {
                const p = publicadores.find(pub => pub.id === rawAssigned || pub.email === rawAssigned || pub.nombre === rawAssigned);
                if (p) currentPubDisplay = p.nombre;
            }

            const currentStatus = t.estado || 'Sin asignar';
            return `
    <tr class="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors border-b border-slate-100 dark:border-white/5 group">
                    <td class="p-4 md:p-6">
                        <div class="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 font-mono text-primary font-black text-sm tracking-widest">
                            <span class="whitespace-nowrap tabular-nums">${formatPhoneNumber(t.numero)}</span>
                            <button onclick="copyToClipboard('${t.numero}')" class="opacity-0 group-hover:opacity-100 transition-all p-2 hover:bg-primary/10 rounded-xl text-primary w-fit translate-x-1 group-hover:translate-x-0" title="Copiar número">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                    </td>
                    <td class="p-2 md:p-4 text-gray-700 dark:text-gray-300 text-[10px] md:text-xs font-bold truncate-text max-w-[80px] md:max-w-[150px] uppercase">
                        ${t.propietario || '-'}
                    </td>
                    <td class="p-2 md:p-4 text-gray-400 dark:text-gray-500 text-[9px] md:text-[10px] uppercase tracking-wide truncate-text max-w-[120px] md:max-w-[200px] hidden sm:table-cell">
                        ${t.direccion || '-'}
                    </td>
                    <td class="p-1 md:p-2">
                        <input type="text" list="phone-pubs-list" value="${currentPubDisplay}" 
                            onchange="window.updatePhoneAssignment('${t.id}', this.value)"
                            placeholder="Nombre..."
                            class="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg md:rounded-xl px-2 md:px-4 py-2 text-[10px] md:text-xs font-medium focus:border-teal-500 outline-none hover:bg-black/10 transition-colors text-slate-800 dark:text-teal-100 min-w-[70px]">
                    </td>
                    <td class="p-1 md:p-2 text-center">
                        <select onchange="window.updatePhoneStatus('${t.id}', this.value)" 
                            class="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg md:rounded-xl px-2 md:px-4 py-2 text-[10px] md:text-xs font-black focus:border-teal-500 outline-none cursor-pointer hover:bg-black/10 transition-colors ${getStatusColor(currentStatus)} min-w-[80px]">
                             ${estados.map(st => `<option value="${st}" ${st === currentStatus ? 'selected' : ''} class="bg-gray-900 text-gray-200 font-bold">${st}</option>`).join('')}
                        </select>
                    </td>
                    <td class="p-1 md:p-2">
                        <div class="flex items-center gap-3">
                            <input type="text" 
                                value="${t.comentario || ''}" 
                                onblur="window.updatePhoneComment('${t.id}', this.value, this, '${currentPubDisplay}')"
                                placeholder="Notas de la llamada..." 
                                class="flex-1 bg-slate-50 dark:bg-white/5 border border-transparent focus:border-primary/30 text-slate-600 dark:text-slate-300 text-xs py-3 px-4 rounded-xl focus:bg-white dark:focus:bg-white/10 outline-none transition-all placeholder:text-slate-400 font-bold shadow-inner">
                            <button onclick='window.showPhoneHistory(${JSON.stringify(t.comentarios_historial || []).replace(/'/g, "&apos;")}, "${t.numero}")' 
                                    class="w-10 h-10 flex items-center justify-center bg-amber-500/10 hover:bg-amber-500 hover:text-white rounded-xl transition-all text-amber-600 shadow-sm border border-amber-500/10 active:scale-95" 
                                    title="Historial">
                                <i class="fas fa-history"></i>
                            </button>
                        </div>
                    </td>
                </tr>
    `;
        }).join('');

        // Fix and move datalist
        const dlContainer = document.getElementById('phone-module-card');
        let dl = document.getElementById('phone-pubs-list');
        if (!dl) {
            dl = document.createElement('datalist');
            dl.id = 'phone-pubs-list';
            dlContainer.appendChild(dl);
        }
        dl.innerHTML = publicadores.map(p => `<option value="${p.nombre}">${p.nombre}</option>`).join('');

        // Progress Stats
        const totalProcessed = telefonos.filter(t => t.estado && t.estado !== 'Sin asignar').length;
        const total = telefonos.length;
        const progressContainer = document.getElementById('phone-progress-info');
        if (progressContainer) {
            progressContainer.innerHTML = `
    <div class="flex items-center gap-4 text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                    <span>Progreso: <b class="text-teal-600 dark:text-teal-400">${totalProcessed}</b> / <b>${total}</b></span>
                    <div class="w-32 h-1.5 bg-gray-200 dark:bg-white/5 rounded-full overflow-hidden shadow-inner">
                        <div class="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-700 rounded-full" style="width: ${(totalProcessed / total) * 100}%"></div>
                    </div>
                </div>>
    `;
        }

        // Finalizar Session Button visibility
        const btnFinalizar = document.getElementById('btn-finalizar-sesion');
        const btnSolicitarMore = document.getElementById('btn-solicitar-more');
        if (btnFinalizar) {
            const hasActive = activeRequests.length > 0;
            btnFinalizar.classList.toggle('hidden', !hasActive);
            if (btnSolicitarMore) btnSolicitarMore.classList.toggle('hidden', !hasActive);
        }
    };
    render();

    // Setup All Solicitar Buttons
    const solicitarBtnIds = ['btn-solicitar', 'btn-solicitar-more', 'btn-solicitar-more-top'];
    solicitarBtnIds.forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;

        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.onclick = async () => {
            const originalText = newBtn.innerHTML;
            newBtn.disabled = true;
            newBtn.innerHTML = '<span class="animate-pulse">PROCESANDO...</span>';
            try {
                // Ensure fresh start: release previous unassigned/unused ones first
                await releaseUnusedTelefonos(userId);
                const count = await solicitarNumeros(30, userId);
                if (count > 0) {
                    showNotification(`¡Se te han asignado ${count} números nuevos!`, "success");
                    if (refreshCallback) {
                        telefonos = await refreshCallback();
                        setPhoneOpen(true); // Automatic expand on success
                        render();
                    } else {
                        window.location.reload();
                    }
                } else {
                    showNotification("No hay números disponibles por ahora.", "warning");
                }
            } catch (err) {
                console.error(err);
                showNotification('Error: ' + err.message, "error");
            } finally {
                newBtn.disabled = false;
                newBtn.innerHTML = originalText;
            }
        };
    });

    /* --- REVISITAS LOGIC --- */
    const btnRevisitas = document.getElementById('btn-revisitas');
    if (btnRevisitas) {
        const newBtn = btnRevisitas.cloneNode(true);
        btnRevisitas.parentNode.replaceChild(newBtn, btnRevisitas);
        newBtn.addEventListener('click', async () => {
            const modal = document.getElementById('modal-container');
            modal.innerHTML = `
    <div class="flex flex-col h-full bg-slate-50 dark:bg-[#0b0e14]">
                    <header class="shrink-0 flex justify-between items-center bg-gradient-to-r from-amber-500 to-orange-600 p-8 text-white shadow-2xl relative overflow-hidden">
                        <div class="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                        <div class="relative z-10">
                             <h3 class="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
                                <i class="fas fa-sync-alt rotate-180"></i> Revisitas Pendientes
                             </h3>
                             <p class="text-[10px] opacity-70 font-black uppercase mt-1 tracking-[0.3em]">Gestión de llamadas por retomar</p>
                        </div>
                        <div class="relative z-10 w-14 h-14 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-white/20">
                            <i class="fas fa-phone-alt animate-float"></i>
                        </div>
                    </header>
                    
                    <div class="flex-1 p-8 overflow-y-auto bg-slate-50 dark:bg-black/20 custom-scrollbar">
                         <div class="modern-card !p-0 relative overflow-hidden bg-white dark:bg-[#0a0a0a] border-slate-200">
                             <div id="revisitas-loader" class="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-black/80 backdrop-blur-sm z-20">
                                 <div class="flex flex-col items-center gap-4">
                                     <div class="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
                                     <span class="text-[10px] font-black uppercase tracking-[0.3em] text-amber-600">Buscando registros...</span>
                                 </div>
                             </div>
                             <div class="overflow-x-auto">
                                 <table class="w-full text-left text-sm">
                                    <thead class="bg-slate-50 dark:bg-white/5 text-slate-400 font-black uppercase text-[10px] tracking-[0.2em] border-b border-slate-100 dark:border-white/10">
                                        <tr>
                                            <th class="p-6">Teléfono</th>
                                            <th class="p-6">Propietario</th>
                                            <th class="p-6 hidden sm:table-cell">Dirección</th>
                                            <th class="p-6 text-right">Gestión</th>
                                        </tr>
                                    </thead>
                                    <tbody id="revisitas-tbody" class="divide-y divide-slate-100 dark:divide-white/5"></tbody>
                                 </table>
                             </div>
                             <div id="no-revisitas-msg" class="hidden flex flex-col items-center justify-center py-24 opacity-20 text-slate-400">
                                 <i class="fas fa-calendar-check text-6xl mb-6"></i>
                                 <p class="text-[10px] font-black uppercase tracking-[0.4em]">Sin revisitas registradas</p>
                             </div>
                         </div>
                    </div>

                    <div class="shrink-0 p-6 border-t border-slate-100 dark:border-white/5 bg-white dark:bg-[#0b0e14]">
                        <button onclick="document.getElementById('modal-container').classList.add('hidden')" class="w-full bg-slate-100 dark:bg-white/5 py-2.5 rounded-xl text-[9px] font-black text-slate-400 hover:text-amber-500 transition-all uppercase tracking-[0.2em] border border-slate-200 dark:border-white/10">
                            Cerrar
                        </button>
                    </div>
                </div>
    `;
            modal.classList.remove('hidden');

            try {
                const allPhones = await getTelefonos();
                const revisitas = allPhones.filter(t => t.estado === 'Revisita');
                const tbody = document.getElementById('revisitas-tbody');
                const loader = document.getElementById('revisitas-loader');
                const noMsg = document.getElementById('no-revisitas-msg');

                loader.classList.add('hidden');

                if (revisitas.length === 0) {
                    noMsg.classList.remove('hidden');
                } else {
                    tbody.innerHTML = revisitas.map(r => `
    <tr id = "rev-row-${r.id}" class="hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors">
                            <td class="p-3 font-mono text-teal-600 dark:text-teal-400">${formatPhoneNumber(r.numero)}</td>
                            <td class="p-3 font-bold text-gray-800 dark:text-gray-200">${r.propietario || '-'}</td>
                            <td class="p-3 text-xs text-gray-500 dark:text-gray-400">${r.direccion || '-'}</td>
                            <td class="p-3 text-sm text-blue-600 dark:text-blue-400 font-medium">
                                ${r.publicador_asignado || r.asignado_a || '<span class="text-gray-400 italic">Sin asignar</span>'}
                            </td>
                            <td class="p-3 text-right">
                                <button onclick="window.returnRevisita('${r.id}')" 
                                        class="bg-amber-100 hover:bg-amber-200 text-amber-700 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-200 px-3 py-1 rounded-lg text-xs font-bold transition-colors shadow-sm">
                                    Devolver
                                </button>
                            </td>
                        </tr>
    `).join('');
                }

            } catch (e) {
                console.error(e);
                showNotification("Error cargando revisitas", "error");
                document.getElementById('revisitas-loader').classList.add('hidden');
            }
        });
    }

    window.startVoiceDictation = (targetId, iconId = 'mic-icon') => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            return showNotification("Tu navegador no soporta transcripción por voz.", "warning");
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'es-ES';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        const micIcon = document.getElementById(iconId);
        const originalClass = micIcon ? micIcon.className : '';

        if (micIcon) {
            micIcon.className = 'fas fa-circle text-rose-500 animate-pulse';
        }

        recognition.start();

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            const target = document.getElementById(targetId);
            if (target) {
                target.value = target.value ? target.value + ' ' + transcript : transcript;
                target.focus();
            }
        };

        recognition.onerror = () => {
            showNotification("Error en el dictado.", "error");
            if (micIcon) micIcon.className = originalClass;
        };

        recognition.onend = () => {
            if (micIcon) micIcon.className = originalClass;
        };
    };

    window.returnRevisita = async (id) => {
        const row = document.getElementById(`rev-row-${id}`);
        // Demand comment for return
        const reason = await showCustomPrompt("MOTIVO DE DEVOLUCIÓN", "¿Por qué devuelves este número? (Quedará disponible para otros)", "Ej: Me mudé, Propietario ocupado...");
        if (!reason) return;

        try {
            await updateTelefono(id, {
                estado: 'Sin asignar',
                publicador_asignado: null,
                asignado_a: null,
                fecha_asignacion: null,
                solicitado_por: null,
                comentario_devolucion: reason,
                fecha_devolucion: new Date().toISOString()
            });

            showNotification("Número devuelto exitosamente.", "success");
            if (row) row.remove();

            const tbodyRev = document.getElementById('revisitas-tbody');
            if (tbodyRev && tbodyRev.children.length === 0) {
                document.getElementById('no-revisitas-msg').classList.remove('hidden');
            }

            if (refreshCallback) {
                telefonos = await refreshCallback();
                render();
            }
        } catch (e) {
            console.error(e);
            showNotification("Error al devolver número", "error");
        }
    };

    // End Session Logic
    const bindFinalizar = (id) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.onclick = async () => {
            const activeRequests = telefonos.filter(t => t.solicitado_por === userId);
            if (activeRequests.length === 0) return;

            const summary = {
                total: activeRequests.length,
                stats: {
                    'Contestaron': 0,
                    'No contestan': 0,
                    'Colgaron': 0,
                    'Revisita': 0,
                    'No llamar': 0,
                    'Sin asignar': 0
                }
            };

            activeRequests.forEach(t => {
                const st = t.estado || 'Sin asignar';
                if (summary.stats.hasOwnProperty(st)) summary.stats[st]++;
                else summary.stats['Sin asignar']++;
            });

            const statsText = Object.entries(summary.stats)
                .filter(([_, count]) => count > 0)
                .map(([name, count]) => `• ${name}: ${count} `)
                .join('\n');

            const modal = document.getElementById('modal-container');
            showModal(`
                <div class="p-12 text-center space-y-12 animate-fade-in bg-slate-50 dark:bg-[#0b0e14]">
                    <div class="relative inline-block">
                        <div class="w-32 h-32 bg-primary/10 dark:bg-primary/20 rounded-[3rem] flex items-center justify-center text-6xl text-primary shadow-inner border border-primary/20 animate-float">
                            <i class="fas fa-flag-checkered"></i>
                        </div>
                        <div class="absolute -top-3 -right-3 w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center text-xl font-black shadow-xl animate-bounce border-4 border-white dark:border-slate-900">
                             <i class="fas fa-check"></i>
                        </div>
                    </div>
                    
                    <div class="space-y-4">
                        <h3 class="text-4xl font-black text-slate-800 dark:text-white tracking-tighter uppercase">Sesión Finalizada</h3>
                        <p class="text-[12px] text-primary font-black uppercase tracking-[0.4em] opacity-80">Resumen de Actividad Telefónica</p>
                    </div>
                    
                    <div class="modern-card bg-white dark:bg-white/[0.03] p-10 border-slate-200 dark:border-white/5 space-y-10 shadow-2xl">
                        <div class="flex justify-between items-center bg-primary/10 dark:bg-primary/20 p-8 rounded-3xl border border-primary/10">
                             <span class="text-[11px] font-black text-primary uppercase tracking-[0.3em]">Total Registros</span>
                             <span class="text-5xl font-black text-primary tracking-tighter tabular-nums">${summary.total}</span>
                        </div>
                        <div class="space-y-5 text-left">
                             ${Object.entries(summary.stats)
                    .filter(([_, count]) => count > 0)
                    .map(([name, count]) => `
                                     <div class="flex justify-between items-center px-6 py-4 hover:bg-slate-50 dark:hover:bg-white/[0.05] rounded-2xl transition-all group/stat">
                                         <span class="text-[13px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest group-hover/stat:text-primary transition-colors">${name}</span>
                                         <span class="text-base font-black text-slate-800 dark:text-white tabular-nums">${count}</span>
                                     </div>
                                 `).join('')}
                        </div>
                    </div>

                    <button id="btn-share-results" class="w-full bg-primary hover:bg-primary-dark py-6 rounded-3xl text-white font-black shadow-2xl shadow-primary/30 hover:shadow-primary/50 hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-[0.4em] text-xs flex items-center justify-center gap-5 group">
                         <i class="fas fa-share-nodes text-xl group-hover:rotate-12 transition-transform"></i> Compartir Reporte
                    </button>
                    <button onclick="document.getElementById('modal-container').classList.add('hidden')" class="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-primary transition-colors">Volver</button>
                </div>
            `, (modal) => {
                // Modal callback
            });

            // Log summary and release numbers immediately on click "Finalizar"
            try {
                await logSessionSummary({
                    conductor_id: userId,
                    stats: summary.stats,
                    total: summary.total
                });
                await releaseUnusedTelefonos(userId);
            } catch (e) {
                console.error("Error finalizing session:", e);
            }

            // Automatic collapse after finishing
            setPhoneOpen(false);

            const shareBtn = document.getElementById('btn-share-results');
            if (shareBtn) {
                shareBtn.onclick = async () => {
                    const message = `📋 *Resumen de Predicación Telefónica*\n` +
                        `👤 *Conductor:* ${userId} \n` +
                        `📊 *Total procesado:* ${summary.total} \n\n` +
                        `${statsText} \n\n` +
                        `_Enviado desde App Territorios_`;

                    if (navigator.share) {
                        try {
                            await navigator.share({
                                title: 'Resumen de Predicación',
                                text: message
                            });
                        } catch (err) {
                            console.log("Share failed or cancelled", err);
                        }
                    } else {
                        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
                    }
                    // Close modal after sharing
                    document.getElementById('modal-container').classList.add('hidden');
                };
            }
        };
    };

    bindFinalizar('btn-finalizar-sesion');
    bindFinalizar('btn-finalizar');

    // Search and Filter Listeners
    const searchPhone = document.getElementById('search-phone');
    const filterStatus = document.getElementById('filter-phone-status');
    if (searchPhone) searchPhone.addEventListener('input', render);
    if (filterStatus) filterStatus.addEventListener('change', render);



    const btnAddPub = document.getElementById('btn-add-publicador');
    if (btnAddPub) {
        const newBtn = btnAddPub.cloneNode(true);
        btnAddPub.parentNode.replaceChild(newBtn, btnAddPub);
        newBtn.addEventListener('click', async () => {
            const modal = document.getElementById('modal-container');
            modal.innerHTML = `
                <div class="modern-card p-10 max-w-sm w-full shadow-2xl relative animate-bounce-in border-primary/20 bg-white dark:bg-[#0b0e14]">
                    <div class="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-2xl text-primary mx-auto mb-6 shadow-inner border border-primary/10">
                        <i class="fas fa-user-plus"></i>
                    </div>
                    <h3 class="text-2xl font-black text-slate-800 dark:text-white mb-2 uppercase tracking-tighter text-center">Nuevo Publicador</h3>
                    <p class="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-8 text-center">Registrar nuevo integrante</p>
                    
                    <div class="space-y-6">
                        <div class="space-y-2">
                             <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Nombre Completo</label>
                             <input type="text" id="new-pub-name-input" placeholder="Ej: Juan Pérez" class="w-full bg-slate-50 dark:bg-white/5 border border-transparent focus:border-primary/30 rounded-2xl px-6 py-4 text-slate-800 dark:text-white focus:bg-white dark:focus:bg-white/10 outline-none transition-all placeholder:text-slate-400 font-bold shadow-inner">
                        </div>
                    </div>

                    <div class="flex gap-4 mt-10">
                        <button onclick="document.getElementById('modal-container').classList.add('hidden')" class="flex-1 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 dark:bg-white/5 rounded-2xl hover:bg-slate-200 transition-colors">Cancelar</button>
                        <button id="confirm-add-pub" class="flex-1 py-5 text-[10px] font-black uppercase tracking-widest text-white bg-primary rounded-2xl shadow-xl shadow-primary/30 hover:bg-primary-dark transition-all hover:scale-105 active:scale-95">Agregar</button>
                    </div>
                </div>
`;
            modal.classList.remove('hidden');

            const inputName = document.getElementById('new-pub-name-input');
            inputName.focus();

            const submit = async () => {
                const name = inputName.value.trim();
                if (name.length > 0) {
                    try {
                        modal.classList.add('hidden');
                        await addPublicador({ nombre: name });
                        showNotification("Publicador agregado correctamente.", "success");
                        // Update local state and re-render dropdowns
                        publicadores.push({ nombre: name });
                        publicadores.sort((a, b) => a.nombre.localeCompare(b.nombre));
                        render();
                    } catch (e) {
                        console.error(e);
                        showNotification("Error al agregar publicador: " + e.message, "error");
                    }
                }
            };

            document.getElementById('confirm-add-pub').addEventListener('click', submit);
            inputName.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') submit();
            });
        });
    }



};

/* --- AI / INTELLIGENCE --- */
/* --- AI / INTELLIGENCE --- */
async function renderAISection(name) {
    const config = await getConfiguracion();
    if (!config.gemini_key) return;

    const [telefonos, publicadores, territorios, programa] = await Promise.all([
        getTelefonos(), getPublicadores(), getTerritorios(), getProgramaSemanal()
    ]);

    const brain = new TerritoryIntelligence(telefonos, publicadores, territorios, programa);

    // Inject Dynamic styles
    if (!document.getElementById('ai-pulse-styles')) {
        const style = document.createElement('style');
        style.id = 'ai-pulse-styles';
        style.innerHTML = `
            @keyframes ai-pulse {
                0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.7); }
                70% { transform: scale(1.05); box-shadow: 0 0 0 15px rgba(139, 92, 246, 0); }
                100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(139, 92, 246, 0); }
            }
            @keyframes ai-glow {
                from { filter: drop-shadow(0 0 5px #8b5cf6); }
                to { filter: drop-shadow(0 0 20px #c084fc); }
            }
            .ai-thinking { animation: ai-pulse 2s infinite !important; background: linear-gradient(135deg, #8b5cf6, #3b82f6) !important; }
            .ai-badge { position: absolute; top: -5px; right: -5px; width: 18px; height: 18px; background: #ef4444; border-radius: 50%; border: 2px solid white; font-size: 10px; font-weight: 900; color: white; display: flex; align-items: center; justify-content: center; animation: bounce 1s infinite; }
        `;
        document.head.appendChild(style);
    }

    const aiUI = document.createElement('div');
    aiUI.id = 'ai-assistant-overlay';
    aiUI.innerHTML = `
        <!-- Proactive Speech Bubble -->
        <div id="ai-speech-bubble" class="fixed bottom-28 right-6 z-40 max-w-[220px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl text-slate-800 dark:text-white p-5 rounded-[2rem] rounded-br-none shadow-2xl border border-primary/20 opacity-0 pointer-events-none translate-y-4 transition-all duration-500">
            <p class="text-[10px] font-black uppercase tracking-widest leading-none mb-1 opacity-50">Sugerencia IA</p>
            <p class="text-[13px] font-black leading-tight" id="ai-bubble-text">¿Te digo por donde empezar?</p>
            <div class="absolute bottom-[-10px] right-0 w-0 h-0 border-l-[12px] border-l-transparent border-t-[12px] border-t-white/95 dark:border-t-slate-900/95 transition-all"></div>
        </div>

        <button id="ai-fab" class="fixed bottom-8 right-8 z-40 bg-slate-900 dark:bg-primary text-white rounded-full p-5 shadow-2xl border border-white/20 transition-all hover:scale-110 active:scale-95 group overflow-hidden">
            <div class="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent transition-opacity group-hover:opacity-0"></div>
            <i class="fas fa-brain text-4xl relative z-10 group-hover:rotate-12 transition-transform" style="animation: ai-glow 2s ease-in-out infinite alternate"></i>
            <div id="ai-suggestion-badge" class="hidden ai-badge">1</div>
            <span class="absolute right-full top-1/2 -translate-y-1/2 mr-4 px-4 py-2 bg-slate-950/90 backdrop-blur-md text-white text-[10px] font-black uppercase rounded-xl opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap pointer-events-none tracking-[0.3em] border border-white/10 shadow-2xl">
                Asistente Inteligente
            </span>
        </button>

        <div id="ai-panel" class="fixed bottom-28 right-8 w-80 md:w-96 modern-card border-primary/20 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)] z-40 transform translate-y-12 opacity-0 pointer-events-none transition-all duration-500 ease-out flex flex-col max-h-[75vh] overflow-hidden !p-0 !bg-white/80 dark:!bg-slate-900/80 backdrop-blur-3xl ring-1 ring-white/20">
            <div class="flex justify-between items-center p-8 bg-gradient-to-r from-primary/20 to-blue-500/20 border-b border-primary/10 backdrop-blur-xl">
                <div class="flex items-center gap-4">
                    <div class="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center text-2xl text-primary shadow-inner">
                        <i class="fas fa-brain"></i>
                    </div>
                    <div>
                        <h3 class="font-black text-slate-800 dark:text-white text-base uppercase tracking-tighter">Cerebro Territorial</h3>
                        <p class="text-[9px] text-primary font-black uppercase tracking-[0.3em] animate-pulse">Red Neuronal Activa</p>
                    </div>
                </div>
                <button id="ai-close" class="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-primary transition-all text-xl">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div id="conductor-chat-log" class="flex-1 overflow-y-auto p-8 space-y-6 text-xs custom-scrollbar min-h-[350px] bg-slate-50/50 dark:bg-black/20">
                <div class="bg-white dark:bg-slate-800 p-6 rounded-[2rem] rounded-tl-none border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 leading-relaxed shadow-sm font-bold text-[13px]">
                    <p class="text-[9px] font-black text-primary uppercase tracking-[0.2em] mb-2 opacity-50">
                        Hoy es ${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    Hola <b>${name.split(' ')[0]}</b>. He analizado el estado del territorio de la congregación. ✨<br><br>
                    ¿Necesitas que te recomiende un territorio estratégico o tienes alguna consulta sobre cómo usar la App?
                </div>
                <div id="ai-proactive-card" class="hidden"></div>
            </div>

            <div class="p-6 bg-white dark:bg-black/40 flex gap-3 border-t border-slate-100 dark:border-white/10">
                <input type="text" id="conductor-chat-input" 
                    placeholder="Escribe tu consulta aquí..." 
                    class="flex-1 bg-slate-100 dark:bg-white/5 border border-transparent focus:border-primary/40 rounded-2xl px-6 py-4 text-sm text-slate-800 dark:text-white focus:bg-white dark:focus:bg-white/10 outline-none placeholder-slate-400 transition-all font-bold shadow-inner">
                <button id="conductor-chat-send" class="bg-primary hover:bg-primary-dark text-white w-14 h-14 rounded-2xl transition-all flex items-center justify-center shadow-xl shadow-primary/30 active:scale-90 group">
                    <i class="fas fa-paper-plane text-xl group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform"></i>
                </button>
            </div>
        </div>
    `;

    const existing = document.getElementById('ai-assistant-overlay');
    if (existing) existing.remove();
    document.body.appendChild(aiUI);

    const fab = document.getElementById('ai-fab');
    const panel = document.getElementById('ai-panel');
    const closeBtn = document.getElementById('ai-close');
    const input = document.getElementById('conductor-chat-input');
    const sendBtn = document.getElementById('conductor-chat-send');
    const log = document.getElementById('conductor-chat-log');
    const badge = document.getElementById('ai-suggestion-badge');

    // PROACTIVE ANALYSIS
    const checkInsights = async () => {
        const insight = await brain.getProactiveInsight(name, config.gemini_key);
        if (insight) {
            badge.classList.remove('hidden');
            fab.classList.add('ai-thinking');

            const proactiveDiv = document.getElementById('ai-proactive-card');
            proactiveDiv.classList.remove('hidden');
            proactiveDiv.innerHTML = `
                <div class="bg-gradient-to-br from-purple-600/30 to-blue-600/30 p-5 rounded-3xl border border-white/20 shadow-xl animate-fade-in">
                    <h4 class="font-black text-purple-300 uppercase tracking-widest text-[10px] mb-2">${insight.title}</h4>
                    <p class="text-white text-xs leading-relaxed mb-4">${insight.message}</p>
                    <button onclick="window.askForTerritoryIA('${insight.territoryId}', '${insight.action}')" class="w-full bg-white text-purple-900 font-black py-2.5 rounded-xl text-[10px] uppercase shadow-lg hover:scale-105 active:scale-95 transition-all">
                        ${insight.action}
                    </button>
                </div>
            `;
        }
    };

    // Exposed for the proactive button
    window.askForTerritoryIA = (tid, label) => {
        input.value = label;
        handleSend();
    };

    // Proactive Speech Bubble Cycle
    const bubble = document.getElementById('ai-speech-bubble');
    const bubbleText = document.getElementById('ai-bubble-text');
    const messages = [
        "¡Hey! Yo puedo ayudarte 🧠",
        "¿Tienes dudas sobre cómo usar la App?",
        "¿Te digo por dónde empezar? ✨",
        "Puedo sugerirte un territorio estratégico",
        "Haz clic aquí si necesitas asistencia"
    ];

    let msgIndex = 0;
    const rotateBubble = () => {
        if (isOpen) return;
        bubble.classList.add('opacity-0', 'translate-y-4');
        setTimeout(() => {
            bubbleText.innerText = messages[msgIndex];
            msgIndex = (msgIndex + 1) % messages.length;
            bubble.classList.remove('opacity-0', 'translate-y-4');
        }, 1000);
    };

    setTimeout(() => {
        bubble.classList.remove('opacity-0', 'translate-y-4');
        setInterval(rotateBubble, 8000);
    }, 5000);

    bubble.onclick = () => togglePanel();

    setTimeout(checkInsights, 2000);

    let isOpen = false;
    const togglePanel = () => {
        isOpen = !isOpen;
        if (isOpen) {
            panel.classList.remove('translate-y-10', 'opacity-0', 'pointer-events-none');
            badge.classList.add('hidden');
            input.focus();
        } else {
            panel.classList.add('translate-y-10', 'opacity-0', 'pointer-events-none');
        }
    };

    fab.addEventListener('click', togglePanel);
    closeBtn.addEventListener('click', togglePanel);

    const handleSend = async () => {
        const prompt = input.value.trim();
        if (!prompt) return;

        log.innerHTML += `<div class="flex justify-end"><div class="bg-purple-600 text-white px-4 py-3 rounded-3xl rounded-tr-none text-xs max-w-[85%] font-medium shadow-lg">${prompt}</div></div>`;
        log.scrollTop = log.scrollHeight;
        input.value = '';
        input.disabled = true;

        try {
            const loadingId = 'loading-' + Date.now();
            log.innerHTML += `<div id="${loadingId}" class="flex items-center gap-2 text-purple-400 text-[10px] font-black uppercase tracking-widest"><span class="animate-ping">🧠</span> Procesando...</div>`;
            log.scrollTop = log.scrollHeight;

            const appInstructions = `
            Instrucciones de la App para el Conductor:
            1. Agenda Semanal: Muestra tus turnos y territorios asignados. Haz clic en las tarjetas para ver más.
            2. Predicación Telefónica: Debes 'Solicitar Números' para empezar. Luego asigna un 'Publicador' de la lista a cada número y marca el 'Estado' de la llamada (Contestaron, No contestan, etc.).
            3. Zoom: Hay un botón para conectar a la reunión de grupo.
            4. Mapas: En cada territorio asignado hay un botón de 'Mapa Interactivo'.
            5. Finalizar: Al terminar la sesión teletónica, usa 'Finalizar Sesión' para liberar números no usados.
            `;

            const response = await brain.askGemini(config.gemini_key, `Soy el conductor ${name}. ${appInstructions} Consulta: ${prompt}`);
            const safeResponse = response.replace(/\|\|.*?\|\|/g, '');
            const htmlResponse = safeResponse.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');

            document.getElementById(loadingId)?.remove();

            log.innerHTML += `<div class="flex justify-start"><div class="bg-white dark:bg-slate-800 text-slate-700 dark:text-gray-200 px-5 py-4 rounded-3xl rounded-tl-none text-[13px] border border-slate-100 dark:border-white/10 max-w-[90%] leading-relaxed shadow-md font-medium">
                ${htmlResponse}
             </div></div>`;

        } catch (err) {
            console.error(err);
            log.innerHTML += `<div class="bg-red-500/10 text-red-400 text-[10px] p-4 rounded-2xl border border-red-500/20">Error: ${err.message}</div>`;
        } finally {
            input.disabled = false;
            input.focus();
            log.scrollTop = log.scrollHeight;
        }
    };

    sendBtn.addEventListener('click', handleSend);
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSend(); });
}


/** --- RESCUE MODE (Ayudas) --- **/

function renderRescueSection(container, currentConductorName, allTerritorios, config, programa, conductorData) {
    if (!container) return;
    container.classList.remove('hidden');

    const now = new Date();
    now.setHours(0, 0, 0, 0); // Normalize today

    // 1. Map planned dates from program
    const plannedDates = {}; // territoryNum -> Set of Dates
    if (programa && programa.dias && programa.id) {
        const monday = new Date(programa.id + "T00:00:00");
        const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        const shifts = ['manana', 'tarde', 'noche'];

        programa.dias.forEach(d => {
            const dayIdx = dayNames.indexOf(d.nombre);
            if (dayIdx === -1) return;

            const plannedDate = new Date(monday);
            plannedDate.setDate(monday.getDate() + dayIdx);
            plannedDate.setHours(0, 0, 0, 0);

            shifts.forEach(s => {
                if (d[s] && d[s].territorio) {
                    const nums = d[s].territorio.split(/[,/]+/).map(n => n.trim()).filter(Boolean);
                    nums.forEach(num => {
                        if (!plannedDates[num]) plannedDates[num] = new Set();
                        plannedDates[num].add(plannedDate.getTime());
                    });
                }
            });
        });
    }

    const rescueCandidates = allTerritorios.filter(t => {
        if (t.estado !== 'Asignado' && t.estado !== 'Pendiente') return false;
        if (t.asignado_a === currentConductorName) return false;

        const timestamps = plannedDates[t.numero];
        if (!timestamps) return false;

        let isRescueNeeded = false;
        for (const ts of timestamps) {
            const planned = new Date(ts);
            const diffDays = Math.floor((now - planned) / (1000 * 60 * 60 * 24));
            if (diffDays >= 2) {
                isRescueNeeded = true;
                break;
            }
        }

        return isRescueNeeded;
    });

    if (rescueCandidates.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-24 modern-card text-center border-dashed border-slate-200 dark:border-white/10 opacity-60 bg-slate-50/50 dark:bg-white/5 mt-12">
                <div class="flex flex-col items-center gap-6">
                    <div class="w-16 h-16 bg-white dark:bg-slate-800 rounded-[2rem] flex items-center justify-center text-3xl text-emerald-500 shadow-sm border border-slate-100 dark:border-white/5">
                        <i class="fas fa-check-double"></i>
                    </div>
                    <div class="space-y-2">
                        <p class="text-[11px] font-black uppercase tracking-[0.5em] text-slate-500 dark:text-slate-400">Territorios al día</p>
                        <p class="text-[10px] text-slate-400 italic font-bold">Sin misiones de rescate para esta semana</p>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    const existingDetails = container.querySelector('details.group\\/rescue');
    const wasOpen = existingDetails ? existingDetails.open : (rescueCandidates.length > 0);

    container.innerHTML = `
        <div class="modern-card !p-0 mt-24 animate-fade-in shadow-2xl transition-all overflow-hidden border-slate-200 dark:border-white/10 bg-white dark:bg-[#0f1115]">
            <details class="group/rescue" ${wasOpen ? 'open' : ''}>
                <summary class="flex flex-col md:flex-row justify-between items-start md:items-center p-12 cursor-pointer list-none select-none hover:bg-rose-500/5 transition-colors border-b border-rose-500/10 outline-none">
                    <div class="flex items-start gap-10">
                        <div class="w-16 h-16 rounded-[1.75rem] bg-rose-600 flex items-center justify-center text-3xl text-white shadow-2xl shadow-rose-600/40 border-2 border-white/20 group-open/rescue:rotate-6 transition-transform">
                            <i class="fas fa-ambulance"></i>
                        </div>
                        <div class="space-y-2">
                            <div class="flex items-center gap-4">
                                <h3 class="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Misiones de Rescate</h3>
                                <div class="px-4 py-1.5 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-600/20">
                                    ${rescueCandidates.length} Pendiente${rescueCandidates.length > 1 ? 's' : ''}
                                </div>
                            </div>
                            <p class="text-[11px] text-rose-600 dark:text-rose-400 font-black uppercase tracking-[0.25em] opacity-90 flex items-center gap-2">
                                <span class="w-2 h-2 rounded-full bg-rose-600 animate-pulse"></span>
                                Atraso Crítico: Más de 48 horas sin reporte de actividad
                            </p>
                        </div>
                    </div>
                    <div class="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-white/5 flex items-center justify-center group-open/rescue:rotate-180 transition-transform text-rose-500 mt-6 md:mt-0">
                        <i class="fas fa-chevron-down text-lg"></i>
                    </div>
                </summary>

                <div class="p-12 animate-fade-in">
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                        ${rescueCandidates.map(t => `
                            <div class="bg-white dark:bg-white/5 border-2 border-slate-100 dark:border-white/10 rounded-[3rem] p-10 flex flex-col gap-10 group/item hover:border-rose-500/40 transition-all shadow-xl hover:shadow-rose-500/15 relative overflow-hidden">
                                <div class="absolute top-0 right-0 w-48 h-48 bg-rose-500/5 blur-3xl -mr-20 -mt-20 group-hover:bg-rose-500/20 transition-colors"></div>
                                
                                <div class="flex justify-between items-start relative z-10">
                                    <div class="space-y-2">
                                        <div class="flex items-baseline gap-1">
                                            <span class="text-rose-600 font-black text-xl italic leading-none">T-</span>
                                            <h4 class="font-black text-5xl text-slate-900 dark:text-white leading-none uppercase tracking-tighter tabular-nums">${t.numero}</h4>
                                        </div>
                                        <div class="flex items-center gap-3 mt-1">
                                            <div class="w-2 h-2 rounded-full bg-rose-500"></div>
                                            <p class="text-[12px] text-slate-600 dark:text-slate-300 font-black uppercase tracking-[0.1em]">${t.asignado_a}</p>
                                        </div>
                                    </div>
                                    <div class="flex flex-col items-end gap-2">
                                         <span class="bg-rose-600/10 text-rose-600 px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-rose-500/20">RESCATE</span>
                                         <p class="text-[9px] font-black text-rose-500/60 uppercase tracking-widest">Atrasado</p>
                                    </div>
                                </div>

                                <div class="p-8 rounded-[2rem] bg-rose-50/30 dark:bg-black/40 border border-rose-100/50 dark:border-white/5 min-h-[7rem] flex items-center relative z-10 shadow-inner group-hover:bg-rose-50/50 dark:group-hover:bg-black/60 transition-colors">
                                    <p class="text-[14px] text-slate-800 dark:text-slate-200 leading-relaxed font-black uppercase tracking-tight line-clamp-3 italic">
                                        "${t.manzanas || 'Territorio necesita atención inmediata para completar la predicación.'}"
                                    </p>
                                </div>

                                 ${conductorData?.privilegios?.includes('Superintendente de Circuito') ? '' : `
                                <button onclick="window.handleRescueTerritory('${t.id}', '${t.numero}', '${currentConductorName}', '${t.manzanas || ''}')" 
                                        class="relative z-10 w-full bg-rose-600 hover:bg-rose-700 text-white text-[13px] font-black py-6 rounded-2xl shadow-2xl shadow-rose-600/40 transition-all uppercase tracking-[0.35em] active:scale-95 flex items-center justify-center gap-4 border border-white/10 group-hover:scale-[1.03]">
                                    <i class="fas fa-hand-holding-heart text-xl"></i> Asumir Ayuda
                                </button>
                                `}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </details>
        </div>
    `;
}

window.handleRescueTerritory = async (id, num, newConductor, manzanas) => {
    const ok = await new Promise(resolve => {
        const modal = document.getElementById('modal-container');
        modal.innerHTML = `
            <div class="modern-card p-10 max-w-sm w-full text-center animate-bounce-in border-rose-500/20 shadow-2xl">
                <div class="w-20 h-20 bg-rose-500/10 rounded-[2.5rem] flex items-center justify-center text-4xl text-rose-600 mx-auto mb-6 shadow-inner border border-rose-500/10 animate-float">
                    <i class="fas fa-ambulance"></i>
                </div>
                <h3 class="text-2xl font-black text-slate-800 dark:text-white mb-4 uppercase tracking-tighter">¿Iniciar Rescate?</h3>
                <p class="text-[13px] text-slate-500 dark:text-slate-400 mb-10 leading-relaxed font-bold">
                    Vas a tomar el territorio <b class="text-rose-600">T-${num}</b> para ayudar a completarlo. Se notificará formalmente al responsable.
                </p>
                <div class="flex gap-4">
                    <button id="rescue-cancel" class="flex-1 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 dark:bg-white/5 rounded-2xl hover:bg-slate-200 transition-colors">Cancelar</button>
                    <button id="rescue-confirm" class="flex-1 py-5 text-[10px] font-black uppercase tracking-widest text-white bg-rose-600 rounded-2xl shadow-xl shadow-rose-500/30 hover:bg-rose-500 transition-all hover:scale-105 active:scale-95">SÍ, AYUDAR</button>
                </div>
            </div>
        `;
        modal.classList.remove('hidden');
        document.getElementById('rescue-cancel').onclick = () => { modal.classList.add('hidden'); resolve(false); };
        document.getElementById('rescue-confirm').onclick = () => { modal.classList.add('hidden'); resolve(true); };
    });

    if (!ok) return;

    try {
        showNotification("Procesando transferencia...", "info");
        await transferTerritory(id, newConductor, manzanas);
        showNotification(`¡Misión aceptada! El territorio #${num} ahora está en tu agenda.`, "success");
        // Force reload using the exposed refresh function
        if (window.refreshConductorView) {
            await window.refreshConductorView();
        } else {
            window.location.reload();
        }
    } catch (err) {
        console.error(err);
        showNotification("Error en el rescate: " + err.message, "error");
    }
};





function renderRecursosSection(container) {
    if (!container) return;

    getRecursos().then(recursos => {
        container.classList.remove('hidden');
        if (recursos.length === 0) {
            container.innerHTML = `
                <div class="modern-card p-12 text-center space-y-4 bg-white dark:bg-slate-900/40 border-slate-200 dark:border-white/10 shadow-2xl animate-fade-in group">
                    <div class="w-20 h-20 bg-slate-100 dark:bg-white/5 rounded-3xl flex items-center justify-center text-3xl text-slate-400 mx-auto shadow-inner border border-slate-100 dark:border-white/10 group-hover:rotate-6 transition-transform">
                        <i class="fas fa-book-open opacity-30"></i>
                    </div>
                    <div>
                        <h3 class="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Ayudas para el Ministerio</h3>
                        <p class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">Próximamente Recursos Digitales</p>
                    </div>
                </div>
            `;
            return;
        }

        // const wasRecOpen = container.querySelector('.group-recursos')?.open;

        container.classList.remove('hidden');
        container.innerHTML = `
                    <div class="space-y-8 animate-fade-in group">
                        <header class="flex items-center gap-6 mb-12">
                            <div class="w-16 h-16 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-2xl flex items-center justify-center text-3xl text-white shadow-xl rotate-3 group-hover:rotate-0 transition-all duration-700">
                                <i class="fas fa-book-open"></i>
                            </div>
                            <div>
                                <h3 class="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Ayudas para el Ministerio</h3>
                                <div class="flex items-center gap-3 mt-1.5 font-bold uppercase tracking-[0.3em] text-[10px] text-teal-600 dark:text-teal-400">
                                    <span class="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                                    Recursos y Metodologías
                                </div>
                            </div>
                        </header>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                            ${recursos.map(r => `
                                <div class="modern-card !p-0 overflow-hidden border-slate-200 dark:border-white/10 transition-all shadow-2xl hover:shadow-primary/10 hover:border-primary/30 group/item flex flex-col h-full bg-white dark:bg-slate-900/40">
                                    <div class="h-44 bg-slate-50 dark:bg-black/40 relative overflow-hidden flex items-center justify-center">
                                         ${r.imagen ? `<img src="${r.imagen}" class="w-full h-full object-cover transition-transform duration-700 group-hover/item:scale-110">` : `
                                            <div class="flex flex-col items-center gap-3 opacity-20">
                                                <i class="fas fa-file-alt text-4xl"></i>
                                                <p class="text-[9px] font-black uppercase tracking-widest">Sin vista previa</p>
                                            </div>
                                         `}
                                         <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity"></div>
                                    </div>
                                    <div class="p-8 flex flex-col gap-6 flex-1">
                                        <div class="space-y-2">
                                            <h4 class="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">${r.titulo || r.nombre}</h4>
                                            <p class="text-[12px] text-slate-500 dark:text-slate-400 font-bold leading-relaxed line-clamp-3">${r.descripcion || ''}</p>
                                        </div>
                                        <div class="mt-auto pt-6 border-t border-slate-100 dark:border-white/5">
                                            <a href="${r.url || '#'}" target="_blank" class="w-full bg-slate-900 dark:bg-white/5 py-4 rounded-xl text-[10px] font-black text-white dark:text-teal-400 uppercase tracking-[0.3em] flex items-center justify-center gap-2 hover:bg-black dark:hover:bg-white/10 transition-all shadow-lg active:scale-95">
                                                Ver <i class="fas fa-external-link-alt text-[8px]"></i>
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
    }).catch(err => {
        console.error("Error fetching recursos:", err);
        container.innerHTML = '';
    });
}

window.showUnifiedTerritoryHistory = async (territoryId, territoryNum) => {
    try {
        const history = await getTerritoryHistory(territoryId);
        const config = await getConfiguracion();
        const allT = await getTerritorios();
        const t = allT.find(x => x.id === territoryId) || { numero: territoryNum };

        showModal(`
            <div class="flex flex-col h-full bg-slate-50 dark:bg-[#0a0f18] rounded-[2.5rem] overflow-hidden shadow-2xl">
                 <header class="shrink-0 bg-gradient-to-br from-amber-500 to-orange-600 p-8 text-white relative overflow-hidden">
                     <div class="absolute -right-20 -top-20 w-64 h-64 bg-white/10 blur-[80px] rounded-full"></div>
                     <div class="relative z-10 flex justify-between items-center">
                        <div class="flex items-center gap-6">
                            <div class="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-3xl shadow-2xl border border-white/30 animate-float">
                                <i class="fas fa-history"></i>
                            </div>
                            <div>
                                <h3 class="text-2xl font-black uppercase tracking-tight leading-none mb-1">Historial T-${t.numero}</h3>
                                <p class="text-[10px] opacity-60 uppercase tracking-[0.4em] font-black">Historial de Predicación</p>
                            </div>
                        </div>
                     </div>
                 </header>

                 <div class="flex-1 p-6 md:p-8 overflow-y-auto custom-scrollbar space-y-6 bg-white dark:bg-black/20">
                     <!-- OBSERVATIONS SECTION -->
                     <div class="modern-card p-6 bg-slate-50 dark:bg-white/[0.03] border-slate-100 dark:border-white/5 border relative overflow-hidden group">
                         <div class="relative z-10">
                            <div class="flex items-center gap-3 mb-6">
                                <div class="w-8 h-8 rounded-xl bg-teal-500 text-white flex items-center justify-center text-sm shadow-lg shadow-teal-500/20">
                                    <i class="fas fa-edit"></i>
                                </div>
                                <h4 class="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-[0.3em]">Observaciones</h4>
                            </div>
                            
                            <div class="space-y-4">
                                <div class="flex gap-3 relative">
                                    <input type="text" id="ai-ask-input" placeholder="¿Hay alguna novedad importante?" 
                                        class="flex-1 bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 pr-24 text-[13px] font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all text-slate-800 dark:text-white shadow-inner">
                                    
                                    <div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                        <label class="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 hover:text-primary transition-all cursor-pointer">
                                            <i class="fas fa-camera"></i>
                                            <input type="file" id="history-photo-input" accept="image/*" class="hidden" multiple>
                                        </label>
                                        <button id="ai-ask-btn" class="bg-primary hover:bg-primary-light text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 transition-all active:scale-95">
                                            <i class="fas fa-paper-plane"></i>
                                        </button>
                                    </div>
                                </div>
                                <div id="history-photos-preview" class="flex flex-wrap gap-2 empty:hidden"></div>
                                <div id="ai-ask-response" class="hidden animate-fade-in p-5 bg-white dark:bg-white/5 rounded-[1.5rem] border border-slate-100 dark:border-white/5 text-[13px] text-slate-600 dark:text-slate-300 font-bold leading-relaxed shadow-sm"></div>
                            </div>
                         </div>
                     </div>

                     <!-- HISTORY LIST -->
                     <div class="space-y-6">
                         ${(() => {
                const filteredHistory = history.filter(rec => (rec.notas && rec.notas.trim() !== '') || (rec.observaciones && rec.observaciones.trim() !== '') || (rec.fotos && rec.fotos.length > 0));
                if (filteredHistory.length === 0) {
                    return `
                        <div class="flex flex-col items-center justify-center py-20 opacity-30 text-center">
                            <i class="fas fa-scroll text-5xl mb-6"></i>
                            <p class="text-[10px] font-black uppercase tracking-[0.3em]">Sin observaciones registradas todavía</p>
                        </div>
                    `;
                }
                return filteredHistory.map(rec => {
                    const fmtDate = rec.fecha_entrega ? new Date(rec.fecha_entrega).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : (rec.fecha_asignacion ? new Date(rec.fecha_asignacion).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '-');
                    const obs = rec.notas || rec.observaciones || '';
                    const isAdmin = window.isAdminMode === true;

                    return `
                        <div class="modern-card p-6 border-slate-100 dark:border-white/5 hover:border-primary/20 transition-all group shadow-sm bg-white dark:bg-white/5 relative">
                            <div class="flex justify-between items-start mb-4">
                                <div class="flex items-center gap-4">
                                    <div class="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400">
                                        <i class="fas fa-user-circle text-xl"></i>
                                    </div>
                                    <div>
                                        <p class="text-xs font-black text-slate-800 dark:text-white uppercase truncate max-w-[150px]">${rec.conductor || 'Anónimo'}</p>
                                        <p class="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">${fmtDate}</p>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="px-3 py-1 bg-slate-100 dark:bg-white/10 rounded-lg text-[8px] font-black text-slate-500 uppercase tracking-widest">${rec.estado || '-'}</span>
                                    ${isAdmin ? `
                                        <div class="flex gap-1 ml-2">
                                            <button onclick="event.stopPropagation(); window.openHistoryEditor('${rec.id}')" class="w-7 h-7 bg-blue-500/10 text-blue-500 rounded-lg flex items-center justify-center hover:bg-blue-500 hover:text-white transition-all shadow-sm" title="Editar">
                                                <i class="fas fa-edit text-[10px]"></i>
                                            </button>
                                            <button onclick="event.stopPropagation(); window.deleteHistoryEntry('${rec.id}', '${territoryId}')" class="w-7 h-7 bg-rose-500/10 text-rose-500 rounded-lg flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm" title="Eliminar">
                                                <i class="fas fa-trash-alt text-[10px]"></i>
                                            </button>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                            ${obs ? `
                                <div class="p-4 bg-slate-50 dark:bg-black/20 rounded-xl border border-slate-100 dark:border-white/5">
                                    <p class="text-xs text-slate-600 dark:text-slate-300 font-bold leading-relaxed">"${obs}"</p>
                                </div>
                            ` : ''}
                            ${rec.fotos && rec.fotos.length > 0 ? `
                                <div class="flex gap-2 mt-4 overflow-x-auto pb-2 custom-scrollbar">
                                    ${rec.fotos.map(f => `<img src="${f}" class="w-20 h-20 object-cover rounded-lg shadow-md hover:scale-110 transition-transform cursor-pointer" onclick="window.viewFullImage('${f}')">`).join('')}
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('');
            })()}
                     </div>
                 </div>

                 <footer class="shrink-0 p-8 bg-white dark:bg-black/40 border-t border-slate-100 dark:border-white/5">
                     <button onclick="document.getElementById('modal-container').classList.add('hidden')" class="w-full py-5 rounded-2xl bg-slate-100 dark:bg-white/10 text-slate-500 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-200 dark:hover:bg-white/20 transition-all border border-slate-200 dark:border-white/5 shadow-sm active:scale-95">
                         Cerrar Historial
                     </button>
                 </footer>
            </div>
        `, (modal) => {
            const brain = new TerritoryIntelligence(null, null, allT, null);

            // Photo Preview Logic
            const photoInput = modal.querySelector('#history-photo-input');
            const photoPreview = modal.querySelector('#history-photos-preview');

            if (photoInput && photoPreview) {
                photoInput.onchange = (e) => {
                    Array.from(e.target.files).forEach(file => {
                        if (file.size > 800 * 1024) return showNotification("Foto muy grande (max 800KB)", "warning");
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                            const container = document.createElement('div');
                            container.className = 'relative w-16 h-16 rounded-xl overflow-hidden border border-black/10 group animate-scale-in';
                            container.innerHTML = '<img src="' + ev.target.result + '" class="w-full h-full object-cover"><button onclick="this.parentElement.remove()" class="absolute inset-0 bg-rose-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><i class="fas fa-trash-alt text-xs"></i></button>';
                            photoPreview.appendChild(container);
                        };
                        reader.readAsDataURL(file);
                    });
                };
            }

            const askInput = modal.querySelector('#ai-ask-input');
            const askBtn = modal.querySelector('#ai-ask-btn');
            const askResponse = modal.querySelector('#ai-ask-response');

            askBtn.onclick = async () => {
                const q = askInput.value.trim();
                const photos = Array.from(photoPreview.querySelectorAll('img')).map(img => img.src);
                if (!q && photos.length === 0) return;

                askBtn.disabled = true;
                askBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
                askResponse.classList.remove('hidden');
                askResponse.innerText = "Procesando...";

                try {
                    const historyCtx = history.slice(0, 30).map(h => {
                        const d = h.fecha_entrega || h.fecha_asignacion || h.fecha || 'Sin fecha';
                        const o = h.notas || h.observaciones || 'Sin notas';
                        return '[' + d + '] ' + o;
                    }).join('\n');

                    const prompt = "Analiza el historial de T-" + (t.numero || territoryNum) + " y responde la consulta.\n\nHistorial:\n" + historyCtx + "\n\nConsulta: " + q;

                    const response = await brain.askGemini(config.gemini_key, prompt);
                    askResponse.innerText = response;
                } catch (e) {
                    askResponse.innerText = "Error: " + e.message;
                } finally {
                    askBtn.disabled = false;
                    askBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
                }
            };

            askInput.onkeypress = (e) => { if (e.key === 'Enter') askBtn.click(); };
        }, 'max-w-2xl');
    } catch (e) {
        console.error(e);
        showNotification("Error cargando historial: " + e.message, "error");
    }
};
