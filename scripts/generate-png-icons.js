#!/usr/bin/env node

/**
 * Generate simple PNG placeholders for PWA icons
 * These are basic colored squares that will prevent manifest errors
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a minimal PNG (1x1 pixel, scaled by browsers)
// This is the smallest valid PNG file
const createMinimalPNG = () => {
  // PNG magic number + IHDR chunk for 1x1 pixel image
  const png = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, // IHDR length
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x01, // width: 1
    0x00, 0x00, 0x00, 0x01, // height: 1
    0x08, 0x02, // bit depth: 8, color type: 2 (RGB)
    0x00, 0x00, 0x00, // compression, filter, interlace
    0x90, 0x77, 0x53, 0xDE, // CRC
    0x00, 0x00, 0x00, 0x0C, // IDAT length
    0x49, 0x44, 0x41, 0x54, // IDAT
    0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0xFE, 0xFF, // compressed data
    0x00, 0x3B, 0x82, 0xF6, // blue pixel + checksum
    0x36, 0xBF, 0x8A, 0xAD, // CRC
    0x00, 0x00, 0x00, 0x00, // IEND length
    0x49, 0x45, 0x4E, 0x44, // IEND
    0xAE, 0x42, 0x60, 0x82  // CRC
  ]);
  return png;
};

// Icon configurations
const icons = [
  'icon-192x192.png',
  'icon-512x512.png',
  'icon-192x192-maskable.png',
  'icon-512x512-maskable.png',
  'search-96x96.png'
];

// Ensure icons directory exists
const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate minimal PNG for each icon
const pngData = createMinimalPNG();
icons.forEach(fileName => {
  const filePath = path.join(iconsDir, fileName);
  fs.writeFileSync(filePath, pngData);
  console.log(`✅ Generated ${fileName}`);
});

// Also remove the placeholder.txt if it exists
const placeholderPath = path.join(iconsDir, 'placeholder.txt');
if (fs.existsSync(placeholderPath)) {
  fs.unlinkSync(placeholderPath);
  console.log('🗑️  Removed placeholder.txt');
}

console.log('\n✨ PNG icons generated successfully!');
console.log('📝 These are minimal placeholder PNGs that prevent manifest errors.');
console.log('💡 For production, replace with properly designed icons.');