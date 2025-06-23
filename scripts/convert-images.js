import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function convertToWebP() {
  const inputPath = path.join(__dirname, '../public/social.png');
  const outputPath = path.join(__dirname, '../public/social.webp');
  
  if (!fs.existsSync(inputPath)) {
    console.log('social.png not found, skipping conversion');
    return;
  }
  
  try {
    await sharp(inputPath)
      .webp({ quality: 80 })
      .toFile(outputPath);
    
    console.log('✅ Converted social.png to social.webp');
    
    // Get file sizes for comparison
    const originalSize = fs.statSync(inputPath).size;
    const webpSize = fs.statSync(outputPath).size;
    const savings = ((originalSize - webpSize) / originalSize * 100).toFixed(1);
    
    console.log(`📊 Original: ${(originalSize / 1024).toFixed(1)}KB`);
    console.log(`📊 WebP: ${(webpSize / 1024).toFixed(1)}KB`);
    console.log(`💾 Savings: ${savings}%`);
  } catch (error) {
    console.error('❌ Error converting image:', error);
  }
}

convertToWebP();