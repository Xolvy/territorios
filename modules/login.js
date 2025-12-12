import { auth } from '../firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getConductores } from '../data/firestore-services.js?v=3.5';

export const renderLogin = (container) => {
    renderSelection(container);
};

const renderSelection = (container) => {
    container.innerHTML = `
        <div class="morphinglass-card w-full max-w-md animate-fade-in text-center">
            <h2 class="text-3xl font-bold mb-6 text-teal-400">Acceso al Sistema</h2>
            <p class="mb-8 text-gray-300">Congregación 14282</p>
            
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
            <div class="mt-6 text-xs text-gray-400">
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
                <button id="btn-back" class="text-teal-400 hover:text-teal-300 flex items-center gap-1 text-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                    </svg>
                    Volver
                </button>
            </div>
            <h2 class="text-3xl font-bold mb-6 text-teal-400">Administrador</h2>
            
            <form id="login-form" class="flex flex-col gap-4">
                <div class="text-left">
                    <label class="text-xs uppercase text-teal-500 font-bold ml-1">Correo Electrónico</label>
                    <input type="email" id="email" class="w-full p-3 rounded-lg mt-1 bg-black/20 border border-teal-500/30 text-white focus:border-teal-500 focus:outline-none" placeholder="admin@ejemplo.com" required>
                </div>
                
                <div class="text-left">
                    <label class="text-xs uppercase text-teal-500 font-bold ml-1">Contraseña</label>
                    <input type="password" id="password" class="w-full p-3 rounded-lg mt-1 bg-black/20 border border-teal-500/30 text-white focus:border-teal-500 focus:outline-none" placeholder="••••••••" required>
                </div>

                <button type="submit" class="mt-4 bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-105 shadow-lg shadow-teal-500/30">
                    Iniciar Sesión
                </button>
            </form>
            <p id="error-message" class="text-red-400 mt-4 text-sm font-medium min-h-[20px]"></p>
        </div>
    `;

    document.getElementById('btn-back').addEventListener('click', () => renderSelection(container));

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorMessage = document.getElementById('error-message');

        errorMessage.textContent = 'Autenticando...';

        try {
            // Ensure app.js knows we are logging in as Admin
            localStorage.setItem('demo_role', 'Administrador');
            await signInWithEmailAndPassword(auth, email, password);
            // Auth listener in app.js will handle redirection
        } catch (error) {
            console.warn("Auth error:", error);
            errorMessage.textContent = `Error: ${error.message}`;

            // OPTIONAL: Demo backdoor for testing if auth fails
            if (email.includes('demo')) {
                const event = new CustomEvent('demo-login', { detail: { email, role: 'Administrador' } });
                document.dispatchEvent(event);
            }
        }
    });
};

const renderConductorSelection = async (container) => {
    container.innerHTML = `
        <div class="morphinglass-card w-full max-w-md animate-fade-in text-center">
            <div class="flex justify-start mb-4">
                <button id="btn-back-c" class="text-teal-400 hover:text-teal-300 flex items-center gap-1 text-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                    </svg>
                    Volver
                </button>
            </div>
            <h2 class="text-2xl font-bold mb-6 text-teal-400">Seleccionar Conductor</h2>
            <div id="conductores-list" class="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                <p class="text-gray-400 animate-pulse">Cargando conductores...</p>
            </div>
        </div>
    `;

    document.getElementById('btn-back-c').addEventListener('click', () => renderSelection(container));

    try {
        const conductores = await getConductores();

        // Ordenar alfabéticamente por nombre
        conductores.sort((a, b) => a.nombre.localeCompare(b.nombre));

        const listContainer = document.getElementById('conductores-list');

        if (conductores.length === 0) {
            listContainer.innerHTML = '<p class="text-yellow-400">No hay conductores registrados.</p>';
            return;
        }

        listContainer.innerHTML = '';
        conductores.forEach(c => {
            const btn = document.createElement('button');
            btn.className = 'w-full text-left p-4 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-teal-500/50 transition-all group';
            btn.innerHTML = `
                <div class="flex items-center justify-between">
                    <span class="font-medium text-gray-200 group-hover:text-white">${c.nombre}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-500 group-hover:text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                </div>
            `;
            btn.addEventListener('click', () => {
                // Dispatch login event
                const event = new CustomEvent('demo-login', {
                    detail: {
                        email: c.email || c.nombre, // Use email if available, else name as ID
                        role: 'Conductor'
                    }
                });
                document.dispatchEvent(event);
            });
            listContainer.appendChild(btn);
        });

    } catch (error) {
        console.error(error);
        document.getElementById('conductores-list').innerHTML = `<p class="text-red-400">Error al cargar: ${error.message}</p>`;
    }
};
