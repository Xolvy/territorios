
export const UIHelpers = {
    fmtDate: (d) => d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) : '',

    getMonday: (d) => {
        d = new Date(d);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    },

    formatDateId: (date) => {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    formatDisplayDateRange: (date) => {
        try {
            const start = new Date(date);
            if (isNaN(start.getTime())) return '';
            const end = new Date(date);
            end.setDate(start.getDate() + 6);
            if (window.dateFns) {
                return `${window.dateFns.format(start, 'd MMM')} - ${window.dateFns.format(end, 'd MMM yyyy')}`;
            }
            const f = (d) => `${d.getDate()}/${d.getMonth() + 1}`;
            return `${f(start)} - ${f(end)}, ${start.getFullYear()}`;
        } catch (e) { return date; }
    }
};

export const showModal = (html, onRender, maxWidth = 'max-w-2xl', containerId = 'modal-container') => {
    const modal = document.getElementById(containerId);
    if (!modal) return;

    modal.innerHTML = `
        <div class="modal-backdrop-area absolute inset-0 cursor-default"></div>
        <div class="relative w-full ${maxWidth} bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-black/5 dark:border-white/10 animate-scale-in overflow-hidden z-10">
            ${html}
        </div>
    `;

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    if (onRender) onRender(modal);

    const close = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        window.removeEventListener('keydown', handleEsc);
    };

    const handleEsc = (e) => {
        if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handleEsc);

    modal.querySelector('.modal-backdrop-area').onclick = close;
};

export const showCustomConfirm = (message, onConfirm) => {
    showModal(`
        <div class="p-8 text-center space-y-6 flex flex-col items-center">
            <div class="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 text-2xl">
                <i class="fas fa-question-circle"></i>
            </div>
            <div>
                <h3 class="text-h3 text-slate-900 dark:text-white">${message}</h3>
                <p class="text-[10px] text-slate-600 dark:text-slate-400 mt-2 font-black uppercase tracking-widest">Confirmación de Administrador</p>
            </div>
            <div class="flex gap-3 w-full mt-4">
                <button id="confirm-cancel" class="flex-1 py-4 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 font-bold hover:bg-slate-200 transition-all text-xs uppercase">Cancelar</button>
                <button id="confirm-ok" class="flex-[1.5] py-4 rounded-xl bg-primary text-white font-bold hover:bg-primary-light shadow-lg shadow-primary/20 transition-all text-xs uppercase">Confirmar</button>
            </div>
        </div>
    `, (modal) => {
        modal.querySelector('#confirm-cancel').onclick = () => modal.classList.add('hidden');
        modal.querySelector('#confirm-ok').onclick = () => {
            modal.classList.add('hidden');
            onConfirm();
        };
    }, 'max-w-sm');
};

export const showCustomPrompt = (message, defaultValue, onConfirm) => {
    showModal(`
        <div class="p-8 space-y-6">
            <div class="text-center">
                <h3 class="text-h3 text-slate-900 dark:text-white">${message}</h3>
                <p class="text-[10px] text-primary font-bold uppercase tracking-widest mt-1 italic">Entrada de Sistema</p>
            </div>
            <div class="relative">
                <input type="text" id="prompt-input" value="${defaultValue || ''}" 
                    class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:border-primary/50 rounded-2xl p-4 text-slate-900 dark:text-white outline-none font-bold text-center text-base transition-all">
            </div>
            <div class="flex gap-3 mt-4">
                <button id="prompt-cancel" class="flex-1 py-4 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 font-bold hover:bg-slate-200 transition-all text-xs uppercase">Omitir</button>
                <button id="prompt-ok" class="flex-[1.5] py-4 rounded-xl bg-primary text-white font-bold hover:bg-primary-light shadow-lg shadow-primary/20 transition-all text-xs uppercase">Guardar</button>
            </div>
        </div>
    `, (modal) => {
        const input = modal.querySelector('#prompt-input');
        input.focus();
        input.select();

        const handleConfirm = () => {
            const val = input.value.trim();
            if (val) {
                modal.classList.add('hidden');
                onConfirm(val);
            }
        };

        input.onkeydown = (e) => {
            if (e.key === 'Enter') handleConfirm();
            if (e.key === 'Escape') modal.classList.add('hidden');
        };

        modal.querySelector('#prompt-cancel').onclick = () => modal.classList.add('hidden');
        modal.querySelector('#prompt-ok').onclick = handleConfirm;
    }, 'max-w-sm');
};

export const showCustomAlert = (message) => {
    if (!message) return;
    const type = message.toLowerCase().includes('error') ? 'error' : 'success';
    showNotification(message, type);
};

window.showModal = showModal;
window.showCustomConfirm = showCustomConfirm;
window.showCustomPrompt = showCustomPrompt;
window.showCustomAlert = showCustomAlert;
