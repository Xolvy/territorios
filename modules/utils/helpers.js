export const formatPhoneNumber = (numero) => {
    if (!numero) return '';
    const cleaned = numero.toString().replace(/\D/g, '');
    return cleaned.length === 7 ? `${cleaned.slice(0, 3)} ${cleaned.slice(3)}` : numero;
};

export const getStatusColor = (status) => {
    const s = status || 'Sin asignar'; // Default fallback
    if (s === 'Contestaron') return 'text-green-400';
    if (s === 'No contestan') return 'text-orange-400';
    if (s === 'No llamar') return 'text-red-400';
    if (s === 'Colgaron') return 'text-gray-400';
    if (s === 'Revisita') return 'text-yellow-400';
    if (s === 'Suspendido') return 'text-orange-500';
    if (s === 'Testigo') return 'text-purple-400';
    if (s === 'Pendiente' || s === 'Sin asignar') return 'text-gray-500';
    return 'text-gray-500';
};

export const showNotification = (message, type = 'success') => {
    let banner = document.getElementById('app-notification-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'app-notification-banner';
        banner.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 transform -translate-y-20 opacity-0 pointer-events-none';
        banner.innerHTML = `
            <div class="bg-gray-900/90 backdrop-blur-md text-white px-6 py-4 rounded-xl shadow-2xl border border-teal-500/30 flex items-center gap-4 min-w-[300px] pointer-events-auto">
                <div class="bg-teal-500/20 p-2 rounded-full text-teal-300 icon-container">🔔</div>
                <div class="flex-1">
                    <h4 class="font-bold text-sm text-teal-100 title">Notificación</h4>
                    <p class="text-xs text-gray-400 message"></p>
                </div>
                <button onclick="this.closest('#app-notification-banner').classList.add('-translate-y-20', 'opacity-0')" class="text-gray-500 hover:text-white transition-colors">✕</button>
            </div>
        `;
        document.body.appendChild(banner);
    }
    const content = banner.querySelector('.message');
    content.textContent = message;

    const icon = banner.querySelector('.icon-container');
    const title = banner.querySelector('.title');

    if (type === 'error') {
        icon.textContent = '⚠️';
        icon.className = 'bg-red-500/20 p-2 rounded-full text-red-300 icon-container';
        title.className = 'font-bold text-sm text-red-100 title';
    } else if (type === 'warning') {
        icon.textContent = '⚠️';
        icon.className = 'bg-yellow-500/20 p-2 rounded-full text-yellow-300 icon-container';
        title.className = 'font-bold text-sm text-yellow-100 title';
    } else {
        icon.textContent = '🔔';
        icon.className = 'bg-teal-500/20 p-2 rounded-full text-teal-300 icon-container';
        title.className = 'font-bold text-sm text-teal-100 title';
    }

    requestAnimationFrame(() => banner.classList.remove('-translate-y-20', 'opacity-0'));

    // Clear previous timeout if exists
    if (banner.dataset.timeoutId) clearTimeout(parseInt(banner.dataset.timeoutId));

    const tid = setTimeout(() => banner.classList.add('-translate-y-20', 'opacity-0'), 4000);
    banner.dataset.timeoutId = tid;
};
