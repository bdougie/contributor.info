#!/usr/bin/env node

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration for screenshots to capture
const SCREENSHOTS = [
  // Homepage
  {
    url: 'https://contributor.info',
    filename: 'homepage.png',
    waitFor: 'networkidle',
    viewport: { width: 1280, height: 720 }
  },
  // Popular repository examples
  {
    url: 'https://contributor.info/facebook/react',
    filename: 'repo-react.png',
    waitFor: 'networkidle',
    viewport: { width: 1280, height: 720 }
  },
  {
    url: 'https://contributor.info/microsoft/vscode',
    filename: 'repo-vscode.png',
    waitFor: 'networkidle',
    viewport: { width: 1280, height: 720 }
  },
  {
    url: 'https://contributor.info/vercel/next.js',
    filename: 'repo-nextjs.png',
    waitFor: 'networkidle',
    viewport: { width: 1280, height: 720 }
  },
  // Different tabs/views
  {
    url: 'https://contributor.info/facebook/react/health',
    filename: 'repo-health-view.png',
    waitFor: 'networkidle',
    viewport: { width: 1280, height: 720 }
  },
  {
    url: 'https://contributor.info/facebook/react/distribution',
    filename: 'repo-distribution-view.png',
    waitFor: 'networkidle',
    viewport: { width: 1280, height: 720 }
  },
  // Social cards
  {
    url: 'https://contributor.info/social-cards/home',
    filename: 'social-card-home.png',
    waitFor: 'networkidle',
    viewport: { width: 1200, height: 630 }
  },
  {
    url: 'https://contributor.info/social-cards/facebook/react',
    filename: 'social-card-react.png',
    waitFor: 'networkidle',
    viewport: { width: 1200, height: 630 }
  },
  // Mobile views
  {
    url: 'https://contributor.info',
    filename: 'homepage-mobile.png',
    waitFor: 'networkidle',
    viewport: { width: 375, height: 812 } // iPhone X
  },
  {
    url: 'https://contributor.info/facebook/react',
    filename: 'repo-react-mobile.png',
    waitFor: 'networkidle',
    viewport: { width: 375, height: 812 }
  }
];

async function captureScreenshots() {
  console.log('🎬 Starting screenshot capture...');
  
  // Ensure public directory exists
  const publicDir = path.join(__dirname, '..', 'public');
  await fs.mkdir(publicDir, { recursive: true });
  
  // Launch browser
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    for (const config of SCREENSHOTS) {
      console.log(`📸 Capturing: ${config.url}`);
      
      const page = await browser.newPage();
      
      // Set viewport if specified
      if (config.viewport) {
        await page.setViewportSize(config.viewport);
      }
      
      // Navigate to URL
      await page.goto(config.url, {
        waitUntil: config.waitFor === 'networkidle' ? 'networkidle' : 'load'
      });
      
      // Wait for specific selector if provided
      if (config.waitFor && config.waitFor !== 'networkidle') {
        try {
          await page.waitForSelector(config.waitFor, { timeout: 15000 });
        } catch (err) {
          console.log(`⚠️  Selector '${config.waitFor}' not found, continuing anyway...`);
        }
      }
      
      // Additional wait for dynamic content
      await page.waitForTimeout(2000);
      
      // Take screenshot
      const screenshotPath = path.join(publicDir, config.filename);
      await page.screenshot({
        path: screenshotPath,
        fullPage: config.fullPage || false
      });
      
      console.log(`✅ Saved: ${config.filename}`);
      
      await page.close();
    }
    
    console.log('🎉 All screenshots captured successfully!');
  } catch (error) {
    console.error('❌ Error capturing screenshots:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Run the script
captureScreenshots().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});