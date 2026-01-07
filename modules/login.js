import { auth } from '../firebase-config.js?v=3.2.0';
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getPublicadores, getConfiguracion } from '../data/firestore-services.js?v=3.2.0';

export const renderLogin = (container) => {
    container.innerHTML = `
        <div class="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-500/10 via-transparent to-transparent">
            
            <div id="login-card-container" class="w-full max-w-md space-y-8 text-center animate-slide-up">
                <!-- Brand Header -->
                <div class="space-y-4">
                    <div class="w-24 h-24 bg-teal-600 rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-teal-500/30 rotate-3 hover:rotate-0 transition-transform duration-500 animate-float">
                        <svg class="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A2 2 0 013 15.488V5.002a2 2 0 011.553-1.948l7-1.75a2 2 0 01.894 0l7 1.75A2 2 0 0121 5.002v10.486a2 2 0 01-1.118 1.789L14.447 20l-5.447-2.724zM9 20V10"></path>
                        </svg>
                    </div>
                    <h1 class="text-4xl font-black tracking-tight text-slate-900 dark:text-white sm:text-5xl">
                        Territorios <span class="text-teal-600">Pro</span>
                    </h1>
                    <p id="cong-label" class="text-slate-500 dark:text-slate-400 font-medium animate-pulse">Cargando configuración...</p>
                </div>

                <!-- Role Selection -->
                <div class="grid grid-cols-1 gap-4 mt-12">
                    <button id="btn-admin" class="group relative p-6 glass-morphism rounded-3xl border border-white/20 dark:border-white/5 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-teal-500/10 active:scale-95">
                        <div class="flex items-center gap-5">
                            <div class="w-14 h-14 rounded-2xl bg-teal-500/10 flex items-center justify-center text-teal-600 group-hover:bg-teal-500 group-hover:text-white transition-colors duration-300">
                                <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                                </svg>
                            </div>
                            <div>
                                <h3 class="text-xl font-bold text-slate-800 dark:text-white">Administrador</h3>
                                <p class="text-sm text-slate-500 dark:text-slate-400">Gestión total de territorios</p>
                            </div>
                        </div>
                    </button>

                    <button id="btn-conductor" class="group relative p-6 glass-morphism rounded-3xl border border-white/20 dark:border-white/5 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-indigo-500/10 active:scale-95">
                        <div class="flex items-center gap-5">
                            <div class="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-500 group-hover:text-white transition-colors duration-300">
                                <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                                </svg>
                            </div>
                            <div>
                                <h3 class="text-xl font-bold text-slate-800 dark:text-white">Conductor</h3>
                                <p class="text-sm text-slate-500 dark:text-slate-400">Mis asignaciones de predicación</p>
                            </div>
                        </div>
                    </button>
                </div>

                <!-- Footer Info -->
                <div class="pt-8 space-y-1">
                    <p id="app-version-label" class="text-xs text-slate-400 uppercase tracking-widest font-bold">Version 3.1.5 PRO</p>
                    <p class="text-[10px] text-slate-400/60 font-medium">© 2026 Developed for Congregation Support</p>
                </div>
            </div>
        </div>
    `;

    // Load Congregation Name
    getConfiguracion().then(config => {
        const label = document.getElementById('cong-label');
        if (label) {
            label.classList.remove('animate-pulse');
            label.textContent = config.congregacion?.nombre
                ? `Congregación ${config.congregacion.nombre} ${config.congregacion.numero || ''}`
                : "Sistema de Gestión de Territorios";
        }
    });

    document.getElementById('btn-admin').addEventListener('click', () => renderAdminLogin(container));
    document.getElementById('btn-conductor').addEventListener('click', () => renderConductorSelection(container));
};

