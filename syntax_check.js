const fs = require('fs');
const files = ['modules/admin-dashboard.js', 'modules/login.js', 'modules/conductor-dashboard.js', 'app.js'];

files.forEach(f => {
    try {
        const c = fs.readFileSync(f, 'utf8');
        const backticks = (c.match(/`/g) || []).length;
        const openBraces = (c.match(/\{/g) || []).length;
        const closeBraces = (c.match(/\}/g) || []).length;
        console.log(`${f}: Backticks=${backticks} (${backticks % 2 === 0 ? 'OK' : 'ODD!'}), Braces=${openBraces}/${closeBraces}`);
    } catch (e) {
        console.error(`Error reading ${f}: ${e.message}`);
    }
});
