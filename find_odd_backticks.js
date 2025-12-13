const fs = require('fs');
const content = fs.readFileSync('modules/admin-dashboard.js', 'utf8');
const lines = content.split('\n');

lines.forEach((line, i) => {
    // Remove comments roughly
    let clean = line.replace(/\/\/.*$/, '');
    // This doesn't handle /* */ or strings with //

    // Count backticks
    const count = (clean.match(/`/g) || []).length;
    if (count % 2 !== 0) {
        console.log(`Line ${i + 1} has ODD backticks (${count}): ${clean.trim()}`);
    }
});