const renderAdminLogin = (container) => {
    container.innerHTML = `
        <div class="min-h-[100dvh] flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
            <div class="w-full max-w-sm glass-morphism p-8 rounded-[2.5rem] border border-white/20 dark:border-white/5 space-y-8 animate-slide-up shadow-2xl">
                <button id="btn-back" class="group flex items-center gap-2 text-slate-500 hover:text-teal-600 transition-colors font-bold text-sm">
                    <svg class="w-5 h-5 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                    Volver
                </button>

                <div class="text-center space-y-3">
                    <div class="w-16 h-16 bg-teal-500/10 rounded-2xl mx-auto flex items-center justify-center text-teal-600">
                        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                    </div>
                    <h2 class="text-2xl font-black text-slate-800 dark:text-white">Acceso Administrador</h2>
                    <p class="text-sm text-slate-500 dark:text-slate-400">Por favor, identifícate con tu cuenta de Google autorizada.</p>
                </div>

                <button id="btn-google-login" class="w-full flex items-center justify-center gap-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl font-bold text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm active:scale-95 group">
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" class="w-6 h-6 grayscale group-hover:grayscale-0 transition-all" alt="Google">
                    Continuar con Google
                </button>

                <div id="auth-status" class="text-center">
                    <p id="error-message" class="text-red-500 text-sm font-medium"></p>
                </div>
            </div>
        </div>
    `;

    document.getElementById('btn-back').addEventListener('click', () => renderLogin(container));

    document.getElementById('btn-google-login').addEventListener('click', async () => {
        const errorEl = document.getElementById('error-message');
        errorEl.textContent = 'Abriendo ventana de Google...';

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

const renderConductorSelection = async (container) => {
    container.innerHTML = `
        <div class="min-h-[100dvh] bg-slate-50 dark:bg-slate-950 flex flex-col animate-fade-in">
            <!-- Header Sticky -->
            <div class="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 p-6">
                <div class="max-w-xl mx-auto space-y-5">
                    <div class="flex items-center justify-between">
                        <h2 class="text-2xl font-black text-slate-900 dark:text-white">Selecciona tu Nombre</h2>
                        <button id="btn-back-c" class="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-teal-600 transition-colors">
                             <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                        </button>
                    </div>
                    
                    <div class="relative group">
                        <div class="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-teal-500 transition-colors">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        </div>
                        <input type="text" id="conductor-search" placeholder="Buscar mi nombre..." 
                            class="w-full pl-14 pr-4 py-5 bg-slate-100 dark:bg-slate-800 border-none rounded-[2rem] focus:ring-2 focus:ring-teal-500 transition-all font-bold text-lg text-slate-900 dark:text-white placeholder:text-slate-400">
                    </div>
                </div>
            </div>

            <!-- List Content -->
            <div class="flex-1 overflow-y-auto p-6 scroll-smooth">
                <div class="max-w-xl mx-auto">
                    <div id="conductores-list" class="grid grid-cols-1 gap-3 pb-24">
                        <div class="text-center py-12 space-y-4">
                            <div class="w-12 h-12 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin mx-auto"></div>
                            <p class="text-slate-400 font-bold uppercase tracking-widest text-xs">Cargando publicadores...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('btn-back-c').addEventListener('click', () => renderLogin(container));

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
                    <div class="text-center py-20 space-y-4 opacity-70 animate-fade-in">
                        <div class="text-5xl">🔍</div>
                        <p class="text-slate-400 font-bold">No se encontró a "${filter}"</p>
                        <button class="text-teal-600 font-black text-sm uppercase tracking-wider" onclick="document.getElementById('conductor-search').value=''; document.getElementById('conductor-search').dispatchEvent(new Event('input'))">Ver todos</button>
                    </div>
                `;
                return;
            }

            list.innerHTML = filtered.map(c => `
                <button data-id="${c.id}" data-name="${c.nombre}" data-phone="${c.telefono || ''}"
                    class="conductor-btn group w-full p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between transition-all hover:border-teal-500/50 hover:shadow-xl hover:shadow-teal-500/5 active:scale-[0.98] animate-fade-in">
                    <div class="flex items-center gap-5">
                        <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500/10 to-indigo-500/10 flex items-center justify-center text-teal-600 dark:text-teal-400 font-black text-xl shadow-inner group-hover:from-teal-500 group-hover:to-teal-600 group-hover:text-white transition-all duration-300">
                            ${c.nombre.charAt(0)}
                        </div>
                        <div class="text-left">
                            <h4 class="font-black text-lg text-slate-800 dark:text-slate-100 transition-colors group-hover:text-teal-600 dark:group-hover:text-teal-400">${c.nombre}</h4>
                            <p class="text-xs font-bold text-slate-400 uppercase tracking-tighter">${c.telefono ? '' : 'Acceso Público'}</p>
                        </div>
                    </div>
                    <div class="w-10 h-10 rounded-full flex items-center justify-center text-slate-300 group-hover:text-teal-500 group-hover:bg-teal-50 dark:group-hover:bg-teal-500/10 transition-all">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M9 5l7 7-7 7"></path></svg>
                    </div>
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
        document.getElementById('conductores-list').innerHTML = `
            <div class="p-8 bg-red-500/10 rounded-3xl border border-red-500/20 text-center space-y-3">
                <p class="text-red-500 font-bold">Error al conectar con el servidor</p>
                <button onclick="location.reload()" class="bg-red-500 text-white px-6 py-2 rounded-xl text-sm font-bold">Reintentar</button>
            </div>
        `;
    }
};





