// Xolvy Data Shield: Centrally defined normalization rule
export const normalize = (val) => String(val || '').trim();

export const formatPhoneNumber = (numero) => {
    if (!numero) return '';
    const cleaned = numero.toString().replace(/\D/g, '');
    return cleaned.length === 7 ? `${cleaned.slice(0, 3)} ${cleaned.slice(3)}` : numero;
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
    return 'text-gray-500';
};



export const showNotification = (message, type = 'success', duration = 5000, workflow = [], onUndo = null) => {
    // 1. Text Optimization for glanceability
    let displayMessage = message;
    if (message.includes('Conexión Restablecida')) displayMessage = 'Sistema Sincronizado';
    if (message.includes('No hay más números')) displayMessage = 'Sin Números Libres';
    if (message.includes('¡Actualización Global Activada!')) displayMessage = 'Sincronizando Global';
    if (message.includes('Referencia guardada')) displayMessage = 'Referencia Guardada';
    if (message.includes('¡Importación exitosa!')) displayMessage = 'Datos Importados';
    if (message.includes('Sincronizando')) displayMessage = message.replace('Sincronizando ', 'Sinc: ');

    // Fallback truncation for very long ad-hoc messages
    if (displayMessage.length > 50) displayMessage = displayMessage.substring(0, 47) + '...';

    // 2. HUD Container (Bottom Right)
    let hud = document.getElementById('xolvy-notifications-hud');
    if (!hud) {
        hud = document.createElement('div');
        hud.id = 'xolvy-notifications-hud';
        hud.className = 'fixed bottom-6 right-6 z-[10000] flex flex-col items-end gap-3 pointer-events-none';
        document.body.appendChild(hud);
    }

    // 3. Notification Card
    const card = document.createElement('div');
    const id = 'notif-' + Date.now();
    card.id = id;

    // Type Styling
    const styles = {
        success: { bg: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-500/30', text: 'text-emerald-600 dark:text-emerald-400', icon: 'fa-check-circle', label: 'ÉXITO' },
        error: { bg: 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-500/30', text: 'text-rose-600 dark:text-rose-400', icon: 'fa-triangle-exclamation', label: 'ERROR' },
        warning: { bg: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-500/30', text: 'text-amber-600 dark:text-amber-400', icon: 'fa-circle-exclamation', label: 'AVISO' },
        info: { bg: 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-500/30', text: 'text-indigo-600 dark:text-indigo-400', icon: 'fa-circle-info', label: 'INFO' },
        sync: { bg: 'bg-indigo-50 dark:bg-slate-950 border-indigo-200 dark:border-indigo-500/40', text: 'text-indigo-600 dark:text-indigo-400', icon: 'fa-sync-alt fa-spin-slow', label: 'XOLVY WORKFLOW' }
    };

    const isSync = type === 'sync' || message.includes('Sincronizando');
    const s = styles[isSync ? 'sync' : type] || styles.success;

    // Workflow log rendering
    const workflowHTML = workflow.length > 0
        ? `<div class="mt-2.5 pt-2.5 border-t ${isSync ? 'border-indigo-500/20' : 'border-slate-200 dark:border-white/5'} space-y-1">
             ${workflow.map(step => `
                <div class="flex items-center gap-1.5 opacity-60">
                    <i class="fas fa-caret-right text-[6px] text-indigo-500"></i>
                    <span class="text-[7px] font-black ${isSync ? 'text-indigo-900/50 dark:text-indigo-300/50' : 'text-slate-500 dark:text-slate-400'} uppercase tracking-widest">${step}</span>
                </div>
             `).join('')}
           </div>`
        : '';

    // Undo Action HUD
    const undoHTML = onUndo ? `
        <div class="mt-4 flex items-center justify-between gap-4">
             <div class="flex-1 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                 <div id="notif-progress-${id}" class="h-full ${s.text.replace('text-', 'bg-')} w-full transition-all ease-linear" style="transition-duration: ${duration}ms"></div>
             </div>
             <button id="notif-undo-${id}" class="px-5 py-2 rounded-xl bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-[9px] font-black uppercase tracking-widest ${s.text} shadow-sm hover:scale-105 active:scale-95 transition-all">
                <i class="fas fa-undo-alt mr-1.5"></i> Deshacer
             </button>
        </div>
    ` : '';

    card.className = `${s.bg} border backdrop-blur-xl px-5 py-3.5 rounded-2xl shadow-2xl flex flex-col gap-1 animate-slide-left pointer-events-auto transform transition-all duration-500 hover:scale-[1.02] group min-w-[280px] max-w-[340px]`;
    card.innerHTML = `
        <div class="flex items-center gap-4 w-full">
            <div class="w-10 h-10 ${isSync ? 'bg-indigo-500/10 dark:bg-indigo-500/20' : 'bg-white/50 dark:bg-white/5'} rounded-xl flex items-center justify-center ${s.text} shadow-inner shrink-0 group-hover:scale-110 transition-transform">
                 <i class="fas ${s.icon} text-lg"></i>
            </div>
            <div class="flex flex-col flex-1">
                <div class="flex items-center gap-2 mb-0.5">
                    <span class="text-[8px] font-black ${s.text} uppercase tracking-[0.25em]">${s.label}</span>
                    <span class="w-1 h-1 ${s.text.replace('text-', 'bg-')} rounded-full animate-pulse"></span>
                </div>
                <h4 class="text-[11px] font-black ${isSync ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-800 dark:text-white'} uppercase tracking-tight leading-none">${displayMessage}</h4>
            </div>
            <button class="ml-2 text-slate-400 hover:text-rose-500 transition-colors opacity-40 hover:opacity-100" onclick="this.closest('div.animate-slide-left').remove()">
                <i class="fas fa-times text-[10px]"></i>
            </button>
        </div>
        ${workflowHTML}
        ${undoHTML}
    `;

    // Manage Singleton Sync Cards
    if (isSync) {
        const existing = Array.from(hud.children).find(c => c.innerHTML.includes('XOLVY WORKFLOW') || c.innerHTML.includes('XOLVY UPDATES'));
        if (existing) existing.remove();
    }

    hud.appendChild(card);

    // Bind Undo
    if (onUndo) {
        const btn = card.querySelector(`#notif-undo-${id}`);
        btn.onclick = () => {
            onUndo();
            card.remove();
        };

        // Trigger progress bar animation in next frame
        requestAnimationFrame(() => {
            const bar = card.querySelector(`#notif-progress-${id}`);
            if (bar) bar.style.width = '0%';
        });
    }

    // Auto-remove
    if (duration > 0) {
        setTimeout(() => {
            if (card.parentElement) {
                card.classList.add('opacity-0', 'translate-x-[100px]', 'scale-90', 'blur-sm');
                setTimeout(() => card.remove(), 700);
            }
        }, duration);
    }

    return id;
};

export const updateNotificationWorkflow = (id, step) => {
    const card = document.getElementById(id);
    if (!card) return;

    let container = card.querySelector('.space-y-1');
    if (!container) {
        const hr = document.createElement('div');
        hr.className = 'mt-2.5 pt-2.5 border-t border-white/5 space-y-1';
        card.appendChild(hr);
        container = hr;
    }

    const stepEl = document.createElement('div');
    stepEl.className = 'flex items-center gap-1.5 animate-fade-in';
    stepEl.innerHTML = `
        <i class="fas fa-caret-right text-[6px] text-indigo-500"></i>
        <span class="text-[7px] font-bold text-slate-400 uppercase tracking-widest">${step}</span>
    `;
    container.appendChild(stepEl);
};

export const completeSyncNotification = (moduleName) => {
    const hud = document.getElementById('xolvy-notifications-hud');
    if (!hud) return;
    const cards = Array.from(hud.children);
    const card = cards.find(c => c.innerText.includes(moduleName) || c.innerText.includes('XOLVY WORKFLOW'));

    if (card) {
        card.className = 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500/20 dark:border-emerald-500/30 border backdrop-blur-3xl px-5 py-3.5 rounded-2xl shadow-[0_20px_50px_rgba(16,185,129,0.1)] dark:shadow-[0_20px_50px_rgba(16,185,129,0.3)] flex flex-col gap-1 animate-slide-left pointer-events-auto transform transition-all duration-700';

        // Cleanup workflow logs
        const workflowDiv = card.querySelector('.border-t');
        if (workflowDiv) workflowDiv.remove();

        const iconWrap = card.querySelector('.w-10');
        if (iconWrap) {
            iconWrap.className = 'w-10 h-10 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-inner scale-110 transition-transform';
            iconWrap.innerHTML = '<i class="fas fa-check text-lg"></i>';
        }
        const label = card.querySelector('span');
        if (label) {
            label.innerText = 'WORKFLOW FINALIZADO';
            label.className = 'text-[8px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-[0.25em]';
        }
        const title = card.querySelector('h4');
        if (title) {
            title.innerText = moduleName + ' al día';
            title.className = 'text-[11px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-tight leading-none';
        }

        setTimeout(() => {
            card.classList.add('opacity-0', 'translate-x-[100px]', 'scale-90');
            setTimeout(() => card.remove(), 700);
        }, 3000);
    }
};

/**
 * Generates a simple Excel-compatible XLS (XML) file from an array of objects
 */
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
    if (!val) return '—';
    return String(val).toUpperCase().split(/[,/]/).map(s => s.trim().split(' ')[0]).join(' / ');
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
