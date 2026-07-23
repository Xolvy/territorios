import { GoogleAuthProvider, linkWithRedirect, signInWithRedirect } from "firebase/auth";
import { auth, db } from "../../firebase-config.js";
import { showModal } from "./ui-helpers.js";
import { showNotification } from "../utils/helpers.js";

export const switchAppRole = (targetRole) => {
    window.XolvyApp = window.XolvyApp || {};
    window.XolvyApp.user = window.XolvyApp.user || {};
    window.XolvyApp.user.role = targetRole;
    window.XolvyApp.user.rol = targetRole;
    sessionStorage.setItem("xolvy_active_mode", targetRole);

    const currentSession = JSON.parse(localStorage.getItem("xolvy_session") || "{}");
    localStorage.setItem("xolvy_session", JSON.stringify({ ...currentSession, ...window.XolvyApp.user, rol: targetRole, role: targetRole }));

    if (targetRole === "Administrador") {
        showNotification("Cambiado a Modo Administrador", "success");
        if (typeof window.switchToAdminView === "function") {
            window.switchToAdminView();
        } else {
            location.href = "/administrador";
        }
    } else {
        showNotification(`Cambiado a Modo ${targetRole}`, "success");
        if (typeof window.switchToConductorView === "function") {
            window.switchToConductorView();
        } else {
            location.href = "/conductores";
        }
    }
};
window.switchAppRole = switchAppRole;

