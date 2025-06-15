import { spawn } from 'child_process';
import { promisify } from 'util';
import { chromium } from 'playwright';

const sleep = promisify(setTimeout);

// Wait for server to be ready
async function waitForServer(url, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log(`Server ready at ${url}`);
        return true;
      }
    } catch (error) {
      // Server not ready yet
    }
    await sleep(1000);
  }
  throw new Error(`Server not ready after ${maxAttempts} seconds`);
}

async function generateSocialCardsWithPreview() {
  console.log('Starting preview server for social card generation...');
  
  // Start the preview server
  const server = spawn('npm', ['run', 'preview'], {
    stdio: 'pipe',
    cwd: process.cwd()
  });

  // Set up server output logging
  server.stdout.on('data', (data) => {
    console.log(`Preview server: ${data}`);
  });

  server.stderr.on('data', (data) => {
    console.error(`Preview server error: ${data}`);
  });

  try {
    // Wait for the server to be ready
    await waitForServer('http://localhost:4173');
    
    // Test that social card routes work
    console.log('Testing social card routes...');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
      await page.goto('http://localhost:4173/social-cards/home');
      await page.waitForTimeout(2000);
      console.log('Social card routes are working');
    } catch (error) {
      console.error('Social card routes not working:', error.message);
      throw error;
    } finally {
      await browser.close();
    }
    
    // Now run the social card generation script
    console.log('Generating social cards...');
    const { default: generateCards } = await import('./generate-social-cards.js');
    
  } finally {
    // Clean up: kill the preview server
    console.log('Stopping preview server...');
    server.kill('SIGTERM');
    
    // Give it a moment to clean up
    await sleep(1000);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateSocialCardsWithPreview().catch(console.error);
}

export default generateSocialCardsWithPreview;