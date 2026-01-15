import { auth } from '../firebase-config.js?v=1.9.8';
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getPublicadores, getConfiguracion } from '../data/firestore-services.js?v=1.9.8';

export const renderLogin = (container, appVersion) => {
    container.innerHTML = `
        <div class="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 transition-colors duration-500">
            <!-- Background Decorative Elements -->
            <div class="fixed inset-0 overflow-hidden pointer-events-none opacity-50 dark:opacity-20">
                <div class="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary-glow blur-[120px] rounded-full"></div>
                <div class="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-indigo-500/5 blur-[120px] rounded-full"></div>
            </div>

            <div id="login-card-container" class="w-full max-w-sm sm:max-w-md space-y-8 text-center relative z-10 animate-fade-in px-2">
                <!-- Brand Header -->
                <div class="space-y-4 sm:space-y-6">
                    <div class="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-tr from-teal-600 to-teal-400 rounded-2xl sm:rounded-[1.75rem] mx-auto flex items-center justify-center shadow-xl shadow-teal-500/20 transform transition-all duration-700 hover:rotate-12">
                        <svg class="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 20l-5.447-2.724A2 2 0 013 15.488V5.002a2 2 0 011.553-1.948l7-1.75a2 2 0 01.894 0l7 1.75A2 2 0 0121 5.002v10.486a2 2 0 01-1.118 1.789L14.447 20l-5.447-2.724zM9 20V10"></path>
                        </svg>
                    </div>
                    <div class="space-y-1 sm:space-y-2">
                        <h1 class="text-h1 sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                            Gestión de <span class="bg-clip-text text-transparent bg-gradient-to-r from-teal-600 to-teal-400">Territorios</span>
                        </h1>
                        <p id="cong-label" class="text-xs sm:text-sm font-black text-slate-600 dark:text-slate-300 tracking-wide uppercase">Cargando congregación...</p>
                    </div>
                </div>

                <!-- Role Selection -->
                <div class="grid grid-cols-1 gap-4 mt-6 sm:mt-8">
                    <button id="btn-admin" class="group modern-card text-left flex items-center gap-4 sm:gap-5 !p-4 sm:!p-5 hover:border-teal-500/30">
                        <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-teal-500/10 flex items-center justify-center text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-all duration-300">
                            <svg class="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                            </svg>
                        </div>
                        <div class="flex-1">
                            <h3 class="text-sm sm:text-base font-bold text-slate-800 dark:text-white mb-0.5">Administrador</h3>
                            <p class="text-[11px] sm:text-[13px] text-slate-600 dark:text-slate-400 font-medium line-clamp-1">Gestión avanzada del sistema</p>
                        </div>
                        <i class="fas fa-chevron-right text-slate-300 group-hover:text-teal-500 transition-colors text-[10px] sm:text-xs"></i>
                    </button>

                    <button id="btn-conductor" class="group modern-card text-left flex items-center gap-4 sm:gap-5 !p-4 sm:!p-5 hover:border-indigo-500/30">
                        <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                            <svg class="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                            </svg>
                        </div>
                        <div class="flex-1">
                            <h3 class="text-sm sm:text-base font-bold text-slate-800 dark:text-white mb-0.5">Conductor</h3>
                            <p class="text-[11px] sm:text-[13px] text-slate-600 dark:text-slate-400 font-medium line-clamp-1">Asignaciones y registros locales</p>
                        </div>
                        <i class="fas fa-chevron-right text-slate-300 group-hover:text-indigo-500 transition-colors text-[10px] sm:text-xs"></i>
                    </button>
                </div>

                <!-- Footer Info -->
                <div class="pt-6 sm:pt-10 space-y-2 opacity-60">
                    <p id="app-version-label" class="text-[11px] text-slate-600 dark:text-slate-400 font-black tracking-tighter uppercase">
                        Plataforma v${appVersion || '1.9.5.1'} · Modern 2026
                    </p>
                    <p class="text-[10px] text-slate-500 dark:text-slate-400 font-bold tracking-tight">© Congregation Software Solutions · Ecuador</p>
                </div>
            </div>
        </div>
    `;

    getConfiguracion().then(config => {
        const label = document.getElementById('cong-label');
        if (label) {
            label.textContent = config.congregacion?.nombre
                ? `Congregación ${config.congregacion.nombre}`
                : "Portal de Gestión Colectiva";
        }
    });

    document.getElementById('btn-admin').addEventListener('click', () => renderAdminLogin(container, appVersion));
    document.getElementById('btn-conductor').addEventListener('click', () => renderConductorSelection(container, appVersion));
};

const renderAdminLogin = (container, appVersion) => {
    container.innerHTML = `
        <div class="min-h-[100dvh] flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
            <div class="w-full max-w-sm glass-morphism p-10 rounded-[2.5rem] space-y-10 animate-slide-up">
                <button id="btn-back" class="group flex items-center gap-2 text-slate-500 hover:text-primary transition-colors font-bold text-sm">
                    <i class="fas fa-arrow-left transition-transform group-hover:-translate-x-1 text-xs"></i>
                    Volver
                </button>

                <div class="text-center space-y-4">
                    <div class="w-14 h-14 bg-primary/10 rounded-2xl mx-auto flex items-center justify-center text-primary shadow-inner">
                        <i class="fas fa-shield-alt text-xl"></i>
                    </div>
                    <div>
                        <h2 class="text-h2 text-slate-900 dark:text-white">Acceso Seguro</h2>
                        <p class="text-sm text-slate-500 mt-2">Identifícate para gestionar tu congregación.</p>
                    </div>
                </div>

                <button id="btn-google-login" class="w-full flex items-center justify-center gap-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[1.25rem] font-bold text-slate-700 dark:text-white hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm active:scale-95 group">
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" class="w-5 h-5 group-hover:scale-110 transition-transform" alt="Google">
                    Entrar con Google
                </button>

                <div id="auth-status" class="text-center">
                    <p id="error-message" class="text-red-500 text-xs font-semibold"></p>
                </div>
            </div>
        </div>
    `;

    document.getElementById('btn-back').addEventListener('click', () => renderLogin(container, appVersion));

    document.getElementById('btn-google-login').addEventListener('click', async () => {
        const errorEl = document.getElementById('error-message');
        errorEl.textContent = 'Verificando credenciales...';

        try {
            const provider = new GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            localStorage.setItem('demo_role', 'Administrador');
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.warn("Auth error:", error);
            errorEl.textContent = `Error: ${error.message}`;
        }
    });
};

