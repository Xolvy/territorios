
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
        <div class="relative w-full ${maxWidth} bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-black/5 dark:border-white/10 animate-scale-in overflow-hidden">
            ${html}
        </div>
    `;

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    if (onRender) onRender(modal);

    const handleEsc = (e) => {
        if (e.key === 'Escape') {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            window.removeEventListener('keydown', handleEsc);
        }
    };
    window.addEventListener('keydown', handleEsc);
};
