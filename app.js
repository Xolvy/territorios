import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { renderLogin } from './modules/login.js';
import { renderAdminDashboard } from './modules/admin-dashboard.js';
import { renderConductorDashboard } from './modules/conductor-dashboard.js';
import { getPermisosUsuario } from './data/firestore-services.js';

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
            // Buscamos el rol en Firestore
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

    // LISTENER PARA DEMO (Simulación de login sin backend real)
    document.addEventListener('demo-login', (e) => {
        const { email, role } = e.detail;
        currentUserRole = role;
        localStorage.setItem('demo_role', role);

        // Simulamos un objeto usuario de Firebase
        const mockUser = { uid: 'demo-123', email: email };

        // Forzamos la renderización ya que onAuthStateChanged no disparará si no hay auth real
        appContainer.innerHTML = '';
        if (role === 'Administrador') {
            renderAdminDashboard(appContainer);
        } else {
            renderConductorDashboard(appContainer, email);
        }
    });
});
