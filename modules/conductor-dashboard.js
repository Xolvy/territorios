import Chart from 'chart.js/auto';
import { auth } from '../firebase-config.js';
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import {
    getTerritorios, getConductores, getPublicadores, getTelefonos, updateTelefono,
    getRecursos, getConfiguracion,
    getPredicacionPublica, savePredicacionPublica,
    getProgramaSemanal, saveProgramaSemanal, syncSlotWithTerritories, getTerritoryHistory,
    addPublicador, updatePublicador, deletePublicador,
    releaseUnusedTelefonos, solicitarNumeros, updateTelefonoStatus, logSessionSummary,
    logReturn, returnTerritorio, returnTerritorioParcial, transferTerritory, takeTerritoryPartial, assignFreeTerritory,
    getPuntosInteres, assignTerritorio, addHistoryRecord, getHistorialReport
} from '../data/firestore-services.js';
import { showNotification, getStatusColor, formatPhoneNumber, formatMapUrl, formatManzanas } from './utils/helpers.js';
import { TerritoryIntelligence } from './utils/intelligence.js';
import { MapViewer } from './map-viewer.js';
import { AppConfig } from './utils/config.js';
import h2c from 'html2canvas';
import { showModal, showCustomConfirm, showCustomPrompt, UIHelpers } from './services/ui-helpers.js';
window.AppConfig = AppConfig;
import { VoiceDictationHelper } from './conductor/voice-helper.js';
import { moduleRegistry } from './utils/module-registry.js';

// --- MICRO-MODULE LOADER ---
const SubModuleCache = new Map();
const dynamicSubModules = import.meta.glob('./**/*.js');

// Module scope variables for micro-modules to resolve closure/ReferenceError issues
let mAvail, mRec, mMaps, mRescue, mPhone, mOnboard, mProg;

async function loadSubModule(name, path) {
    const fullPath = moduleRegistry.getModulePath(name, path);
    // If version changed, force fresh reload
    const isNew = SubModuleCache.get(`${name}_path`) !== fullPath;
    if (!SubModuleCache.has(name) || isNew) {
        console.log(`📡 [HMS] Swapping Micro-Module (Conductor): ${name}`);

        let mod;
        const globPath = path.startsWith('./') ? path : `./${path.startsWith('/') ? path.substring(1) : path}`;

        if (dynamicSubModules[globPath]) {
            mod = await dynamicSubModules[globPath]();
        } else {
            const finalPath = isNew ? `${fullPath}&ts=${Date.now()}` : fullPath;
            mod = await import(/* @vite-ignore */ finalPath);
        }

        SubModuleCache.set(name, mod);
        SubModuleCache.set(`${name}_path`, fullPath);
    }
    return SubModuleCache.get(name);
}

const html2canvas = h2c;

// --- UTILS ---
window.viewMapFromReport = async (id) => {
    showNotification("Cargando mapa interactivo...", "info");
    const territories = await getTerritorios();
    const t = territories.find(x => x.id === id);
    if (t) {
        window.openInteractiveMap(t);
    } else {
        showNotification("No se encontró la data del territorio para el mapa.", "error");
    }
};

window.showCustomAlert = (message) => {
    const type = message.toLowerCase().includes('error') ? 'error' : 'success';
    showNotification(message, type);
};

