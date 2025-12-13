const fs = require('fs');
const content = fs.readFileSync('modules/admin-dashboard.js', 'utf8');
const lines = content.split('\n');

let openLine = 0;
let inString = false;

lines.forEach((line, i) => {
    let clean = line.replace(/\/\/.*$/, ''); // basic comment strip
    const count = (clean.match(/`/g) || []).length;

    // Simplistic toggle
    // This assumes backticks don't appear escaped inside strings often
    for (let k = 0; k < count; k++) {
        if (!inString) {
            inString = true;
            openLine = i + 1;
        } else {
            inString = false;
        }
    }
});

if (inString) {
    console.log(`Unclosed string starting at Line ${openLine}`);
} else {
    console.log("All backticks paired.");
}
