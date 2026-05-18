import { auth } from '../firebase-config.js';
import { GoogleAuthProvider, signInWithRedirect, getRedirectResult } from "firebase/auth";
import { getPublicadores } from '../data/firestore-services.js';
import { createAdaptiveLogo } from './utils/AdaptiveLogo.js';


export const renderLogin = (container) => {
    // --- XOLVY REDIRECT CAPTURE (PWA SILENT LOGIN) ---
    // SECURITY v4.0: No role check from localStorage.
    // Post-redirect, onAuthStateChanged in app.js will fire,
    // which calls getPermisosUsuario() to verify role from Firestore.
    getRedirectResult(auth).then((result) => {
        if (result && result.user) {
            console.log("💎 [Auth] Redirect Login Exitosa:", result.user.email);
            // Clean stale navigation caches
            localStorage.removeItem('lastPath');
            localStorage.removeItem('lastRoute');
            localStorage.removeItem('redirectUrl');
            sessionStorage.removeItem('lastPath');
            sessionStorage.removeItem('lastRoute');
            sessionStorage.removeItem('redirectUrl');
            // Role routing is handled by onAuthStateChanged → handleAuthChange in app.js
        }
    }).catch((error) => {
        console.error("❌ [Auth] Error en Redirect Login:", error);
    });

    container.innerHTML = `
        <div class="bg-slate-50 dark:bg-slate-950 min-h-screen flex items-center justify-center p-4 sm:p-6 font-sans animate-fade-in relative overflow-hidden w-full max-w-[100vw]" style="min-height: 100vh; min-height: 100dvh;">
            <!-- Professional Deep Glow -->
            <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] bg-blue-900/20 rounded-full blur-[160px] pointer-events-none"></div>

            <div class="z-10 w-full max-w-4xl flex flex-col items-center gap-6 md:gap-8 px-2">
                <div id="login-logo-container" class="animate-fade-in transition-all duration-700 text-center">
                    <h1 class="text-3xl md:text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Sistema de Gestión de Territorios</h1>
                </div>
                
                <div class="w-full bg-white dark:bg-slate-900 enterprise-card p-4 sm:p-6 lg:p-8 shadow-2xl rounded-[2.5rem] grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 box-border">
                
                <!-- Panel Administrador -->
                <button id="btn-google-login" class="group flex flex-col items-center px-4 py-4 sm:p-5 bg-slate-50 dark:bg-white/5 rounded-2xl border-2 border-slate-100 dark:border-white/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-blue-500 w-full max-w-sm mx-auto text-sm sm:text-base text-center cursor-pointer relative z-[9999]">
                    <div class="p-3 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-600/20 mb-3 transition-transform group-hover:scale-105 duration-500">
                        <i class="fas fa-user-shield text-2xl h-8 w-8 flex items-center justify-center"></i>
                    </div>
                    <h2 class="text-xl lg:text-2xl font-extrabold text-slate-950 dark:text-white tracking-tight mb-1 text-center">Administrador</h2>
                    <p class="text-slate-600 dark:text-slate-400 mb-4 text-[10px] lg:text-xs leading-relaxed max-w-[240px]">Gestión total de datos, reportes estratégicos S-13 y analíticas avanzadas.</p>
                    
                    <div id="google-status-wrapper" class="mt-auto pt-2 flex items-center justify-center gap-2 text-[10px] lg:text-xs font-bold text-slate-600 dark:text-slate-400 group-hover:text-blue-600 transition-colors">
                        <img src="https://www.google.com/images/branding/product/2x/googleg_32dp.png" class="w-4 h-4 grayscale group-hover:grayscale-0 transition-all" alt="G">
                        <span>ACCEDER CON GOOGLE &rarr;</span>
                    </div>
                </button>

                <!-- Panel Conductor -->
                    <button id="btn-conductor-trigger" class="btn-pro group flex flex-col items-center px-4 py-6 sm:p-8 bg-white dark:bg-white/5 rounded-[2rem] border-2 border-slate-100 dark:border-white/5 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:border-slate-900 dark:hover:border-white/10 w-full max-w-sm mx-auto text-sm sm:text-base text-center cursor-pointer">
                    <div class="p-3 bg-slate-900 dark:bg-white/10 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-slate-900/20 mb-3 transition-transform group-hover:scale-105 duration-500">
                        <i class="fas fa-map-marked-alt text-2xl h-8 w-8 flex items-center justify-center"></i>
                    </div>
                    <h2 class="text-xl lg:text-2xl font-extrabold text-slate-950 dark:text-white tracking-tight mb-1 text-center">Conductor</h2>
                    <p class="text-slate-600 dark:text-slate-400 mb-4 text-[10px] lg:text-xs leading-relaxed max-w-[240px]">Terminal de campo optimizada para la predicación y gestión de territorios.</p>
                    
                    <div class="mt-auto pt-2 flex items-center justify-center gap-2 text-[10px] lg:text-xs font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                        <span>ENTRAR AL TERMINAL &rarr;</span>
                    </div>
                </button>

                <div id="auth-error" class="hidden col-span-full mt-2 text-rose-600 text-[8px] font-bold uppercase tracking-widest text-center"></div>
            </div>
            
        </div>
    `;

    // Se asegura que el DOM ya ha renderizado antes de bindear (Event Loop Queue)
    setTimeout(() => {
        const btnGoogle = document.getElementById('btn-google-login');
        const googleStatusWrapper = document.getElementById('google-status-wrapper');
        const btnConductorTrigger = document.getElementById('btn-conductor-trigger');
        const errorEl = document.getElementById('auth-error');

        if (btnGoogle) {
            btnGoogle.addEventListener('click', async () => {
                btnGoogle.disabled = true;
                googleStatusWrapper.innerHTML = `<i class="fas fa-circle-notch animate-spin mr-2"></i> Redirigiendo...`;
                
                // FASE 1: Limpieza estricta de rutas previas e ignorar caché de navegación
                localStorage.removeItem('lastPath');
                localStorage.removeItem('lastRoute');
                localStorage.removeItem('redirectUrl');
                localStorage.removeItem('redirectPath');
                sessionStorage.removeItem('lastPath');
                sessionStorage.removeItem('lastRoute');
                sessionStorage.removeItem('redirectUrl');
                sessionStorage.removeItem('redirectPath');
                localStorage.removeItem('xolvy_session'); 
                
                try {
                    const provider = new GoogleAuthProvider();
                    provider.setCustomParameters({ prompt: 'select_account' });
                    // SECURITY v4.0: NO demo_role stored. Role verified from Firestore post-redirect.
                    await signInWithRedirect(auth, provider);
                } catch (error) {
                    console.error("Error en Auth:", error);
                    errorEl.textContent = "Error de Servidor: " + error.message;
                    errorEl.classList.remove('hidden');
                    btnGoogle.disabled = false;
                    googleStatusWrapper.innerHTML = `
                        <img src="https://www.google.com/images/branding/product/2x/googleg_32dp.png" class="w-5 h-5 grayscale group-hover:grayscale-0 transition-all" alt="G">
                        <span>ACCEDER CON GOOGLE &rarr;</span>
                    `;
                    alert("Fallo al iniciar sesión: " + error.message);
                }
            });
        }

        if (btnConductorTrigger) {
            btnConductorTrigger.addEventListener('click', () => renderConductorSelection());
        }

        // Ya no se inyecta el logo verde debido a la solicitud de UI
    }, 0);
};


