/**
 * MODULAR BASE ENGINE
 * Use this template to create new modules that support HMS (Hot Module Swapping)
 */

export const createModularView = (moduleName, renderFn) => {
    console.log(`🚀 [${moduleName}] Module Initialized (v${__APP_VERSION__})`);

    return async (container, ...args) => {
        // Clear previous module logic if needed
        // container.innerHTML = '';

        try {
            await renderFn(container, ...args);
        } catch (error) {
            console.error(`❌ Error rendering module [${moduleName}]:`, error);
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center p-20 text-center space-y-4">
                    <div class="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-3xl flex items-center justify-center text-3xl">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h2 class="text-xl font-black uppercase italic">Error de Módulo</h2>
                    <p class="text-sm text-slate-500 max-w-xs">Hubo un problema al cargar esta sección. Estamos intentando restaurarla.</p>
                    <button onclick="location.reload()" class="bg-primary text-white px-6 py-2 rounded-xl text-xs font-black uppercase">Recargar Sistema</button>
                </div>
            `;
        }
    };
};
