/**
 * @file alerts.js
 * @description Xolvy Alert System — SweetAlert2 with Glassmorphism 2.0 theme.
 * Replaces all native alert/confirm/prompt dialogs globally.
 */
import Swal from "sweetalert2";

// ─── THEME FOUNDATION ─────────────────────────────────────────────────────────
// We use pure Tailwind responsive modifiers (dark:bg-slate-900/90, etc.)
// to ensure the alert components instantly and reactively adapt to theme changes.
const BASE_CLASSES = {
    popup: "modern-card !rounded-[2rem] !p-0 !overflow-hidden !border !border-slate-200 dark:!border-white/10 !shadow-[0_60px_120px_-20px_rgba(0,0,0,0.6)] !backdrop-blur-3xl !bg-white/95 dark:!bg-slate-900/90",
    htmlContainer: "!px-8 !pb-0 !text-slate-700 dark:!text-slate-200",
    title: "!px-8 !pt-8 !pb-3 !font-black !text-slate-800 dark:!text-slate-100 !tracking-tighter !text-xl !uppercase",
    confirmButton:
        "btn-primary !px-8 !py-4 !text-[10px] !font-black !uppercase !tracking-widest !rounded-2xl !shadow-xl !shadow-primary/20",
    cancelButton:
        "!px-8 !py-4 !text-[10px] !font-black !uppercase !tracking-widest !rounded-2xl !bg-slate-100 dark:!bg-white/5 !text-slate-600 dark:!text-slate-300 !shadow-none hover:!bg-slate-200 dark:hover:!bg-white/10",
    actions: "!px-8 !pb-8 !pt-4 !gap-3 !flex-row-reverse",
    icon: "!border-0 !mb-0 !mt-8 !mx-auto",
};

// ─── BASE INSTANCE ─────────────────────────────────────────────────────────────
// The backdrop style is styled dynamically in input.css using .swal2-container for zero-lock-in reactive rendering
export const XolvyAlert = Swal.mixin({
    customClass: BASE_CLASSES,
    buttonsStyling: false,
    showClass: {
        popup: "animate-scale-in",
    },
    hideClass: {
        popup: "swal2-hide",
    },
    allowOutsideClick: true,
    allowEscapeKey: true,
    confirmButtonText: "Confirmar",
    cancelButtonText: "Cancelar",
});

// ─── SPECIALIZED HELPERS ───────────────────────────────────────────────────────

/**
 * Confirm dialog — replaces confirm()
 * @returns {Promise<boolean>}
 */
export const xConfirm = async (title, text = "", options = {}) => {
    const result = await XolvyAlert.fire({
        title,
        text,
        icon: options.icon || "warning",
        showCancelButton: true,
        confirmButtonText: options.confirm || "Sí, continuar",
        cancelButtonText: options.cancel || "Cancelar",
        reverseButtons: false,
        customClass: {
            ...BASE_CLASSES,
            icon: `!border-0 !mb-0 !mt-8 !mx-auto ${options.icon === "error" ? "!text-rose-500" : "!text-amber-500"}`,
            confirmButton: options.danger
                ? "!px-8 !py-4 !text-[10px] !font-black !uppercase !tracking-widest !rounded-2xl !bg-rose-600 !text-white hover:!bg-rose-700 !shadow-xl !shadow-rose-600/20"
                : BASE_CLASSES.confirmButton,
        },
    });
    return result.isConfirmed;
};

/**
 * Input prompt — replaces prompt()
 * @returns {Promise<string|null>}
 */
export const xPrompt = async (title, placeholder = "", defaultValue = "") => {
    const result = await XolvyAlert.fire({
        title,
        input: "text",
        inputPlaceholder: placeholder,
        inputValue: defaultValue,
        showCancelButton: true,
        confirmButtonText: "Guardar",
        inputAttributes: { autocomplete: "off" },
        customClass: {
            ...BASE_CLASSES,
            input: "!rounded-2xl !border !border-slate-200 dark:border-slate-700 dark:!border-white/10 !bg-slate-50 dark:bg-slate-800 dark:!bg-white/5 !text-slate-800 dark:!text-white !font-bold !text-sm !px-5 !py-4 focus:!border-primary focus:!ring-2 focus:!ring-primary/20 !shadow-inner !mt-4",
        },
        inputValidator: (value) => {
            if (!value?.trim()) return "Este campo es requerido.";
        },
    });
    return result.isConfirmed ? result.value?.trim() : null;
};

