/**
 * @module ui-helpers
 * @description Barrel file (agregador) para los servicios de presentación.
 *              Reexporta utilidades de fecha (ui-date-helpers) y el sistema
 *              de modales (ui-modals) para mantener retrocompatibilidad.
 *
 * @layer Frontend / Services
 *
 * @exports
 *  - UIHelpers (desde ui-date-helpers.js)
 *  - showModal, showCustomConfirm, showCustomPrompt, showCustomAlert, showTerritorySelectionModal (desde ui-modals.js)
 */

export { UIHelpers } from './ui-date-helpers.js';
export {
    showModal,
    showCustomConfirm,
    showCustomPrompt,
    showCustomAlert,
    showTerritorySelectionModal
} from './ui-modals.js';
