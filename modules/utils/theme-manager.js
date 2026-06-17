/**
 * Theme Manager for MorphinGlass
 * Handles Light/Dark/Auto modes
 */

export const applyTheme = (theme) => {
    const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.style.colorScheme = 'dark';
    } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.style.colorScheme = 'light';
    }

    // Dispatch dynamic event for views listening to theme changes
    document.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme } }));
};

export const initTheme = () => {
    const theme = localStorage.getItem('theme') || 'auto';
    applyTheme(theme);

    // Real-time synchronization with device preference settings
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = (e) => {
        const currentTheme = localStorage.getItem('theme') || 'auto';
        if (currentTheme === 'auto') {
            applyTheme('auto');
        }
    };
    
    try {
        mediaQuery.removeEventListener('change', handleSystemChange);
        mediaQuery.addEventListener('change', handleSystemChange);
    } catch (err) {
        try {
            mediaQuery.addListener(handleSystemChange);
        } catch (e) {}
    }

    // Setup global listeners to automatically keep the DOM theme buttons in sync
    document.addEventListener('theme-changed', (e) => {
        updateDOMThemeToggles(e.detail.theme);
    });

    // Run initial DOM update after short delay to let dashboard mount
    setTimeout(() => {
        const activeTheme = localStorage.getItem('theme') || 'auto';
        updateDOMThemeToggles(activeTheme);
    }, 150);
};

export const toggleTheme = () => {
    const currentTheme = localStorage.getItem('theme') || 'auto';
    let newTheme;

    // Cycle: auto -> light -> dark -> auto
    if (currentTheme === 'auto') {
        newTheme = 'light';
        localStorage.setItem('theme', 'light');
    } else if (currentTheme === 'light') {
        newTheme = 'dark';
        localStorage.setItem('theme', 'dark');
    } else {
        newTheme = 'auto';
        localStorage.removeItem('theme');
    }

    applyTheme(newTheme);

    // Elegant non-blocking toast messaging
    if (typeof window.xToast === 'function') {
        const labels = {
            light: 'Tema: Modo Claro ☀️',
            dark: 'Tema: Modo Oscuro 🌙',
            auto: 'Tema: Configuración del Dispositivo 💻'
        };
        window.xToast(labels[newTheme] || 'Tema Actualizado', 'info');
    }

    return newTheme;
};

export const updateDOMThemeToggles = (theme) => {
    // Select all sidebar buttons and custom header theme selector buttons
    const toggles = document.querySelectorAll('.theme-toggle-btn, [onclick="window.toggleTheme();"]');
    toggles.forEach(btn => {
        const textSpan = btn.querySelector('.sidebar-text') || btn.querySelector('span');
        const icon = btn.querySelector('i') || btn.querySelector('svg');
        
        let label = 'Tema: Dispositivo';
        let iconClass = 'fas fa-laptop';
        let titleText = 'Tema: Automático (Sincronizado con Dispositivo)';
        
        if (theme === 'light') {
            label = 'Tema: Claro';
            iconClass = 'fas fa-sun text-amber-500';
            titleText = 'Tema: Modo Claro';
        } else if (theme === 'dark') {
            label = 'Tema: Oscuro';
            iconClass = 'fas fa-moon text-indigo-400';
            titleText = 'Tema: Modo Oscuro';
        }
        
        if (textSpan) {
            textSpan.textContent = label;
        }
        
        btn.title = titleText;
        
        if (icon && icon.tagName === 'I') {
            // Unify transitions and rotation
            icon.className = `${iconClass} transition-all duration-300 transform group-hover:scale-110`;
        }
    });
};

// Bind to window for direct HTML onClick support
window.initTheme = initTheme;
window.toggleTheme = toggleTheme;
window.updateDOMThemeToggles = updateDOMThemeToggles;
