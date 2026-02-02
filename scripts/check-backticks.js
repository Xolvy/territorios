import fs from 'fs';
const content = fs.readFileSync('modules/conductor-dashboard.js', 'utf8');
let backticks = 0;
for (let i = 0; i < content.length; i++) {
    if (content[i] === '`') backticks++;
}
console.log(`Total backticks: ${backticks}`);
