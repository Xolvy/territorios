import { GoogleAuthProvider, signInAnonymously, signInWithRedirect } from "firebase/auth";
import { getPublicadores } from "../data/firestore-services.js";
import { auth } from "../firebase-config.js";

import { applyTheme, updateDOMThemeToggles } from "./utils/theme-manager.js";

export const renderLogin = (container) => {
    // Force auto-theme based on system preferences for the login screen
    applyTheme("auto");

    container.innerHTML = `
        <div class="bg-slate-50/60 dark:bg-[#030712]/60 min-h-screen flex items-center justify-center p-4 sm:p-6 font-sans animate-fade-in relative overflow-hidden w-full max-w-[100vw] backdrop-blur-[45px] transition-colors duration-700 ease-in-out" style="min-height: 100vh; min-height: 100dvh;">
            
            <!-- Noise texture filter layer -->
            <div class="noise-overlay"></div>

            <!-- Multi-colored Ambient Radial Flows for futuristic 2027 SaaS look -->
            <div class="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none"></div>
            <div class="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none"></div>
            <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/5 dark:bg-blue-500/2 rounded-full blur-[140px] pointer-events-none"></div>

            <div class="z-10 w-full max-w-4xl flex flex-col items-center gap-8 px-4 relative">
                
                <!-- Logo Badge & Dynamic Title -->
                <div id="login-logo-container" class="animate-fade-in transition-all duration-700 text-center flex flex-col items-center">
                    <div class="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-tr from-emerald-600 via-indigo-600 to-indigo-700 rounded-2xl flex items-center justify-center text-white text-2xl sm:text-3xl shadow-[0_12px_40px_rgba(99,102,241,0.35)] border border-white/20 mb-3 sm:mb-4 animate-float relative overflow-hidden group">
                        <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                        <i class="fas fa-layer-group"></i>
                    </div>
                    <h1 class="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 dark:from-white dark:via-slate-200 dark:to-slate-400 bg-clip-text text-transparent uppercase text-center max-w-xs sm:max-w-2xl font-sans">
                        Ecosistema de Territorios
                    </h1>
                    <div class="flex items-center gap-3 mt-3">
                        <div class="h-[1px] w-6 bg-slate-300 dark:bg-white/10"></div>
                        <p class="text-[10px] sm:text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.35em] leading-none">
                            Congregación Nueve de Octubre
                        </p>
                        <div class="h-[1px] w-6 bg-slate-300 dark:bg-white/10"></div>
                    </div>
                </div>
                
                <!-- Breathtaking Frost-Glass Responsive Grid Container -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
                
                    <!-- Panel Administrador -->
                    <button id="btn-google-login" class="group flex flex-col p-6 md:p-8 bg-white/70 dark:bg-slate-900/60 rounded-[2.5rem] border border-slate-200/60 dark:border-white/5 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-1.5 hover:border-indigo-500/40 dark:hover:border-indigo-400/30 w-full text-center cursor-pointer relative z-[99] focus:outline-none backdrop-blur-xl">
                        <!-- Icon Badge -->
                        <div class="w-14 h-14 bg-gradient-to-tr from-indigo-500 via-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 mb-6 mx-auto">
                            <i class="fas fa-user-shield text-xl"></i>
                        </div>
                        
                        <!-- Header text -->
                        <h2 class="text-lg font-bold text-slate-800 dark:text-white tracking-tight uppercase leading-none mb-1.5">Administrador</h2>
                        <p class="text-[9px] text-indigo-650 dark:text-indigo-400 font-extrabold uppercase tracking-widest">Acceso seguro y analíticas</p>

                        <!-- Description -->
                        <p class="text-xs text-slate-500 dark:text-slate-400 mt-4 mb-6 leading-relaxed normal-case font-medium text-center min-h-[48px]">
                            Gestión total de datos, reportes estratégicos S-13 y analíticas avanzadas de territorio.
                        </p>

                        <!-- CTA Button -->
                        <div id="google-status-wrapper" class="w-full mt-auto bg-gradient-to-r from-indigo-600 to-violet-600 group-hover:from-indigo-500 group-hover:to-violet-500 text-white py-3.5 px-5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-md shadow-indigo-600/10 transition-all flex items-center justify-center gap-2 group-active:scale-[0.98]">
                            <img src="https://www.google.com/images/branding/product/2x/googleg_32dp.png" style="width: 14px; height: 14px;" class="object-contain brightness-0 invert flex-shrink-0 grayscale group-hover:grayscale-0 transition-all duration-300" alt="G">
                            <span>Acceder con Google</span>
                            <i class="fas fa-arrow-right transition-transform group-hover:translate-x-1 duration-300 ml-1"></i>
                        </div>
                    </button>

                    <!-- Panel Conductor -->
                    <button id="btn-conductor-trigger" class="group flex flex-col p-6 md:p-8 bg-white/70 dark:bg-slate-900/60 rounded-[2.5rem] border border-slate-200/60 dark:border-white/5 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-1.5 hover:border-emerald-500/40 dark:hover:border-emerald-400/30 w-full text-center cursor-pointer relative z-[99] focus:outline-none backdrop-blur-xl">
                        <!-- Icon Badge -->
                        <div class="w-14 h-14 bg-gradient-to-tr from-emerald-500 via-teal-500 to-teal-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 mb-6 mx-auto">
                            <i class="fas fa-map-marked-alt text-xl"></i>
                        </div>
                        
                        <!-- Header text -->
                        <h2 class="text-lg font-bold text-slate-800 dark:text-white tracking-tight uppercase leading-none mb-1.5">Conductor</h2>
                        <p class="text-[9px] text-emerald-650 dark:text-emerald-400 font-extrabold uppercase tracking-widest">Terminal de predicación</p>

                        <!-- Description -->
                        <p class="text-xs text-slate-500 dark:text-slate-400 mt-4 mb-6 leading-relaxed normal-case font-medium text-center min-h-[48px]">
                            Terminal de campo optimizada para la predicación en grupo y asignación ágil de territorios.
                        </p>

                        <!-- CTA Button -->
                        <div class="w-full mt-auto bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 py-3.5 px-5 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-200/60 dark:border-white/10 transition-all flex items-center justify-center gap-2 group-active:scale-[0.98] group-hover:border-emerald-500/20 group-hover:text-emerald-500 dark:group-hover:text-emerald-400">
                            <i class="fas fa-sign-in-alt text-[10px] flex-shrink-0"></i>
                            <span>Ingresar al Directorio</span>
                            <i class="fas fa-arrow-right transition-transform group-hover:translate-x-1 duration-300 ml-1"></i>
                        </div>
                    </button>

                    <div id="auth-error" class="hidden col-span-full mt-2 text-rose-600 text-[8px] font-bold uppercase tracking-widest text-center animate-pulse"></div>
                </div>
                
            </div>
        </div>
    `;

    // Se asegura que el DOM ya ha renderizado antes de bindear (Event Loop Queue)
    setTimeout(() => {
        const btnGoogle = document.getElementById("btn-google-login");
        const googleStatusWrapper = document.getElementById("google-status-wrapper");
        const btnConductorTrigger = document.getElementById("btn-conductor-trigger");
        const errorEl = document.getElementById("auth-error");

        // Sync initial state of the floating theme switcher button
        const activeTheme = localStorage.getItem("theme") || "auto";
        updateDOMThemeToggles(activeTheme);

        if (btnGoogle) {
            btnGoogle.addEventListener("click", async () => {
                btnGoogle.disabled = true;
                googleStatusWrapper.innerHTML = `<i class="fas fa-circle-notch animate-spin mr-2"></i> Redirigiendo...`;

                // FASE 1: Limpieza estricta de rutas previas e ignorar caché de navegación
                localStorage.removeItem("lastPath");
                localStorage.removeItem("lastRoute");
                localStorage.removeItem("redirectUrl");
                localStorage.removeItem("redirectPath");
                sessionStorage.removeItem("lastPath");
                sessionStorage.removeItem("lastRoute");
                sessionStorage.removeItem("redirectUrl");
                sessionStorage.removeItem("redirectPath");
                localStorage.removeItem("xolvy_session");

                try {
                    const provider = new GoogleAuthProvider();
                    provider.setCustomParameters({ prompt: "select_account" });
                    // SECURITY v4.0: NO demo_role stored. Role verified from Firestore post-redirect.
                    await signInWithRedirect(auth, provider);
                } catch (error) {
                    console.error("Error en Auth:", error);
                    errorEl.textContent = `Error de Servidor: ${error.message}`;
                    errorEl.classList.remove("hidden");
                    btnGoogle.disabled = false;
                    googleStatusWrapper.innerHTML = `
                        <img src="https://www.google.com/images/branding/product/2x/googleg_32dp.png" class="w-5 h-5 grayscale group-hover:grayscale-0 transition-all" alt="G">
                        <span>ACCEDER CON GOOGLE &rarr;</span>
                    `;
                    alert(`Fallo al iniciar sesión: ${error.message}`);
                }
            });
        }

        if (btnConductorTrigger) {
            btnConductorTrigger.addEventListener("click", async () => {
                // Ensure anonymous authentication before opening the selection modal
                // to prevent "Missing or insufficient permissions" when fetching directory.
                try {
                    if (!auth.currentUser) {
                        console.log(
                            "🛡️ [Login] No active auth session. Requesting anonymous session for directory query...",
                        );
                        await signInAnonymously(auth);
                    }
                } catch (err) {
                    console.error("🛡️ [Login] Failed anonymous login for directory query:", err);
                }
                renderConductorSelection();
            });
        }
    }, 0);
};