export const renderConductorDashboard = async (container, nameOrEmail, appVersion, userRole = null) => {
    // Xolvy Modular: Pre-fetch Micro-Modules for this view
    [mAvail, mRec, mMaps, mRescue, mPhone, mOnboard, mProg] = await Promise.all([
        loadSubModule('availability', './conductor/availability.js'),
        loadSubModule('recursos', './conductor/recursos.js'),
        loadSubModule('maps_explorer', './conductor/maps-explorer.js'),
        loadSubModule('rescue', './conductor/rescue.js'),
        loadSubModule('phone_module', './conductor/phone-module.js'),
        loadSubModule('onboarding', './conductor/onboarding.js'),
        loadSubModule('weekly_program', './conductor/weekly-program.js')
    ]);

    // Xolvy Data Shield: Aggressive normalization for Conductor resolution
    const normalize = (val) => String(val || '').trim().toLowerCase();
    const cleanPhone = (val) => String(val || '').replace(/[\s\-\(\)]/g, '');

    let displayName = nameOrEmail;
    let conductorData = null;
    let config = null;
    const sessionHandledIds = new Set();
    try {
        config = await getConfiguracion();
        const allC = await getPublicadores(); // Use publicadores for broader match
        conductorData = allC.find(c =>
            normalize(c.email) === normalize(nameOrEmail) ||
            normalize(c.nombre) === normalize(nameOrEmail) ||
            (c.telefono && cleanPhone(c.telefono) === cleanPhone(nameOrEmail))
        );
        if (conductorData) displayName = conductorData.nombre;

        // Xolvy Session Tracking: Track phones handled in THIS specific session
        // to avoid hiding them immediately (which is confusing)
    } catch (err) {
        console.error("🛡️ [Data Shield] Error resolving name:", err);
    }

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
        <div class="animate-fade-in pb-32 w-full max-w-7xl mx-auto p-2 md:p-8 space-y-8 md:space-y-12" data-adaptive-container="true">
            <header class="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 lg:mb-10 p-4 md:p-8 glass-morphism rounded-2xl lg:rounded-[2rem] gap-6" data-mobile-order="1">
                <div class="flex items-center gap-4 md:gap-6 relative z-10">
                    <div class="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-indigo-600 to-slate-900 rounded-2xl flex items-center justify-center text-white text-2xl md:text-3xl shadow-xl shadow-indigo-500/20 border border-white/10 transition-transform hover:scale-105 duration-500 shrink-0">
                        <i class="fas fa-user-circle"></i>
                    </div>
                    <div>
                        <h1 class="text-xl md:text-3xl font-black text-slate-900 dark:text-white leading-tight uppercase tracking-tighter">Hola, ${displayName.split(' ')[0]}</h1>
                        <div class="flex items-center gap-2 mt-1">
                            <span class="relative flex h-2 w-2">
                               <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                               <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <p class="text-[9px] md:text-[10px] text-slate-500 font-black uppercase tracking-widest">Panel Conductor • v${appVersion}</p>
                        </div>
                    </div>
                </div>

                <div class="flex flex-wrap items-center gap-3 w-full lg:w-auto relative z-10">
                    <!-- Status Badge -->
                    <div id="connection-hub" class="flex items-center gap-4 bg-slate-100 dark:bg-white/5 px-4 md:px-6 py-2.5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-inner shrink-0">
                         <div class="flex items-center gap-2">
                             <div id="status-dot" class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                             <span id="status-text" class="text-[8px] md:text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap">En Línea</span>
                         </div>
                         <div class="w-px h-3 bg-slate-300 dark:bg-white/10 mx-0.5"></div>
                         <button id="btn-sync-all" class="text-[8px] md:text-[9px] font-black text-indigo-600 hover:text-indigo-500 uppercase tracking-widest transition-colors flex items-center gap-2 whitespace-nowrap group/syncall">
                             <i class="fas fa-arrows-rotate group-hover/syncall:rotate-180 transition-transform duration-700"></i> Sincronizar
                         </button>
                    </div>

                    ${(userRole === 'Administrador' || userRole === 'SuperAdmin' || conductorData?.privilegios?.includes('Administrador')) ? `
                    <!-- UI Role/Switch Badge -->
                    <div class="flex-1 lg:flex-none flex items-center justify-center gap-4 bg-slate-100 dark:bg-white/5 px-4 md:px-6 py-2.5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-inner min-w-fit shrink-0">
                         <div class="flex items-center gap-2">
                             <div class="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                             <span class="text-[8px] md:text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap">Conductor</span>
                         </div>
                         <div class="w-px h-3 bg-slate-300 dark:bg-white/10 mx-0.5"></div>
                         <button id="btn-goto-admin" class="text-[8px] md:text-[9px] font-black text-indigo-600 hover:text-indigo-500 uppercase tracking-widest transition-colors flex items-center gap-2 whitespace-nowrap group/switch shrink-0 px-1">
                             <i class="fas fa-user-shield text-[10px] group-hover:scale-110 transition-transform"></i> Admin
                         </button>
                    </div>
                    ` : `
                    <button onclick="window.startOnboarding()" class="flex-1 md:flex-none bg-slate-50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 px-6 py-3 rounded-2xl border border-slate-200 dark:border-white/10 transition-all font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm active:scale-95 min-w-0">
                        <i class="fas fa-circle-info text-indigo-500"></i> Ayuda
                    </button>
                    `}

                    <button id="logout-btn" class="flex-1 lg:flex-none btn-pro bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white px-8 py-3.5 rounded-2xl border border-rose-500/20 transition-all font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-rose-500/5 active:scale-95">
                        <i class="fas fa-sign-out-alt"></i> Salir
                    </button>
                </div>
            </header>
 
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-y-12 gap-x-8 px-2 md:px-4 mb-12">
                <div class="lg:col-span-2 space-y-8 animate-fade-in ${mods.agenda !== false ? '' : 'hidden'}">
                    <div class="flex flex-col md:flex-row md:items-center justify-between px-4 gap-4">
                        <h3 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] flex items-center gap-4">
                           <span class="w-12 h-1 bg-indigo-500/20 rounded-full"></span>
                           Agenda Inteligente
                        </h3>
                        <div class="flex items-center gap-3">
                            <button onclick="document.getElementById('details-programa').parentElement.scrollIntoView({ behavior: 'smooth' }); document.getElementById('details-programa').open = true;" 
                                class="bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 px-6 rounded-2xl font-black text-[10px] uppercase tracking-[0.15em] flex items-center gap-3 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all">
                                <i class="fas fa-calendar-alt"></i> Programa de Predicación
                            </button>
                            <div id="agenda-intelligence-badge"></div>
                        </div>
                    </div>
                    <div id="calendar-container" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                        <div class="skeleton-pro h-48 rounded-[2.5rem]"></div>
                    </div>
                </div>
            </div>
 
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-y-12 gap-x-8 px-2 md:px-4 mb-12">
                <!--Module: Programa Semanal(Global Cards)-->
                <div id="programa-semanal-section" class="lg:col-span-2 ${mods.programa !== false ? '' : 'hidden'} mb-4">
                    <div class="modern-card !p-0 border-slate-200 dark:border-white/10 shadow-2xl transition-all overflow-hidden group/prog bg-white dark:bg-slate-900/40">
                        <details id="details-programa" class="group/prog-details">
                             <summary class="flex flex-col md:flex-row justify-between items-start md:items-center p-6 md:p-8 cursor-pointer list-none select-none hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors border-b border-transparent group-open/prog-details:border-slate-100 dark:group-open/prog-details:border-white/5">
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
                                         <div class="flex items-center gap-2">
                                             <button id="prog-btn-sync-offline" class="hidden p-4 bg-teal-500/10 border border-teal-500/20 text-teal-600 hover:bg-teal-500 hover:text-white rounded-xl transition-all shadow-lg shadow-teal-500/5 group/sync" title="Pre-descargar territorios de la semana">
                                                <i class="fas fa-cloud-download-alt group-hover/sync:scale-110 transition-transform"></i>
                                                <span class="hidden sm:inline ml-2 text-[9px] font-black uppercase tracking-widest">Pre-Cargar</span>
                                             </button>
                                             <button id="prog-btn-share" class="p-4 bg-blue-500/10 border border-blue-500/20 text-blue-600 hover:bg-blue-500 hover:text-white rounded-xl transition-all shadow-lg shadow-blue-500/5 group/share" title="Compartir Programa">
                                                <i class="fas fa-share-alt group-hover/share:scale-110 transition-transform"></i>
                                                <span class="hidden sm:inline ml-2 text-[9px] font-black uppercase tracking-widest">Compartir</span>
                                             </button>
                                             <button id="prog-export-png" class="p-4 bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 hover:bg-indigo-500 hover:text-white rounded-xl transition-all shadow-lg shadow-indigo-500/5 group/dl" title="Descargar como Imagen">
                                                <i class="fas fa-download group-hover/dl:scale-110 transition-transform"></i>
                                                <span class="hidden sm:inline ml-2 text-[9px] font-black uppercase tracking-widest">Descargar</span>
                                             </button>
                                         </div>
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

                <!--Module: Misiones de Rescate(Reordered to be above availability)-->
                <div class="lg:col-span-2 hidden mb-4" id="ayudas-container"></div>
                
                <div class="lg:col-span-2 ${mods.disponibilidad !== false ? '' : 'hidden'} mb-4" id="availability-section">
                    <div class="modern-card !p-0 border-slate-200 dark:border-white/10 shadow-2xl transition-all overflow-hidden group/avail bg-white dark:bg-slate-900/40">
                         <details class="group/avail-details">
                             <summary class="flex flex-col md:flex-row justify-between items-start md:items-center p-6 md:p-8 cursor-pointer list-none select-none hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors border-b border-transparent group-open/avail-details:border-slate-100 dark:group-open/avail-details:border-white/5">
                                <div class="flex items-start gap-6">
                                    <div class="w-14 h-14 rounded-2xl bg-teal-500/10 flex items-center justify-center text-2xl text-teal-600 shadow-inner border border-teal-500/10 group-open/avail-details:rotate-6 transition-transform">
                                        <i class="fas fa-user-clock"></i>
                                    </div>
                                    <div>
                                        <div class="flex items-center gap-3">
                                            <h3 class="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Mi Disponibilidad</h3>
                                            <div class="w-6 h-6 rounded-lg bg-slate-100 dark:bg-white/10 flex items-center justify-center text-[10px] group-open/avail-details:rotate-180 transition-transform text-slate-400">
                                                <i class="fas fa-chevron-down"></i>
                                            </div>
                                        </div>
                                        <p class="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1 opacity-70">Gestiona tus horarios para el programa</p>
                                    </div>
                                </div>
                            </summary>
                            <div id="availability-container" class="p-4 md:p-8 animate-fade-in group-open/avail-details:block hidden">
                                <!-- Content will be injected here -->
                            </div>
                         </details>
                    </div>
                </div>

                <!--Module: Telefonos-->
                <div class="lg:col-span-2 modern-card p-6 md:p-8 ${mods.telefonos !== false ? '' : 'hidden'} border-slate-200 dark:border-white/10 shadow-2xl transition-all duration-500 bg-white dark:bg-slate-900/40 mb-4" id="phone-module-card">
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
                               <button id="btn-zoom-compact" onclick="window.open(AppConfig.zoom_url, '_blank')" class="bg-blue-600 hover:bg-blue-500 text-white px-10 py-5 rounded-[2rem] font-black shadow-2xl shadow-blue-500/30 transition-all hover:scale-105 active:scale-95 flex items-center gap-4 uppercase tracking-[0.3em] text-xs">
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
                                <button id="btn-zoom" onclick="window.open(AppConfig.zoom_url, '_blank')" class="flex-1 md:flex-none btn-pro bg-blue-600 text-white border border-blue-400/20 px-6 py-4 rounded-2xl hover:bg-blue-500 transition-all flex items-center justify-center gap-3 font-black shadow-xl shadow-blue-500/20 uppercase tracking-[0.2em] text-[10px]">
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
                                       class="w-full bg-slate-50 dark:bg-white/5 border border-transparent focus:border-primary/20 rounded-2xl !pl-14 pr-6 py-5 text-sm font-bold shadow-inner outline-none transition-all placeholder:text-slate-400">
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
                            <table class="w-full text-left text-xs" data-adaptive="true">
                                 <thead class="hidden sm:table-header-group bg-gray-100/50 dark:bg-white/5 border-b border-black/5 dark:border-white/5 text-gray-500 dark:text-gray-400 font-black uppercase tracking-widest text-[9px] md:text-[10px]">
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

                    </div>
                </div>

                <!-- Xolvy Adapt: Floating Action Bar for Phones (Mockup Mode) -->
                <div id="phone-floating-actions" class="fixed bottom-8 left-1/2 -translate-x-1/2 hidden items-center gap-4 z-[60] animate-bounce-in w-[90%] md:w-auto">
                    <button id="btn-finalizar-float" class="flex-1 md:flex-none bg-[#E12E2E] hover:bg-red-500 text-white px-8 md:px-12 py-5 rounded-[2rem] font-black shadow-[0_20px_40px_rgba(225,46,46,0.3)] transform hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-[10px]">
                        <i class="fas fa-check-double"></i> FINALIZAR PREDICACIÓN
                    </button>
                    <button id="btn-solicitar-more-float" class="flex-1 md:flex-none bg-[#00897B] hover:bg-teal-500 text-white px-8 md:px-12 py-5 rounded-[2rem] font-black shadow-[0_20px_40px_rgba(0,137,123,0.3)] transform hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-[10px] border border-white/10">
                        <i class="fas fa-plus"></i> SOLICITAR MÁS
                    </button>
                </div>

                <div class="lg:col-span-2 modern-card border-slate-200 dark:border-white/10 shadow-2xl transition-all overflow-hidden !p-0 ${mods.mapas !== false ? '' : 'hidden'} bg-white dark:bg-slate-900/40 mb-4" id="interactive-maps-module">
                    <details class="group/maps" ${container.querySelector('.group\\/maps')?.open ? 'open' : ''}>
                        <summary class="flex flex-col md:flex-row justify-between items-start md:items-center p-6 md:p-8 cursor-pointer list-none select-none hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
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
                                        class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl !pl-12 pr-6 py-4 text-[13px] text-slate-700 dark:text-white focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 font-black uppercase tracking-tight">
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

                <!--Module: Ayudas Ministerio-->
                <div class="lg:col-span-2 ${mods.ayudas !== false ? '' : 'hidden'} mb-4" id="recursos-container"></div>
            </div>
        </div>
        <div id="modal-container" class="fixed inset-0 bg-black/80 backdrop-blur-sm hidden overflow-y-auto z-50 p-4 md:p-10 flex justify-center items-start"></div>
    `;

    document.getElementById('logout-btn').addEventListener('click', async () => {
        localStorage.removeItem('demo_role');
        localStorage.removeItem('user_email');
        await auth.signOut();
        // Location.reload(); // Not strictly necessary if auth state change handles it, but good for clean slate
    });

    const btnAdmin = container.querySelector('#btn-goto-admin');
    if (btnAdmin) {
        btnAdmin.onclick = () => {
            window.history.pushState({}, '', '/administrador/dashboard');
            location.reload();
        };
    }

    // Helper for Phones
    const refreshPhones = async (forceRefresh = false) => {
        const allPhones = await getTelefonos(forceRefresh);
        const cleanStr = (s) => String(s || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

        const userEmail = auth.currentUser?.email?.toLowerCase() || '';
        const userName = cleanStr(displayName);

        console.log(`[Phones] Refreshing for: "${userName}" / "${userEmail}"`);
        console.log(`[Phones] Total in DB: ${allPhones.length}`);

        const filtered = allPhones.filter(t => {
            const sol = cleanStr(t.solicitado_por);
            const pub = cleanStr(t.publicador_asignado);
            const asg = cleanStr(t.asignado_a);

            // Match if requested by me, or assigned specifically to me (by name or email)
            const isMatch = (sol === userName || sol === userEmail) ||
                (pub === userName || pub === userEmail) ||
                (asg === userName || asg === userEmail);
            return isMatch;
        });

        console.log(`[Phones] Filtered count: ${filtered.length}`);
        return filtered;
    };

    // Robust Refresh for Table specifically
    window.refreshPhoneTableOnly = async (idToMark = null) => {
        if (idToMark) sessionHandledIds.add(idToMark);

        const searchPhone = container.querySelector('#search-phone');
        const filterStatus = container.querySelector('#filter-phone-status');
        const term = searchPhone?.value.toLowerCase() || '';
        const status = filterStatus?.value || '';
        await refreshAndRenderPhoneTable(term, status);
    };

    // Expose refresh function/trigger
    window.refreshConductorView = async () => {
        try {
            const config = await getConfiguracion();
            const allC = await getPublicadores();
            const normalized = displayName.trim().toLowerCase();
            const conductorData = allC.find(c =>
                String(c.nombre || '').trim().toLowerCase() === normalized ||
                String(c.email || '').trim().toLowerCase() === normalized
            );
            const userMods = conductorData?.modulos || {
                agenda: true,
                programa: true,
                disponibilidad: true,
                telefonos: true,
                mapas: true,
                ayudas: true,
                rescue: false
            };

            await loadUnifiedDashboard(container, displayName, container.querySelector('#agenda-intelligence-badge'), container.querySelector('#calendar-container'), container.querySelector('#territorios-container'), userMods, config, conductorData, userRole);
            const myPhones = await refreshPhones(true); // Force refresh to see newly requested numbers
            const publicadores = await getPublicadores();

            // Set up Solicitar Números logic
            const setupSolicitarBtn = (btnId) => {
                const btn = container.querySelector(`#${btnId}`);
                if (btn) {
                    btn.onclick = async () => {
                        try {
                            btn.disabled = true;
                            const oldText = btn.innerHTML;
                            btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Solicitando...';

                            // Xolvy Adapt: Changed batch size to 30 as requested for better performance/UX
                            const count = await solicitarNumeros(30, displayName);
                            if (count > 0) {
                                showNotification(`Se han asignado ${count} números nuevos.`, 'success');
                                await window.refreshConductorView();
                            } else {
                                showNotification("No hay más números disponibles en este momento.", "warning");
                                btn.disabled = false;
                                btn.innerHTML = oldText;
                            }
                        } catch (err) {
                            console.error("Error solicitando números:", err);
                            showNotification("Error al solicitar números", "error");
                            btn.disabled = false;
                        }
                    };
                }
            };

            setupSolicitarBtn('btn-solicitar');
            setupSolicitarBtn('btn-solicitar-more');
            setupSolicitarBtn('btn-solicitar-more-float');

            setupDashboardListeners();

            // Toggle View Visibility
            const compactView = container.querySelector('#phone-compact-view');
            const expandedView = container.querySelector('#phone-expanded-view');
            const floatingActions = container.querySelector('#phone-floating-actions');

            if (myPhones.length > 0) {
                compactView?.classList.add('hidden');
                expandedView?.classList.remove('hidden');

                // Show floating bar
                floatingActions?.classList.replace('hidden', 'flex');
            } else {
                compactView?.classList.remove('hidden');
                expandedView?.classList.add('hidden');

                // Hide floating bar
                floatingActions?.classList.replace('flex', 'hidden');
            }

            if (mPhone && mPhone.initializePhoneModule) {
                mPhone.initializePhoneModule(myPhones, publicadores, displayName, container.querySelector('#phone-tbody'), window.refreshConductorView);
            }
        } catch (e) {
            console.error("Refresh error", e);
            container.innerHTML = `
                 <div class="flex flex-col items-center justify-center py-32 text-center space-y-4 px-6">
                    <div class="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center text-2xl"><i class="fas fa-triangle-exclamation"></i></div>
                    <h4 class="text-sm font-black uppercase text-slate-800 dark:text-white">Error de Carga</h4>
                    <p class="text-xs text-slate-400 max-w-xs">${e.message}</p>
                    <div class="flex flex-wrap justify-center gap-3 mt-4">
                        <button onclick="location.reload()" class="bg-indigo-600 px-8 py-3 rounded-xl text-[10px] font-black uppercase text-white tracking-widest shadow-lg shadow-indigo-500/20 transition-all active:scale-95">
                            <i class="fas fa-sync-alt mr-2"></i> Reintentar
                        </button>
                        <button onclick="window.repairSystem()" class="bg-slate-800 dark:bg-slate-700 px-8 py-3 rounded-xl text-[10px] font-black uppercase text-white tracking-widest shadow-lg transition-all active:scale-95">
                            <i class="fas fa-tools mr-2"></i> Reparar Sistema
                        </button>
                    </div>
                </div>
            `;
        }
    };

    // Connection Hub Logic
    const statusDot = container.querySelector('#status-dot');
    const statusText = container.querySelector('#status-text');
    const btnSyncAll = container.querySelector('#btn-sync-all');

    const updateConnectionStatus = () => {
        if (navigator.onLine) {
            statusDot?.classList.replace('bg-rose-500', 'bg-emerald-500');
            statusText && (statusText.innerText = 'En Línea');
        } else {
            statusDot?.classList.replace('bg-emerald-500', 'bg-rose-500');
            statusText && (statusText.innerText = 'Modo Offline');
        }
    };
    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);
    updateConnectionStatus();

    if (btnSyncAll) {
        btnSyncAll.onclick = async () => {
            const allT = await getTerritorios();
            showNotification(`Sincronizando ${allT.length} territorios...`, 'info');
            btnSyncAll.querySelector('i').classList.add('animate-spin');
            if (window.precacheTerritoryResources) {
                await window.precacheTerritoryResources(allT);
                showNotification("¡Todo el sistema está listo para uso offline!", "success");
            }
            btnSyncAll.querySelector('i').classList.remove('animate-spin');
        };
    }

    // --- DASHBOARD LISTENERS SETUP ---
    const setupDashboardListeners = () => {
        // Phone Search & Filter
        const searchPhone = container.querySelector('#search-phone');
        const filterStatus = container.querySelector('#filter-phone-status');
        if (searchPhone) {
            searchPhone.oninput = () => {
                window.refreshPhoneTableOnly();
            };
        }
        if (filterStatus) {
            filterStatus.onchange = () => {
                window.refreshPhoneTableOnly();
            };
        }

        // Revisitas Modal
        const btnRevisitas = container.querySelector('#btn-revisitas');
        if (btnRevisitas) {
            btnRevisitas.onclick = async () => {
                showNotification("Cargando revisitas...", "info");
                const [allPhones, allPubs] = await Promise.all([
                    getTelefonos(true),
                    getPublicadores()
                ]);
                const revisitas = allPhones.filter(p => p.estado === 'Revisita');

                const resolveName = (raw) => {
                    const clean = String(raw || '').trim();
                    if (!clean) return 'Sin asignar';
                    const found = allPubs.find(p => p.id === clean || p.email?.toLowerCase() === clean.toLowerCase() || p.nombre === clean);
                    return found ? found.nombre : clean;
                };

                showModal(`
                    <div class="p-8 space-y-8 bg-slate-50 dark:bg-[#0b0e14]">
                        <div class="flex items-center gap-6">
                            <div class="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center text-3xl text-amber-500 shadow-inner border border-amber-500/10">
                                <i class="fas fa-sync-alt rotate-180"></i>
                            </div>
                            <div>
                                <h3 class="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-none mb-1">Centro de Revisitas</h3>
                                <p class="text-[10px] text-amber-500 font-black uppercase tracking-[0.3em]">Gestión de contactos interesados</p>
                            </div>
                        </div>

                        <div class="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                            ${revisitas.length === 0 ? `
                                <div class="py-12 text-center opacity-40">
                                    <p class="text-[10px] font-black uppercase tracking-[0.4em]">No hay revisitas registradas</p>
                                </div>
                            ` : revisitas.map(r => `
                                <div class="modern-card bg-white dark:bg-white/[0.03] !p-6 border-slate-200 dark:border-white/5 group hover:border-amber-500/30 transition-all shadow-sm">
                                    <div class="flex justify-between items-start mb-4">
                                        <div>
                                            <h4 class="text-lg font-black text-slate-800 dark:text-white tabular-nums">${formatPhoneNumber(r.telefono)}</h4>
                                            <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">${r.propietario || 'Propietario no registrado'}</p>
                                        </div>
                                        <div class="px-3 py-1 bg-amber-500/10 text-amber-500 rounded-lg text-[8px] font-black uppercase tracking-widest">Revisita</div>
                                    </div>
                                    
                                    <div class="flex items-center gap-3 mb-6 bg-slate-50 dark:bg-black/20 p-4 rounded-xl border border-black/5">
                                        <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs">
                                            <i class="fas fa-user-edit"></i>
                                        </div>
                                        <div class="flex-1">
                                            <p class="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Responsable</p>
                                            <p class="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase">${resolveName(r.asignado_a || r.publicador_asignado)}</p>
                                        </div>
                                    </div>

                                    ${r.notas ? `
                                        <div class="mb-6 p-4 bg-amber-50/30 dark:bg-amber-500/5 rounded-xl border border-amber-500/10 italic text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                                            "${r.notas}"
                                        </div>
                                    ` : ''}

                                    <div class="flex justify-center">
                                        <button onclick="window.returnPhoneToPool('${r.id}')" class="w-full py-3 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-rose-500/5 flex items-center justify-center gap-2">
                                            <i class="fas fa-undo-alt"></i> Devolver
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        
                        <button onclick="window.closeModal()" class="w-full py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] hover:text-primary transition-colors">Cerrar Ventana</button>
                    </div>
                `, null, 'max-w-2xl');

                window.returnPhoneToPool = async (id) => {
                    showCustomPrompt("Indica la razón de la devolución (esto se guardará en el historial):", "", async (reason) => {
                        if (!reason || reason.trim().length === 0) {
                            showNotification("Debes indicar una razón", "warning");
                            return;
                        }
                        await updateTelefonoStatus(id, 'Sin asignar', null, reason);
                        window.closeModal();

                        showNotification("Número devuelto correctamente.", "success", 5000, [], async () => {
                            try {
                                await updateTelefonoStatus(id, 'Revisita', null, 'Devolución deshecha por el usuario');
                                showNotification("Acción deshecha.");
                                window.refreshConductorView();
                            } catch (err) {
                                console.error("Undo error:", err);
                                showNotification("No se pudo deshacer la acción", "error");
                            }
                        });

                        window.refreshConductorView();
                    });
                };

                window.reAssignAndCall = async (id, phone) => {
                    // Re-request properly if not currently requested by me
                    await solicitarNumeros(1, displayName);
                    // Open notes
                    window.openPhoneNotes(id, phone, '');
                    window.closeModal();
                };
            };
        }

        // Add Publisher
        const btnAddPub = container.querySelector('#btn-add-publicador');
        if (btnAddPub) {
            btnAddPub.onclick = async () => {
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
                            window.refreshConductorView();
                        } catch (e) {
                            console.error(e);
                            showNotification("Error al agregar publicador: " + e.message, "error");
                        }
                    }
                };

                document.getElementById('confirm-add-pub').onclick = submit;
                inputName.onkeypress = (e) => { if (e.key === 'Enter') submit(); };
            };
        }

        // Finalize Session
        const bindFinalizar = (id) => {
            const btn = container.querySelector(`#${id}`);
            if (btn) {
                btn.onclick = async () => {
                    const allPhones = await getTelefonos();
                    // Xolvy Shield: Use robust normalization for comparison to avoid 'No phones found' error
                    const myPhones = allPhones.filter(t => (t.solicitado_por || '').trim() === (displayName || '').trim());

                    if (myPhones.length === 0) {
                        showNotification("No tienes números solicitados activos.", "info");
                        return;
                    }

                    const summary = {
                        total: myPhones.length,
                        stats: {
                            'Contestaron': 0,
                            'No contestan': 0,
                            'Colgaron': 0,
                            'Revisita': 0,
                            'Predicado': 0,
                            'No llamar': 0,
                            'Sin asignar': 0
                        }
                    };

                    myPhones.forEach(t => {
                        const st = t.estado || 'Sin asignar';
                        if (summary.stats.hasOwnProperty(st)) summary.stats[st]++;
                        else summary.stats['Sin asignar']++;
                    });

                    showModal(`
                        <div class="p-8 text-center space-y-8 animate-fade-in bg-slate-50 dark:bg-[#0b0e14]">
                                <div class="relative inline-block">
                                    <div class="w-24 h-24 bg-primary/10 dark:bg-primary/20 rounded-[2.5rem] flex items-center justify-center text-5xl text-primary shadow-inner border border-primary/20 animate-float">
                                        <i class="fas fa-flag-checkered"></i>
                                    </div>
                                    <div class="absolute -top-2 -right-2 w-10 h-10 bg-emerald-500 text-white rounded-full flex items-center justify-center text-lg font-black shadow-xl animate-bounce border-4 border-white dark:border-slate-900">
                                         <i class="fas fa-check"></i>
                                    </div>
                                </div>
                                
                                <div class="space-y-2">
                                    <h3 class="text-3xl font-black text-slate-800 dark:text-white tracking-tighter uppercase">Sesión Finalizada</h3>
                                    <p class="text-[10px] text-primary font-black uppercase tracking-[0.4em] opacity-80">Resumen de Actividad Telefónica</p>
                                </div>
                                
                                <div class="modern-card bg-white dark:bg-white/[0.03] p-6 border-slate-200 dark:border-white/5 space-y-6 shadow-2xl">
                                    <div class="flex justify-between items-center bg-primary/10 dark:bg-primary/20 p-6 rounded-2xl border border-primary/10">
                                         <span class="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Total Registros</span>
                                         <span class="text-4xl font-black text-primary tracking-tighter tabular-nums">${summary.total}</span>
                                    </div>
                                    <div class="space-y-3 text-left">
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

                                <div class="space-y-3">
                                    <textarea id="session-notes" placeholder="Notas adicionales sobre esta sesión (opcional)..." 
                                        class="w-full bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 rounded-2xl p-5 text-sm font-bold outline-none focus:border-primary transition-all text-slate-700 dark:text-white placeholder:text-slate-400 min-h-[100px] resize-none"></textarea>
                                </div>

                                <button id="btn-share-results" class="w-full bg-primary hover:bg-primary-dark py-5 rounded-2xl text-white font-black shadow-2xl shadow-primary/30 hover:shadow-primary/50 hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-[0.4em] text-xs flex items-center justify-center gap-5 group">
                                     <i class="fas fa-paper-plane text-xl group-hover:rotate-12 transition-transform"></i> Enviar reporte
                                </button>
                                <button onclick="window.closeModal()" class="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-primary transition-colors">Volver</button>
                        </div>
                    `, async (modal) => {
                        const shareBtn = modal.querySelector('#btn-share-results');
                        if (shareBtn) {
                            shareBtn.onclick = async () => {
                                const notes = modal.querySelector('#session-notes')?.value || '';
                                const statsText = Object.entries(summary.stats)
                                    .filter(([_, count]) => count > 0)
                                    .map(([name, count]) => `• ${name}: ${count}`)
                                    .join('\n');

                                const message = `📋 *Resumen de Predicación Telefónica*\n` +
                                    `👤 *Conductor:* ${displayName}\n` +
                                    `📊 *Total procesado:* ${summary.total}\n\n` +
                                    `${statsText}\n\n` +
                                    (notes ? `📝 *Notas:* ${notes}\n\n` : '') +
                                    `_Enviado desde App Territorios_`;

                                // Xolvy Adapt: Pre-action countdown for Finalize with RED bar ('bg-rose-500')
                                showNotification("Finalizando sesión...", "info", 5000, ["Preparando reporte", "Cerrando registros"], null, async () => {
                                    try {
                                        await logSessionSummary({
                                            conductor_id: displayName,
                                            stats: summary.stats,
                                            total: summary.total,
                                            notas: notes
                                        });
                                        await releaseUnusedTelefonos(displayName);
                                        showNotification("Sesión finalizada con éxito.", "success");
                                        window.closeModal();
                                        await window.refreshConductorView();
                                    } catch (e) {
                                        console.error("Error finalizing session:", e);
                                        showNotification("Error al finalizar sesión", "error");
                                    }
                                }, "bg-rose-500");
                            };
                        }
                    });
                };
            }
        };

        bindFinalizar('btn-finalizar-sesion');
        bindFinalizar('btn-finalizar');
        bindFinalizar('btn-finalizar-float');

        // Refrescar button
        const btnRefresh = container.querySelector('#btn-refresh');
        if (btnRefresh) {
            btnRefresh.onclick = () => window.refreshConductorView();
        }
    };

    const refreshAndRenderPhoneTable = async (term = '', status = '') => {
        const myPhones = await refreshPhones(true);
        const filtered = myPhones.filter(p => {
            const cleanTerm = term.replace(/[\s\-\(\)]/g, '');
            const matchesTerm = !term ||
                (p.telefono && cleanPhone(p.telefono).includes(cleanTerm)) ||
                p.propietario?.toLowerCase().includes(term) ||
                p.direccion?.toLowerCase().includes(term);

            // Xolvy Adapt: By default (no status filter), only show 'Sin asignar' or 'Revisitas'
            // Handled ones (No contestan, Contestaron) stay hidden until session end/reset.
            // UNLESS they were handled in the CURRENT session (sessionHandledIds).
            let matchesStatus = false;
            if (status) {
                matchesStatus = p.estado === status;
            } else {
                // Default view: Show unhandled, revisitas, or what we just worked on
                matchesStatus = (!p.estado || p.estado === 'Sin asignar' || p.estado === 'Revisita' || sessionHandledIds.has(p.id));
            }

            return matchesTerm && matchesStatus;
        });
        const publicadores = await getPublicadores();
        if (mPhone.initializePhoneModule) {
            // Corrected: pass refreshPhoneTableOnly as onRefresh to maintain filters
            mPhone.initializePhoneModule(filtered, publicadores, displayName, container.querySelector('#phone-tbody'), window.refreshPhoneTableOnly);
        }
    };

    try {
        // Clean up unassigned/unused numbers from previous sessions for a fresh "Solicitar" experience
        await releaseUnusedTelefonos(displayName);
        // Initial render
        await window.refreshConductorView();
        // Initialize AI Assistant
        renderAISection(displayName);
    } catch (e) {
        console.error("Error loading initial view:", e);
    }
};

const loadUnifiedDashboard = async (container, name, intelligenceBadge, agendaContainer, territoriosContainer, userMods, config, conductorData, userRole) => {
    // We no longer hide the territories container as requested ("fusionar") 
    // to allow seeing all assigned territories independently of the weekly program.

    window.startOnboarding = () => {
        if (mOnboard?.startOnboarding) mOnboard.startOnboarding();
        else showNotification("Módulo de guía no disponible.", "warning");
    };

    const getMonday = (d) => {
        d = new Date(d);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    };

    const getSafeDateId = UIHelpers.formatDateId;

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

        // Power Up: Pre-load resources for offline use
        if (window.precacheTerritoryResources) {
            window.precacheTerritoryResources(allTerritorios);
        }
    } catch (err) {
        console.error("Critical error loading dashboard data:", err);
        agendaContainer.innerHTML = '<div class="col-span-full py-10 text-center"><p class="text-red-500 font-bold">Error de conexión al cargar datos.</p></div>';
        if (territoriosContainer) territoriosContainer.innerHTML = '';
        return;
    }

    const territoryMap = {};
    if (allTerritorios) allTerritorios.forEach(t => territoryMap[t.numero] = t);

    const normalizedName = name?.trim().toLowerCase();
    const turnosArr = ['manana', 'tarde', 'noche', 'zoom'];
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
                    const isConductor = tData.conductor?.trim().toLowerCase() === normalizedName;
                    const isAuxiliar = tData.auxiliar?.trim().toLowerCase() === normalizedName;

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
                        const matchesConductor = t.asignado_a?.trim().toLowerCase() === normalizedName;
                        const matchesAuxiliar = t.auxiliar?.trim().toLowerCase() === normalizedName;
                        return matchesConductor || matchesAuxiliar;
                    });

                    assignments.push({
                        dia: d.nombre,
                        turno: turno === 'manana' ? '🌅 Mañana' : (turno === 'tarde' ? '☀️ Tarde' : (turno === 'zoom' ? '📹 Zoom' : '🌙 Noche')),
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

    // myExtraTerritories will be handled in the Rescue Missions modal as requested by the user
    // to avoid the "EXTRAS" card in the main agenda.


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

        // --- FUSION POWER UP: RESCUE MISSIONS LOGIC (48h Atraso) ---
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const plannedDates = {};
        if (programa && programa.dias && programa.id) {
            const monday = new Date(programa.id + "T00:00:00");
            const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
            const shifts = ['manana', 'tarde', 'noche', 'zoom'];
            programa.dias.forEach(d => {
                const dayIdx = dayNames.indexOf(d.nombre);
                if (dayIdx === -1) return;
                const plD = new Date(monday);
                plD.setDate(monday.getDate() + dayIdx);
                plD.setHours(0, 0, 0, 0);
                shifts.forEach(s => {
                    if (d[s] && d[s].territorio) {
                        const nums = Array.from(new Set(String(d[s].territorio).split(/[,/]+/).map(n => n.trim()).filter(Boolean)));
                        nums.forEach(num => {
                            if (!plannedDates[num]) plannedDates[num] = new Set();
                            plannedDates[num].add(plD.getTime());
                        });
                    }
                });
            });
        }

        const myExtraMissions = allTerritorios.filter(t => {
            const matchesUser = t.asignado_a?.trim().toLowerCase() === normalizedName || t.auxiliar?.trim().toLowerCase() === normalizedName;
            const isOrphan = !shownTerritoryIds.has(t.id);
            const isActive = t.estado === 'Asignado' || t.estado === 'Pendiente';
            return matchesUser && isOrphan && isActive;
        });

        const rescueCandidates = allTerritorios.filter(t => {
            // Priority 1: High delay (Original Rescue logic)
            const timestamps = plannedDates[t.numero];
            const isDelayed = timestamps && Array.from(timestamps).some(ts => {
                const diff = Math.floor((now - new Date(ts)) / (1000 * 60 * 60 * 24));
                return diff >= 1;
            });
            const isAssignedToOther = (t.estado === 'Asignado' || t.estado === 'Pendiente') && t.asignado_a?.trim().toLowerCase() !== normalizedName;

            // Priority 2: Free territories (Bolsa de Trabajo)
            const isFree = t.estado === 'Libre' || t.estado === 'Disponible';

            // Priority 3: Incomplete markers
            const isIncomplete = t.is_incomplete === true;

            return isDelayed || isFree || isIncomplete;
        });

        // Sort: Incomplete territories at the top
        rescueCandidates.sort((a, b) => {
            if (a.is_incomplete && !b.is_incomplete) return -1;
            if (!a.is_incomplete && b.is_incomplete) return 1;
            // Then by number
            return (parseInt(a.numero) || 0) - (parseInt(b.numero) || 0);
        });

        const rescueCount = rescueCandidates.length;
        const totalMissionCount = rescueCount + myExtraMissions.length;


        if (mRescue?.renderRescueMissions) {
            mRescue.renderRescueMissions(allTerritorios, normalizedName, myExtraMissions, rescueCandidates, totalMissionCount);
        }

        intelligenceBadge.innerHTML = `
            <div class="flex flex-wrap items-center gap-3">
                <button onclick="window.showRescueMissionsModal()" 
                        class="flex items-center gap-3 ${totalMissionCount > 0 ? 'bg-indigo-600 border-indigo-500/20 shadow-indigo-600/20 text-white' : 'bg-white dark:bg-white/5 text-indigo-500 border-indigo-500/30'} py-3.5 px-6 rounded-2xl border text-[10px] font-black uppercase tracking-[0.15em] shadow-sm backdrop-blur-md hover:scale-105 active:scale-95 transition-all">
                    <i class="fas fa-map-marked-alt ${totalMissionCount > 0 ? 'animate-pulse' : ''}"></i> 
                    POR COMPLETAR ${totalMissionCount > 0 ? `<span class="bg-white text-indigo-600 px-2 py-0.5 rounded-lg ml-1 font-black">${totalMissionCount}</span>` : ''}
                </button>
            </div>
    `;


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
                            <button onclick="document.getElementById('modal-container').classList.add('hidden'); document.getElementById('modal-container').classList.remove('flex');" class="w-12 h-12 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-2xl transition-all flex items-center justify-center text-lg active:scale-95">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div class="flex-1 overflow-hidden rounded-[2.5rem] bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 flex items-center justify-center relative touch-none shadow-inner" id="png-zoom-container">
                        <img id="global-png-map" src="assets/mapa-general.jpg" class="max-w-full max-h-full object-contain transition-all duration-200 ease-out shadow-2xl origin-center" style="transform: scale(1) translate(0px, 0px);">
                        
                         <!-- Dynamic Controls -->
                        <div class="absolute bottom-10 right-10 flex flex-col gap-3 z-50">
                            <button id="btn-global-zoom-in" class="w-12 h-12 rounded-2xl bg-white/95 dark:bg-[#1a1c2a]/95 backdrop-blur shadow-2xl text-primary font-black border border-slate-200 dark:border-white/10 flex items-center justify-center hover:scale-110 active:scale-90 transition-all">
                                <i class="fas fa-plus"></i>
                            </button>
                            <button id="btn-global-zoom-out" class="w-12 h-12 rounded-2xl bg-white/95 dark:bg-[#1a1c2a]/95 backdrop-blur shadow-2xl text-primary font-black border border-slate-200 dark:border-white/10 flex items-center justify-center hover:scale-110 active:scale-90 transition-all">
                                <i class="fas fa-minus"></i>
                            </button>
                            <button id="btn-global-zoom-reset" class="w-12 h-12 rounded-2xl bg-primary text-white shadow-2xl flex items-center justify-center hover:scale-110 active:scale-90 transition-all group">
                                <i class="fas fa-undo-alt group-hover:rotate-[-45deg] transition-transform"></i>
                            </button>
                        </div>
                    </div>
                </div>
    `;
                // Initialize Pan and Zoom logic
                modal.classList.add('flex');
                setTimeout(() => {
                    panZoomController = UIHelpers.initImagePanZoom('global-png-map', 'png-zoom-container');
                    if (panZoomController) {
                        modal.querySelector('#btn-global-zoom-in').onclick = () => panZoomController.zoom(0.3);
                        modal.querySelector('#btn-global-zoom-out').onclick = () => panZoomController.zoom(-0.3);
                        modal.querySelector('#btn-global-zoom-reset').onclick = () => panZoomController.reset();
                    }
                }, 100);
            } else if (type === 'satellite') {
                modal.innerHTML = '<div id="global-map-root" class="w-full h-full max-w-6xl mx-auto p-4 md:p-10"></div>';
                MapViewer.renderGlobal(document.getElementById('global-map-root'), allTerritorios);
            }
        };

        let panZoomController = null;




        if (!hasShifts) {
            agendaContainer.innerHTML = `
                <div class="col-span-full py-16 sm:py-24 px-6 sm:px-8 modern-card text-center animate-fade-in shadow-2xl bg-white dark:bg-white/[0.02] border-slate-200 dark:border-white/5 opacity-60">
        <div class="flex flex-col items-center gap-6">
            <div class="w-24 h-24 bg-primary/10 rounded-[2.5rem] flex items-center justify-center text-5xl text-primary shadow-inner">
                <i class="fas fa-inbox"></i>
            </div>
            <div class="space-y-2">
                <h4 class="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tighter uppercase">Sin asignaciones activas</h4>
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
    <div class="group relative modern-card !p-5 sm:!p-6 transition-all duration-500 hover:shadow-2xl flex flex-col gap-6 shadow-sm border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900/40">
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

                <div class="flex flex-col flex-1 gap-6">
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
                                        <p class="text-[10px] font-black ${a.conductor?.trim().toLowerCase() === normalizedName ? 'text-teal-600' : 'text-slate-700 dark:text-slate-200'} leading-none">${a.conductor || '---'}</p>
                                    </div>
                                    <div class="space-y-0.5 text-left border-l-2 border-slate-100 dark:border-white/5 pl-3">
                                        <p class="text-[7px] font-black text-slate-400 uppercase tracking-widest opacity-70">Auxiliar</p>
                                        <p class="text-[10px] font-black ${a.auxiliar?.trim().toLowerCase() === normalizedName ? 'text-teal-600' : 'text-slate-700 dark:text-slate-200'} leading-none">${a.auxiliar || '---'}</p>
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
                                <div class="mt-auto pt-4">
                                    <button class="territory-report-btn w-full bg-slate-900 dark:bg-teal-600 shadow-xl hover:bg-black dark:hover:bg-teal-500 py-3.5 sm:py-4 rounded-2xl text-white font-black text-[10px] sm:text-[11px] uppercase tracking-[0.2em] sm:tracking-[0.3em] active:scale-95 transition-all flex items-center justify-center gap-3"
                                        data-ids="${a.attachedTerritories.map(t => t.id).join(',')}" 
                                        data-nums="${a.attachedTerritories.map(t => t.numero).join(',')}">
                                        <i class="fas fa-file-signature text-[12px] opacity-70"></i>
                                        Informar
                                    </button>
                                </div>
                                `}
                            </div>` : `
                            <div class="px-5 py-6 bg-slate-50 dark:bg-white/[0.03] rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-white/10 animate-fade-in group/empty-shift shadow-inner relative overflow-hidden text-center">
                                <div class="absolute inset-0 bg-primary/5 opacity-0 group-hover/empty-shift:opacity-100 transition-opacity pointer-events-none"></div>
                                <div class="flex flex-col items-center gap-3 relative z-10">
                                    <div class="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center text-primary text-lg shadow-sm group-hover/empty-shift:scale-110 transition-transform duration-500">
                                        <i class="fas fa-bullhorn"></i>
                                    </div>
                                    <div>
                                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5 opacity-60">Actividad Planeada</p>
                                        <p class="text-[14px] font-black text-primary uppercase tracking-tight">${a.faceta || 'Predicación General'}</p>
                                    </div>
                                </div>
                            </div>
                            `}
                            
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
            mAvail.renderAvailabilitySection(document.getElementById('availability-container'), name);
        }
        if (userRole !== 'Administrador' && userRole !== 'SuperAdmin' && userMods.agenda !== false) {
            renderAISection(name);
        }
        if (userMods.ayudas !== false) {
            mRec.renderRecursosSection(document.getElementById('recursos-container'));
        }

        if (userMods.mapas !== false) {
            mMaps.renderMapsExplorer(container, allTerritorios, (t) => window.openInteractiveMap(t));
        }

        // Module: Programa Semanal (Global)
        if (userMods.programa !== false && mProg.initializeWeeklyProgram) {
            mProg.initializeWeeklyProgram(container, userMods, allTerritorios, territoryMap, name, currentWeekStart, activeDayIndex, activeTurns);
        }

        window.openTerritorySelector = (dayIndex, turnId, btnElement) => {
            if (!btnElement || !window._globalPrograma) return;

            // Extract all territories already in this week's program to highlight them
            const weekAssignments = [];
            if (window._globalPrograma.dias) {
                window._globalPrograma.dias.forEach(d => {
                    ['manana', 'tarde', 'noche', 'zoom'].forEach(turn => {
                        const tStr = d[turn]?.territorio;
                        if (tStr) {
                            const parts = tStr.split(/[,;/]+/).map(p => p.trim()).filter(Boolean);
                            parts.forEach(p => {
                                const num = p.replace(/\(.*\)/, '').trim();
                                if (num) weekAssignments.push(num);
                            });
                        }
                    });
                });
            }

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
            }, 'modal-container', null, weekAssignments); // Pass weekAssignments as 6th param
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
                const programCardsContainer = container.querySelector('#weekly-program-cards');
                if (programCardsContainer && mProg.renderFullProgramaCards) {
                    mProg.renderFullProgramaCards(window._globalPrograma, programCardsContainer, territoryMap, name, activeDayIndex, activeTurns);
                }

                showNotification("Asignación sincronizada exitosamente", "success");
            } catch (e) {
                console.error("Update error:", e);
                showNotification("Error al guardar revisión", "error");
            }
        };
    }
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
                                            ${Array.from(new Set(String(sData.territorio).split(/[,/]/).map(t => t.trim()).filter(Boolean))).map(t => `<span class="px-2 py-1 bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 rounded-lg text-[9px] font-black border border-slate-200 dark:border-white/5 uppercase tracking-widest">${t}</span>`).join('')}
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
        <div class="flex flex-col h-full bg-slate-50 dark:bg-[#0b0e14] sm:rounded-[2rem] overflow-hidden">
            <header class="shrink-0 bg-white dark:bg-slate-900 p-6 relative overflow-hidden shadow-sm dark:shadow-2xl border-b border-slate-100 dark:border-white/5">
                <div class="absolute inset-0 bg-gradient-to-br from-primary/5 to-indigo-500/5 dark:from-primary dark:to-primary-dark opacity-100 dark:opacity-100 transition-opacity"></div>
                <div class="relative z-10 flex items-center justify-between">
                    <div class="flex items-center gap-5">
                        <div class="w-12 h-12 bg-primary/10 dark:bg-white/10 backdrop-blur-xl rounded-xl flex items-center justify-center text-xl text-primary dark:text-white border border-primary/20 dark:border-white/20 shadow-inner">
                            <i class="fas fa-chart-line animate-float"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-black text-slate-800 dark:text-white tracking-tighter uppercase leading-none mb-1">Informe de Actividad</h3>
                            <p class="text-[9px] text-slate-500 dark:text-white/60 uppercase tracking-[0.4em] font-black">Registro de Territorios Asignados</p>
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
                                        <span class="text-[8px] font-black uppercase tracking-widest text-slate-500 group-[.active]:text-emerald-600 dark:group-[.active]:text-emerald-400 group-[.active]:opacity-100 opacity-60">Completo</span>
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
                             <label class="text-[9px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-widest ml-1">Fecha en que se completó</label>
                             <input type="date" id="bulk-return-date" value="${todayStr}" class="w-full bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-2xl p-4 text-xs font-black outline-none focus:ring-4 focus:ring-teal-500/10 transition-all text-slate-800 dark:text-white">
                        </div>
                    </div>

                    <!-- Voice Command Hint -->
                    <button id="btn-none-today" class="w-full py-2 text-rose-500 dark:text-rose-400 font-black text-[9px] uppercase tracking-[0.3em] hover:opacity-70 transition-opacity">No se pudo predicar nada hoy</button>
                </div>
            </div>

            <div class="shrink-0 p-6 border-t border-black/5 dark:border-white/5 bg-white dark:bg-[#0b0e14] z-20">
                <button id="confirm-all-reports" class="w-full group relative overflow-hidden bg-gradient-to-r from-teal-600 to-emerald-700 py-4 rounded-2xl text-white font-black shadow-xl shadow-teal-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-[0.2em] text-xs">
                    <span class="relative z-10">Confirmar como Completado</span>
                    <div class="absolute inset-0 bg-white/10 translate-x-full group-hover:translate-x-0 transition-transform duration-500"></div>
                </button>
            </div>
        </div>
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
                    window.closeModal();
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
                    const tNotes = modal.querySelector(`.territory - notes[data - tid="${tid}"]`)?.value || '';
                    const pGrid = modal.querySelector(`.photos - grid[data - tid="${tid}"]`);
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
                            showNotification(`No seleccionaste manzanas para T - ${t.numero} `, "warning");
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
                window.closeModal();
                if (window.refreshConductorView) await window.refreshConductorView();

            } catch (err) {
                console.error(err);
                showCustomAlert("Error al procesar: " + err.message);
                e.target.disabled = false;
                e.target.innerHTML = "Confirmar como Completado";
            }
        };
    });
};