export const renderConductorSelection = async () => {
    const modal = document.createElement('div');
    modal.id = 'conductor-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-fade-in';
    
    modal.innerHTML = `
        <div class="bg-white dark:bg-[#0a0f18] w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-transparent dark:border-white/10">
            <!-- Header Modal -->
            <div class="p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between shrink-0">
                <div>
                    <h2 class="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Directorio</h2>
                    <p class="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.2em] mt-1.5">Busca tu nombre en el listado</p>
                </div>
                <button id="btn-close-modal-c" class="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-300 dark:text-slate-400 hover:text-rose-500 transition-all border border-slate-100 dark:border-white/10 shadow-inner group">
                     <i class="fas fa-times group-hover:rotate-90 transition-transform"></i>
                </button>
            </div>
            
            <div class="p-8 space-y-8 flex-1 min-w-0 overflow-hidden flex flex-col bg-slate-50/30 dark:bg-black/20">
                <div class="relative flex items-center w-full mb-4">
                    <div class="absolute inset-y-0 left-0 flex items-center pl-5 pointer-events-none">
                        <i class="fas fa-search text-slate-600 dark:text-slate-400 text-lg"></i>
                    </div>
                    <input type="text" id="conductor-search" placeholder="Escribe tu nombre..." 
                        class="w-full py-4 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-white/10 rounded-2xl shadow-sm focus:ring-0 focus:border-indigo-400 transition-all font-bold text-base text-slate-800 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 outline-none"
                        style="padding-left: 3.5rem !important;">
                </div>

                <!-- Scrollable People List -->
                <div class="flex-1 min-w-0 overflow-y-auto pr-2 custom-scrollbar">
                    <div id="conductores-list" class="grid grid-cols-1 gap-4 py-2">
                        <div class="text-center py-20 space-y-6">
                            <div class="w-8 h-8 border-2 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin mx-auto"></div>
                            <p class="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest text-[9px]">Sincronizando Directorio...</p>
                        </div>
                    </div>
                </div>
            </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('btn-close-modal-c').onclick = () => modal.remove();

    try {
        const list = document.getElementById('conductores-list');
        const searchInput = document.getElementById('conductor-search');
        
        let people = [];
        try {
            people = await getPublicadores();
        } catch (e) {
            console.warn('[Login] getPublicadores failed — likely permissions:', e);
            if (list) {
                list.innerHTML = `
                    <div class="text-center py-10 opacity-60">
                        <i class="fas fa-exclamation-triangle mb-3 text-amber-500"></i>
                        <p class="text-[9px] font-black uppercase tracking-widest text-slate-500">Error de Sincronización</p>
                        <p class="text-[8px] font-bold text-slate-600 dark:text-slate-400 mt-1 uppercase tracking-tighter">Reintenta en unos segundos</p>
                    </div>
                `;
            }
            return;
        }

        const conductors = people.filter(p => p.es_conductor || p.modulos?.habilitado).sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || '')));

        const updateList = (filter = '') => {
            const term = filter.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const filtered = conductors.filter(c =>
                c.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(term)
            );

            if (filtered.length === 0) {
                list.innerHTML = `
                    <div class="text-center py-24 space-y-4 animate-fade-in opacity-80">
                        <p class="text-slate-600 dark:text-slate-400 font-bold text-[10px] uppercase tracking-widest">No hay resultados para "${filter}"</p>
                    </div>
                `;
                return;
            }

            list.innerHTML = filtered.map(c => {
                const isSup = c.privilegios?.includes('Superintendente de Circuito');
                const roleLabel = isSup ? 'Sup. Circuito' : (c.es_conductor ? 'Conductor' : 'Publicador');

                return `
                    <button data-id="${c.id}" data-name="${c.nombre}" data-phone="${c.telefono || ''}"
                        class="conductor-btn group w-full p-5 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl shadow-sm flex items-center justify-between transition-all hover:border-indigo-200 dark:hover:border-indigo-500/50 hover:shadow-md active:scale-[0.98] text-left">
                        <div class="flex items-center gap-5">
                            <div class="w-12 h-12 rounded-xl bg-slate-50 dark:bg-black/20 flex items-center justify-center text-indigo-500 font-black text-base border border-slate-100 dark:border-white/5 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300">
                                ${c.nombre.charAt(0)}
                            </div>
                            <div>
                                <h4 class="font-black text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors uppercase tracking-tight text-sm">${c.nombre}</h4>
                                <p class="text-[8px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest mt-1">${roleLabel}</p>
                            </div>
                        </div>
                        <i class="fas fa-chevron-right text-[10px] text-slate-800 dark:text-slate-200 group-hover:text-indigo-400"></i>
                    </button>
                `;
            }).join('');

            list.querySelectorAll('.conductor-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const name = btn.getAttribute('data-name');
                    const phone = btn.getAttribute('data-phone');

                    // Helper para capitalizar tipo oración:
                    const toTitleCase = (str) => String(str || '')
                        .toLowerCase()
                        .split(' ')
                        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                        .join(' ');
                    
                    const nombreCapitalizado = toTitleCase(name);
                    
                    // 2. State mutations (IdentityShield handles resolution in app.js via demo-login)
                    // SECURITY v4.0: NO demo_role stored. Role verified from Firestore via IdentityShield.
                    localStorage.setItem('selected_conductor_name', phone || name);
                    
                    const sessionData = { nombre: nombreCapitalizado, email: phone || name, rol: 'Conductor' };
                    localStorage.setItem('xolvy_session', JSON.stringify(sessionData));
                    
                    window.XolvyApp = window.XolvyApp || {};
                    window.XolvyApp.user = sessionData;

                    // 3. SaaS Premium Loading State (Fix Parpadeo)
                    modal.innerHTML = `
                        <div class="w-full h-full flex items-center justify-center bg-slate-50/90 dark:bg-[#0a0f18]/95 backdrop-blur-3xl animate-fade-in relative overflow-hidden">
                            <!-- Premium Glows -->
                            <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>
                            
                            <div class="z-10 flex flex-col items-center gap-8">
                                <div class="relative">
                                    <div class="w-24 h-24 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin"></div>
                                    <div class="absolute inset-0 flex items-center justify-center">
                                        <i class="fas fa-id-card text-indigo-500 text-2xl animate-pulse"></i>
                                    </div>
                                </div>
                                <div class="text-center">
                                    <h3 class="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Sincronizando Perfil</h3>
                                    <p class="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-[0.3em] mt-3">Iniciando terminal para <span class="text-indigo-500">${name}</span></p>
                                </div>
                            </div>
                            
                        </div>
                    `;
                    modal.className = 'fixed inset-0 z-[99999] flex items-center justify-center p-0';
                    
                    // Zero-Bounce: Forzar suspensión de cambios de Auth por 500ms
                    window._authSuspended = true;
                    setTimeout(() => window._authSuspended = false, 500);

                    // Dispatch routing trigger programmatically
                    document.dispatchEvent(new CustomEvent('demo-login', {
                        detail: { email: phone || name, role: 'Conductor' }
                    }));

                    // El loader se removerá automáticamente cuando el Dashboard se monte y limpie el body/container
                });
            });
        };

        searchInput.addEventListener('input', (e) => updateList(e.target.value));
        updateList();
        searchInput.focus();

    } catch (error) {
        console.error('Error directory sync:', error);
    }
};
