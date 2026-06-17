// Xolvy Data Shield: Centrally defined normalization rule
export const normalize = (val) => String(val || '').trim().toLowerCase();
export const normalizeName = (val) => String(val || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim().toLowerCase();
export const normalizeRobust = normalizeName;
export const toTitleCase = (str) => {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

export const formatPhoneNumber = (numero) => {
    if (!numero) return '';
    const cleaned = numero.toString().replace(/\D/g, '');
    if (cleaned.length === 7) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    if (cleaned.length === 10) return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
    return numero;
};

export const getStatusColor = (status) => {
    const s = status || 'Sin asignar'; // Default fallback
    if (s === 'Contestaron') return 'text-green-600 dark:text-green-400';
    if (s === 'No contestan') return 'text-orange-600 dark:text-orange-400';
    if (s === 'No llamar') return 'text-red-600 dark:text-red-400';
    if (s === 'Colgaron') return 'text-gray-600 dark:text-gray-400';
    if (s === 'Revisita') return 'text-yellow-600 dark:text-yellow-400';
    if (s === 'Predicado') return 'text-teal-600 dark:text-teal-400';
    if (s === 'Suspendido') return 'text-orange-700 dark:text-orange-500';
    if (s === 'Testigo') return 'text-purple-600 dark:text-purple-400';
    if (s === 'Asignado') return 'text-teal-600 dark:text-teal-400';
    if (s === 'Pendiente' || s === 'Sin asignar') return 'text-gray-500 dark:text-gray-500';
    return 'text-slate-600 dark:text-slate-400';
};



export const showNotification = (message, type = 'success', duration = 5000, workflow = [], onUndo = null, onComplete = null, barClass = null) => {
    // 1. Text Optimization for glanceability
    let displayMessage = message;
    if (message.includes('Conexión Restablecida')) displayMessage = 'Sistema Sincronizado';
    if (message.includes('No hay más números')) displayMessage = 'Sin Números Libres';
    if (message.includes('¡Actualización Global Activada!')) displayMessage = 'Sincronizando Global';
    if (message.includes('Referencia guardada')) displayMessage = 'Referencia Guardada';
    if (message.includes('¡Importación exitosa!')) displayMessage = 'Datos Importados';
    if (message.includes('Sincronizando')) displayMessage = message.replace('Sincronizando ', 'Sinc: ');

    // Fallback truncation for very long ad-hoc messages
    if (displayMessage.length > 60) displayMessage = displayMessage.substring(0, 57) + '...';

    const isSync = type === 'sync' || message.includes('Sincronizando');
    const isPwa = type === 'pwa';

    // 2. HUD Containers
    const containerClass = (isSync || isPwa) 
        ? 'fixed top-6 left-1/2 -translate-x-1/2 z-[10001] flex flex-col items-center gap-4 pointer-events-none w-full max-w-md'
        : 'fixed bottom-6 right-6 z-[10000] flex flex-col items-end gap-3 pointer-events-none';
    const hudId = (isSync || isPwa) ? 'xolvy-notifications-top' : 'xolvy-notifications-hud';

    let hud = document.getElementById(hudId);
    if (!hud) {
        hud = document.createElement('div');
        hud.id = hudId;
        hud.className = containerClass;
        document.body.appendChild(hud);
    }

    // 3. Notification Card
    const card = document.createElement('div');
    const id = 'notif-' + Date.now();
    card.id = id;

    // Type Styling
    const styles = {
        success: { 
            bg: 'bg-white/90 dark:bg-slate-900/90 border-emerald-100/50 dark:border-emerald-500/10', 
            text: 'text-emerald-500 dark:text-emerald-400', 
            icon: 'fa-check', 
            label: 'ÉXITO',
            iconBg: 'bg-emerald-50 dark:bg-emerald-500/10'
        },
        error: { 
            bg: 'bg-white/90 dark:bg-slate-900/90 border-rose-100/50 dark:border-rose-500/10', 
            text: 'text-rose-500 dark:text-rose-400', 
            icon: 'fa-exclamation-triangle', 
            label: 'ERROR',
            iconBg: 'bg-rose-50 dark:bg-rose-500/10'
        },
        warning: { 
            bg: 'bg-white/90 dark:bg-slate-900/90 border-amber-100/50 dark:border-amber-500/10', 
            text: 'text-amber-500 dark:text-amber-400', 
            icon: 'fa-exclamation-circle', 
            label: 'AVISO',
            iconBg: 'bg-amber-50 dark:bg-amber-500/10'
        },
        info: { 
            bg: 'bg-white/90 dark:bg-slate-900/90 border-blue-100/50 dark:border-blue-500/10', 
            text: 'text-blue-500 dark:text-blue-400', 
            icon: 'fa-info-circle', 
            label: 'INFO',
            iconBg: 'bg-blue-50 dark:bg-blue-500/10'
        },
        sync: { 
            bg: 'bg-white/90 dark:bg-slate-900/90 border-indigo-100 dark:border-indigo-500/20', 
            text: 'text-indigo-600 dark:text-indigo-400', 
            icon: 'fa-sync-alt fa-spin-slow', 
            label: 'WORKFLOW',
            iconBg: 'bg-indigo-50 dark:bg-indigo-500/10'
        },
        pwa: { 
            bg: 'bg-indigo-600 dark:bg-indigo-500 border-indigo-700 dark:border-indigo-400 shadow-[0_15px_30px_rgba(79,70,229,0.35)]', 
            text: 'text-white', 
            icon: 'fa-cloud-download-alt', 
            label: 'PWA READY',
            iconBg: 'bg-white/20'
        }
    };

    const s = styles[isPwa ? 'pwa' : (isSync ? 'sync' : type)] || styles.success;

    // Workflow log rendering
    const workflowHTML = workflow.length > 0
        ? `<div class="mt-3 pt-3 border-t ${isSync ? 'border-indigo-500/10 dark:border-slate-800' : 'border-slate-100 dark:border-slate-800'} space-y-1.5">
             ${workflow.map(step => `
                <div class="flex items-center gap-2.5 opacity-75">
                    <span class="text-indigo-500 text-[10px]">▶</span>
                    <span class="text-[9px] font-bold ${isSync ? 'text-indigo-900/80 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400'} uppercase tracking-widest leading-none">${step}</span>
                </div>
             `).join('')}
           </div>`
        : '';

    // Undo/Cancel Action HUD
    const undoLabel = onComplete ? 'Cancelar' : 'Deshacer';
    const activeBarClass = barClass || s.text.replace('text-', 'bg-');
    const undoHTML = onUndo || onComplete ? `
        <div class="mt-4 flex items-center justify-between gap-4">
             <div class="flex-1 min-w-0 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                 <div id="notif-progress-${id}" class="h-full ${activeBarClass} w-full transition-all ease-linear" style="transition-duration: ${duration}ms"></div>
             </div>
             <button id="notif-undo-${id}" class="px-5 py-2 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-[9px] font-black uppercase tracking-widest ${s.text} shadow-sm hover:scale-105 active:scale-95 transition-all">
                <i class="fas ${onComplete ? 'fa-times' : 'fa-undo-alt'} mr-1.5"></i> ${undoLabel}
             </button>
        </div>
    ` : '';

    const animationClass = (isSync || isPwa) ? 'animate-slide-down' : 'animate-slide-left';
    card.className = `${s.bg} border backdrop-blur-xl px-6 py-4.5 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.55)] flex flex-col gap-1.5 ${animationClass} pointer-events-auto transform transition-all duration-500 hover:scale-[1.01] group min-w-[320px] max-w-[380px]`;
    card.innerHTML = `
        <div class="flex items-center gap-4 w-full">
            <div class="w-11 h-11 ${s.iconBg} rounded-2xl flex items-center justify-center ${s.text} shadow-sm shrink-0 group-hover:scale-105 transition-transform duration-300">
                 <i class="fas ${s.icon} text-lg"></i>
            </div>
            <div class="flex flex-col flex-1 min-w-0">
                <div class="flex items-center gap-1.5 mb-1">
                    <span class="text-[9px] font-black ${s.text} uppercase tracking-[0.25em]">${s.label}</span>
                    <span class="w-1 h-1 ${s.text.replace('text-', 'bg-')} rounded-full animate-pulse"></span>
                </div>
                <h4 class="text-xs font-black ${isSync ? 'text-slate-900 dark:text-indigo-100' : 'text-slate-850 dark:text-white'} uppercase tracking-tight leading-none">${displayMessage}</h4>
            </div>
            <button id="notif-close-${id}" class="ml-2 text-slate-400 dark:text-slate-500 hover:text-rose-500 transition-colors opacity-60 hover:opacity-100 p-1">
                <i class="fas fa-times text-xs"></i>
            </button>
        </div>
        ${workflowHTML}
        ${undoHTML}
    `;

    // Manage Singleton Sync Cards
    if (isSync) {
        const existing = Array.from(hud.children).find(c => c.innerHTML.includes('WORKFLOW') || c.innerHTML.includes('Sinc:'));
        if (existing) existing.remove();
    }

    hud.appendChild(card);

    let completeTimer = null;
    let autoRemoveTimer = null;

    const clearTimers = () => {
        if (completeTimer) clearTimeout(completeTimer);
        if (autoRemoveTimer) clearTimeout(autoRemoveTimer);
    };

    const removeCard = (withDelay = true) => {
        clearTimers();
        if (withDelay) {
            card.classList.add('opacity-0', 'translate-x-[100px]', 'scale-90', 'blur-sm');
            setTimeout(() => card.remove(), 700);
        } else {
            card.remove();
        }
    };

    // Bind Close
    card.querySelector(`#notif-close-${id}`).onclick = () => removeCard();

    // Bind Undo/Cancel
    if (onUndo || onComplete) {
        const btn = card.querySelector(`#notif-undo-${id}`);
        btn.onclick = () => {
            if (onUndo) onUndo();
            removeCard(false);
        };

        // Trigger progress bar animation in next frame
        requestAnimationFrame(() => {
            const bar = card.querySelector(`#notif-progress-${id}`);
            if (bar) bar.style.width = '0%';
        });
    }

    // Auto-complete or Auto-remove
    if (duration > 0) {
        if (onComplete) {
            completeTimer = setTimeout(() => {
                onComplete();
                removeCard();
            }, duration);
        } else {
            autoRemoveTimer = setTimeout(() => {
                if (card.parentElement) removeCard();
            }, duration);
        }
    }

    return id;
};

export const updateNotificationWorkflow = (id, step) => {
    const card = document.getElementById(id);
    if (!card) return;

    let container = card.querySelector('.space-y-1.5') || card.querySelector('.space-y-1');
    if (!container) {
        const hr = document.createElement('div');
        hr.className = 'mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5';
        card.appendChild(hr);
        container = hr;
    }

    const stepEl = document.createElement('div');
    stepEl.className = 'flex items-center gap-2.5 animate-fade-in opacity-75';
    stepEl.innerHTML = `
        <span class="text-indigo-500 text-[10px]">▶</span>
        <span class="text-[9px] font-bold text-slate-650 dark:text-slate-400 uppercase tracking-widest leading-none">${step}</span>
    `;
    container.appendChild(stepEl);
};

export const completeSyncNotification = (moduleName) => {
    const hudTop = document.getElementById('xolvy-notifications-top');
    const hudHud = document.getElementById('xolvy-notifications-hud');
    const cards = [];
    if (hudTop) cards.push(...Array.from(hudTop.children));
    if (hudHud) cards.push(...Array.from(hudHud.children));
    const card = cards.find(c => c.innerText.includes(moduleName) || c.innerText.includes('WORKFLOW'));

    if (card) {
        card.className = 'bg-white/90 dark:bg-slate-900/90 border-emerald-100/50 dark:border-emerald-500/10 border backdrop-blur-xl px-6 py-4.5 rounded-[2rem] shadow-[0_20px_50px_rgba(16,185,129,0.15)] flex flex-col gap-1.5 animate-slide-left pointer-events-auto transform transition-all duration-700';

        // Cleanup workflow logs
        const workflowDiv = card.querySelector('.border-t');
        if (workflowDiv) workflowDiv.remove();

        const iconWrap = card.querySelector('.w-11') || card.querySelector('.w-10');
        if (iconWrap) {
            iconWrap.className = 'w-11 h-11 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 dark:text-emerald-400 shadow-sm scale-105 transition-transform duration-350';
            iconWrap.innerHTML = '<i class="fas fa-check text-lg"></i>';
        }
        const label = card.querySelector('span');
        if (label) {
            label.innerText = 'WORKFLOW FINALIZADO';
            label.className = 'text-[9px] font-black text-emerald-500 dark:text-emerald-400 uppercase tracking-[0.25em]';
        }
        const title = card.querySelector('h4');
        if (title) {
            title.innerText = moduleName + ' al día';
            title.className = 'text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-tight leading-none';
        }

        setTimeout(() => {
            card.classList.add('opacity-0', 'translate-y-[-50px]', 'scale-90', 'blur-sm');
            setTimeout(() => card.remove(), 700);
        }, 3000);
    }
};

export const generatePlainXLS = (data, fileName) => {
    if (!data || data.length === 0) return;

    // Headers
    const headers = Object.keys(data[0]);

    // Create XML structure for Excel (SpreadsheetML)
    let xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="sHeader">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0D9488" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Reporte">
  <Table>`;

    // Header Row
    xml += '<Row ss:StyleID="sHeader">';
    headers.forEach(h => {
        xml += `<Cell><Data ss:Type="String">${h}</Data></Cell>`;
    });
    xml += '</Row>';

    // Data Rows
    data.forEach(item => {
        xml += '<Row>';
        headers.forEach(h => {
            const val = item[h] || '';
            xml += `<Cell><Data ss:Type="String">${val}</Data></Cell>`;
        });
        xml += '</Row>';
    });

    xml += `  </Table>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

/**
 * Checks if the browser is online and shows a notification if not.
 * @returns {boolean} True if online, false otherwise.
 */
export const ensureOnline = () => {
    if (!navigator.onLine) {
        showNotification("⚠️ Acción no disponible sin conexión a Internet.", "warning");
        return false;
    }
    return true;
};

export const formatManzanas = (text) => {
    if (!text) return text;
    // Replace Salmo with Mz. to correct terminology (Imagen 5)
    return text.toString().replace(/Salmo/gi, 'Mz.');
};

export const formatGroups = (val) => {
    if (!val || val === '—') return '—';
    if (val.toLowerCase() === 'todos') return 'TODOS';

    // Xolvy Data Shield: Aggressive 'Grupo' stripping
    let clean = val.replace(/grupos?/gi, '').trim();

    // Split by common separators and clean up
    let parts = clean.split(/[,;&y]+/).map(p => p.trim()).filter(Boolean);
    if (parts.length === 0) return '—';

    // Xolvy Data Shield: Numerical Sorting for consistency
    parts.sort((a, b) => {
        const na = parseInt(a);
        const nb = parseInt(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return a.localeCompare(b);
    });

    if (parts.length === 1) return parts[0];
    const last = parts.pop();
    return parts.join(', ') + ' y ' + last;
};

export const getBaseTerritoryNumber = (val) => {
    if (!val) return '';
    // Extract base number before any parenthesis or extra text
    const match = String(val).match(/^(\d+)/);
    return match ? match[1] : val;
};

export const splitTerritories = (str) => {
    if (!str) return [];
    const res = [];
    let current = '';
    let depth = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (char === '(') depth++;
        else if (char === ')') depth--;

        if (depth === 0 && (char === ',' || char === ';' || char === '/')) {
            res.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    res.push(current.trim());
    return res.filter(Boolean);
};

// Global click-outside to close modals
if (typeof document !== 'undefined') {
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            const modal = e.target.closest('.modal-container') || e.target;
            modal.remove();
        }
    });
}

export const isIOS = () => {
    return [
        'iPad Simulator',
        'iPhone Simulator',
        'iPod Simulator',
        'iPad',
        'iPhone',
        'iPod'
    ].includes(navigator.platform)
        // iPad on iOS 13 detection
        || (navigator.userAgent.includes("Mac") && "ontouchend" in document);
};

/**
 * 🦴 XOLVY SKELETON ENGINE - Premium Loading States
 * Replaces ugly spinners with structural shadows for a smoother UX.
 */
export const renderSkeleton = (container) => {
    if (!container) return;
    container.innerHTML = `
    <div class="p-4 md:p-10 space-y-8 md:space-y-12 animate-pulse w-full h-full flex flex-col">
        <!-- Header Skeleton -->
        <div class="h-40 bg-slate-200 dark:bg-white/5 rounded-[2.5rem] border border-slate-100 dark:border-white/[0.05]"></div>
        
        <!-- Stats Grid Skeleton -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 shrink-0">
            <div class="h-28 bg-slate-200 dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/[0.05]"></div>
            <div class="h-28 bg-slate-200 dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/[0.05]"></div>
            <div class="h-28 bg-slate-200 dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/[0.05]"></div>
            <div class="h-28 bg-slate-200 dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/[0.05]"></div>
        </div>
        
        <!-- Main Content Skeleton -->
        <div class="flex-1 min-w-0 min-h-[400px] bg-slate-200 dark:bg-white/5 rounded-[3rem] border border-slate-100 dark:border-white/[0.05] shadow-inner"></div>
    </div>
    `;
};

/**
 * Retorna el lunes de la semana que contiene la fecha dada.
 * @param {Date|string} d - Cualquier fecha válida
 * @returns {Date} El lunes de esa semana
 */
export const getMonday = (d) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
};

/**
 * Formatea una fecha al formato YYYY-MM-DD usado como ID de documentos
 * en la colección `programa_semanal` de Firestore.
 * @param {Date|string} date - Fecha a formatear
 * @returns {string} Formato "YYYY-MM-DD"
 */
export const getSafeDateId = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
