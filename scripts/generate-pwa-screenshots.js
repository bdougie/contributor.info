import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Screenshot configurations
const screenshots = [
  { width: 1280, height: 720, name: 'desktop-1280x720.png' },
  { width: 375, height: 667, name: 'mobile-375x667.png' }
];

async function generateScreenshots() {
  const screenshotsDir = path.join(__dirname, '../public/screenshots');
  
  try {
    console.log('Generating PWA screenshots...');
    
    for (const screenshot of screenshots) {
      const outputPath = path.join(screenshotsDir, screenshot.name);
      
      // Generate a placeholder screenshot with the app theme
      await sharp({
        create: {
          width: screenshot.width,
          height: screenshot.height,
          channels: 3,
          background: { r: 255, g: 255, b: 255 }
        }
      })
      .composite([
        {
          input: Buffer.from(`
            <svg width="${screenshot.width}" height="${screenshot.height}" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
                  <stop offset="100%" style="stop-color:#1e40af;stop-opacity:1" />
                </linearGradient>
              </defs>
              <rect width="100%" height="100%" fill="url(#gradient)" opacity="0.1"/>
              <text x="50%" y="40%" text-anchor="middle" font-family="Arial, sans-serif" font-size="48" fill="#3b82f6">🌱</text>
              <text x="50%" y="55%" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#1e40af">Contributor Info</text>
              <text x="50%" y="65%" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#6b7280">Visualize GitHub Contributors</text>
            </svg>
          `),
          top: 0,
          left: 0
        }
      ])
      .png({ quality: 80 })
      .toFile(outputPath);
      
      console.log(`Generated ${screenshot.name}`);
    }
    
    console.log('✅ All PWA screenshots generated successfully!');
    
  } catch (error) {
    console.error('Error generating screenshots:', error);
    process.exit(1);
  }
}

generateScreenshots();