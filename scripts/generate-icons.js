#!/usr/bin/env node

/**
 * Generate PWA icons from emoji favicon
 * Creates PNG icons at various sizes for manifest.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a simple colored background with the emoji
const createIconSVG = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#3b82f6" rx="${size * 0.1}"/>
  <text x="50%" y="50%" font-size="${size * 0.6}" text-anchor="middle" dominant-baseline="central" fill="white">🌱</text>
</svg>
`;

// Create maskable icon with safe area padding
const createMaskableIconSVG = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#3b82f6"/>
  <circle cx="${size/2}" cy="${size/2}" r="${size * 0.4}" fill="white" opacity="0.2"/>
  <text x="50%" y="50%" font-size="${size * 0.45}" text-anchor="middle" dominant-baseline="central" fill="white">🌱</text>
</svg>
`;

// Icon sizes needed
const iconSizes = [
  { size: 192, maskable: false },
  { size: 512, maskable: false },
  { size: 192, maskable: true },
  { size: 512, maskable: true },
  { size: 96, maskable: false, name: 'search' }
];

// Ensure icons directory exists
const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate each icon
iconSizes.forEach(({ size, maskable, name }) => {
  const svgContent = maskable ? createMaskableIconSVG(size) : createIconSVG(size);
  const fileName = name 
    ? `${name}-${size}x${size}.svg`
    : maskable 
      ? `icon-${size}x${size}-maskable.svg`
      : `icon-${size}x${size}.svg`;
  
  const filePath = path.join(iconsDir, fileName);
  fs.writeFileSync(filePath, svgContent);
  console.log(`✅ Generated ${fileName}`);
});

// Create placeholder PNG files (actual conversion would require a library like sharp or puppeteer)
// For now, create an HTML file that explains how to generate the PNGs
const instructions = `
<!DOCTYPE html>
<html>
<head>
  <title>Icon Generator</title>
  <style>
    body { font-family: system-ui; padding: 20px; }
    .icon { margin: 10px; border: 1px solid #ccc; display: inline-block; }
    img { display: block; }
  </style>
</head>
<body>
  <h1>PWA Icon Generator</h1>
  <p>The SVG icons have been generated. To create PNG versions:</p>
  <ol>
    <li>Use an online converter like <a href="https://cloudconvert.com/svg-to-png">CloudConvert</a></li>
    <li>Or use ImageMagick: <code>convert icon-192x192.svg icon-192x192.png</code></li>
    <li>Or use a design tool like Figma to export as PNG</li>
  </ol>
  
  <h2>Generated Icons:</h2>
  ${iconSizes.map(({ size, maskable, name }) => {
    const fileName = name 
      ? `${name}-${size}x${size}.svg`
      : maskable 
        ? `icon-${size}x${size}-maskable.svg`
        : `icon-${size}x${size}.svg`;
    return `
    <div class="icon">
      <img src="${fileName}" width="${size}" height="${size}" alt="${fileName}">
      <p>${fileName}</p>
    </div>`;
  }).join('')}
</body>
</html>
`;

fs.writeFileSync(path.join(iconsDir, 'generate-pngs.html'), instructions);

console.log('\n📝 SVG icons generated successfully!');
console.log('📌 To create PNG versions, open public/icons/generate-pngs.html');
console.log('   or use: npx sharp-cli -i public/icons/*.svg -o public/icons/ -f png');