/* --- AI / INTELLIGENCE --- */
/* --- AI / INTELLIGENCE --- */
async function renderAISection(name) {
    const config = await getConfiguracion();
    if (!config.gemini_key) return;

    const [telefonos, publicadores, territorios, programa, pois] = await Promise.all([
        getTelefonos(), getPublicadores(), getTerritorios(), getProgramaSemanal(), getPuntosInteres()
    ]);

    const brain = new TerritoryIntelligence(telefonos, publicadores, territorios, programa, null, pois);

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
        <div id="ai-speech-bubble" class="fixed bottom-36 right-6 z-40 max-w-[220px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl text-slate-800 dark:text-white p-5 rounded-[2rem] rounded-br-none shadow-2xl border border-primary/20 opacity-0 pointer-events-none translate-y-4 transition-all duration-500">
            <p class="text-[10px] font-black uppercase tracking-widest leading-none mb-1 opacity-50">Sugerencia IA</p>
            <p class="text-[13px] font-black leading-tight" id="ai-bubble-text">¿Te digo por donde empezar?</p>
            <div class="absolute bottom-[-10px] right-0 w-0 h-0 border-l-[12px] border-l-transparent border-t-[12px] border-t-white/95 dark:border-t-slate-900/95 transition-all"></div>
        </div>

        <button id="ai-fab" class="fixed bottom-12 right-12 z-40 bg-slate-900 dark:bg-primary text-white rounded-full p-5 shadow-2xl border border-white/20 transition-all hover:scale-110 active:scale-95 group overflow-hidden">
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

        const isOffline = !navigator.onLine;

        log.innerHTML += `<div class="flex justify-end"><div class="bg-purple-600 text-white px-4 py-3 rounded-3xl rounded-tr-none text-xs max-w-[85%] font-medium shadow-lg">${prompt}</div></div>`;
        log.scrollTop = log.scrollHeight;
        input.value = '';
        input.disabled = true;

        try {
            const loadingId = 'loading-' + Date.now();
            const loadingMsg = isOffline ? '📴 Guardando en cola...' : '🧠 Procesando...';
            log.innerHTML += `<div id="${loadingId}" class="flex items-center gap-2 text-purple-400 text-[10px] font-black uppercase tracking-widest"><span class="animate-ping">${isOffline ? '💾' : '🧠'}</span> ${loadingMsg}</div>`;
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

    // --- POWER UP: AI SYNC ON ONLINE ---
    window.addEventListener('online', async () => {
        if (!config.gemini_key) return;
        const count = brain.getOfflineQueueCount();
        if (count > 0) {
            showNotification(`🛰️ Sincronizando ${count} consultas con el Cerebro IA...`, "info");
            await brain.processOfflineQueue(config.gemini_key, (q, r) => {
                const safeResponse = r.replace(/\|\|.*?\|\|/g, '');
                const htmlResponse = safeResponse.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
                log.innerHTML += `
                        <div class="flex justify-start opacity-70 border-l-2 border-primary pl-4">
                            <div class="bg-primary/5 dark:bg-primary/10 text-slate-500 dark:text-gray-400 px-5 py-4 rounded-3xl text-[11px] max-w-[90%]">
                                <p class="text-[8px] font-black uppercase mb-1">Respuesta Diferida a: "${q}"</p>
                                ${htmlResponse}
                            </div>
                        </div>`;
                log.scrollTop = log.scrollHeight;
            });
            showNotification("🤖 Cerebro IA actualizado.", "success");
        }
    });

    sendBtn.addEventListener('click', handleSend);
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSend(); });
}


