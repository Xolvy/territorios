import { GoogleAuthProvider, linkWithRedirect, signInWithRedirect, unlink } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { getGroupsConfig } from "../../data/firestore-services.js";
import { auth, db } from "../../firebase-config.js";
import { checkAdminPrivileges, showNotification } from "../utils/helpers.js";
import { showModal } from "./ui-helpers.js";

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

export async function openUserProfileModal() {
    const user = window.XolvyApp?.user || {};
    const currentName = user.nombre || localStorage.getItem("selected_conductor_name") || auth.currentUser?.displayName || "Publicador";
    const isAdmin = checkAdminPrivileges();

    // 1. Obtener grupos configurados desde Firestore
    let groups = [];
    try {
        groups = await getGroupsConfig();
    } catch (_e) {
        groups = [];
    }

    // 2. Buscar datos reales del publicador en Firestore
    let firestorePerson = null;
    let personDocId = null;
    try {
        const pubRef = collection(db, "publicadores");
        const q = query(pubRef, where("nombre", "==", currentName));
        const snap = await getDocs(q);
        if (!snap.empty) {
            const firstDoc = snap.docs[0];
            personDocId = firstDoc.id;
            firestorePerson = firstDoc.data();
        }
    } catch (e) {
        console.warn("⚠️ No se pudo obtener datos del publicador desde Firestore:", e);
    }

    // Perfil combinado (Firestore > LocalStorage > Defaults)
    let localSaved = {};
    try {
        localSaved = JSON.parse(localStorage.getItem(`xolvy_user_profile_${currentName}`) || "{}");
    } catch (_e) {}

    const profile = {
        nombre: currentName,
        telefono: firestorePerson?.telefono || localSaved.telefono || user.telefono || "",
        genero: firestorePerson?.genero || localSaved.genero || "Hombre",
        perfil: firestorePerson?.perfil || firestorePerson?.precursor || localSaved.perfil || "Publicador",
        grupo: firestorePerson?.grupo || localSaved.grupo || (groups[0]?.id || 1),
        superintendente: firestorePerson?.superintendente || "",
        auxiliar: firestorePerson?.auxiliar || "",
        password: firestorePerson?.password || firestorePerson?.contrasena || localSaved.password || "",
        email: firestorePerson?.email || auth.currentUser?.email || "",
    };

    // Calcular superintendente/auxiliar inicial según el grupo
    const currentGroupObj = groups.find((g) => String(g.id) === String(profile.grupo));
    const initSuperintendente = currentGroupObj?.encargado || currentGroupObj?.superintendente || profile.superintendente || "Sin asignar";
    const initAuxiliar = currentGroupObj?.auxiliar || profile.auxiliar || "Sin asignar";

    // Verificar estado de Google
    const googleProviderData = auth.currentUser?.providerData?.find((p) => p.providerId === "google.com");
    const isGoogleLinked = !!googleProviderData || !!profile.email;
    const googleEmail = googleProviderData?.email || profile.email || auth.currentUser?.email || "";

    showModal(`
        <div class="flex flex-col h-full bg-white dark:bg-[#0a0f18] rounded-[2.5rem] overflow-hidden max-w-lg mx-auto border border-slate-100 dark:border-white/10 shadow-2xl animate-scale-in">
            <!-- Header Ultra Moderno -->
            <header class="p-6 bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 text-white relative shrink-0">
                <div class="flex items-center justify-between relative z-10">
                    <div class="flex items-center gap-3.5">
                        <div class="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-xl font-black border border-white/30 shadow-lg">
                            <i class="fas fa-id-card"></i>
                        </div>
                        <div>
                            <h3 class="text-lg font-black uppercase tracking-tight leading-none mb-1">Perfil de Usuario</h3>
                            <p class="text-[9px] uppercase tracking-widest opacity-90 font-bold text-indigo-200">Información de Registro</p>
                        </div>
                    </div>
                    <button onclick="this.closest('.fixed').classList.add('hidden')" class="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all active:scale-95">
                        <i class="fas fa-times text-xs"></i>
                    </button>
                </div>
            </header>

            <!-- Form Content -->
            <div class="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar bg-slate-50 dark:bg-slate-900/50">
                
                <!-- SECCIÓN 1: DATOS PERSONALES -->
                <div class="bg-white dark:bg-white/5 p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-4 shadow-sm">
                    <div class="flex items-center justify-between">
                        <h4 class="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider flex items-center gap-2">
                            <i class="fas fa-user-edit"></i> Datos Personales
                        </h4>
                        ${!isAdmin ? `<span class="text-[8px] font-bold uppercase tracking-widest text-slate-400 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-full"><i class="fas fa-lock text-[8px] mr-1"></i>Modificación Restringida</span>` : ""}
                    </div>

                    <!-- Nombre Completo -->
                    <div class="space-y-1">
                        <label class="text-[9px] font-black uppercase text-slate-500">Nombre Completo</label>
                        <input type="text" id="prof-nombre" value="${profile.nombre}" ${!isAdmin ? "readonly" : ""}
                            class="w-full py-2.5 px-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs outline-none ${!isAdmin ? "opacity-80 cursor-not-allowed select-none bg-slate-100/70 dark:bg-white/[0.02]" : "focus:border-indigo-500"}">
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <!-- Teléfono (Modificable por el Publicador) -->
                        <div class="space-y-1">
                            <label class="text-[9px] font-black uppercase text-slate-500 flex items-center justify-between">
                                <span>Teléfono</span>
                                <span class="text-[8px] text-emerald-600 font-bold uppercase">Editable</span>
                            </label>
                            <input type="text" id="prof-telefono" value="${profile.telefono}" placeholder="0991234567" 
                                class="w-full py-2.5 px-3.5 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-500/30 rounded-xl font-bold text-xs outline-none focus:border-indigo-500 shadow-sm">
                        </div>

                        <!-- Género (Modificable solo por Admin) -->
                        <div class="space-y-1">
                            <label class="text-[9px] font-black uppercase text-slate-500">Género</label>
                            ${
                                isAdmin
                                    ? `
                                <select id="prof-genero" class="w-full py-2.5 px-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs outline-none focus:border-indigo-500">
                                    <option value="Hombre" ${profile.genero === "Hombre" ? "selected" : ""}>Hombre 🙋‍♂️</option>
                                    <option value="Mujer" ${profile.genero === "Mujer" ? "selected" : ""}>Mujer 🙋‍♀️</option>
                                </select>
                            `
                                    : `
                                <input type="text" value="${profile.genero === "Hombre" ? "Hombre 🙋‍♂️" : "Mujer 🙋‍♀️"}" readonly
                                    class="w-full py-2.5 px-3.5 bg-slate-100/70 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs opacity-80 cursor-not-allowed select-none">
                            `
                            }
                        </div>
                    </div>

                    <!-- Perfil (Antes Condición / Servicio) -->
                    <div class="space-y-1">
                        <label class="text-[9px] font-black uppercase text-slate-500">Perfil</label>
                        ${
                            isAdmin
                                ? `
                            <select id="prof-perfil" class="w-full py-2.5 px-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs outline-none focus:border-indigo-500">
                                <option value="Publicador" ${profile.perfil === "Publicador" ? "selected" : ""}>Publicador</option>
                                <option value="Precursor Auxiliar" ${profile.perfil === "Precursor Auxiliar" ? "selected" : ""}>Precursor Auxiliar</option>
                                <option value="Precursor Regular" ${profile.perfil === "Precursor Regular" ? "selected" : ""}>Precursor Regular</option>
                                <option value="Siervo Ministerial" ${profile.perfil === "Siervo Ministerial" ? "selected" : ""}>Siervo Ministerial</option>
                                <option value="Anciano" ${profile.perfil === "Anciano" ? "selected" : ""}>Anciano</option>
                            </select>
                        `
                                : `
                            <input type="text" value="${profile.perfil}" readonly
                                class="w-full py-2.5 px-3.5 bg-slate-100/70 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs opacity-80 cursor-not-allowed select-none">
                        `
                        }
                    </div>
                </div>

                <!-- SECCIÓN 2: GRUPO Y SUPERINTENDENCIA DINÁMICA -->
                <div class="bg-white dark:bg-white/5 p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-4 shadow-sm">
                    <h4 class="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center gap-2">
                        <i class="fas fa-users"></i> Grupo de Predicación
                    </h4>
                    
                    <div class="space-y-1">
                        <label class="text-[9px] font-black uppercase text-slate-500">Grupo Asignado</label>
                        <select id="prof-grupo-select" class="w-full py-2.5 px-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs outline-none focus:border-indigo-500 cursor-pointer">
                            ${
                                groups.length > 0
                                    ? groups.map((g) => `<option value="${g.id}" ${String(profile.grupo) === String(g.id) ? "selected" : ""}>${g.numero_nombre || `Grupo ${g.id}`}</option>`).join("")
                                    : `<option value="1">Grupo 1</option>`
                            }
                        </select>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div class="space-y-1">
                            <label class="text-[9px] font-black uppercase text-slate-500">Superintendente</label>
                            <input type="text" id="prof-superintendente" value="${initSuperintendente}" readonly 
                                class="w-full py-2.5 px-3.5 bg-slate-100/80 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs opacity-80 cursor-not-allowed select-none">
                        </div>
                        <div class="space-y-1">
                            <label class="text-[9px] font-black uppercase text-slate-500">Auxiliar</label>
                            <input type="text" id="prof-auxiliar" value="${initAuxiliar}" readonly 
                                class="w-full py-2.5 px-3.5 bg-slate-100/80 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs opacity-80 cursor-not-allowed select-none">
                        </div>
                    </div>
                </div>

                <!-- SECCIÓN 3: CREDANCIALES DE ACCESO Y SEGURIDAD -->
                <div class="bg-white dark:bg-white/5 p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-4 shadow-sm">
                    <div class="flex items-center justify-between">
                        <h4 class="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider flex items-center gap-2">
                            <i class="fas fa-key"></i> Credenciales de Acceso
                        </h4>
                        <button id="btn-toggle-pass-edit" type="button" class="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
                            <i class="fas fa-pen text-[8px]"></i> Modificar Contraseña
                        </button>
                    </div>

                    <div class="space-y-1">
                        <label class="text-[9px] font-black uppercase text-slate-500">Contraseña Personal</label>
                        <input type="password" id="prof-password" value="${profile.password}" disabled placeholder="•••••••• (Contraseña predeterminada)"
                            class="w-full py-2.5 px-3.5 bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs outline-none opacity-60 cursor-not-allowed transition-all">
                        <p class="text-[9px] text-slate-400 dark:text-slate-500 font-medium italic mt-1">
                            Al guardar una nueva contraseña, ingresarás solo con ella y no con la genérica.
                        </p>
                    </div>

                    <!-- VINCULACIÓN CON GOOGLE -->
                    <div class="pt-3 border-t border-slate-100 dark:border-white/5 space-y-2">
                        <label class="text-[9px] font-black uppercase text-slate-500">Acceso Google</label>
                        ${
                            isGoogleLinked
                                ? `
                            <div class="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20 text-xs font-bold flex items-center justify-between">
                                <span class="truncate max-w-[220px]"><i class="fab fa-google text-emerald-500 mr-2"></i> Vinculada: <b>${googleEmail || "Cuenta de Google"}</b></span>
                                <button id="btn-unlink-google" type="button" class="text-[9px] font-black uppercase tracking-wider bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 px-3 py-1.5 rounded-lg transition-all shrink-0">
                                    Desvincular
                                </button>
                            </div>
                        `
                                : `
                            <button id="btn-link-google-profile" type="button" class="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm">
                                <img src="https://www.google.com/images/branding/product/2x/googleg_32dp.png" class="w-4 h-4 object-contain" alt="Google">
                                <span>Vincular Cuenta de Google</span>
                            </button>
                        `
                        }
                    </div>
                </div>

            </div>

            <!-- Footer con Botones -->
            <footer class="p-5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-white/5 flex gap-3 shrink-0">
                <button onclick="this.closest('.fixed').classList.add('hidden')" class="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all">
                    Cancelar
                </button>
                <button id="btn-save-profile" class="flex-1 py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-indigo-600/20 active:scale-95 transition-all">
                    Guardar Cambios
                </button>
            </footer>
        </div>
    `, (modal) => {
        // Dynamic Overseers calculation on Group Change
        const groupSelect = modal.querySelector("#prof-grupo-select");
        if (groupSelect) {
            groupSelect.onchange = (e) => {
                const selectedGroupId = e.target.value;
                const gObj = groups.find((g) => String(g.id) === String(selectedGroupId));
                const superInp = modal.querySelector("#prof-superintendente");
                const auxInp = modal.querySelector("#prof-auxiliar");
                if (superInp) superInp.value = gObj?.encargado || gObj?.superintendente || "Sin asignar";
                if (auxInp) auxInp.value = gObj?.auxiliar || "Sin asignar";
            };
        }

        // Toggle Password Input Editable
        const btnTogglePass = modal.querySelector("#btn-toggle-pass-edit");
        const passInput = modal.querySelector("#prof-password");
        if (btnTogglePass && passInput) {
            btnTogglePass.onclick = () => {
                passInput.disabled = false;
                passInput.classList.remove("opacity-60", "cursor-not-allowed", "bg-slate-100", "dark:bg-slate-800/40");
                passInput.classList.add("bg-white", "dark:bg-slate-800", "border-indigo-500");
                passInput.focus();
            };
        }

        // Link / Unlink Google
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

        const btnUnlink = modal.querySelector("#btn-unlink-google");
        if (btnUnlink) {
            btnUnlink.onclick = async () => {
                try {
                    if (auth.currentUser && googleProviderData) {
                        await unlink(auth.currentUser, "google.com");
                        showNotification("Cuenta de Google desvinculada correctamente", "success");
                    } else {
                        showNotification("Cuenta desvinculada del perfil", "info");
                    }
                    modal.classList.add("hidden");
                    openUserProfileModal();
                } catch (e) {
                    showNotification(`Error al desvincular: ${e.message}`, "error");
                }
            };
        }

        // Save Profile Logic
        const btnSave = modal.querySelector("#btn-save-profile");
        if (btnSave) {
            btnSave.onclick = async () => {
                const nombre = modal.querySelector("#prof-nombre").value.trim() || currentName;
                const telefono = modal.querySelector("#prof-telefono").value.trim();
                const genero = modal.querySelector("#prof-genero") ? modal.querySelector("#prof-genero").value : profile.genero;
                const perfilVal = modal.querySelector("#prof-perfil") ? modal.querySelector("#prof-perfil").value : profile.perfil;
                const grupoVal = modal.querySelector("#prof-grupo-select").value;
                const superVal = modal.querySelector("#prof-superintendente").value;
                const auxVal = modal.querySelector("#prof-auxiliar").value;
                const newPassword = modal.querySelector("#prof-password").value.trim();

                const updatedProfile = {
                    nombre,
                    telefono,
                    genero,
                    perfil: perfilVal,
                    precursor: perfilVal,
                    grupo: Number(grupoVal) || grupoVal,
                    superintendente: superVal,
                    auxiliar: auxVal,
                    password: newPassword || profile.password,
                };

                // Guardar en LocalStorage
                localStorage.setItem(`xolvy_user_profile_${currentName}`, JSON.stringify(updatedProfile));

                // Guardar credenciales personalizadas si la contraseña cambió
                if (newPassword) {
                    let customCreds = {};
                    try {
                        customCreds = JSON.parse(localStorage.getItem("xolvy_custom_credentials") || "{}");
                    } catch (_e) {}
                    const userKey = currentName.toLowerCase().replace(/\s+/g, "");
                    customCreds[userKey] = { password: newPassword, nombre: currentName };
                    localStorage.setItem("xolvy_custom_credentials", JSON.stringify(customCreds));
                }

                // Sincronizar con Firestore si existe el documento
                if (personDocId) {
                    try {
                        const docRef = doc(db, "publicadores", personDocId);
                        await updateDoc(docRef, {
                            telefono: telefono,
                            genero: genero,
                            perfil: perfilVal,
                            grupo: Number(grupoVal) || grupoVal,
                            superintendente: superVal,
                            auxiliar: auxVal,
                            ...(newPassword ? { password: newPassword, contrasena: newPassword } : {}),
                        });
                        console.log("✅ Perfil sincronizado con Firestore:", personDocId);
                    } catch (e) {
                        console.warn("⚠️ No se pudo actualizar Firestore directamente:", e);
                    }
                }

                showNotification("Perfil de usuario actualizado y sincronizado", "success");
                modal.classList.add("hidden");
            };
        }
    });
}

window.openUserProfileModal = openUserProfileModal;
