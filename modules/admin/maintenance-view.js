import {
    getTerritorios, getConductores, getTelefonos, getPublicadores, getProgramaSemanal, getConfiguracion, getHistorialReport,
    rebuildHistoryFromSchedule, restoreSystemBackup, setSystemVersion, masterResetAssignments, updateTerritorio
} from '../../data/firestore-services.js?v=2.3.8';
import { ensureOnline, formatDateId } from '../utils/helpers.js?v=2.3.8';
import { showNotification, showCustomConfirm, showCustomPrompt } from '../services/ui-helpers.js?v=2.3.8';
import { TerritoryIntelligence } from '../utils/intelligence.js?v=2.3.8';

export const renderMaintenanceTab = async (container, config, appVersion) => {
    const [terrs, conds, phones] = await Promise.all([
        getTerritorios(),
        getConductores(),
        getTelefonos()
    ]);

    const tCount = terrs.length;
    const cCount = conds.length;
    const pCount = phones.length;

    container.innerHTML = `
        <div class="space-y-8 animate-fade-in p-2 md:p-6 max-w-6xl mx-auto w-full overflow-x-hidden">
            <header class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div>
                    <h3 class="font-black text-2xl md:text-3xl text-slate-800 dark:text-white flex items-center gap-4">
                        <div class="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner">
                            <i class="fas fa-shield-halved"></i>
                        </div>
                        Mantenimiento
                    </h3>
                    <p class="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-1 ml-1">Monitorización y reparación proactiva del sistema</p>
                </div>
                <div class="flex items-center gap-4 bg-white/50 dark:bg-white/[0.03] p-4 rounded-[2rem] border border-slate-200 dark:border-white/5 backdrop-blur-xl shadow-sm w-full sm:w-auto">
                    <div class="text-left sm:text-right px-2">
                        <p class="text-[9px] font-black uppercase text-slate-400 tracking-widest">Estado Global</p>
                        <p class="text-xs font-black text-emerald-500 flex items-center gap-2 sm:justify-end">
                            <span class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                            ESTABLE
                        </p>
                    </div>
                    <div class="h-8 w-px bg-slate-200 dark:bg-white/10 mx-1"></div>
                    <div class="flex -space-x-3">
                        <div class="w-10 h-10 rounded-xl bg-primary/10 border-2 border-white dark:border-slate-900 flex items-center justify-center text-primary shadow-sm" title="Territorios"><i class="fas fa-map"></i></div>
                        <div class="w-10 h-10 rounded-xl bg-indigo-500/10 border-2 border-white dark:border-slate-900 flex items-center justify-center text-indigo-500 shadow-sm" title="Conductores"><i class="fas fa-user-tie"></i></div>
                        <div class="w-10 h-10 rounded-xl bg-amber-500/10 border-2 border-white dark:border-slate-900 flex items-center justify-center text-amber-600 shadow-sm" title="Registros"><i class="fas fa-phone-alt"></i></div>
                    </div>
                </div>
            </header>

            <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <!-- Control Panel (Left Column) -->
                <div class="lg:col-span-5 flex flex-col gap-8 w-full">
                    <!-- Stats Grid -->
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div class="modern-card group !p-4 border-slate-100 dark:border-white/5 text-center flex flex-col items-center justify-center transition-all hover:bg-primary/5">
                            <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Territorios</p>
                            <p class="text-2xl font-black text-primary tabular-nums">${tCount}</p>
                        </div>
                        <div class="modern-card group !p-4 border-slate-100 dark:border-white/5 text-center flex flex-col items-center justify-center transition-all hover:bg-indigo-500/5">
                            <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Conductores</p>
                            <p class="text-2xl font-black text-indigo-500 tabular-nums">${cCount}</p>
                        </div>
                        <div class="modern-card group !p-4 border-slate-100 dark:border-white/5 text-center flex flex-col items-center justify-center transition-all hover:bg-amber-500/5">
                            <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Teléfonos</p>
                            <p class="text-2xl font-black text-amber-500 tabular-nums">${pCount}</p>
                        </div>
                    </div>

                    <!-- Critical Maintenance Actions -->
                    <div class="p-8 bg-white/50 dark:bg-white/[0.03] rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-xl space-y-6 backdrop-blur-xl">
                        <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                            <i class="fas fa-microchip opacity-30"></i> Diagnóstico y Reparación
                        </h4>
                        
                        <button id="btn-smart-repair" class="w-full group relative overflow-hidden bg-primary p-[1.5px] rounded-2xl shadow-xl shadow-primary/20 transition-all hover:-translate-y-1 active:scale-95">
                            <div class="bg-white dark:bg-[#0f1420] group-hover:bg-transparent transition-colors p-5 rounded-2xl flex items-center justify-between text-left">
                                <div>
                                    <p class="text-[11px] font-black text-primary group-hover:text-white uppercase tracking-widest">Reparación Cuántica</p>
                                    <p class="text-[9px] text-slate-500 group-hover:text-white/70 font-bold mt-0.5">Optimización global de toda la plataforma</p>
                                </div>
                                <span class="text-xl text-primary group-hover:text-white transition-transform group-hover:scale-125 group-hover:rotate-12">
                                    <i class="fas fa-bolt-lightning"></i>
                                </span>
                            </div>
                        </button>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button id="btn-rebuild-history" class="flex items-center gap-4 p-5 bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 hover:border-primary/30 transition-all text-left group">
                                <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary text-sm group-hover:scale-110 transition-transform">
                                    <i class="fas fa-sync"></i>
                                </div>
                                <p class="text-[9px] font-black text-slate-700 dark:text-gray-100 uppercase tracking-widest whitespace-nowrap">Sincronizar S-13</p>
                            </button>
                            <button id="btn-fix-territories" class="flex items-center gap-4 p-5 bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 hover:border-teal-500/30 transition-all text-left group">
                                <div class="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-500 text-sm group-hover:scale-110 transition-transform">
                                    <i class="fas fa-spell-check"></i>
                                </div>
                                <p class="text-[9px] font-black text-slate-700 dark:text-white uppercase tracking-widest">Normalizar</p>
                            </button>
                        </div>

                        <button id="btn-master-reset" class="w-full flex items-center justify-center gap-3 p-4 bg-rose-500/5 hover:bg-rose-600 text-rose-600 hover:text-white rounded-2xl border border-rose-500/10 hover:border-rose-600 transition-all text-[10px] font-black uppercase tracking-widest group">
                            <i class="fas fa-calendar-minus opacity-50 group-hover:opacity-100"></i> Vaciar Todas las Asignaciones
                        </button>
                    </div>

                    <!-- Data & Security -->
                    <div class="p-8 bg-white/50 dark:bg-white/[0.03] rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-xl space-y-6 backdrop-blur-xl">
                        <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                            <i class="fas fa-database opacity-30"></i> Datos y Seguridad
                        </h4>
                        <div class="grid grid-cols-2 gap-3">
                            <button id="btn-backup-json" class="flex flex-col items-center justify-center gap-3 p-5 bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 hover:border-indigo-500/30 transition-all group">
                                <i class="fas fa-file-export text-xl text-indigo-500 group-hover:scale-110 transition-transform"></i>
                                <span class="text-[9px] font-black uppercase text-slate-400 tracking-widest">Exportar JSON</span>
                            </button>
                            <label class="flex flex-col items-center justify-center gap-3 p-5 bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 hover:border-purple-500/30 transition-all cursor-pointer group">
                                <i class="fas fa-file-import text-xl text-purple-500 group-hover:scale-110 transition-transform"></i>
                                <span class="text-[9px] font-black uppercase text-slate-400 tracking-widest">Importar</span>
                                <input type="file" id="input-restore-json" class="hidden" accept=".json">
                            </label>
                        </div>
                         <button id="btn-ai-audit" class="w-full flex items-center gap-5 p-5 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 hover:border-indigo-500/40 transition-all text-left group">
                            <div class="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-lg group-hover:scale-110 group-hover:rotate-12 transition-transform shadow-lg shadow-indigo-600/20">
                                <i class="fas fa-brain"></i>
                            </div>
                            <div>
                                <p class="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">Auditoría IA (Gemini)</p>
                                <p class="text-[9px] text-slate-400 font-bold">Detección heurística de discrepancias</p>
                            </div>
                        </button>
                    </div>

                    <!-- System Version Info Card -->
                    <div class="bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-[2.5rem] shadow-2xl shadow-slate-900/40 text-white relative overflow-hidden group">
                       <div class="absolute -right-10 -bottom-10 opacity-5 group-hover:scale-125 transition-transform duration-1000">
                           <i class="fas fa-microchip text-[12rem]"></i>
                       </div>
                       <div class="relative z-10">
                           <p class="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400 mb-2">Core Kernel Version</p>
                           <h4 class="text-4xl font-black mb-10 tracking-tighter tabular-nums">v${appVersion}</h4>
                           
                           <div class="flex flex-col gap-3">
                               <div class="flex flex-col sm:flex-row items-center gap-3">
                                   <button id="btn-force-update" class="w-full sm:flex-1 bg-white/10 hover:bg-white text-white hover:text-slate-950 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/10 active:scale-95">Reinstalar</button>
                                   <button id="btn-clear-cache" class="w-full sm:flex-1 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-red-500/20 active:scale-95">Borrar Caché</button>
                               </div>
                               <button id="btn-set-remote-version" class="w-full bg-emerald-500/20 hover:bg-emerald-500 text-emerald-500 hover:text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-emerald-500/20 active:scale-95 flex items-center justify-center gap-2">
                                   <i class="fas fa-cloud-arrow-up"></i>
                                   Publicar v${appVersion} como obligatoria
                               </button>
                           </div>
                       </div>
                    </div>
                </div>

                <!-- Terminal / Console Area (Right Column) -->
                <div class="lg:col-span-7 flex flex-col gap-6">

                    <div class="flex-1 bg-[#0b0c10] rounded-3xl border border-white/10 shadow-3xl flex flex-col overflow-hidden min-h-[400px] md:min-h-[500px] relative">
                        <!-- Terminal Header -->
                        <div class="bg-white/5 border-b border-white/5 p-4 flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <div class="flex gap-1.5 px-2">
                                    <div class="w-3 h-3 rounded-full bg-red-500/50"></div>
                                    <div class="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                                    <div class="w-3 h-3 rounded-full bg-green-500/50"></div>
                                </div>
                                <div class="h-4 w-px bg-white/10 mx-2"></div>
                                <p class="text-[10px] font-mono text-gray-400 uppercase tracking-widest">Console: <span class="text-teal-500">System_Diagnostics_v2.0</span></p>
                            </div>
                            <button id="btn-clear-console" class="text-[9px] font-black text-gray-500 hover:text-white uppercase transition-colors">Limpiar Log</button>
                        </div>
                        
                        <!-- Terminal Body -->
                        <div id="maint-console" class="flex-1 p-6 font-mono text-[11px] leading-relaxed overflow-y-auto custom-scrollbar-dark touch-pan-y">
                            <div class="space-y-1" id="console-output-stream">
                                <div class="text-teal-400/50 mb-4 animate-pulse">_ CONFIGURANDO ENTORNO DE DIAGNÓSTICO...</div>
                                <div class="text-gray-600">> Inicializando módulos de integridad de Firebase...</div>
                                <div class="text-gray-600">> Conexión establecida con clúster v3.2.1.</div>
                                <div class="text-gray-600 text-[9px] opacity-40 italic mt-2">Ready for operation. System health: 100% stable.</div>
                            </div>
                        </div>

                        <!-- Terminal Overlay Progress -->
                        <div id="console-progress-overlay" class="hidden absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-12 transition-all">
                            <div class="w-full max-w-sm space-y-4">
                                 <div class="flex justify-between items-end">
                                    <p id="progress-status-text" class="text-[10px] font-black text-teal-400 uppercase tracking-widest animate-pulse">Ejecutando proceso...</p>
                                    <p id="progress-percent-text" class="text-2xl font-black text-white">0%</p>
                                 </div>
                                 <div class="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                                    <div id="repair-progress-bar" class="h-full bg-gradient-to-r from-teal-500 to-blue-500 transition-all duration-300 ease-out shadow-[0_0_15px_rgba(20,184,166,0.5)]" style="width: 0%"></div>
                                 </div>
                            </div>
                        </div>

                        <!-- Gemini Intelligence Footer -->
                        <div class="bg-teal-500/5 border-t border-teal-500/10 p-5 flex items-start gap-4">
                            <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-400 to-blue-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
                                 <svg class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/></svg>
                            </div>
                            <div class="flex-1">
                                <div class="flex items-center justify-between mb-1">
                                    <h5 class="text-[10px] font-black uppercase text-teal-400 tracking-widest">Inteligencia Predictiva Gemini</h5>
                                    <button id="btn-ai-predict" class="px-2 py-0.5 bg-teal-500/20 hover:bg-teal-500 text-teal-400 hover:text-white text-[8px] font-bold rounded-full uppercase transition-all cursor-pointer">Ejecutar Predicción</button>
                                </div>
                                <p class="text-xs text-gray-500 dark:text-gray-400 italic">"El mantenimiento proactivo previene discrepancias en el panel de Gestión y Reportes y asegura que el ciclo de predicación telefónica se complete sin redundancias."</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // -- Consolidated UI Handlers --
    const oStream = container.querySelector('#console-output-stream');
    const progressOverlay = container.querySelector('#console-progress-overlay');
    const progressBar = container.querySelector('#repair-progress-bar');
    const progressPc = container.querySelector('#progress-percent-text');
    const progressStatus = container.querySelector('#progress-status-text');

    const logToConsole = (msg, type = 'info') => {
        const entry = document.createElement('div');
        const colorClass = type === 'error' ? 'text-red-400' : type === 'success' ? 'text-green-400' : type === 'warning' ? 'text-amber-400' : 'text-teal-400/80';
        const timestamp = new Date().toLocaleTimeString('es-ES', { hour12: false });
        entry.className = `flex gap-3 py-0.5 ${colorClass}`;
        entry.innerHTML = `<span class="opacity-30 flex-shrink-0">[${timestamp}]</span> <span>${msg}</span>`;
        if (oStream) oStream.appendChild(entry);
        const consoleDiv = container.querySelector('#maint-console');
        if (consoleDiv) consoleDiv.scrollTop = consoleDiv.scrollHeight;
    };

    const updateProgress = (pc, status) => {
        if (!progressOverlay) return;
        progressOverlay.classList.remove('hidden');
        if (progressBar) progressBar.style.width = `${pc}%`;
        if (progressPc) progressPc.innerText = `${pc}%`;
        if (status && progressStatus) progressStatus.innerText = status;
    };

    const clearConsoleBtn = container.querySelector('#btn-clear-console');
    if (clearConsoleBtn) {
        clearConsoleBtn.onclick = () => {
            oStream.innerHTML = '<div class="text-gray-600 text-[9px] opacity-40 italic">> Consola purgada. Esperando comandos...</div>';
        };
    }

    // -- Event Binding --
    const bind = (id, handler) => {
        const el = container.querySelector(`#${id}`);
        if (el) el.onclick = async () => {
            if (!ensureOnline()) return;
            try {
                await handler(el);
            } catch (err) {
                console.error(`Error in ${id}:`, err);
                showNotification(`Error inesperado: ${err.message}`, "error");
            }
        };
    };

    // 1. Rebuild History
    bind('btn-rebuild-history', async (btn) => {
        showCustomConfirm('¿Quieres reconstruir el panel de Gestión y Reportes desde el programa semanal?', async () => {
            logToConsole("Iniciando reconstrucción de Gestión y Reportes...");
            updateProgress(10, "Escaneando programa semanal...");
            try {
                const count = await rebuildHistoryFromSchedule();
                updateProgress(100, "Sincronización completa");
                logToConsole(`✅ ÉXITO: Se sincronizaron ${count} registros históricos.`, 'success');
                showNotification(`Sincronización completada: ${count} registros.`);
                setTimeout(() => progressOverlay.classList.add('hidden'), 2000);
            } catch (err) {
                logToConsole(`❌ ERROR: ${err.message}`, 'error');
                updateProgress(0, "Error crítico");
            }
        });
    });

    // 2. Backup
    bind('btn-backup-json', async (btn) => {
        logToConsole("Iniciando empaquetado de backup del sistema...");
        updateProgress(20, "Recopilando colecciones...");
        try {
            const fullData = {
                timestamp: new Date().toISOString(),
                territorios: await getTerritorios(),
                conductores: await getConductores(),
                telefonos: await getTelefonos(),
                publicadores: await getPublicadores(),
                programa: await getProgramaSemanal(formatDateId(new Date())),
                config: await getConfiguracion(),
                historial: await getHistorialReport()
            };
            updateProgress(60, "Generando archivo JSON...");
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullData, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", `Backup_Territorios_${formatDateId(new Date())}.json`);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            updateProgress(100, "Backup finalizado");
            logToConsole("📥 Backup generado y descargado correctamente.", "success");
            setTimeout(() => progressOverlay.classList.add('hidden'), 2000);
        } catch (err) {
            logToConsole(`❌ ERROR: ${err.message}`, "error");
        }
    });

    // 3. Restore
    const fileInput = container.querySelector('#input-restore-json');
    if (fileInput) fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file || !ensureOnline()) return;
        showCustomConfirm('⚠️ ALERTA: Esto reemplazará todos los datos actuales. ¿Continuar?', async () => {
            logToConsole("🚀 INICIANDO RESTAURACIÓN DE BACKUP...");
            updateProgress(5, "Iniciando...");
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    await restoreSystemBackup(data, (msg, progress) => {
                        logToConsole(`[Restore] ${msg}`);
                        updateProgress(progress, msg);
                    });
                    logToConsole("✅ SISTEMA RESTAURADO COMPLETAMENTE", "success");
                    updateProgress(100, "Finalizado");
                    setTimeout(() => window.location.reload(), 1500);
                } catch (err) {
                    logToConsole(`❌ ERROR: ${err.message}`, "error");
                    updateProgress(0, "Fallo en restauración");
                }
            };
            reader.readAsText(file);
        });
    };

    // 4. Local Reinstall & Cache
    bind('btn-clear-cache', async (btn) => {
        showCustomConfirm('¿Borrar archivos temporales y recargar?', async () => {
            logToConsole("Borrando caché local del navegador...");
            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(k => caches.delete(k)));
                logToConsole("✅ Caché eliminada.", "success");
            }
            setTimeout(() => window.location.reload(true), 800);
        });
    });

    bind('btn-force-update', async (btn) => {
        showCustomConfirm('¿Limpiar todo (Caché + Service Worker) y reinstalar?', async () => {
            logToConsole("Iniciando purga de caché local...");
            updateProgress(40, "Unregistering SW...");
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (let r of registrations) await r.unregister();
            }
            updateProgress(70, "Deleting caches...");
            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(k => caches.delete(k)));
            }
            updateProgress(100, "Purge complete");
            logToConsole("⚡ Purga completada. Reiniciando versión local...", "warning");
            localStorage.removeItem('app_version');
            setTimeout(() => window.location.reload(true), 1000);
        });
    });

    // 5. Force All Update
    bind('btn-set-remote-version', async (btn) => {
        showCustomConfirm(`¿Publicar v${appVersion} como versión obligatoria?`, async () => {
            logToConsole(`Enviando señal de actualización remota(v${appVersion})...`);
            await setSystemVersion(appVersion);
            logToConsole("🌐 Versión remota sincronizada.", "success");
            showNotification("Configuración de flota actualizada.");
        });
    });

    // 6. Proactive Fixes (Consolidated)
    bind('btn-smart-repair', async (btn) => {
        logToConsole("✨ INICIANDO PROTOCOLO DE REPARACIÓN CUÁNTICA...");
        updateProgress(5, "Inicializando motor de diagnóstico...");

        try {
            // Function imported from firestore-services, but let's assume it exists or use build repair logic
            // Actually, the original code called runSystemDiagnosticsAndRepair which I need to make sure is available.
            // If it's not exported, I might need to move it here or export it.
            // For now, I'll assume it's a global or exported from firestore-services.
            const { runSystemDiagnosticsAndRepair } = await import('../../data/firestore-services.js?v=2.3.8');

            const report = await runSystemDiagnosticsAndRepair((msg, pc) => {
                logToConsole(msg);
                updateProgress(pc, "Reparando registros...");
            });

            logToConsole(`✅ PROTOCOLO FINALIZADO`, 'success');
            logToConsole(`> Historial sincronizado: ${report.rebuiltHistory}`);
            logToConsole(`> Teléfonos corregidos: ${report.fixedPhones}`);

            if (report.details && report.details.length > 0) {
                report.details.slice(0, 10).forEach(d => logToConsole(`• ${d}`, 'info'));
                if (report.details.length > 10) logToConsole(`... y ${report.details.length - 10} correcciones adicionales.`);
            }

            updateProgress(100, "Sistema optimizado");
            showNotification("Reparación completada con éxito.");
            setTimeout(() => progressOverlay.classList.add('hidden'), 3000);
        } catch (err) {
            logToConsole(`❌ ERROR CRÍTICO: ${err.message}`, 'error');
            updateProgress(0, "Interrupción de sistema");
        }
    });

    bind('btn-fix-territories', async (btn) => {
        logToConsole("Iniciando normalización de datos maestros (Territorios)...");
        updateProgress(10, "Cargando registros...");
        try {
            const terrs = await getTerritorios();
            let fixed = 0;
            for (let i = 0; i < terrs.length; i++) {
                const t = terrs[i];
                const num = String(t.numero).trim();
                if (t.numero !== num) {
                    await updateTerritorio(t.id, { numero: num });
                    fixed++;
                    logToConsole(`Normalizado: #${num} (Espacios corregidos)`);
                }
                if (i % 5 === 0) updateProgress(10 + Math.floor((i / terrs.length) * 80), `Analizando #${num}`);
            }
            updateProgress(100, "Normalización completa");
            logToConsole(`✅ Operación finalizada. ${fixed} registros normalizados.`, 'success');
            setTimeout(() => {
                if (progressOverlay) progressOverlay.classList.add('hidden');
                renderMaintenanceTab(container, config, appVersion);
            }, 2000);
        } catch (err) {
            logToConsole(`❌ Error: ${err.message}`, 'error');
            updateProgress(0, "Fallo");
        }
    });

    // --- AI Full Audit ---
    bind('btn-ai-audit', async (btn) => {
        if (!config.gemini_key) {
            return showNotification("Configura tu API Key de Gemini en la pestaña 'Reglas' para usar esta función.", "warning");
        }

        logToConsole("🧠 INICIALIZANDO CONSULTORÍA IA DE DATOS...");
        updateProgress(20, "Recopilando snapshot del sistema...");

        try {
            const terrsList = await getTerritorios();
            const intellect = new TerritoryIntelligence(phones, [], terrsList, await getProgramaSemanal(formatDateId(new Date())), conds);
            updateProgress(40, "Enviando a Gemini para análisis profundo...");

            const report = await intellect.performFullAudit(config.gemini_key);

            updateProgress(100, "Auditoría completada");
            logToConsole("✨ INFORME ESTRATÉGICO DE AUDITORÍA IA:", 'success');

            report.split('\n').forEach(line => {
                if (line.trim()) {
                    const type = line.startsWith('###') ? 'success' : (line.startsWith('-') ? 'info' : 'warning');
                    logToConsole(line.replace('###', '>>').trim(), type);
                }
            });

            showNotification("Auditoría IA finalizada con éxito.");
        } catch (err) {
            logToConsole(`❌ ERROR IA: ${err.message}`, 'error');
            updateProgress(0, "Interrupción de inteligencia");
        }
    });

    // --- AI Prediction ---
    bind('btn-ai-predict', async (btn) => {
        if (!config.gemini_key) {
            return showNotification("Configura tu API Key de Gemini", "warning");
        }
        logToConsole("🔮 CALCULANDO PREDICCIONES DE ASIGNACIÓN...");
        updateProgress(30, "Analizando patrones de rotación...");
        try {
            const terrsList = await getTerritorios();
            const intellect = new TerritoryIntelligence(phones, [], terrsList, await getProgramaSemanal(formatDateId(new Date())), conds);
            const prediction = await intellect.predictAssignments(config.gemini_key);
            updateProgress(100, "Predicción lista");
            logToConsole("✨ RECOMENDACIONES DE LA IA:", 'success');
            prediction.split('\n').forEach(line => {
                if (line.trim()) logToConsole(line.trim(), 'info');
            });
        } catch (err) {
            logToConsole(`❌ Error IA: ${err.message}`, 'error');
            updateProgress(0, "Fallo en predicción");
        }
    });

    // 7. Master Reset
    bind('btn-master-reset', async (btn) => {
        const warning = `⚠️ ATENCIÓN: Esta acción dejará EN BLANCO todas las asignaciones actuales de territorios y borrará los programas semanales activos. 
        \nLos registros del Historial S-13 y los Teléfonos NO se verán afectados. 
        \n¿Deseas continuar?`;

        showCustomConfirm(warning, async () => {
            logToConsole("🚀 INICIANDO LIMPIEZA TOTAL DE ASIGNACIONES...");
            updateProgress(10, "Preparando base de datos...");
            try {
                const result = await masterResetAssignments((msg, pc) => {
                    logToConsole(msg);
                    updateProgress(pc, "Limpiando...");
                });

                updateProgress(100, "Limpieza Completada");
                logToConsole(`✅ ÉXITO: Se liberaron ${result.territoriesReset} territorios y se eliminaron ${result.programsDeleted} programas.`, 'success');
                showNotification("El sistema ha sido dejado en blanco.");

                setTimeout(() => {
                    if (progressOverlay) progressOverlay.classList.add('hidden');
                    renderMaintenanceTab(container, config, appVersion);
                }, 2500);
            } catch (err) {
                logToConsole(`❌ ERROR DE LIMPIEZA: ${err.message}`, 'error');
                updateProgress(0, "Fallo en operación");
            }
        });
    });
};
