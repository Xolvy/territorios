/**
 * Theme Manager for MorphinGlass
 * Handles Light/Dark/Auto modes
 */

export const initTheme = () => {
    // Check local storage or system preference
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
};

export const toggleTheme = () => {
    const isDark = document.documentElement.classList.contains('dark');

    // Toggle
    if (isDark) {
        document.documentElement.classList.remove('dark');
        localStorage.theme = 'light';
        return 'light';
    } else {
        document.documentElement.classList.add('dark');
        localStorage.theme = 'dark';
        return 'dark';
    }
};

export const resetThemeToAuto = () => {
    localStorage.removeItem('theme');
    initTheme();
    return 'auto';
};

/**
 * Creates a beautiful floating toggle button
 */
export const createThemeToggle = () => {
    const btn = document.createElement('button');
    btn.className = "fixed top-6 right-6 z-[9999] p-3 rounded-full bg-white/10 dark:bg-white/10 backdrop-blur-xl border border-slate-200 dark:border-white/20 shadow-2xl hover:scale-110 transition-all text-teal-600 dark:text-teal-400 group ring-4 ring-black/[0.02]";
    btn.title = "Cambiar Tema (Claro/Oscuro)";

    const updateIcon = () => {
        const isDark = document.documentElement.classList.contains('dark');
        btn.innerHTML = isDark
            ? `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>`
            : `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>`;
    };

    updateIcon();

    btn.onclick = () => {
        toggleTheme();
        updateIcon();
    };

    return btn;
};
