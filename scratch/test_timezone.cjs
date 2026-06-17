// Emulated UIHelpers incorporating timezone-safe fixes
const UIHelpers = {
    parseFirebaseDate: (d) => {
        if (!d) return null;
        if (typeof d.toDate === 'function') return d.toDate();
        if (d.seconds) return new Date(d.seconds * 1000);
        if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
            // Append local midnight time to force the browser to parse it in the local timezone
            const date = new Date(d + 'T00:00:00');
            return isNaN(date.getTime()) ? null : date;
        }
        const date = new Date(d);
        return isNaN(date.getTime()) ? null : date;
    },

    getMonday: (d) => {
        const parsed = UIHelpers.parseFirebaseDate(d);
        if (!parsed) return new Date();
        const dateObj = new Date(parsed);
        const day = dateObj.getDay();
        const diff = dateObj.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(dateObj.setDate(diff));
    },

    formatDateId: (date) => {
        const parsed = UIHelpers.parseFirebaseDate(date);
        if (!parsed) return '';
        const year = parsed.getFullYear();
        const month = String(parsed.getMonth() + 1).padStart(2, '0');
        const day = String(parsed.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    formatDisplayDateRange: (date) => {
        try {
            const start = UIHelpers.parseFirebaseDate(date);
            if (!start || isNaN(start.getTime())) return '';
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            
            // Standard format local date string fallback if date-fns is not loaded
            const f = (d) => `${d.getDate()}/${d.getMonth() + 1}`;
            return `${f(start)} - ${f(end)}, ${start.getFullYear()}`;
        } catch (e) { return date; }
    }
};

const testDates = [
    '2026-05-25', // Monday, May 25
    '2026-05-24', // Sunday, May 24
];

console.log("=== TIMEZONE FIXES TEST ===");
testDates.forEach(str => {
    console.log(`Input: ${str}`);
    
    const parsed = UIHelpers.parseFirebaseDate(str);
    console.log(`Parsed Date: ${parsed.toString()}`);
    console.log(`getDay(): ${parsed.getDay()} (expected 1 for Monday, 0 for Sunday)`);
    console.log(`getDate(): ${parsed.getDate()}`);
    
    const monday = UIHelpers.getMonday(str);
    console.log(`getMonday output: ${monday.toString()}`);
    console.log(`formatDateId(monday): ${UIHelpers.formatDateId(monday)}`);
    console.log(`formatDisplayDateRange(monday): ${UIHelpers.formatDisplayDateRange(monday)}`);
    console.log("--------------------------------");
});
