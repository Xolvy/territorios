const fs = require('fs');

const content = fs.readFileSync('modules/admin-dashboard.js', 'utf8');

const stack = [{ type: 'ROOT', startLine: 1 }];
let line = 1;

for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '\n') {
        line++;
        continue;
    }

    const context = stack[stack.length - 1];

    if (context.type === 'ROOT' || context.type === 'INTERPOLATION' || context.type === 'BLOCK') {
        if (char === '`') {
            stack.push({ type: 'TEMPLATE', startLine: line });
        } else if (char === '{') {
            if (context.type === 'INTERPOLATION' || context.type === 'BLOCK') {
                stack.push({ type: 'BLOCK', startLine: line });
            }
        } else if (char === '}') {
            if (context.type === 'BLOCK') {
                stack.pop();
            } else if (context.type === 'INTERPOLATION') {
                stack.pop();
            }
        }
        // Ignores ' and " strings for simplicity, assumming no backticks inside them for now
    } else if (context.type === 'TEMPLATE') {
        if (char === '`') {
            stack.pop();
        } else if (char === '$' && content[i + 1] === '{') {
            stack.push({ type: 'INTERPOLATION', startLine: line });
            i++;
        }
    }
}

console.log("Stack size:", stack.length);
if (stack.length > 1) {
    console.log("Unclosed element:", stack[stack.length - 1]);
    if (stack.length > 2) console.log("Parent:", stack[stack.length - 2]);
}
