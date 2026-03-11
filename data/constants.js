/**
 * @file constants.js
 * @description Centralized Firestore collection names and system constants to avoid Rollup binding conflicts.
 */

export const COL = {
    TERRITORIOS: "territorios",
    BANCO_S13: "banco_s13",
    BITACORA_OBS: "bitacora_observaciones",
    CONFIG: "configuracion",
    HISTORIAL: "historial_territorios",
    POIS: "puntos_interes",
    PROGRAMA: "programa_semanal",
    AUDIT: "logs_auditoria",
    METRICAS: "metricas_telefonia",
    TELEFONOS: "telefonos"
};

export const CACHE_KEYS = {
    TERRITORIOS: 'territorios_combined',
    HISTORIAL: 'historial',
    STATS: 'stats_globales',
    PROGRAMA: 'programa',
    POIS: 'puntos_interes'
};
