const fs = require('fs');
const code = fs.readFileSync('modules/admin-dashboard.js', 'utf8');

let backtickCount = 0;
let lastBacktickIndex = -1;

for (let i = 0; i < code.length; i++) {
    if (code[i] === '`') {
        // Simple heuristic: ignore escaped backticks (not perfect but helpful)
        if (i > 0 && code[i - 1] === '\\') continue;

        backtickCount++;
        lastBacktickIndex = i;
    }
}

console.log(`Total Backticks: ${backtickCount}`);
if (backtickCount % 2 !== 0) {
    console.log("ODD NUMBER OF BACKTICKS DETECTED!");
    // Find context of the last one
    const context = code.substring(Math.max(0, lastBacktickIndex - 50), Math.min(code.length, lastBacktickIndex + 50));
    console.log(`Context around last backtick (Index ${lastBacktickIndex}):`);
    console.log(context);

    // Find line number
    const lines = code.substring(0, lastBacktickIndex).split('\n');
    console.log(`Line Number: ${lines.length}`);
} else {
    console.log("Backticks are balanced (by count check).");
}
