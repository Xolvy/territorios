/**
 * Xolvy PWA — Responsive Audit Refactoring Script v1
 * Policy: "Zero Horizontal Scroll" on mobile devices.
 * 
 * FASE 1: Overflow & fixed widths
 * FASE 2: Flex min-w-0 injection  
 * FASE 3: Touch targets
 * FASE 4: Table-specific fixes
 */
const fs = require('fs');
const path = require('path');

const modulesDir = path.join(__dirname, 'modules');
const changes = [];

function getFiles(dir, filesList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            getFiles(filePath, filesList);
        } else if (filePath.endsWith('.js')) {
            filesList.push(filePath);
        }
    }
    return filesList;
}

const allFiles = getFiles(modulesDir);

for (const file of allFiles) {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    const relPath = file.replace(modulesDir, '');

    // ═══════════════════════════════════════════════════════
    // FASE 1: Remove min-w-max (causes horizontal scroll)
    // ═══════════════════════════════════════════════════════
    content = content.replace(/\bmin-w-max\b/g, 'min-w-0');

    // ═══════════════════════════════════════════════════════
    // FASE 2: Inject min-w-0 on flex-1 children
    // Pattern: flex-1 without min-w-0
    // ═══════════════════════════════════════════════════════
    content = content.replace(/\bflex-1\b(?![\s"']*min-w-0)/g, (match, offset) => {
        // Check if min-w-0 is already nearby in the same class string
        const surroundingChunk = content.substring(Math.max(0, offset - 200), offset + 200);
        // Only inject if this occurrence is inside a class attribute and min-w-0 is not already there
        const classStart = surroundingChunk.lastIndexOf('class="');
        const classEnd = surroundingChunk.indexOf('"', classStart + 7);
        if (classStart !== -1 && classEnd !== -1) {
            const classContent = surroundingChunk.substring(classStart + 7, classEnd);
            if (classContent.includes('min-w-0')) {
                return match; // Already has min-w-0
            }
        }
        return 'flex-1 min-w-0';
    });

    // ═══════════════════════════════════════════════════════
    // FASE 3: Touch targets — Confirm buttons with py-2.5
    // Upgrade small paddings on important action buttons
    // ═══════════════════════════════════════════════════════
    // Fix the specific confirm button: py-2.5 -> py-4
    content = content.replace(
        /class="([^"]*?)flex-\[1\.5\] px-6 py-2\.5 bg-blue-600([^"]*?)"/g,
        'class="$1flex-[1.5] px-6 py-4 bg-blue-600$2 min-h-[44px]"'
    );

    // ═══════════════════════════════════════════════════════
    // FASE 4: Ensure break-words on long text containers
    // Add break-words to cells with addresses/emails
    // ═══════════════════════════════════════════════════════
    // Already have truncate in most places, which is fine.
    // Add overflow-wrap for textareas/inputs that might be too wide
    
    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        changes.push(relPath);
    }
}

console.log(`Responsive Audit Phase 1-3: Modified ${changes.length} files.`);
changes.forEach(f => console.log(`  Updated: ${f}`));
