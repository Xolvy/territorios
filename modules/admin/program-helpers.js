/**
 * @module program-helpers
 * @description Utilidades puras para el manejo y validación del programa semanal.
 * @layer Frontend / Utils
 */

/**
 * 🗺️ TERRITORY HIERARCHY HELPERS
 */
export const parseTerritorioSelection = (val) => {
    const selection = {};
    const parts = (val || '').split(',').map(p => p.trim()).filter(Boolean);
    parts.forEach(part => {
        const match = part.match(/^(\d+)(?:\s*\((.*?)\))?$/);
        if (match) {
            const tNum = match[1];
            const content = match[2] || '';
            selection[tNum] = { blocks: new Set(), isFull: false };
            if (content) {
                if (content.toLowerCase() === 'completo') {
                    selection[tNum].isFull = true;
                } else {
                    content.split(/[,;/]/).forEach(b => selection[tNum].blocks.add(b.trim()));
                }
            } else {
                selection[tNum].isFull = true;
            }
        }
    });
    return selection;
};

export const formatTerritorioSelection = (selection) => {
    const parts = [];
    Object.keys(selection).sort((a,b) => a.localeCompare(b, undefined, {numeric:true})).forEach(tNum => {
        const data = selection[tNum];
        if (data.isFull) {
            parts.push(`${tNum}`);
        } else if (data.blocks.size > 0) {
            const sortedBlocks = Array.from(data.blocks).sort();
            parts.push(`${tNum} (${sortedBlocks.join(', ')})`);
        }
    });
    return parts.join(', ');
};

export const getWeekOccupancy = (currentProg, currentDayIdx, currentTurnId) => {
    const occupancy = {};
    if (!currentProg || !currentProg.dias) return occupancy;

    currentProg.dias.forEach((dia, dIdx) => {
        Object.keys(dia).filter(k => k !== 'nombre' && k !== 'fecha').forEach(tId => {
            if (dIdx === currentDayIdx && tId === currentTurnId) return;
            const data = dia[tId];
            if (data && data.territorio) {
                const sel = parseTerritorioSelection(data.territorio);
                Object.keys(sel).forEach(tNum => {
                    if (!occupancy[tNum]) occupancy[tNum] = { blocks: new Set(), isFull: false };
                    if (sel[tNum].isFull) occupancy[tNum].isFull = true;
                    else sel[tNum].blocks.forEach(b => occupancy[tNum].blocks.add(b));
                });
            }
        });
    });
    return occupancy;
};

export const getEffectiveManzanas = (t) => {
    return String(t.manzanas || '').split(/[,;/]/).map(m => m.trim()).filter(Boolean);
};

export const getEffectiveShiftId = (turnoId, horaStr) => {
    if (turnoId === 'zoom') return 'zoom';
    if (!horaStr || horaStr === '—') return turnoId;

    let hours = -1;
    const time = horaStr.toLowerCase().trim();
    const match = time.match(/(\d{1,2})[:.]?(\d{0,2})?\s*(am|pm)?/);

    if (match) {
        hours = parseInt(match[1]);
        const ampm = match[3];
        if (ampm === 'pm' && hours < 12) hours += 12;
        if (ampm === 'am' && hours === 12) hours = 0;
    }

    if (hours === -1) return turnoId;
    if (hours < 12) return 'manana';
    if (hours < 18) return 'tarde';
    return 'noche';
};

/**
 * 🕵️‍♂️ SMART VALIDATION (NEXO AI CROSS-CHECK)
 * Evalúa la coherencia entre Jornada, Hora y Faceta.
 */
export const checkIncongruences = (turnoId, hora, faceta) => {
    const findings = [];
    const t = (turnoId || '').toLowerCase();
    const h = (hora || '').toLowerCase();
    const f = (faceta || '').toLowerCase();

    // Regla A: Tiempo (AM en turnos de Noche estrictamente)
    if (t.includes('noche') && h.includes('am')) {
        findings.push("Horario AM en jornada nocturna");
    }

    // Regla B: Física vs Virtual (Casa en casa/Calles en Zoom)
    // FIXED: Telefonica y Cartas son COMPATIBLES con Zoom.
    if (t.includes('zoom') && (f.includes('casa') || f.includes('calle') || f.includes('negocio') || f.includes('carritos') || f.includes('digital (físico)'))) {
        findings.push("Faceta física en jornada virtual (Zoom)");
    }

    // Regla C: Eliminada (Telefónica/Cartas ahora es válida en cualquier jornada, sea Mañana, Tarde o Noche)

    return findings;
};

export const getTurnoStyling = (turnoId, horaStr) => {
    const defaults = {
        manana: { label: 'Mañana', icon: 'fa-sun', color: 'text-amber-500', bg: 'bg-amber-500/10' },
        tarde: { label: 'Tarde', icon: 'fa-cloud-sun', color: 'text-orange-500', bg: 'bg-orange-500/10' },
        noche: { label: 'Noche', icon: 'fa-moon', color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
        zoom: { label: 'Zoom', icon: 'fa-video', color: 'text-emerald-500', bg: 'bg-emerald-500/10' }
    };

    const effectiveId = getEffectiveShiftId(turnoId, horaStr);
    return defaults[effectiveId] || defaults.manana;
};

export const getFieldIcon = (field) => {
    const map = {
        'Lugar': 'fa-map-marker-alt',
        'Hora': 'fa-clock',
        'Conductor': 'fa-user-tie',
        'Auxiliar': 'fa-user',
        'Faceta': 'fa-tag',
        'Grupos': 'fa-users',
        'Territorio': 'fa-map'
    };
    return map[field] || 'fa-info-circle';
};
