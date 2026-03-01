import { auth } from '../firebase-config.js';
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getPublicadores, getConfiguracion } from '../data/firestore-services.js';
import { VisualEngine } from './utils/visual-engine.js';

export const renderLogin = (container, appVersion) => {
    const cachedName = localStorage.getItem('cached_congregation_name') || "Sincronizando Portal...";

    container.innerHTML = `
        <div class="${VisualEngine.get('shell.container')} flex flex-col items-center justify-center p-6 relative">
            <!-- Background Decorative Elements -->
            <div class="fixed inset-0 overflow-hidden pointer-events-none opacity-50 dark:opacity-20 animate-fade-in">
                <div class="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] bg-primary/20 blur-[150px] rounded-full animate-pulse"></div>
                <div class="absolute -bottom-[10%] -right-[10%] w-[60%] h-[60%] bg-indigo-500/10 blur-[150px] rounded-full animate-float"></div>
            </div>

            <div id="login-card-container" class="w-full max-w-sm sm:max-w-md space-y-8 text-center relative z-10 animate-fade-in px-2">
                <!-- Brand Header -->
                <div class="space-y-4 sm:space-y-6">
                    <div class="relative w-24 h-24 sm:w-32 sm:h-32 mx-auto mb-8 group">
                        <!-- Soft Ambient Glow -->
                        <div class="absolute inset-0 bg-primary/20 dark:bg-primary/10 blur-[50px] rounded-full scale-125 group-hover:scale-150 transition-all duration-1000 opacity-70"></div>
                        
                        <!-- Main Logo Container (Glass) -->
                        <div class="relative w-full h-full bg-white/60 dark:bg-[#0f1420]/80 backdrop-blur-3xl rounded-[2.5rem] sm:rounded-[3rem] border border-white/40 dark:border-white/10 flex items-center justify-center shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] dark:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)] transform transition-all duration-700 group-hover:scale-105 group-hover:-rotate-3 overflow-hidden">
                            <!-- Subtle Internal Gradient Overlay -->
                            <div class="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
                            
                            <svg viewBox="0 0 512 512" class="w-14 h-14 sm:w-20 sm:h-20 drop-shadow-[0_12px_24px_rgba(13,148,136,0.25)]">
                                <defs>
                                    <linearGradient id="mapGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
                                        <stop offset="100%" style="stop-color:#f0fdfa;stop-opacity:1" />
                                    </linearGradient>
                                </defs>
                                <path d="M48 96 L176 32 L304 96 L432 32 V384 L304 448 L176 384 L48 448 Z" 
                                      fill="url(#mapGrad)" stroke="#0d9488" stroke-width="18" stroke-linejoin="round"/>
                                <path d="M176 32 V384 M304 96 V448" stroke="#0d9488" stroke-width="18" stroke-linecap="round" opacity="0.3"/>
                                <circle cx="240" cy="190" r="50" fill="#14b8a6" stroke="white" stroke-width="10"/>
                                <circle cx="240" cy="190" r="18" fill="white"/>
                                <path d="M240 240 L240 320" stroke="#14b8a6" stroke-width="20" stroke-linecap="round"/>
                            </svg>
                        </div>
                    </div>
                    <div class="space-y-1 sm:space-y-2">
                        <h1 class="text-h1 sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                            Gestión de <span class="bg-clip-text text-transparent bg-gradient-to-r from-teal-600 to-teal-400">Territorios</span>
                        </h1>
                        <p id="cong-label" class="text-[10px] sm:text-xs font-black text-slate-400 dark:text-slate-500 tracking-widest uppercase animate-pulse-slow">${cachedName}</p>
                    </div>
                </div>

                <!-- Role Selection -->
                <div id="selection-area" class="grid grid-cols-1 gap-4 mt-6 sm:mt-8">
                    <!-- Administrador State Wrapper -->
                    <div id="admin-wrapper" class="group ${VisualEngine.get('card.premium')} !p-0 transition-all duration-500 overflow-hidden relative">
                        <!-- Preview State -->
                        <div id="admin-preview" class="flex items-center gap-4 sm:gap-6 p-4 sm:p-6 w-full cursor-pointer hover:bg-primary/5 transition-colors">
                            <div class="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300">
                                 <i class="fas fa-user-shield text-xl sm:text-2xl"></i>
                            </div>
                            <div class="flex-1">
                                <h3 class="text-sm sm:text-lg font-bold text-slate-800 dark:text-white mb-0.5">Administrador</h3>
                                <p class="text-[11px] sm:text-[13px] text-slate-500 dark:text-slate-400 font-medium line-clamp-1">Gestión avanzada del sistema</p>
                            </div>
                            <i class="fas fa-chevron-right text-slate-300 group-hover:text-primary transition-colors text-[10px] sm:text-xs"></i>
                        </div>

                        <!-- Login State -->
                        <div id="admin-login-state" class="hidden flex flex-col items-center text-center p-8 sm:p-12 w-full animate-slide-up gap-8 relative">
                            <!-- Close Button (X) -->
                            <button id="btn-close-admin" class="absolute top-6 right-6 w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all active:scale-95 z-30">
                                <i class="fas fa-times text-base"></i>
                            </button>
                            
                            <div class="w-20 h-20 rounded-[2rem] bg-primary/10 flex items-center justify-center text-primary shadow-inner animate-bounce-in">
                                <i class="fas fa-shield-alt text-3xl"></i>
                            </div>
                            
                            <div class="space-y-2">
                                <h3 class="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Acceso Seguro</h3>
                                <p class="text-[10px] font-black text-primary uppercase tracking-[0.2em] opacity-80">Identidad Digital Xolvy</p>
                            </div>

                            <button id="btn-google-login-action" class="w-full flex items-center justify-center gap-4 py-5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[1.5rem] font-black text-sm text-slate-700 dark:text-white hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-white/10 transition-all shadow-premium active:scale-95 group/google">
                                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" class="w-6 h-6 group-hover/google:scale-110 transition-all duration-300" alt="Google">
                                Entrar con Google
                            </button>
                            
                            <p id="auth-error" class="text-rose-500 text-[10px] font-black uppercase tracking-widest hidden animate-pulse"></p>
                        </div>
                    </div>

                    <!-- Conductor Button -->
                    <button id="btn-conductor" class="group ${VisualEngine.get('card.premium')} !p-4 sm:!p-6 flex items-center gap-4 sm:gap-6 hover:border-secondary/40 text-left transition-all duration-500">
                        <div class="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary group-hover:bg-secondary group-hover:text-white transition-all duration-300">
                             <i class="fas fa-user-friends text-xl sm:text-2xl"></i>
                        </div>
                        <div class="flex-1">
                            <h3 class="text-sm sm:text-lg font-bold text-slate-800 dark:text-white mb-0.5">Conductor</h3>
                            <p class="text-[11px] sm:text-[13px] text-slate-500 dark:text-slate-400 font-medium line-clamp-1">Asignaciones y registros locales</p>
                        </div>
                        <i class="fas fa-chevron-right text-slate-300 group-hover:text-secondary transition-colors text-[10px] sm:text-xs"></i>
                    </button>
                </div>

                <!-- Footer Info -->
                <div class="pt-6 sm:pt-10 space-y-2 opacity-60">
                    <p id="app-version-label" class="text-[11px] text-slate-600 dark:text-slate-400 font-black tracking-tighter uppercase">
                        Plataforma v${appVersion || '2.4.0.7'} · Modern 2026
                    </p>
                    <p class="text-[10px] text-slate-500 dark:text-slate-400 font-bold tracking-tight">© Congregation Software Solutions · Ecuador</p>
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
        }).sort((a, b) => a.nombre.localeCompare(b.nombre));

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





