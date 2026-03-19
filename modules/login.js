import { auth } from '../firebase-config.js';
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getPublicadores, getConfiguracion } from '../data/firestore-services.js';
import { VisualEngine } from './utils/visual-engine.js';

export const renderLogin = (container, appVersion) => {
    const cachedName = localStorage.getItem('cached_congregation_name') || "";

    container.innerHTML = `
        <div class="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-[#060a12] p-6 sm:p-12 md:p-24 relative overflow-hidden font-sans">
            <!-- Espacio Negativo & Fondos Abstractos -->
            <div class="fixed inset-0 overflow-hidden pointer-events-none opacity-40 dark:opacity-20">
                <div class="absolute top-[10%] left-[20%] w-[50%] h-[50%] bg-indigo-500/10 blur-[120px] rounded-full mix-blend-multiply dark:mix-blend-screen animate-pulse"></div>
                <div class="absolute bottom-[20%] right-[10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full mix-blend-multiply dark:mix-blend-screen animate-float"></div>
            </div>

            <header class="absolute top-0 inset-x-0 w-full flex justify-center py-10 z-10 animate-fade-in opacity-50">
                <span class="text-[9px] font-bold tracking-[0.4em] text-slate-500 uppercase">Portal Verificado</span>
            </header>

            <div id="login-card-container" class="w-full max-w-[300px] flex flex-col items-center relative z-10 animate-fade-in">
                
                <!-- Avatar Nexo Mejorado -->
                <div class="relative w-28 h-28 mx-auto mb-10 group cursor-default">
                    <div class="absolute inset-0 bg-indigo-500/20 dark:bg-indigo-500/10 blur-[40px] rounded-[2.5rem] scale-110 group-hover:scale-125 transition-transform duration-1000"></div>
                    <div class="relative w-full h-full bg-white dark:bg-slate-900/50 backdrop-blur-2xl rounded-[2.5rem] border border-slate-100 dark:border-white/10 shadow-2xl flex items-center justify-center overflow-hidden transition-all duration-700 group-hover:shadow-indigo-500/20">
                        <div class="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none"></div>
                        <!-- Nexo AI / Network Icon Minimal -->
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" class="w-10 h-10 text-indigo-500 dark:text-indigo-400 drop-shadow-sm group-hover:scale-110 transition-transform duration-700">
                            <!-- Digital Assistant Sparkle -->
                            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" class="opacity-50 animate-[spin_10s_linear_infinite]" style="transform-origin: center;"></path>
                            <!-- Core Brain/Node -->
                            <rect x="7" y="7" width="10" height="10" rx="3" class="fill-indigo-500/10"></rect>
                            <circle cx="12" cy="12" r="1.5" class="fill-indigo-500 dark:fill-indigo-400"></circle>
                        </svg>
                    </div>
                </div>

                <!-- Tipografía Nexo -->
                <div class="text-center space-y-2 mb-12">
                    <h1 class="text-2xl md:text-3xl font-black tracking-tighter text-slate-900 dark:text-white uppercase flex items-center justify-center">
                        NEX<span class="text-indigo-500 font-light">O</span>
                    </h1>
                    <p id="cong-label" class="text-[9px] font-bold text-slate-400 tracking-[0.25em] uppercase min-h-[14px]">${cachedName}</p>
                </div>

                <!-- Roles Secuencia Lineal Minimalista -->
                <div class="w-full space-y-4">
                    <!-- Administrador -->
                    <div id="admin-wrapper" class="w-full bg-white dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/50 dark:border-white/5 rounded-[2rem] p-2 transition-all duration-500 shadow-sm hover:shadow-xl hover:border-indigo-500/30 overflow-hidden relative">
                        <div id="admin-preview" class="flex items-center gap-4 py-3 px-4 w-full cursor-pointer group">
                            <div class="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 transition-colors group-hover:bg-indigo-500 group-hover:text-white">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                            </div>
                            <div class="flex-1 text-left">
                                <h3 class="text-[11px] font-black tracking-widest uppercase text-slate-800 dark:text-white">Administrador</h3>
                                <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 opacity-70">Acceso Seguro</p>
                            </div>
                        </div>

                        <!-- Estado Login Google -->
                        <div id="admin-login-state" class="hidden flex-col items-center p-6 w-full animate-slide-up relative">
                            <button id="btn-close-admin" class="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-slate-500 dark:hover:text-white transition-colors z-30">
                                <svg viewBox="0 0 24 24" fill="none" class="w-4 h-4" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"></path></svg>
                            </button>
                            
                            <div class="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 mb-4">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                            </div>
                            
                            <button id="btn-google-login-action" class="w-full flex items-center justify-center gap-3 py-3.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl font-bold text-[10px] uppercase tracking-widest text-slate-700 dark:text-white hover:bg-white dark:hover:bg-white/10 transition-all active:scale-95 shadow-sm">
                                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" class="w-4 h-4 opacity-80" alt="Google">
                                Entrar con Google
                            </button>
                            <p id="auth-error" class="text-rose-500 text-[9px] font-black uppercase tracking-widest hidden mt-4 text-center"></p>
                        </div>
                    </div>

                    <!-- Conductor -->
                    <button id="btn-conductor" class="w-full bg-transparent border border-slate-200/50 dark:border-white/5 rounded-[2rem] p-2 flex items-center gap-4 hover:bg-white dark:hover:bg-white/5 hover:border-slate-300 dark:hover:border-white/20 transition-all duration-500 group">
                        <div class="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:bg-slate-800 dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-slate-900 transition-colors">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                        </div>
                        <div class="flex-1 text-left">
                            <h3 class="text-[11px] font-black tracking-widest uppercase text-slate-800 dark:text-white">Conductor</h3>
                            <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 opacity-70">Salidas Hoy</p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    `;

    getConfiguracion().then(config => {
        const label = document.getElementById('cong-label');
        if (label) {
            const name = config.congregacion?.nombre
                ? `Congregación ${config.congregacion.nombre}`
                : "Portal de Gestión Colectiva";
            label.textContent = name;
            label.classList.remove('animate-pulse-slow');
            label.classList.replace('text-slate-400', 'text-slate-600');
            localStorage.setItem('cached_congregation_name', name);
        }
    });

    const adminWrapper = document.getElementById('admin-wrapper');
    const adminPreview = document.getElementById('admin-preview');
    const adminLogin = document.getElementById('admin-login-state');
    const closeBtn = document.getElementById('btn-close-admin');
    const conductorBtn = document.getElementById('btn-conductor');

    adminPreview.addEventListener('click', () => {
        adminPreview.classList.add('hidden');
        adminLogin.classList.remove('hidden');
        conductorBtn.classList.add('opacity-30', 'pointer-events-none', 'grayscale', 'scale-95');
        adminWrapper.classList.add('shadow-2xl', 'ring-2', 'ring-primary/20');
    });

    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        adminLogin.classList.add('hidden');
        adminPreview.classList.remove('hidden');
        conductorBtn.classList.remove('opacity-30', 'pointer-events-none', 'grayscale', 'scale-95');
        adminWrapper.classList.remove('shadow-2xl', 'ring-2', 'ring-primary/20');
    });

    document.getElementById('btn-google-login-action').addEventListener('click', async (e) => {
        e.stopPropagation();
        const errorEl = document.getElementById('auth-error');
        errorEl.classList.remove('hidden');
        errorEl.textContent = 'AUTENTICANDO...';

        try {
            const provider = new GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            localStorage.setItem('demo_role', 'Administrador');
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.warn("Auth error:", error);
            errorEl.textContent = `ERROR: ${error.message}`;
        }
    });

    conductorBtn.addEventListener('click', () => renderConductorSelection(container, appVersion));
};