export function openUserProfileModal() {
    const user = window.XolvyApp?.user || {};
    const currentName = user.nombre || localStorage.getItem("selected_conductor_name") || "Usuario";
    const currentRole = user.role || "Publicador";

    // Cargar perfil guardado localmente o default
    let profile = {
        nombre: currentName,
        telefono: "",
        sexo: "Hombre",
        precursor: "Publicador",
        grupo: "Grupo 1",
        superintendente: "Hermano Encargado",
        auxiliar: "Hermano Auxiliar",
        username: currentName.toLowerCase().replace(/\s+/g, ""),
        password: "",
    };

    try {
        const saved = localStorage.getItem(`xolvy_user_profile_${currentName}`);
        if (saved) {
            profile = { ...profile, ...JSON.parse(saved) };
        }
    } catch (_e) {}

    showModal(`
        <div class="flex flex-col h-full bg-white dark:bg-[#0a0f18] rounded-[2.5rem] overflow-hidden max-w-lg mx-auto border border-slate-100 dark:border-white/10 shadow-2xl">
            <!-- Header -->
            <header class="p-6 bg-gradient-to-r from-indigo-600 to-violet-600 text-white relative shrink-0">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-xl font-black border border-white/30">
                            <i class="fas fa-id-card"></i>
                        </div>
                        <div>
                            <h3 class="text-lg font-black uppercase tracking-tight leading-none mb-1">Perfil de Usuario</h3>
                            <p class="text-[9px] uppercase tracking-widest opacity-80 font-bold">Modo Activo: <span class="text-emerald-300 font-extrabold">${currentRole}</span></p>
                        </div>
                    </div>
                    <button onclick="this.closest('.fixed').classList.add('hidden')" class="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all">
                        <i class="fas fa-times text-xs"></i>
                    </button>
                </div>
            </header>

            <!-- Form Content -->
            <div class="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50 dark:bg-slate-900/50">
                <!-- SECCIÓN 1: DATOS PERSONALES -->
                <div class="bg-white dark:bg-white/5 p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-4">
                    <h4 class="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider flex items-center gap-2">
                        <i class="fas fa-user-edit"></i> Datos Personales
                    </h4>

                    <div class="space-y-1">
                        <label class="text-[9px] font-black uppercase text-slate-500">Nombre Completo</label>
                        <input type="text" id="prof-nombre" value="${profile.nombre}" 
                            class="w-full py-2.5 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs outline-none focus:border-indigo-500">
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div class="space-y-1">
                            <label class="text-[9px] font-black uppercase text-slate-500">Teléfono</label>
                            <input type="text" id="prof-telefono" value="${profile.telefono}" placeholder="0991234567" 
                                class="w-full py-2.5 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs outline-none focus:border-indigo-500">
                        </div>

                        <div class="space-y-1">
                            <label class="text-[9px] font-black uppercase text-slate-500">Género</label>
                            <select id="prof-sexo" class="w-full py-2.5 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs outline-none focus:border-indigo-500">
                                <option value="Hombre" ${profile.sexo === "Hombre" ? "selected" : ""}>Hombre 🙋‍♂️</option>
                                <option value="Mujer" ${profile.sexo === "Mujer" ? "selected" : ""}>Mujer 🙋‍♀️</option>
                            </select>
                        </div>
                    </div>

                    <div class="space-y-1">
                        <label class="text-[9px] font-black uppercase text-slate-500">Condición / Servicio</label>
                        <select id="prof-precursor" class="w-full py-2.5 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs outline-none focus:border-indigo-500">
                            <option value="Publicador" ${profile.precursor === "Publicador" ? "selected" : ""}>Publicador</option>
                            <option value="Precursor Auxiliar" ${profile.precursor === "Precursor Auxiliar" ? "selected" : ""}>Precursor Auxiliar</option>
                            <option value="Precursor Regular" ${profile.precursor === "Precursor Regular" ? "selected" : ""}>Precursor Regular</option>
                        </select>
                    </div>
                </div>

                <!-- SECCIÓN 2: GRUPO ASIGNADO -->
                <div class="bg-white dark:bg-white/5 p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-3">
                    <h4 class="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center gap-2">
                        <i class="fas fa-users"></i> Grupo de Predicación
                    </h4>
                    
                    <div class="grid grid-cols-2 gap-3">
                        <div class="space-y-1">
                            <label class="text-[9px] font-black uppercase text-slate-500">Grupo Asignado</label>
                            <input type="text" id="prof-grupo" value="${profile.grupo}" 
                                class="w-full py-2.5 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs outline-none">
                        </div>
                        <div class="space-y-1">
                            <label class="text-[9px] font-black uppercase text-slate-500">Superintendente</label>
                            <input type="text" id="prof-superintendente" value="${profile.superintendente}" readonly 
                                class="w-full py-2.5 px-3 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs opacity-80 cursor-not-allowed">
                        </div>
                    </div>
                </div>

                <!-- SECCIÓN 3: SEGURIDAD Y VINCULACIÓN -->
                <div class="bg-white dark:bg-white/5 p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-4">
                    <h4 class="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider flex items-center gap-2">
                        <i class="fas fa-shield-alt"></i> Credenciales de Acceso
                    </h4>

                    <div class="grid grid-cols-2 gap-3">
                        <div class="space-y-1">
                            <label class="text-[9px] font-black uppercase text-slate-500">Usuario Personal</label>
                            <input type="text" id="prof-username" value="${profile.username}" placeholder="usuario" 
                                class="w-full py-2.5 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs outline-none">
                        </div>
                        <div class="space-y-1">
                            <label class="text-[9px] font-black uppercase text-slate-500">Nueva Contraseña</label>
                            <input type="password" id="prof-password" value="${profile.password}" placeholder="••••••••" 
                                class="w-full py-2.5 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs outline-none">
                        </div>
                    </div>

                    <div class="pt-2 border-t border-slate-100 dark:border-white/5">
                        <button id="btn-link-google-profile" type="button" class="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all">
                            <img src="https://www.google.com/images/branding/product/2x/googleg_32dp.png" class="w-4 h-4 object-contain" alt="Google">
                            <span>Vincular Cuenta de Google</span>
                        </button>
                    </div>
                </div>

                <!-- SECCIÓN 4: CONMUTADOR DE ROL / MODO DE VISTA EN 1-TAP -->
                <div class="bg-indigo-500/5 dark:bg-indigo-500/10 p-5 rounded-2xl border border-indigo-500/20 space-y-3">
                    <div class="flex items-center justify-between">
                        <h4 class="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider flex items-center gap-2">
                            <i class="fas fa-user-shield"></i> Modo de Vista Activo
                        </h4>
                        <span class="text-[8px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-500 px-2 py-0.5 rounded-full border border-indigo-500/20">
                            ${currentRole}
                        </span>
                    </div>
                    <div class="grid grid-cols-3 gap-2">
                        <button id="btn-switch-publicador" type="button" class="py-2.5 px-2 bg-white dark:bg-slate-800 border rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1 ${currentRole === 'Publicador' ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500 bg-emerald-500/10 shadow-sm' : 'text-slate-500 hover:border-slate-300'}">
                            <i class="fas fa-user text-xs"></i>
                            <span>Publicador</span>
                        </button>

                        <button id="btn-switch-conductor" type="button" class="py-2.5 px-2 bg-white dark:bg-slate-800 border rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1 ${currentRole === 'Conductor' ? 'text-indigo-600 dark:text-indigo-400 border-indigo-500 bg-indigo-500/10 shadow-sm' : 'text-slate-500 hover:border-slate-300'}">
                            <i class="fas fa-id-badge text-xs"></i>
                            <span>Conductor</span>
                        </button>

                        <button id="btn-switch-admin" type="button" class="py-2.5 px-2 bg-white dark:bg-slate-800 border rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1 ${['Administrador', 'SuperAdmin', 'Admin'].includes(currentRole) ? 'text-amber-600 dark:text-amber-400 border-amber-500 bg-amber-500/10 shadow-sm' : 'text-slate-500 hover:border-slate-300'}">
                            <i class="fas fa-user-shield text-xs"></i>
                            <span>Admin</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <footer class="p-5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-white/5 flex gap-3 shrink-0">
                <button onclick="this.closest('.fixed').classList.add('hidden')" class="flex-1 py-3 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-wider">
                    Cancelar
                </button>
                <button id="btn-save-profile" class="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-indigo-600/20">
                    Guardar Cambios
                </button>
            </footer>
        </div>
    `, (modal) => {
        // Link Google Account
        const btnLink = modal.querySelector("#btn-link-google-profile");
        if (btnLink) {
            btnLink.onclick = async () => {
                try {
                    const provider = new GoogleAuthProvider();
                    if (auth.currentUser) {
                        await linkWithRedirect(auth.currentUser, provider);
                    } else {
                        await signInWithRedirect(auth, provider);
                    }
                    showNotification("Redirigiendo a autenticación con Google...", "info");
                } catch (e) {
                    showNotification(`Error vinculando Google: ${e.message}`, "error");
                }
            };
        }

        // Switch to Publicador mode
        const btnPub = modal.querySelector("#btn-switch-publicador");
        if (btnPub) {
            btnPub.onclick = () => switchAppRole("Publicador");
        }

        // Switch to Conductor mode
        const btnCond = modal.querySelector("#btn-switch-conductor");
        if (btnCond) {
            btnCond.onclick = () => switchAppRole("Conductor");
        }

        // Switch to Admin mode
        const btnAdmin = modal.querySelector("#btn-switch-admin");
        if (btnAdmin) {
            btnAdmin.onclick = () => switchAppRole("Administrador");
        }

        // Save Profile
        const btnSave = modal.querySelector("#btn-save-profile");
        if (btnSave) {
            btnSave.onclick = () => {
                const nombre = modal.querySelector("#prof-nombre").value.trim() || currentName;
                const telefono = modal.querySelector("#prof-telefono").value.trim();
                const sexo = modal.querySelector("#prof-sexo").value;
                const precursor = modal.querySelector("#prof-precursor").value;
                const grupo = modal.querySelector("#prof-grupo").value.trim();
                const username = modal.querySelector("#prof-username").value.trim().toLowerCase();
                const password = modal.querySelector("#prof-password").value.trim();

                const updatedProfile = {
                    nombre, telefono, sexo, precursor, grupo, username, password
                };

                localStorage.setItem(`xolvy_user_profile_${currentName}`, JSON.stringify(updatedProfile));

                // Save custom login credentials if username/password set
                if (username && password) {
                    let customCreds = {};
                    try { customCreds = JSON.parse(localStorage.getItem("xolvy_custom_credentials") || "{}"); } catch (_e) {}
                    customCreds[username] = { password, nombre, rol: currentRole };
                    localStorage.setItem("xolvy_custom_credentials", JSON.stringify(customCreds));
                }

                showNotification("Perfil de usuario actualizado correctamente", "success");
                modal.classList.add("hidden");
            };
        }
    });
}

window.openUserProfileModal = openUserProfileModal;
