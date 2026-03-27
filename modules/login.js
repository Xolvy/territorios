import { auth } from '../firebase-config.js';
import { GoogleAuthProvider, signInWithRedirect } from "firebase/auth";
import { getPublicadores, getConfiguracion } from '../data/firestore-services.js';


export const renderLogin = (container, appVersion) => {
    // cachedName removed

    container.innerHTML = `
        <div class="bg-slate-50 min-h-screen flex items-center justify-center p-4 sm:p-8 font-sans animate-fade-in">
            <!-- Split-Card Enterprise -->
            <div class="w-full max-w-4xl bg-white rounded-[2rem] shadow-2xl shadow-slate-200/50 border border-slate-100 flex flex-col md:flex-row overflow-hidden relative z-10 transition-all duration-500 hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.1)]">
                
                <!-- Panel Izquierdo (Identidad) -->
                <div class="md:w-1/2 bg-slate-50/80 p-10 lg:p-14 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-200/60 relative overflow-hidden">
                    <!-- Icon Area -->
                    <div>
                        <div class="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-indigo-500 text-2xl mb-8">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-8 h-8">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                <circle cx="12" cy="10" r="3"></circle>
                            </svg>
                        </div>
                        <h1 class="text-3xl lg:text-4xl font-black text-slate-800 tracking-tight leading-tight uppercase">
                            Gestión de<br>Territorios
                        </h1>
                    </div>
                </div>

                <!-- Panel Derecho (Controles) -->
                <div class="md:w-1/2 p-10 lg:p-14 flex flex-col justify-center bg-white relative min-h-[420px] md:min-h-[480px]">
                    <h2 class="text-sm font-bold text-slate-800 mb-8 uppercase tracking-widest">Selecciona tu perfil de acceso</h2>

                    <div class="w-full">
                        <!-- Administrador Section -->
                        <div id="admin-wrapper" class="w-full">
                            <!-- Admin Initial View -->
                            <button id="admin-preview" class="w-full bg-slate-900 text-white hover:bg-slate-800 rounded-xl p-4 shadow-md transition-all flex items-center justify-center gap-3 active:scale-[0.98]">
                                <i class="fas fa-lock text-slate-400 text-xs"></i>
                                <span class="text-[10px] font-black tracking-widest uppercase">Administrador</span>
                            </button>

                            <!-- Panel Google (Admin) -->
                            <div id="admin-login-state" class="hidden flex-col items-center w-full animate-fade-in relative transition-all duration-300">
                                <div class="w-full border-t border-slate-100 mt-6 pt-6 relative">
                                    <button id="btn-close-admin" class="absolute -top-3 right-0 w-6 h-6 rounded-md flex items-center justify-center bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all z-30 shadow-sm border border-slate-100">
                                        <i class="fas fa-times text-[10px]"></i>
                                    </button>
                                    
                                    <p class="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-4 text-center">Acceso de administrador</p>
                                    
                                    <button id="btn-google-login-action" class="w-full h-[52px] flex items-center justify-center gap-3 bg-white border border-slate-200 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-700 hover:bg-slate-50 hover:border-indigo-300 transition-all active:scale-95 shadow-sm focus:ring-4 focus:ring-indigo-500/10">
                                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" class="w-5 h-5" alt="Google">
                                    </button>
                                    <p id="auth-error" class="text-rose-500 text-[10px] font-black uppercase tracking-widest hidden mt-4 text-center"></p>
                                </div>
                            </div>
                        </div>

                        <!-- Botón Conductor -->
                        <button id="btn-conductor" class="w-full bg-white border-2 border-slate-100 text-slate-700 hover:border-indigo-100 hover:bg-slate-50 rounded-xl p-4 transition-all mt-4 flex items-center justify-center gap-3 active:scale-[0.98]">
                            <i class="fas fa-users text-slate-300 transition-colors text-xs"></i>
                            <span class="text-[10px] font-black tracking-widest uppercase shadow-none">Conductor</span>
                        </button>
                    </div>
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
            localStorage.setItem('cached_congregation_name', name);
        }
    });

    const adminPreview = document.getElementById('admin-preview');
    const adminLogin = document.getElementById('admin-login-state');
    const closeBtn = document.getElementById('btn-close-admin');
    const conductorBtn = document.getElementById('btn-conductor');

    adminPreview.addEventListener('click', () => {
        adminPreview.classList.add('hidden');
        adminLogin.classList.remove('hidden');
        conductorBtn.classList.add('opacity-30', 'pointer-events-none', 'grayscale', 'scale-95');
    });

    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        adminLogin.classList.add('hidden');
        adminPreview.classList.remove('hidden');
        conductorBtn.classList.remove('opacity-30', 'pointer-events-none', 'grayscale', 'scale-95');
    });

    const btnGoogle = document.getElementById('btn-google-login-action');
    btnGoogle.addEventListener('click', async (e) => {
        e.stopPropagation();
        
        btnGoogle.disabled = true;
        btnGoogle.classList.add('opacity-50', 'pointer-events-none');
        btnGoogle.innerHTML = `<div class="w-5 h-5 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>`;
        
        const errorEl = document.getElementById('auth-error');
        errorEl.classList.add('hidden');

        try {
            const provider = new GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            localStorage.setItem('demo_role', 'Administrador');
            await signInWithRedirect(auth, provider);
        } catch (error) {
            console.warn("Auth Redirect error:", error);
            errorEl.classList.remove('hidden');
            errorEl.textContent = `ERROR: ${error.message}`;
            
            btnGoogle.disabled = false;
            btnGoogle.classList.remove('opacity-50', 'pointer-events-none');
            btnGoogle.innerHTML = `<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" class="w-5 h-5" alt="Google">`;
        }
    });

    conductorBtn.addEventListener('click', () => renderConductorSelection(container, appVersion));
};

