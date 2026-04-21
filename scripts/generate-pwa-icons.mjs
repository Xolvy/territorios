import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

/**
 * PWA Icon Generator script
 * Converts favicon.svg into essential PNG resolutions for PWA.
 */

const INPUT_SVG = './public/favicon.svg';
const OUTPUT_DIR = './public';

const ICON_CONFIGS = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' }
];

async function generateIcons() {
  if (!fs.existsSync(INPUT_SVG)) {
    console.error(`❌ Source SVG not found: ${INPUT_SVG}`);
    process.exit(1);
  }

  console.log('🚀 Generating PWA Icons from SVG...');

  try {
    for (const config of ICON_CONFIGS) {
      const outputPath = path.join(OUTPUT_DIR, config.name);
      
      await sharp(INPUT_SVG)
        .resize(config.size, config.size)
        .png()
        .toFile(outputPath);
      
      console.log(`✅ Generated ${config.name} (${config.size}x${config.size})`);
    }

    console.log('✨ All icons generated successfully.');
  } catch (err) {
    console.error('❌ Error generating icons:', err);
  }
}

generateIcons();
