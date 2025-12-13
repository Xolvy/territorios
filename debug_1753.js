const fs = require('fs');
const lines = fs.readFileSync('modules/admin-dashboard.js', 'utf8').split('\n');
const i = 1752; // 0-indexed for line 1753
if (i < lines.length) {
    const l = lines[i];
    console.log(`[${i + 1}] Content: >>>${l}<<<`);
    console.log(`Backtick Count: ${(l.match(/`/g) || []).length}`);
} else {
    console.log("Line 1753 does not exist (file length: " + lines.length + ")");
}