export const renderConductorSelection = async () => {
    const modal = document.createElement("div");
    modal.id = "conductor-modal";
    modal.className =
        "fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-md p-4 animate-fade-in";

    modal.innerHTML = `
        <div class="modal-card-premium bg-white dark:bg-[#0a0f18] w-full max-w-lg rounded-[2.5rem] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-transparent dark:border-white/10 transform transition-all">
            <!-- Header Modal -->
            <div class="p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between shrink-0">
                <div>
                    <h2 class="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight font-sans">Directorio</h2>
                    <p class="text-[10px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-[0.25em] mt-1.5 leading-none">Busca tu nombre en el listado</p>
                </div>
                <button id="btn-close-modal-c" class="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/20 transition-all border border-slate-100 dark:border-white/10 shadow-inner group cursor-pointer focus:outline-none">
                     <i class="fas fa-times group-hover:rotate-90 transition-transform"></i>
                </button>
            </div>
            
            <div class="p-8 space-y-6 flex-1 min-w-0 overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-900/40">
                <div class="relative flex items-center w-full mb-2">
                    <div class="absolute inset-y-0 left-0 flex items-center pl-5 pointer-events-none">
                        <i class="fas fa-search text-slate-450 dark:text-slate-500 text-base"></i>
                    </div>
                    <input type="text" id="conductor-search" placeholder="Escribe tu nombre..." 
                        class="w-full py-4 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl shadow-sm focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all font-bold text-base text-slate-800 dark:text-white placeholder:text-slate-350 dark:placeholder:text-slate-655 outline-none"
                        style="padding-left: 3.5rem !important;">
                </div>

                <!-- Scrollable People List -->
                <div class="flex-1 min-w-0 overflow-y-auto pr-2 custom-scrollbar">
                    <div id="conductores-list" class="grid grid-cols-1 gap-4 py-2">
                        <div class="text-center py-20 space-y-6">
                            <div class="relative w-12 h-12 mx-auto">
                                <div class="w-12 h-12 border-4 border-indigo-500/15 border-t-indigo-500 rounded-full animate-spin"></div>
                            </div>
                            <p class="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[9px]">Sincronizando Directorio...</p>
                        </div>
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
            console.warn("[Login] getPublicadores failed — likely permissions:", e);
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

        const conductors = people
            .filter((p) => p.es_conductor || p.modulos?.habilitado)
            .sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")));

        const updateList = (filter = "") => {
            const term = filter
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "");
            const filtered = conductors.filter((c) =>
                c.nombre
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .includes(term),
            );

            if (filtered.length === 0) {
                list.innerHTML = `
                    <div class="text-center py-24 space-y-4 animate-fade-in opacity-80">
                        <p class="text-slate-600 dark:text-slate-400 font-bold text-[10px] uppercase tracking-widest">No hay resultados para "${filter}"</p>
                    </div>
                `;
                return;
            }

            list.innerHTML = filtered
                .map((c) => {
                    const isSup = c.privilegios?.includes("Superintendente de Circuito");
                    const roleLabel = isSup ? "Sup. Circuito" : c.es_conductor ? "Conductor" : "Publicador";

                    return `
                    <button data-id="${c.id}" data-name="${c.nombre}" data-phone="${c.telefono || ""}"
                        class="conductor-btn group w-full p-4 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl shadow-sm flex items-center justify-between transition-all hover:border-indigo-500/40 hover:bg-slate-50/50 dark:hover:bg-indigo-500/5 hover:shadow-md active:scale-[0.98] text-left cursor-pointer focus:outline-none">
                        <div class="flex items-center gap-4">
                            <div class="w-11 h-11 rounded-xl bg-slate-50 dark:bg-black/25 flex items-center justify-center text-indigo-500 font-black text-base border border-slate-100 dark:border-white/5 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300">
                                ${c.nombre.charAt(0)}
                            </div>
                            <div>
                                <h4 class="font-black text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors uppercase tracking-tight text-sm">${c.nombre}</h4>
                                <p class="text-[8px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest mt-1">${roleLabel}</p>
                            </div>
                        </div>
                        <i class="fas fa-chevron-right text-[10px] text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all duration-300"></i>
                    </button>
                `;
                })
                .join("");

            list.querySelectorAll(".conductor-btn").forEach((btn) => {
                btn.addEventListener("click", async (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const name = btn.getAttribute("data-name");
                    const phone = btn.getAttribute("data-phone");

                    // Helper para capitalizar tipo oración:
                    const toTitleCase = (str) =>
                        String(str || "")
                            .toLowerCase()
                            .split(" ")
                            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                            .join(" ");

                    const nombreCapitalizado = toTitleCase(name);

                    // 2. State mutations (IdentityShield handles resolution in app.js via demo-login)
                    // SECURITY v4.0: NO demo_role stored. Role verified from Firestore via IdentityShield.
                    localStorage.setItem("selected_conductor_name", phone || name);

                    const sessionData = { nombre: nombreCapitalizado, email: phone || name, rol: "Conductor" };
                    localStorage.setItem("xolvy_session", JSON.stringify(sessionData));

                    window.XolvyApp = window.XolvyApp || {};
                    window.XolvyApp.user = sessionData;

                    // 3. SaaS Premium Loading State (Fix Parpadeo)
                    modal.innerHTML = `
                        <div class="w-full h-full flex items-center justify-center bg-slate-50/90 dark:bg-[#030712]/95 backdrop-blur-3xl animate-fade-in relative overflow-hidden">
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
                    modal.className = "fixed inset-0 z-[99999] flex items-center justify-center p-0";

                    // Zero-Bounce: Forzar suspensión de cambios de Auth por 500ms
                    window._authSuspended = true;
                    setTimeout(() => (window._authSuspended = false), 500);

                    // Dispatch routing trigger programmatically
                    document.dispatchEvent(
                        new CustomEvent("demo-login", {
                            detail: { email: phone || name, role: "Conductor" },
                        }),
                    );

                    // El loader se removerá automáticamente cuando el Dashboard se monte y limpie el body/container
                });
            });
        };

        searchInput.addEventListener("input", (e) => updateList(e.target.value));
        updateList();
        searchInput.focus();
    } catch (error) {
        console.error("Error directory sync:", error);
    }
};
