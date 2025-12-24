const fs = require('fs');
const acorn = require('./node_modules/acorn/dist/acorn.js');

const code = fs.readFileSync('modules/admin-dashboard.js', 'utf8');

try {
    acorn.parse(code, { ecmaVersion: 2022, sourceType: 'module' });
    console.log("Syntax is valid.");
} catch (e) {
    console.log(`Syntax Error at line ${e.loc.line}, column ${e.loc.column}: ${e.message}`);
    // Show context
    const lines = code.split('\n');
    const line = lines[e.loc.line - 1];
    console.log(`Code: ${line}`);
}
