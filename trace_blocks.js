const fs = require('fs');
const content = fs.readFileSync('modules/admin-dashboard.js', 'utf8');
const lines = content.split('\n');

let inString = false;
let startLine = 0;

console.log("Tracing blocks...");
lines.forEach((line, i) => {
    let clean = line.replace(/\/\/.*$/, '');
    const count = (clean.match(/`/g) || []).length;

    for (let k = 0; k < count; k++) {
        if (!inString) {
            inString = true;
            startLine = i + 1;
        } else {
            inString = false;
            console.log(`Block: ${startLine} - ${i + 1}`);
        }
    }
});
if (inString) {
    console.log(`Still open! Last opened at: ${startLine}`);
}
