import { GoogleAuthProvider, signInAnonymously, signInWithRedirect } from "firebase/auth";
import { getPublicadores } from "../data/firestore-services.js";
import { auth } from "../firebase-config.js";
import { XolvyAlert } from "./utils/alerts.js";
import { applyTheme } from "./utils/theme-manager.js";

export const renderLogin = (container) => {
    applyTheme("auto");

    container.innerHTML = `
        <div class="bg-slate-50/60 dark:bg-[#030712]/60 min-h-screen flex items-center justify-center p-3 sm:p-5 font-sans animate-fade-in relative overflow-hidden w-full max-w-[100vw] backdrop-blur-[45px] transition-colors duration-700 ease-in-out" style="min-height: 100vh; min-height: 100dvh;">
            
            <div class="noise-overlay"></div>

            <div class="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-slate-500/10 dark:bg-slate-500/5 rounded-full blur-[120px] pointer-events-none"></div>
            <div class="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none"></div>
            <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/5 dark:bg-indigo-500/2 rounded-full blur-[140px] pointer-events-none"></div>

            <div class="z-10 w-full flex flex-col items-center gap-5 sm:gap-6 px-2 sm:px-4 relative max-w-3xl mx-auto">
                
                <!-- Logo Badge & Dynamic Title -->
                <div id="login-logo-container" class="animate-fade-in transition-all duration-700 text-center flex flex-col items-center">
                    <div class="w-11 h-11 sm:w-14 sm:h-14 bg-gradient-to-tr from-emerald-600 via-indigo-600 to-indigo-700 rounded-2xl flex items-center justify-center text-white text-lg sm:text-2xl shadow-[0_12px_40px_rgba(99,102,241,0.35)] border border-white/20 mb-2.5 animate-float relative overflow-hidden group">
                        <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                        <i class="fas fa-layer-group"></i>
                    </div>
                    <h1 class="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 dark:from-white dark:via-slate-200 dark:to-slate-400 bg-clip-text text-transparent uppercase text-center font-sans">
                        Sistema de Territorios
                    </h1>
                    <div class="flex items-center gap-2 sm:gap-3 mt-1 sm:mt-2">
                        <div class="h-[1px] w-6 bg-slate-300 dark:bg-white/10"></div>
                        <p class="text-[9px] sm:text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.25em] sm:tracking-[0.3em] leading-none">
                            CONGREGACIÓN NUEVE DE OCTUBRE
                        </p>
                        <div class="h-[1px] w-6 bg-slate-300 dark:bg-white/10"></div>
                    </div>
                </div>
                
                <!-- 3 CARDS RESPONSIVE GRID CONTAINER (Compact max-w-3xl) -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4 w-full max-w-2xl">
                
                    <!-- Card 1: ADMINISTRADOR (Azul Marino Ejecutivo / Ámbar Dorado) -->
                    <div class="group flex flex-col p-4 sm:p-4.5 bg-white/70 dark:bg-slate-900/60 rounded-[2rem] border border-slate-200/60 dark:border-white/5 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-1.5 hover:border-slate-700/50 dark:hover:border-blue-500/40 text-center relative z-10 backdrop-blur-xl justify-between min-h-[255px]">
                        <div>
                            <div class="w-10 h-10 bg-gradient-to-tr from-slate-900 via-slate-800 to-blue-950 text-amber-400 rounded-2xl flex items-center justify-center border border-amber-400/30 shadow-lg shadow-slate-900/30 group-hover:scale-110 transition-all duration-500 mb-2 mx-auto">
                                <i class="fas fa-user-shield text-sm"></i>
                            </div>
                            <h2 class="text-sm font-bold text-slate-900 dark:text-white uppercase leading-none mb-1.5">Administrador</h2>
                            <p class="text-[11px] text-slate-500 dark:text-slate-400 mb-2 leading-snug font-medium px-0.5">
                                Administración del Sistema de Territorios
                            </p>
                        </div>

                        <div class="space-y-1.5 w-full">
                            <button id="btn-login-list-admin" class="w-full bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-amber-300 dark:text-white py-2.5 px-3 rounded-2xl text-[8.5px] font-black uppercase tracking-widest shadow-md shadow-slate-900/20 border border-amber-400/20 dark:border-blue-400/20 transition-all flex items-center justify-center gap-1.5 active:scale-95">
                                <i class="fas fa-list-ul text-[11px]"></i>
                                <span>Iniciar Sesión</span>
                            </button>

                            <button id="btn-login-google-admin" class="w-full bg-slate-100/90 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 py-2 px-3 rounded-2xl text-[8px] font-black uppercase tracking-widest border border-slate-200/80 dark:border-white/10 transition-all flex items-center justify-center gap-1.5 active:scale-95">
                                <img src="https://www.google.com/images/branding/product/2x/googleg_32dp.png" class="w-3 h-3 object-contain" alt="G">
                                <span>Iniciar Sesión con Google</span>
                            </button>
                        </div>
                    </div>

                    <!-- Card 2: CONDUCTOR (Verde Esmeralda) -->
                    <div class="group flex flex-col p-4 sm:p-4.5 bg-white/70 dark:bg-slate-900/60 rounded-[2rem] border border-slate-200/60 dark:border-white/5 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-1.5 hover:border-emerald-500/40 text-center relative z-10 backdrop-blur-xl justify-between min-h-[255px]">
                        <div>
                            <div class="w-10 h-10 bg-gradient-to-tr from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/25 group-hover:scale-110 transition-all duration-500 mb-2 mx-auto">
                                <i class="fas fa-map-marked-alt text-sm"></i>
                            </div>
                            <h2 class="text-sm font-bold text-slate-800 dark:text-white uppercase leading-none mb-1.5">Conductor</h2>
                            <p class="text-[11px] text-slate-500 dark:text-slate-400 mb-2 leading-snug font-medium px-0.5">
                                Control de asignaciones de territorio.
                            </p>
                        </div>

                        <div class="space-y-1.5 w-full">
                            <button id="btn-login-list-conductor" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 px-3 rounded-2xl text-[8.5px] font-black uppercase tracking-widest shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5 active:scale-95">
                                <i class="fas fa-list-ul text-[11px]"></i>
                                <span>Iniciar Sesión</span>
                            </button>

                            <button id="btn-login-google-conductor" class="w-full bg-slate-100/90 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 py-2 px-3 rounded-2xl text-[8px] font-black uppercase tracking-widest border border-slate-200/80 dark:border-white/10 transition-all flex items-center justify-center gap-1.5 active:scale-95">
                                <img src="https://www.google.com/images/branding/product/2x/googleg_32dp.png" class="w-3 h-3 object-contain" alt="G">
                                <span>Iniciar Sesión con Google</span>
                            </button>
                        </div>
                    </div>

                    <!-- Card 3: PUBLICADOR (Violeta / Índigo) -->
                    <div class="group flex flex-col p-4 sm:p-4.5 bg-white/70 dark:bg-slate-900/60 rounded-[2rem] border border-slate-200/60 dark:border-white/5 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-1.5 hover:border-indigo-500/40 text-center relative z-10 backdrop-blur-xl justify-between min-h-[255px]">
                        <div>
                            <div class="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 group-hover:scale-110 transition-all duration-500 mb-2 mx-auto">
                                <i class="fas fa-users text-sm"></i>
                            </div>
                            <h2 class="text-sm font-bold text-slate-800 dark:text-white uppercase leading-none mb-1.5">Publicador</h2>
                            <p class="text-[11px] text-slate-500 dark:text-slate-400 mb-2 leading-snug font-medium px-0.5">
                                Mapas y programa de territorios.
                            </p>
                        </div>

                        <div class="space-y-1.5 w-full">
                            <button id="btn-login-list-publicador" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 px-3 rounded-2xl text-[8.5px] font-black uppercase tracking-widest shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-1.5 active:scale-95">
                                <i class="fas fa-list-ul text-[11px]"></i>
                                <span>Iniciar Sesión</span>
                            </button>

                            <button id="btn-login-google-publicador" class="w-full bg-slate-100/90 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 py-2 px-3 rounded-2xl text-[8px] font-black uppercase tracking-widest border border-slate-200/80 dark:border-white/10 transition-all flex items-center justify-center gap-1.5 active:scale-95">
                                <img src="https://www.google.com/images/branding/product/2x/googleg_32dp.png" class="w-3 h-3 object-contain" alt="G">
                                <span>Iniciar Sesión con Google</span>
                            </button>
                        </div>
                    </div>

                    <div id="auth-error" class="hidden col-span-full mt-2 text-rose-600 text-[8px] font-bold uppercase tracking-widest text-center animate-pulse"></div>
                </div>
                
            </div>
        </div>
    `;

    setTimeout(() => {
        const btnAdminList = document.getElementById("btn-login-list-admin");
        const btnAdminGoogle = document.getElementById("btn-login-google-admin");
        const btnConductorList = document.getElementById("btn-login-list-conductor");
        const btnConductorGoogle = document.getElementById("btn-login-google-conductor");
        const btnPublicadorList = document.getElementById("btn-login-list-publicador");
        const btnPublicadorGoogle = document.getElementById("btn-login-google-publicador");
        const errorEl = document.getElementById("auth-error");

        const triggerGoogleAuth = async (targetBtn) => {
            if (targetBtn.classList.contains("pointer-events-none")) return;
            targetBtn.classList.add("pointer-events-none", "opacity-50");

            localStorage.removeItem("lastPath");
            localStorage.removeItem("lastRoute");
            localStorage.removeItem("xolvy_session");

            try {
                const provider = new GoogleAuthProvider();
                provider.setCustomParameters({ prompt: "select_account" });
                await signInWithRedirect(auth, provider);
            } catch (error) {
                console.error("Error en Auth:", error);
                if (errorEl) {
                    errorEl.textContent = `Error de Auth: ${error.message}`;
                    errorEl.classList.remove("hidden");
                }
                targetBtn.classList.remove("pointer-events-none", "opacity-50");
            }
        };

        if (btnAdminGoogle) btnAdminGoogle.onclick = () => triggerGoogleAuth(btnAdminGoogle);
        if (btnConductorGoogle) btnConductorGoogle.onclick = () => triggerGoogleAuth(btnConductorGoogle);
        if (btnPublicadorGoogle) btnPublicadorGoogle.onclick = () => triggerGoogleAuth(btnPublicadorGoogle);

        const ensureAnonAuth = async () => {
            if (auth.currentUser) return true;
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    await signInAnonymously(auth);
                    return true;
                } catch (err) {
                    console.warn(`[Login] Anon auth attempt ${attempt + 1} failed:`, err.message);
                    if (attempt < 2) await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
                }
            }
            console.error("[Login] Anonymous auth failed after 3 attempts");
            return false;
        };

        if (btnAdminList) {
            btnAdminList.onclick = async () => {
                const ok = await ensureAnonAuth();
                if (!ok) { if (errorEl) { errorEl.textContent = 'Error de autenticación. Verifica tu conexión.'; errorEl.classList.remove('hidden'); } return; }
                renderRoleDirectorySelection("Administrador");
            };
        }

        if (btnConductorList) {
            btnConductorList.onclick = async () => {
                const ok = await ensureAnonAuth();
                if (!ok) { if (errorEl) { errorEl.textContent = 'Error de autenticación. Verifica tu conexión.'; errorEl.classList.remove('hidden'); } return; }
                renderRoleDirectorySelection("Conductor");
            };
        }

        if (btnPublicadorList) {
            btnPublicadorList.onclick = async () => {
                const ok = await ensureAnonAuth();
                if (!ok) { if (errorEl) { errorEl.textContent = 'Error de autenticación. Verifica tu conexión.'; errorEl.classList.remove('hidden'); } return; }
                renderRoleDirectorySelection("Publicador");
            };
        }
    }, 0);
};

