import { auth } from './firebase-config.js';
import { onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { renderLogin } from './modules/login.js?v=3.4';
import { renderAdminDashboard } from './modules/admin-dashboard.js?v=3.4';
import { renderConductorDashboard } from './modules/conductor-dashboard.js?v=3.4';
import { getPermisosUsuario } from './data/firestore-services.js?v=3.4';

// Estado global simple para demo
let currentUserRole = null;

document.addEventListener('DOMContentLoaded', () => {
    const appContainer = document.getElementById('app-container');

    // 1. Registrar Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js')
                .then(reg => console.log('SW registrado'))
                .catch(err => console.log('SW error', err));
        });
    }

    // 2. Manejar Auth
    onAuthStateChanged(auth, async (user) => {
        appContainer.innerHTML = ''; // Limpiar

        if (user) {
            // Usuario autenticado

            // Si es anónimo, confiamos en el localStorage para el rol/identidad (Lógica Conductor sin pass)
            if (user.isAnonymous) {
                const storedRole = localStorage.getItem('demo_role');

                // Si no hay rol guardado (ej. usuario hizo logout limpieza), cerramos la sesión anónima real
                if (!storedRole) {
                    auth.signOut();
                    return;
                }

                const storedName = localStorage.getItem('selected_conductor_name');
                if (storedRole === 'Conductor') {
                    renderConductorDashboard(appContainer, storedName || 'Conductor');
                    return;
                }
            }

            // Buscamos el rol en Firestore (Logic Admin o Conductor con email real)
            const permisos = await getPermisosUsuario(user.email);

            // Usamos el rol de Firestore si existe, sino fallback a localStorage o 'Conductor'
            const role = (permisos && permisos.role) || currentUserRole || localStorage.getItem('demo_role') || 'Conductor';

            if (role === 'Administrador') {
                renderAdminDashboard(appContainer);
            } else {
                renderConductorDashboard(appContainer, user.email || 'Usuario');
            }
        } else {
            renderLogin(appContainer);
        }
    });

    // LISTENER PARA LOGIN SIN PASSWORD (Ciosco/Demo)
    document.addEventListener('demo-login', async (e) => {
        const { email, role } = e.detail;
        currentUserRole = role;
        localStorage.setItem('demo_role', role);

        // Si es conductor (selección de lista), guardamos el nombre para usarlo tras el login anónimo
        if (role === 'Conductor') {
            localStorage.setItem('selected_conductor_name', email); // En este caso email es el nombre o email
        }

        // Si ya hay usuario (ej. Admin saliendo a Conductor?), signOut primero?
        // Asumimos flujo limpio. Iniciamos sesión anónima para cumplir reglas Firestore.
        if (!auth.currentUser) {
            try {
                await signInAnonymously(auth);
                // onAuthStateChanged se encargará del render
            } catch (error) {
                console.error("Error signing in anonymously:", error);
                if (error.code === 'auth/admin-restricted-operation') {
                    alert("⚠️ Configuración requerida: Debes habilitar el proveedor 'Anónimo' en la consola de Firebase Authentication.");
                } else {
                    alert("Error de autenticación: " + error.message);
                }
            }
        } else {
            // Ya autenticado (quizás real o anónimo previo), forzamos refresh de vista
            if (role === 'Administrador') {
                renderAdminDashboard(appContainer);
            } else {
                renderConductorDashboard(appContainer, email);
            }
        }
    });
});
