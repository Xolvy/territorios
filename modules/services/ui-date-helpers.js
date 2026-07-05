/**
 * @module ui-date-helpers
 * @description Utilidades de fecha y de imagen para la capa de presentación.
 *              Parte del sistema UIHelpers, extraída para responsabilidad única.
 *
 * @layer Frontend / Services
 * @depends date-fns
 *
 * @exports
 *  UIHelpers (objeto)
 *   - parseFirebaseDate(d)         → Convierte Firestore Timestamp / ISO string / Date a Date nativo
 *   - fmtDate(d)                   → Formato corto DD/MM (ej. "07/04")
 *   - fmtDateAt(d)                 → Formato DD MMM (ej. "07 abr")
 *   - getMonday(d)                 → Retorna el lunes de la semana que contiene `d`
 *   - formatDateId(date)           → Formato YYYY-MM-DD para IDs de colección Firestore
 *   - formatDisplayDateRange(date) → Rango humanizado "7 abr - 13 abr 2025"
 *   - initImagePanZoom(imgId, containerId) → Pan/zoom via mouse y touch sobre una imagen
 */
import * as dateFns from "date-fns";

// ═══════════════════════════════════════════════════════════
// UTILIDADES DE FECHA
// ═══════════════════════════════════════════════════════════

export const UIHelpers = {
    /**
     * Convierte cualquier tipo de fecha Firebase/ISO/Date a un objeto Date nativo.
     * Soporta: Firestore Timestamp ({ seconds, nanoseconds }), ISO string, y Date.
     * @param {*} d - Valor de fecha a convertir
     * @returns {Date|null} Fecha convertida, o null si no es válida
     */
    parseFirebaseDate: (d) => {
        if (!d) return null;
        if (typeof d.toDate === "function") return d.toDate();
        if (d.seconds) return new Date(d.seconds * 1000);
        if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
            // Append local midnight to prevent browser from parsing as UTC (which causes off-by-one shifts)
            const date = new Date(`${d}T00:00:00`);
            return Number.isNaN(date.getTime()) ? null : date;
        }
        const date = new Date(d);
        return Number.isNaN(date.getTime()) ? null : date;
    },

    /** Formato corto: DD/MM (ej. "07/04") */
    fmtDate: (d) => {
        const date = UIHelpers.parseFirebaseDate(d);
        return !date ? "—" : date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
    },

    /** Formato mediano: DD Mes (ej. "07 abr") */
    fmtDateAt: (d) => {
        const date = UIHelpers.parseFirebaseDate(d);
        return !date ? "—" : date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
    },

    /**
     * Retorna el lunes de la semana que contiene la fecha dada.
     * @param {Date|string} d - Cualquier fecha válida
     * @returns {Date} El lunes de esa semana
     */
    getMonday: (d) => {
        const parsed = UIHelpers.parseFirebaseDate(d);
        if (!parsed) return new Date();
        const dateObj = new Date(parsed);
        const day = dateObj.getDay();
        const diff = dateObj.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(dateObj.setDate(diff));
    },

    /**
     * Formatea una fecha al formato YYYY-MM-DD usado como ID de documentos
     * en la colección `programa_semanal` de Firestore.
     * @param {Date|string} date - Fecha a formatear
     * @returns {string} Formato "YYYY-MM-DD"
     */
    formatDateId: (date) => {
        const parsed = UIHelpers.parseFirebaseDate(date);
        if (!parsed) return "";
        const year = parsed.getFullYear();
        const month = String(parsed.getMonth() + 1).padStart(2, "0");
        const day = String(parsed.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    },

    /**
     * Genera un rango de fecha legible para mostrar en la UI.
     * Ej: "7 abr - 13 abr 2025"
     * @param {Date|string} date - Fecha de inicio del rango (lunes)
     * @returns {string} Rango humanizado
     */
    formatDisplayDateRange: (date) => {
        try {
            const start = UIHelpers.parseFirebaseDate(date);
            if (!start || Number.isNaN(start.getTime())) return "";
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            if (dateFns && typeof dateFns.format === "function") {
                return `${dateFns.format(start, "d MMM")} - ${dateFns.format(end, "d MMM yyyy")}`;
            }
            const f = (d) => `${d.getDate()}/${d.getMonth() + 1}`;
            return `${f(start)} - ${f(end)}, ${start.getFullYear()}`;
        } catch (_e) {
            return date;
        }
    },

    // ═══════════════════════════════════════════════════════════
    // HELPER DE IMAGEN: Pan/Zoom interactivo
    // ═══════════════════════════════════════════════════════════

    /**
     * Habilita pan y zoom interactivo sobre una imagen dentro de un contenedor.
     * Soporta: arrastre con mouse, pinch-to-zoom táctil, y scroll de rueda.
     * @param {string} imgId - ID del elemento <img>
     * @param {string} containerId - ID del contenedor padre
     * @returns {{ reset: Function, zoom: Function }|null} Controladores, o null si no existe el elemento
     */
    initImagePanZoom: (imgId, containerId) => {
        const img = document.getElementById(imgId);
        const container = document.getElementById(containerId);
        if (!img || !container) return null;

        let state = { scale: 1, x: 0, y: 0 };
        let isDragging = false;
        let startX, startY;
        let lastX = 0,
            lastY = 0;
        let lastTouchDist = 0;

        const updateTransform = () => {
            img.style.transform = `scale(${state.scale}) translate(${state.x}px, ${state.y}px)`;
        };

        // --- Mouse Events ---
        container.onmousedown = (e) => {
            e.preventDefault();
            isDragging = true;
            startX = e.clientX - lastX;
            startY = e.clientY - lastY;
            container.style.cursor = "grabbing";
        };

        window.onmousemove = (e) => {
            if (!isDragging) return;
            lastX = e.clientX - startX;
            lastY = e.clientY - startY;
            state.x = lastX / state.scale;
            state.y = lastY / state.scale;
            updateTransform();
        };

        window.onmouseup = () => {
            isDragging = false;
            container.style.cursor = "default";
        };

        // --- Touch Events ---
        container.ontouchstart = (e) => {
            if (e.touches.length === 1) {
                isDragging = true;
                startX = e.touches[0].clientX - lastX;
                startY = e.touches[0].clientY - lastY;
            } else if (e.touches.length === 2) {
                lastTouchDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY,
                );
            }
        };

        container.ontouchmove = (e) => {
            if (e.touches.length === 1 && isDragging) {
                lastX = e.touches[0].clientX - startX;
                lastY = e.touches[0].clientY - startY;
                state.x = lastX / state.scale;
                state.y = lastY / state.scale;
                updateTransform();
            } else if (e.touches.length === 2) {
                e.preventDefault();
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY,
                );
                const delta = (dist - lastTouchDist) / 100;
                state.scale = Math.max(1, Math.min(10, state.scale + delta));
                lastTouchDist = dist;
                updateTransform();
            }
        };

        container.ontouchend = () => {
            isDragging = false;
        };

        // --- Wheel Zoom ---
        container.onwheel = (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.2 : 0.2;
            state.scale = Math.max(1, Math.min(10, state.scale + delta));
            updateTransform();
        };

        return {
            reset: () => {
                state = { scale: 1, x: 0, y: 0 };
                lastX = 0;
                lastY = 0;
                updateTransform();
            },
            zoom: (delta) => {
                state.scale = Math.max(1, Math.min(10, state.scale + delta));
                updateTransform();
            },
        };
    },
};