/** --- RESCUE MODE (Ayudas) --- **/


// Fusion logic completed. Rescue missions moved to top badge.


window.handleRescueTerritory = async (id, num, newConductor, manzanasStr, isFree = false) => {
    const manzanas = manzanasStr ? manzanasStr.split(',').map(m => m.trim()).filter(Boolean) : [];
    let selectedManzanas = [...manzanas];

    // --- PARTIAL SELECTION LOGIC ---
    if (manzanas.length > 1) {
        const result = await new Promise(resolve => {
            const modal = document.getElementById('modal-container');
            modal.innerHTML = `
                <div class="modal-body max-w-md w-full animate-bounce-in fixed bottom-0 sm:bottom-auto sm:relative left-0 right-0 sm:left-auto sm:right-auto sm:m-4">
                    <div class="glass-morphism bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl p-10 rounded-[3rem] border border-white/20 dark:border-white/5 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)]">
                        <div class="w-20 h-20 bg-primary/10 rounded-[2rem] flex items-center justify-center text-4xl text-primary mx-auto mb-8 shadow-inner border border-primary/10">
                            <i class="fas fa-map-marked-alt"></i>
                        </div>
                        <h3 class="text-2xl font-black text-slate-800 dark:text-white mb-2 uppercase tracking-tight text-center">Seleccionar Alcance</h3>
                        <p class="text-[10px] text-slate-500 text-center mb-8 font-black uppercase tracking-widest italic">T-${num}: ${manzanas.length} Manzanas disponibles</p>
                        
                        <div class="space-y-3 mb-8 max-h-[250px] overflow-y-auto px-2 custom-scrollbar">
                            ${manzanas.map(m => `
                                <label class="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 cursor-pointer hover:border-primary/30 transition-all group">
                                    <span class="text-sm font-bold text-slate-700 dark:text-slate-200">Manzana ${m}</span>
                                    <input type="checkbox" checked value="${m}" class="rescue-mz-check w-5 h-5 rounded-lg border-2 border-slate-300 dark:border-white/10 text-primary focus:ring-primary transition-all cursor-pointer">
                                </label>
                            `).join('')}
                        </div>

                        <div class="flex flex-col gap-3">
                            <button id="rescue-confirm-partial" class="w-full py-5 text-[10px] font-black uppercase tracking-[0.3em] text-white bg-primary rounded-[2rem] shadow-xl shadow-primary/30 hover:bg-primary-dark transition-all hover:scale-105 active:scale-95">Tomar Selección</button>
                            <button id="rescue-confirm-all" class="w-full py-4 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-primary transition-colors">Tomar Todo el Territorio</button>
                            <button id="rescue-cancel-partial" class="w-full py-4 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-red-500 transition-colors">Regresar</button>
                        </div>
                    </div>
                </div>
                `;
            modal.classList.remove('hidden');
            document.getElementById('rescue-cancel-partial').onclick = () => { modal.classList.add('hidden'); resolve(null); };
            document.getElementById('rescue-confirm-all').onclick = () => { modal.classList.add('hidden'); resolve([...manzanas]); };
            document.getElementById('rescue-confirm-partial').onclick = () => {
                const checks = modal.querySelectorAll('.rescue-mz-check:checked');
                const picked = Array.from(checks).map(c => c.value);
                modal.classList.add('hidden');
                resolve(picked.length > 0 ? picked : null);
            };
        });
        if (!result) return;
        selectedManzanas = result;
    } else {
        // Confirmation Modal for Single Apple or Full
        const ok = await new Promise(resolve => {
            const modal = document.getElementById('modal-container');
            const verb = isFree ? 'TOMAR' : 'RESCATAR';
            const actionText = isFree ? 'Iniciar Predicación' : 'Asumir Ayuda';
            const color = isFree ? 'teal' : 'rose';
            const icon = isFree ? 'fa-box-open' : 'fa-ambulance';

            modal.innerHTML = `
                <div class="modal-body max-w-sm w-full animate-bounce-in fixed bottom-0 sm:bottom-auto sm:relative left-0 right-0 sm:left-auto sm:right-auto sm:m-4">
                    <div class="glass-morphism bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl p-10 rounded-[3rem] text-center border border-white/20 dark:border-white/5 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)]">
                        <div class="w-24 h-24 bg-${color}-500/10 rounded-[2.5rem] flex items-center justify-center text-5xl text-${color}-600 mx-auto mb-8 shadow-inner border border-${color}-500/10 animate-float">
                            <i class="fas ${icon}"></i>
                        </div>
                        <h3 class="text-3xl font-black text-slate-800 dark:text-white mb-4 uppercase tracking-tighter">¿${verb}?</h3>
                        <p class="text-[13px] text-slate-500 dark:text-slate-400 mb-10 leading-relaxed font-bold">
                            Vas a tomar el territorio <span class="bg-${color}-500/10 text-${color}-600 px-2 py-0.5 rounded-lg">T-${num}</span> (${manzanas.join(', ') || 'Todo'}).
                        </p>
                        <div class="flex flex-col gap-3">
                            <button id="rescue-confirm" class="w-full py-5 text-[10px] font-black uppercase tracking-[0.3em] text-white bg-${color}-600 rounded-[2rem] shadow-xl shadow-${color}-500/30 hover:bg-${color}-500 transition-all hover:scale-105 active:scale-95">SÍ, ${actionText.toUpperCase()}</button>
                            <button id="rescue-cancel" class="w-full py-5 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-slate-600 transition-colors">Volver</button>
                        </div>
                    </div>
                </div>
                `;
            modal.classList.remove('hidden');
            document.getElementById('rescue-cancel').onclick = () => { modal.classList.add('hidden'); resolve(false); };
            document.getElementById('rescue-confirm').onclick = () => { modal.classList.add('hidden'); resolve(true); };
        });
        if (!ok) return;
    }

    try {
        showNotification("Procesando...", "info");

        if (selectedManzanas.length === manzanas.length) {
            // Take FULL
            if (isFree) {
                await assignFreeTerritory(id, newConductor, num, selectedManzanas.join(', '));
            } else {
                await transferTerritory(id, newConductor, selectedManzanas.join(', '));
            }
        } else {
            // Take PARTIAL
            const remaining = manzanas.filter(m => !selectedManzanas.includes(m));
            await takeTerritoryPartial(id, newConductor, selectedManzanas, remaining);
        }

        showNotification(`¡Éxito! El territorio #${num} ha sido actualizado en tu agenda.`, "success");
        if (window.refreshConductorView) {
            await window.refreshConductorView();
        } else {
            location.reload();
        }
    } catch (err) {
        console.error(err);
        showNotification("Error: " + err.message, "error");
    }
};






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
        `, async (modal) => {
            const pois = await getPuntosInteres();
            const brain = new TerritoryIntelligence(null, null, allT, null, null, pois);

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

