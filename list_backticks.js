const fs = require('fs');
const content = fs.readFileSync('modules/admin-dashboard.js', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
    if (l.includes('`')) {
        console.log(`${i + 1}: ${l.trim()}`);
    }
});
