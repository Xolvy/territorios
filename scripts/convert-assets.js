import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const assetsDir = 'public/assets';

async function convertImage(fileName) {
    const inputPath = path.join(assetsDir, fileName);
    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext);
    const outputPath = path.join(assetsDir, `${base}.webp`);

    if (!fs.existsSync(inputPath)) {
        console.log(`File not found: ${inputPath}`);
        return;
    }

    console.log(`Converting ${inputPath} to ${outputPath}...`);
    try {
        await sharp(inputPath)
            .webp({ quality: 80 })
            .toFile(outputPath);
        
        const originalStats = fs.statSync(inputPath);
        const webpStats = fs.statSync(outputPath);
        
        const originalSizeKB = (originalStats.size / 1024).toFixed(2);
        const webpSizeKB = (webpStats.size / 1024).toFixed(2);
        const reduction = ((1 - webpStats.size / originalStats.size) * 100).toFixed(2);
        
        console.log(`✅ Converted ${fileName} successfully!`);
        console.log(`   Original: ${originalSizeKB} KB`);
        console.log(`   WebP: ${webpSizeKB} KB (Reduced by ${reduction}%)`);
    } catch (err) {
        console.error(`❌ Error converting ${fileName}:`, err);
    }
}

async function main() {
    await convertImage('mapa-general.jpg');
    await convertImage('mapa_territorio.png');
}

main();
