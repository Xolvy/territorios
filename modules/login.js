import { auth } from '/firebase-config.js?v=2.4.0';
import { GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getPublicadores, getConfiguracion } from '../data/firestore-services.js?v=2.4.0';

export const renderLogin = (container) => {
    renderSelection(container);
};

const renderSelection = async (container) => {
    const config = await getConfiguracion();
    const congLabel = config.congregacion?.nombre && config.congregacion?.numero
        ? `Congregación ${config.congregacion.nombre} ${config.congregacion.numero}`
        : "Congregación 14282";

    container.innerHTML = `
        <div class="morphinglass-card w-full max-w-md animate-fade-in text-center">
            <h2 class="text-3xl font-bold mb-6 text-teal-600 dark:text-teal-400">Acceso al Sistema</h2>
            <p class="mb-8 text-gray-600 dark:text-gray-300">${congLabel}</p>
            
            <div class="flex flex-col gap-4">
                <button id="btn-admin" class="bg-teal-600 hover:bg-teal-500 text-white font-bold py-4 px-6 rounded-lg transition-all transform hover:scale-105 shadow-lg shadow-teal-500/30 flex items-center justify-center gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Administrador
                </button>
                <button id="btn-conductor" class="bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-6 rounded-lg transition-all transform hover:scale-105 shadow-lg shadow-blue-500/30 flex items-center justify-center gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Conductor
                </button>
            </div>
            <div class="mt-6 text-xs text-gray-500 dark:text-gray-400">
                <p>Seleccione su perfil para continuar</p>
            </div>
        </div>
    `;

    document.getElementById('btn-admin').addEventListener('click', () => renderAdminLogin(container));
    document.getElementById('btn-conductor').addEventListener('click', () => renderConductorSelection(container));
};

const renderAdminLogin = (container) => {
    container.innerHTML = `
        <div class="morphinglass-card w-full max-w-md animate-fade-in text-center">
            <div class="flex justify-start mb-4">
                <button id="btn-back" class="text-teal-600 dark:text-teal-400 hover:text-teal-500 flex items-center gap-1 text-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                    </svg>
                    Volver
                </button>
            </div>
            <h2 class="text-3xl font-bold mb-6 text-teal-600 dark:text-teal-400">Administrador</h2>
            <p class="mb-8 text-gray-500 dark:text-gray-400 text-sm">Inicia sesión con tu cuenta de Google autorizada.</p>
            
            <button id="btn-google-login" class="w-full bg-white hover:bg-gray-50 text-gray-800 font-bold py-4 px-6 rounded-lg transition-all transform hover:scale-105 shadow-md border border-gray-200 flex items-center justify-center gap-3">
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" class="w-6 h-6">
                <span>Continuar con Google</span>
            </button>

            <p id="error-message" class="text-red-400 mt-6 text-sm font-medium min-h-[20px]"></p>
        </div>
    `;

    document.getElementById('btn-back').addEventListener('click', () => renderSelection(container));

    document.getElementById('btn-google-login').addEventListener('click', async () => {
        const errorMessage = document.getElementById('error-message');
        errorMessage.textContent = 'Contactando a Google...';

        try {
            const provider = new GoogleAuthProvider();
            // Optional: Force account selection
            provider.setCustomParameters({
                prompt: 'select_account'
            });

            // Ensure app.js knows we are logging in as Admin intent
            localStorage.setItem('demo_role', 'Administrador');

            await signInWithPopup(auth, provider);
            // Auth listener in app.js will handle redirection

        } catch (error) {
            console.warn("Auth error:", error);
            errorMessage.textContent = `Error: ${error.message}`;
        }
    });
};

const renderConductorSelection = async (container) => {
    container.innerHTML = `
        <div class="morphinglass-card w-full max-w-md animate-fade-in text-center">
            <div class="flex justify-start mb-4">
                <button id="btn-back-c" class="text-teal-600 dark:text-teal-400 hover:text-teal-500 flex items-center gap-1 text-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                    </svg>
                    Volver
                </button>
            </div>
            <h2 class="text-2xl font-bold mb-4 text-teal-600 dark:text-teal-400">Seleccionar Conductor</h2>
            
            <div class="mb-4 relative">
                <input type="text" id="conductor-search" placeholder="Buscar conductor..." class="w-full bg-white/50 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-lg py-2 pl-3 pr-10 text-gray-800 dark:text-white focus:border-teal-500 outline-none transition-colors">
                 <span class="absolute right-3 top-2.5 text-gray-500">🔍</span>
            </div>

            <div id="conductores-list" class="flex flex-col gap-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                <p class="text-gray-400 animate-pulse">Cargando conductores...</p>
            </div>
        </div>
    `;

    document.getElementById('btn-back-c').addEventListener('click', () => renderSelection(container));

    try {
        const people = await getPublicadores();
        const conductors = people.filter(p => p.es_conductor);

        // Ordenar alfabéticamente por nombre
        conductors.sort((a, b) => a.nombre.localeCompare(b.nombre));

        const listContainer = document.getElementById('conductores-list');
        const searchInput = document.getElementById('conductor-search');

        if (conductors.length === 0) {
            listContainer.innerHTML = '<p class="text-yellow-400">No hay conductores autorizados registrados.</p>';
            return;
        }

        listContainer.innerHTML = '';
        conductors.forEach(c => {
            const btn = document.createElement('button');
            btn.className = 'w-full text-left p-4 rounded-lg bg-white/60 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 border border-black/5 dark:border-white/10 hover:border-teal-500/50 transition-all group conductor-item';
            btn.dataset.name = c.nombre.toLowerCase(); // For easier filtering
            btn.innerHTML = `
                <div class="flex items-center justify-between">
                    <div>
                        <span class="font-bold text-gray-800 dark:text-gray-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 block">${c.nombre}</span>
                        <span class="text-[10px] text-gray-500 font-mono">${c.telefono || 'Sin teléfono'}</span>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400 group-hover:text-teal-500 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                </div>
            `;
            btn.addEventListener('click', () => {
                // Dispatch login event
                const event = new CustomEvent('demo-login', {
                    detail: {
                        email: c.telefono || c.nombre, // Use Phone as ID (International Format)
                        role: 'Conductor'
                    }
                });
                document.dispatchEvent(event);
            });
            listContainer.appendChild(btn);
        });

        // Search Filter Logic
        searchInput.focus();
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const items = listContainer.querySelectorAll('.conductor-item');

            items.forEach(item => {
                if (item.dataset.name.includes(term)) {
                    item.classList.remove('hidden');
                } else {
                    item.classList.add('hidden');
                }
            });
        });

    } catch (error) {
        console.error(error);
        document.getElementById('conductores-list').innerHTML = `<p class="text-red-400">Error al cargar: ${error.message}</p>`;
    }
};





