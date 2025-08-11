#!/usr/bin/env node

/**
 * Generate proper PNG icons from SVG templates for PWA
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create an SVG with emoji on colored background
const createIconSVG = (size, maskable = false) => {
  const padding = maskable ? size * 0.1 : 0; // 10% safe area for maskable
  const fontSize = maskable ? size * 0.45 : size * 0.6;
  
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#3b82f6"/>
  ${maskable ? `<circle cx="${size/2}" cy="${size/2}" r="${size * 0.4}" fill="#4c8bf9"/>` : ''}
  <text x="50%" y="50%" font-size="${fontSize}" text-anchor="middle" dominant-baseline="central" fill="white" font-family="system-ui">🌱</text>
</svg>
`;
};

// Icon configurations
const icons = [
  { size: 192, maskable: false, name: 'icon-192x192.png' },
  { size: 512, maskable: false, name: 'icon-512x512.png' },
  { size: 192, maskable: true, name: 'icon-192x192-maskable.png' },
  { size: 512, maskable: true, name: 'icon-512x512-maskable.png' },
  { size: 96, maskable: false, name: 'search-96x96.png' }
];

// Ensure icons directory exists
const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate each icon
async function generateIcons() {
  for (const { size, maskable, name } of icons) {
    try {
      const svgBuffer = Buffer.from(createIconSVG(size, maskable));
      
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(path.join(iconsDir, name));
      
      console.log(`✅ Generated ${name}`);
    } catch (error) {
      console.error(`❌ Failed to generate ${name}:`, error.message);
    }
  }
  
  console.log('\n✨ PNG icons generated successfully!');
}

generateIcons().catch(console.error);