import fs from 'fs';
const content = fs.readFileSync('modules/conductor-dashboard.js', 'utf8');
let openBraces = 0;
let inString = false;
let stringChar = '';
let inTemplate = false;
let inComment = false;
let inBlockComment = false;

for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const prev = i > 0 ? content[i - 1] : '';
    const next = i < content.length - 1 ? content[i + 1] : '';

    if (inBlockComment) {
        if (char === '*' && next === '/') { inBlockComment = false; i++; }
        continue;
    }
    if (inComment) {
        if (char === '\n') inComment = false;
        continue;
    }
    if (inString) {
        if (char === stringChar && prev !== '\\') inString = false;
        continue;
    }
    if (inTemplate) {
        if (char === '`' && prev !== '\\') inTemplate = false;
        // Handle ${ } inside template
        if (char === '$' && next === '{' && prev !== '\\') {
            // This is tricky because we need to track nested braces inside ${}
        }
        continue;
    }

    if (char === '/' && next === '/') { inComment = true; i++; continue; }
    if (char === '/' && next === '*') { inBlockComment = true; i++; continue; }
    if (char === "'" || char === '"') { inString = true; stringChar = char; continue; }
    if (char === '`') { inTemplate = true; continue; }

    if (char === '{') openBraces++;
    if (char === '}') openBraces--;
}
console.log(`Final open braces (ignoring most strings): ${openBraces}`);
