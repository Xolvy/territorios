import fs from 'fs';
const content = fs.readFileSync('modules/conductor-dashboard.js', 'utf8');
const lines = content.split('\n');
let targetLine = 1073;
let charIdx = 0;
for (let i = 0; i < targetLine - 1; i++) {
    charIdx += lines[i].length + 1;
}
// Find the '}' on that line
let bracePos = charIdx + lines[targetLine - 1].indexOf('}');
console.log(`Matching brace for line ${targetLine} at pos ${bracePos}`);

let stack = [];
for (let i = 0; i < content.length; i++) {
    if (content[i] === '{') stack.push(i);
    if (content[i] === '}') {
        let start = stack.pop();
        if (i === bracePos) {
            let startLine = content.substring(0, start).split('\n').length;
            console.log(`Starts at line ${startLine}: ${lines[startLine - 1]}`);
        }
    }
}