export const renderRoleDirectorySelection = async (targetRole = "Conductor") => {
    const modal = document.createElement("div");
    modal.id = "conductor-modal";
    modal.className =
        "fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-md p-4 animate-fade-in";

    const titleRoleLabel = targetRole === "Administrador" ? "Administradores" : targetRole === "Conductor" ? "Conductores" : "Publicadores";

    modal.innerHTML = `
        <div class="modal-card-premium relative bg-white dark:bg-[#0a0f18] w-full rounded-[2.5rem] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-transparent dark:border-white/10 transform transition-all" style="max-width: 28rem !important;">
            <!-- Header Modal -->
            <div class="relative px-6 py-5 sm:px-8 sm:py-6 border-b border-slate-100 dark:border-white/5 flex flex-col justify-center shrink-0 pr-16">
                <div>
                    <h2 class="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight font-sans">Directorio de ${titleRoleLabel}</h2>
                    <p class="text-[10px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-[0.25em] mt-1.5 leading-none">Selecciona tu nombre de la lista</p>
                </div>
                <!-- Close Button strictly pinned to top right -->
                <button id="btn-close-modal-c" class="absolute top-5 right-5 sm:top-6 sm:right-6 w-10 h-10 rounded-xl bg-slate-100/80 dark:bg-white/5 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/20 transition-all border border-slate-200/60 dark:border-white/10 shadow-inner group cursor-pointer focus:outline-none z-20" title="Cerrar">
                     <i class="fas fa-times group-hover:rotate-90 transition-transform text-xs"></i>
                </button>
            </div>
            
            <div class="p-6 sm:p-8 space-y-4 flex-1 min-w-0 overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-900/40">
                <div class="relative flex items-center w-full">
                    <div class="absolute inset-y-0 left-0 flex items-center pl-5 pointer-events-none">
                        <i class="fas fa-search text-slate-450 dark:text-slate-500 text-base"></i>
                    </div>
                    <input type="text" id="conductor-search" placeholder="Escribe tu nombre..." 
                        class="w-full py-4 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl shadow-sm focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all font-bold text-base text-slate-800 dark:text-white placeholder:text-slate-350 dark:placeholder:text-slate-655 outline-none"
                        style="padding-left: 3.5rem !important;">
                </div>
 
                <!-- Scrollable People List -->
                <div class="flex-1 min-w-0 overflow-y-auto pr-2 custom-scrollbar">
                    <div id="conductores-list" class="grid grid-cols-1 gap-3 py-2">
                        <div class="text-center py-20 space-y-6">
                            <div class="relative w-12 h-12 mx-auto">
                                <div class="w-12 h-12 border-4 border-indigo-500/15 border-t-indigo-500 rounded-full animate-spin"></div>
                            </div>
                            <p class="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[9px]">Sincronizando Listado...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById("btn-close-modal-c").onclick = () => modal.remove();

    try {
        const list = document.getElementById("conductores-list");
        const searchInput = document.getElementById("conductor-search");

        let people = [];
        try {
            people = await getPublicadores();
        } catch (e) {
            console.warn("[Login] getPublicadores failed:", e);
            if (list) {
                list.innerHTML = `
                    <div class="text-center py-10 opacity-60">
                        <p class="text-[9px] font-black uppercase tracking-widest text-slate-500">Error al cargar directorio</p>
                    </div>
                `;
            }
            return;
        }

        // Strict List Depuration & Filtering
        let filteredPeople = [];
        if (targetRole === "Administrador") {
            filteredPeople = people.filter((p) => {
                const r = (p.rol || "").toLowerCase();
                const privs = Array.isArray(p.privilegios) ? p.privilegios.map(x => String(x).toLowerCase()) : [];
                return r === "administrador" || r === "superadmin" || p.es_admin === true || p.es_superadmin === true || privs.includes("administrador") || privs.includes("superadmin");
            });
        } else if (targetRole === "Conductor") {
            filteredPeople = people.filter((p) => {
                const r = (p.rol || "").toLowerCase();
                const privs = Array.isArray(p.privilegios) ? p.privilegios.map(x => String(x).toLowerCase()) : [];
                return r === "conductor" || p.es_conductor === true || p.modulos?.habilitado === true || privs.includes("conductor");
            });
        } else {
            // Publicadores (only those with Publicador role or standard publishers)
            filteredPeople = people.filter((p) => {
                const r = (p.rol || "").toLowerCase();
                const privs = Array.isArray(p.privilegios) ? p.privilegios.map(x => String(x).toLowerCase()) : [];
                const isAdmin = r === "administrador" || r === "superadmin" || p.es_admin || p.es_superadmin || privs.includes("administrador");
                const isCond = r === "conductor" || p.es_conductor || privs.includes("conductor");
                return r === "publicador" || (!isAdmin && !isCond);
            });
        }

        filteredPeople.sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")));

        const updateList = (filter = "") => {
            const term = filter.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const displayList = filteredPeople.filter((c) =>
                String(c.nombre || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(term)
            );

            if (displayList.length === 0) {
                list.innerHTML = `
                    <div class="text-center py-20 space-y-4 opacity-70">
                        <p class="text-slate-600 dark:text-slate-400 font-bold text-[10px] uppercase tracking-widest">No hay resultados para "${filter}"</p>
                    </div>
                `;
                return;
            }

            list.innerHTML = displayList
                .map((c) => {
                    const badgeBg = targetRole === "Administrador" ? "bg-slate-900/10 text-slate-800 dark:text-amber-400 border-amber-500/20 group-hover:bg-slate-900 group-hover:text-amber-400" : targetRole === "Conductor" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-white" : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 group-hover:bg-indigo-500 group-hover:text-white";
                    const roleHoverText = targetRole === "Administrador" ? "group-hover:text-slate-900 dark:group-hover:text-amber-400" : targetRole === "Conductor" ? "group-hover:text-emerald-600 dark:group-hover:text-emerald-400" : "group-hover:text-indigo-600 dark:group-hover:text-indigo-400";
                    
                    return `
                    <button data-id="${c.id}" data-name="${c.nombre}" data-phone="${c.telefono || ""}"
                        class="conductor-btn group w-full p-4 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl shadow-sm flex items-center justify-between transition-all hover:border-slate-800/40 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 hover:shadow-md active:scale-[0.98] text-left cursor-pointer focus:outline-none">
                        <div class="flex items-center gap-4">
                            <div class="w-10 h-10 rounded-xl ${badgeBg} flex items-center justify-center font-black text-sm border transition-all">
                                ${c.nombre.charAt(0)}
                            </div>
                            <div>
                                <h4 class="font-black text-slate-800 dark:text-white ${roleHoverText} transition-colors uppercase tracking-tight text-xs">${c.nombre}</h4>
                                <p class="text-[8px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">${targetRole}</p>
                            </div>
                        </div>
                        <i class="fas fa-key text-[10px] text-slate-400 group-hover:text-slate-800 dark:group-hover:text-amber-400 transition-all"></i>
                    </button>
                `;
                })
                .join("");

            list.querySelectorAll(".conductor-btn").forEach((btn) => {
                btn.onclick = async (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const name = btn.getAttribute("data-name");

                    // Default password based on role
                    const defaultPassword = targetRole === "Administrador" ? "admin" : targetRole === "Conductor" ? "conductor" : "publicador";
                    
                    const { value: passInput } = await XolvyAlert.fire({
                        title: `Hola, ${name}`,
                        text: `Ingresa tu contraseña de ${targetRole}:`,
                        input: "password",
                        inputPlaceholder: "Contraseña...",
                        showCancelButton: true,
                        confirmButtonText: "Ingresar",
                        cancelButtonText: "Cancelar",
                        width: "340px",
                        customClass: {
                            container: "!z-[100000] !flex !items-center !justify-center",
                            popup: "!z-[100000] modern-card !rounded-[2.5rem] !p-6 !border !border-slate-200 dark:!border-white/10 !shadow-2xl !bg-white/95 dark:!bg-slate-900/95 !w-[340px] !max-w-[90vw] !mx-auto !box-border",
                            title: "!text-base !px-2 !pt-2 !pb-1 !font-black !text-slate-800 dark:!text-white !uppercase",
                            htmlContainer: "!px-2 !pb-0 !text-xs !text-slate-500 dark:!text-slate-400 !font-bold",
                            input: "!w-full !rounded-2xl !border !border-slate-200 dark:!border-white/10 !bg-slate-50 dark:!bg-slate-800 !text-slate-800 dark:!text-white !font-bold !text-sm !px-4 !py-3 focus:!border-indigo-500 !shadow-inner !mt-3 !text-center !box-border",
                            confirmButton: "!px-6 !py-3 !text-[10px] !font-black !uppercase !tracking-widest !rounded-xl !bg-indigo-600 !text-white hover:!bg-indigo-700 !shadow-lg !shadow-indigo-500/20",
                            cancelButton: "!px-5 !py-3 !text-[10px] !font-black !uppercase !tracking-widest !rounded-xl !bg-slate-100 dark:!bg-white/5 !text-slate-600 dark:!text-slate-300",
                            actions: "!px-2 !pb-2 !pt-4 !gap-2.5 flex !justify-center",
                        },
                        preConfirm: (val) => {
                            if (!val || val.trim().length === 0) {
                                XolvyAlert.showValidationMessage("Por favor ingresa tu contraseña");
                                return false;
                            }
                            return val.trim();
                        }
                    });

                    if (passInput) {
                        // Check custom saved credentials or default password
                        let customSaved = {};
                        try { customSaved = JSON.parse(localStorage.getItem("xolvy_custom_credentials") || "{}"); } catch (_e) {}

                        const userKey = name.toLowerCase().replace(/\s+/g, "");
                        const isCustomValid = customSaved[userKey] && customSaved[userKey].password === passInput;
                        const isDefaultValid = passInput === defaultPassword;

                        if (isDefaultValid || isCustomValid) {
                            const isAdmin = targetRole === "Administrador" || name.toLowerCase().includes("italo") || name.toLowerCase().includes("admin");
                            const sessionData = {
                                nombre: name,
                                email: name,
                                rol: targetRole,
                                role: targetRole,
                                isAdmin: isAdmin,
                                esConductor: true,
                                availableRoles: isAdmin ? ["Administrador", "Conductor", "Publicador"] : ["Conductor", "Publicador"]
                            };
                            localStorage.setItem("selected_conductor_name", name);
                            localStorage.setItem("xolvy_session", JSON.stringify(sessionData));

                            window.XolvyApp = window.XolvyApp || {};
                            window.XolvyApp.user = sessionData;

                            modal.innerHTML = `
                                <div class="w-full h-full flex items-center justify-center bg-slate-50/90 dark:bg-[#030712]/95 backdrop-blur-3xl animate-fade-in relative overflow-hidden p-8">
                                    <div class="z-10 flex flex-col items-center gap-6 text-center">
                                        <div class="relative">
                                            <div class="w-20 h-20 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin"></div>
                                            <div class="absolute inset-0 flex items-center justify-center">
                                                <i class="fas fa-check text-indigo-500 text-xl animate-pulse"></i>
                                            </div>
                                        </div>
                                        <div>
                                            <h3 class="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Acceso Autorizado</h3>
                                            <p class="text-[9px] font-bold text-indigo-500 uppercase tracking-widest mt-2">Iniciando Modo ${targetRole}...</p>
                                        </div>
                                    </div>
                                </div>
                            `;
                            modal.className = "fixed inset-0 z-[99999] flex items-center justify-center p-0";

                            window._authSuspended = true;
                            setTimeout(() => (window._authSuspended = false), 500);

                            document.dispatchEvent(
                                new CustomEvent("demo-login", {
                                    detail: { email: name, role: targetRole },
                                }),
                            );
                        } else {
                            XolvyAlert.fire({
                                icon: "error",
                                title: "Contraseña incorrecta",
                                text: `La contraseña ingresada no es válida para ${targetRole}.`,
                                width: 360,
                                customClass: {
                                    container: "!z-[100000]",
                                    popup: "!z-[100000] modern-card !rounded-[2rem] !p-5 !border !border-slate-200 dark:!border-white/10 !shadow-2xl !bg-white/95 dark:!bg-slate-900/95 !max-w-[360px]",
                                    title: "!text-base !px-5 !pt-5 !pb-1",
                                    htmlContainer: "!px-5 !pb-0 !text-xs",
                                    actions: "!px-5 !pb-5 !pt-3",
                                }
                            });
                        }
                    }
                };
            });
        };

        searchInput.addEventListener("input", (e) => updateList(e.target.value));
        updateList();
        searchInput.focus();
    } catch (error) {
        console.error("Error role directory sync:", error);
    }
};

export const renderConductorSelection = () => renderRoleDirectorySelection("Conductor");
