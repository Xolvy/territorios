import fs from 'fs';
const content = fs.readFileSync('modules/conductor-dashboard.js', 'utf8');
let openParens = 0;
let inString = false;
let stringChar = '';
let inTemplate = false;
let inComment = false;
let inBlockComment = false;
let lineNum = 1;

for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const prev = i > 0 ? content[i - 1] : '';
    const next = i < content.length - 1 ? content[i + 1] : '';

    if (inBlockComment) {
        if (char === '*' && next === '/') { inBlockComment = false; i++; }
    } else if (inComment) {
        if (char === '\n') inComment = false;
    } else if (inString) {
        if (char === stringChar && prev !== '\\') inString = false;
    } else if (inTemplate) {
        if (char === '`' && prev !== '\\') inTemplate = false;
    } else {
        if (char === '/' && next === '/') { inComment = true; i++; }
        else if (char === '/' && next === '*') { inBlockComment = true; i++; }
        else if (char === "'" || char === '"') { inString = true; stringChar = char; }
        else if (char === '`') { inTemplate = true; }
        else if (char === '(') {
            openParens++;
            if (openParens === 1) console.log(`Balance 1 at line ${lineNum}`);
        }
        else if (char === ')') {
            openParens--;
            if (openParens === 0) console.log(`Balance 0 at line ${lineNum}`);
        }
    }
    if (char === '\n') lineNum++;
}
