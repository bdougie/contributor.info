import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Icon sizes and configurations
const icons = [
  { size: 192, name: 'icon-192x192.png', purpose: 'any' },
  { size: 512, name: 'icon-512x512.png', purpose: 'any' },
  { size: 192, name: 'icon-192x192-maskable.png', purpose: 'maskable' },
  { size: 512, name: 'icon-512x512-maskable.png', purpose: 'maskable' },
  { size: 96, name: 'search-96x96.png', purpose: 'any' }
];

async function generateIcons() {
  const svgPath = path.join(__dirname, '../public/favicon.svg');
  const iconsDir = path.join(__dirname, '../public/icons');
  
  try {
    // Read the SVG file
    const svgBuffer = await fs.readFile(svgPath);
    
    console.log('Generating PWA icons...');
    
    for (const icon of icons) {
      const outputPath = path.join(iconsDir, icon.name);
      
      if (icon.purpose === 'maskable') {
        // For maskable icons, add padding and background
        await sharp(svgBuffer)
          .resize(icon.size - 40, icon.size - 40) // Resize with padding
          .extend({
            top: 20,
            bottom: 20,
            left: 20,
            right: 20,
            background: { r: 255, g: 255, b: 255, alpha: 1 }
          })
          .png({ quality: 90 })
          .toFile(outputPath);
      } else {
        // For regular icons, just resize
        await sharp(svgBuffer)
          .resize(icon.size, icon.size)
          .png({ quality: 90 })
          .toFile(outputPath);
      }
      
      console.log(`Generated ${icon.name}`);
    }
    
    console.log('✅ All PWA icons generated successfully!');
    
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();