const renderConductorSelection = async (container, appVersion) => {
    container.innerHTML = `
        <div class="min-h-[100dvh] bg-slate-50 dark:bg-slate-950 flex flex-col animate-fade-in relative transition-colors duration-500">
            <!-- Header Header -->
            <div class="sticky top-0 z-30 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-xl p-6">
                <div class="max-w-xl mx-auto space-y-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <h2 class="text-h2 text-slate-900 dark:text-white">Publicadores</h2>
                            <p class="text-sm text-slate-600 dark:text-slate-400 font-extrabold tracking-tight">Busca tu nombre en el listado</p>
                        </div>
                        <button id="btn-back-c" class="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 shadow-sm flex items-center justify-center text-slate-400 hover:text-primary transition-colors">
                             <i class="fas fa-times text-lg"></i>
                        </button>
                    </div>
                    
                    <div class="relative group">
                        <div class="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-slate-300 group-focus-within:text-primary transition-colors">
                            <i class="fas fa-search"></i>
                        </div>
                        <input type="text" id="conductor-search" placeholder="Escribe tu nombre..." 
                            class="w-full !pl-14 !py-5 bg-white dark:bg-slate-900 !border-transparent shadow-sm focus:!border-primary/30 transition-all font-bold text-base text-slate-900 dark:text-white">
                    </div>
                </div>
            </div>

            <!-- List Content -->
            <div class="flex-1 overflow-y-auto p-6 pt-2 pb-32">
                <div class="max-w-xl mx-auto">
                    <div id="conductores-list" class="grid grid-cols-1 gap-3">
                        <div class="text-center py-20 space-y-6">
                            <div class="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
                            <p class="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Actualizando directorio...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('btn-back-c').addEventListener('click', () => renderLogin(container, appVersion));

    try {
        const people = await getPublicadores();
        const conductors = people.filter(p => p.es_conductor).sort((a, b) => a.nombre.localeCompare(b.nombre));

        const list = document.getElementById('conductores-list');
        const searchInput = document.getElementById('conductor-search');

        const updateList = (filter = '') => {
            const term = filter.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const filtered = conductors.filter(c =>
                c.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(term)
            );

            if (filtered.length === 0) {
                list.innerHTML = `
                    <div class="text-center py-24 space-y-4 animate-fade-in opacity-80">
                        <div class="w-20 h-20 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto flex items-center justify-center text-slate-400">
                            <i class="fas fa-user-slash text-2xl"></i>
                        </div>
                        <p class="text-slate-500 font-semibold italic">No se encontró a "${filter}"</p>
                    </div>
                `;
                return;
            }

            list.innerHTML = filtered.map(c => `
                <button data-id="${c.id}" data-name="${c.nombre}" data-phone="${c.telefono || ''}"
                    class="conductor-btn group w-full p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/5 flex items-center justify-between transition-all hover:border-primary/30 hover:shadow-lg active:scale-[0.98]">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/5 to-secondary/5 flex items-center justify-center text-primary font-extrabold text-base shadow-inner group-hover:from-primary group-hover:to-primary-light group-hover:text-white transition-all duration-300">
                            ${c.nombre.charAt(0)}
                        </div>
                        <div class="text-left">
                            <h4 class="font-bold text-slate-800 dark:text-slate-100 group-hover:text-primary transition-colors">${c.nombre}</h4>
                            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">${c.telefono ? 'Identificado' : 'Acceso Público'}</p>
                        </div>
                    </div>
                    <i class="fas fa-chevron-right text-slate-200 group-hover:text-primary transition-colors text-xs"></i>
                </button>
            `).join('');

            list.querySelectorAll('.conductor-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const name = btn.getAttribute('data-name');
                    const phone = btn.getAttribute('data-phone');

                    const event = new CustomEvent('demo-login', {
                        detail: {
                            email: phone || name,
                            role: 'Conductor'
                        }
                    });
                    document.dispatchEvent(event);
                });
            });
        };

        searchInput.addEventListener('input', (e) => updateList(e.target.value));
        updateList();
        searchInput.focus();

    } catch (error) {
        console.error('Error fetching conductors:', error);
        list.innerHTML = `
            <div class="p-8 modern-card !border-red-500/20 text-center space-y-5">
                <i class="fas fa-exclamation-triangle text-red-500 text-2xl"></i>
                <p class="text-red-500 font-bold text-sm">Error de sincronización con la base de datos</p>
                <button onclick="location.reload()" class="bg-red-500 text-white px-8 py-3 rounded-xl font-bold text-xs uppercase transition-transform active:scale-95">Reintentar</button>
            </div>
        `;
    }
};