// Redundant renderAdminLogin removed for unified experience

const renderConductorSelection = async (container, appVersion) => {
    container.innerHTML = `
        <div class="${VisualEngine.get('shell.container')} flex flex-col animate-fade-in relative">
            <!-- Header Header -->
            <div class="sticky top-0 z-30 bg-slate-50/80 dark:bg-[#0b0f1a]/80 backdrop-blur-3xl p-6 border-b border-slate-100 dark:border-white/5">
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
                            class="w-full !pl-16 !py-5 bg-white dark:bg-slate-900 !border-transparent shadow-sm focus:!border-primary/30 transition-all font-bold text-base text-slate-900 dark:text-white">
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
        // Filter: Conductors OR people with modules enabled. 
        // Special rule: Sup. Circuito only appears if also marked as Conductor.
        const conductors = people.filter(p => {
            const isSup = p.privilegios?.includes('Superintendente de Circuito');
            if (isSup) return p.es_conductor;
            return p.es_conductor || p.modulos?.habilitado;
        }).sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || '')));

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

            list.innerHTML = filtered.map(c => {
                const isSup = c.privilegios?.includes('Superintendente de Circuito');
                const roleLabel = isSup ? 'Sup. Circuito' : (c.es_conductor ? 'Conductor' : 'Publicador');

                return `
                    <button data-id="${c.id}" data-name="${c.nombre}" data-phone="${c.telefono || ''}"
                        class="conductor-btn group w-full p-4 ${VisualEngine.get('card.premium')} rounded-2xl flex items-center justify-between transition-all hover:border-primary/40 hover:shadow-xl active:scale-[0.98] text-left">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/5 to-secondary/5 flex items-center justify-center text-primary font-extrabold text-base shadow-inner group-hover:from-primary group-hover:to-primary-light group-hover:text-white transition-all duration-300">
                                ${c.nombre.charAt(0)}
                            </div>
                            <div class="text-left">
                                <h4 class="font-bold text-slate-800 dark:text-slate-100 group-hover:text-primary transition-colors">${c.nombre}</h4>
                                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">${roleLabel}</p>
                            </div>
                        </div>
                        <i class="fas fa-chevron-right text-slate-200 group-hover:text-primary transition-colors text-xs"></i>
                    </button>
                `;
            }).join('');

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
        const listEl = document.getElementById('conductores-list');
        if (listEl) listEl.innerHTML = `
            <div class="p-8 modern-card !border-red-500/20 text-center space-y-5">
                <i class="fas fa-exclamation-triangle text-red-500 text-2xl"></i>
                <p class="text-red-500 font-bold text-sm">Error de sincronización con la base de datos</p>
                <button onclick="location.reload()" class="bg-red-500 text-white px-8 py-3 rounded-xl font-bold text-xs uppercase transition-transform active:scale-95">Reintentar</button>
            </div>
        `;
    }
};