export const renderConductorSelection = async (container, appVersion) => {
    const modal = document.createElement('div');
    modal.id = 'conductor-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-fade-in';
    
    modal.innerHTML = `
        <div class="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            <!-- Header Modal -->
            <div class="p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div>
                    <h2 class="text-xl font-black text-slate-800 uppercase tracking-tight">Directorio</h2>
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1.5">Busca tu nombre en el listado</p>
                </div>
                <button id="btn-close-modal-c" class="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 hover:text-rose-500 transition-all border border-slate-100 shadow-inner group">
                     <i class="fas fa-times group-hover:rotate-90 transition-transform"></i>
                </button>
            </div>
            
            <div class="p-8 space-y-8 flex-1 overflow-hidden flex flex-col bg-slate-50/30">
                <div class="relative flex items-center w-full mb-4">
                    <div class="absolute inset-y-0 left-0 flex items-center pl-5 pointer-events-none">
                        <i class="fas fa-search text-slate-400 text-lg"></i>
                    </div>
                    <input type="text" id="conductor-search" placeholder="Escribe tu nombre..." 
                        class="w-full py-4 bg-white border-2 border-slate-100 rounded-2xl shadow-sm focus:ring-0 focus:border-indigo-400 transition-all font-bold text-base text-slate-800 placeholder:text-slate-300 outline-none"
                        style="padding-left: 3.5rem !important;">
                </div>

                <!-- Scrollable People List -->
                <div class="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    <div id="conductores-list" class="grid grid-cols-1 gap-4 py-2">
                        <div class="text-center py-20 space-y-6">
                            <div class="w-8 h-8 border-2 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin mx-auto"></div>
                            <p class="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Sincronizando Directorio...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('btn-close-modal-c').onclick = () => modal.remove();

    try {
        const people = await getPublicadores();
        const conductors = people.filter(p => p.es_conductor || p.modulos?.habilitado).sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || '')));

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
                        <p class="text-slate-400 font-bold text-[10px] uppercase tracking-widest">No hay resultados para "${filter}"</p>
                    </div>
                `;
                return;
            }

            list.innerHTML = filtered.map(c => {
                const isSup = c.privilegios?.includes('Superintendente de Circuito');
                const roleLabel = isSup ? 'Sup. Circuito' : (c.es_conductor ? 'Conductor' : 'Publicador');

                return `
                    <button data-id="${c.id}" data-name="${c.nombre}" data-phone="${c.telefono || ''}"
                        class="conductor-btn group w-full p-5 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center justify-between transition-all hover:border-indigo-100 hover:shadow-md active:scale-[0.98] text-left">
                        <div class="flex items-center gap-5">
                            <div class="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-indigo-500 font-black text-base border border-slate-100 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300">
                                ${c.nombre.charAt(0)}
                            </div>
                            <div>
                                <h4 class="font-black text-slate-800 group-hover:text-indigo-600 transition-colors uppercase tracking-tight text-sm">${c.nombre}</h4>
                                <p class="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">${roleLabel}</p>
                            </div>
                        </div>
                        <i class="fas fa-chevron-right text-[10px] text-slate-200 group-hover:text-indigo-400"></i>
                    </button>
                `;
            }).join('');

            list.querySelectorAll('.conductor-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const name = btn.getAttribute('data-name');
                    const phone = btn.getAttribute('data-phone');
                    document.dispatchEvent(new CustomEvent('demo-login', {
                        detail: { email: phone || name, role: 'Conductor' }
                    }));
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