export const xToast = (message, type = "success") => {
    const iconMap = {
        success: '<i class="fas fa-check"></i>',
        error: '<i class="fas fa-times"></i>',
        warning: '<i class="fas fa-exclamation-triangle"></i>',
        info: '<i class="fas fa-info-circle"></i>',
    };
    const colorMap = {
        success: "from-emerald-600 to-teal-500",
        error: "from-rose-600 to-red-500",
        warning: "from-amber-500 to-orange-400",
        info: "from-indigo-600 to-blue-500",
    };

    Swal.fire({
        toast: true,
        position: "top-end",
        timer: 3500,
        timerProgressBar: true,
        showConfirmButton: false,
        customClass: {
            popup: `!rounded-[1.75rem] !border !border-slate-200/60 dark:!border-white/10 !shadow-[0_20px_50px_rgba(0,0,0,0.05)] dark:!shadow-[0_20px_50px_rgba(0,0,0,0.45)] !backdrop-blur-xl !bg-white/95 dark:!bg-slate-900/95 !p-0 !overflow-hidden`,
        },
        html: `
            <div class="flex items-center gap-4 px-5 py-4 w-full">
                <div class="w-9 h-9 rounded-xl bg-gradient-to-br ${colorMap[type] || colorMap.info} flex items-center justify-center text-white font-black text-xs shadow-lg shadow-indigo-500/10 flex-shrink-0">
                    ${iconMap[type] || iconMap.info}
                </div>
                <p class="text-xs font-black text-slate-800 dark:text-slate-100 leading-snug text-left flex-1 min-w-0">${message}</p>
            </div>
        `,
        showClass: { popup: "animate-slide-in-right" },
    });
};

/**
 * Full-featured info/success/error dialog
 */
export const xAlert = async (title, text, type = "info") => {
    return XolvyAlert.fire({ title, text, icon: type, showCancelButton: false });
};

/**
 * Critical delete confirmation with typing verification
 * @param {string} itemName - The name of the item to confirm deletion of
 * @returns {Promise<boolean>}
 */
export const xDeleteConfirm = async (itemName) => {
    const result = await XolvyAlert.fire({
        title: "¿Eliminar definitivamente?",
        html: `
            <p class="text-sm text-slate-500 dark:text-slate-300 leading-relaxed">Esta acción no se puede deshacer. Escribe <b class="text-rose-500 font-black">"${itemName}"</b> para confirmar.</p>
            <input id="swal-delete-confirm" placeholder="Escribe aquí para confirmar..." class="mt-4 w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-white font-bold text-sm px-5 py-4 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 shadow-inner block">
        `,
        icon: "error",
        showCancelButton: true,
        confirmButtonText: "Eliminar",
        customClass: {
            ...BASE_CLASSES,
            confirmButton:
                "!px-8 !py-4 !text-[10px] !font-black !uppercase !tracking-widest !rounded-2xl !bg-rose-600 !text-white hover:!bg-rose-700 !shadow-xl !shadow-rose-600/20",
        },
        preConfirm: () => {
            const input = document.getElementById("swal-delete-confirm");
            if (input?.value?.trim() !== itemName) {
                Swal.showValidationMessage("El texto no coincide. Inténtalo de nuevo.");
                return false;
            }
            return true;
        },
    });
    return result.isConfirmed;
};

// ─── GLOBAL COMPATIBILITY SHIM ────────────────────────────────────────────────
// Replaces native browser dialogs so legacy code works without changes.
window.xAlert = xAlert;
window.xConfirm = xConfirm;
window.xPrompt = xPrompt;
window.xToast = xToast;
window.xDeleteConfirm = xDeleteConfirm;
window.XolvyAlert = XolvyAlert;
