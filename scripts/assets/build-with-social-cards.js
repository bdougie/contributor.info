import { spawn } from 'child_process';
import { promisify } from 'util';
import { chromium } from 'playwright';

const sleep = promisify(setTimeout);

// Install Playwright browsers if needed
async function ensurePlaywrightBrowsers() {
  console.log('Checking Playwright browser installation...');

  try {
    // Try to launch browser to check if it's installed
    const browser = await chromium.launch({ headless: true });
    await browser.close();
    console.log('Playwright browsers already installed');
    return true;
  } catch (error) {
    if (
      error.message.includes("Executable doesn't exist") ||
      error.message.includes('Browser is not installed')
    ) {
      console.log('Installing Playwright browsers...');

      return new Promise((resolve) => {
        const install = spawn('npx', ['playwright', 'install', 'chromium'], {
          stdio: 'inherit',
          cwd: process.cwd(),
        });

        install.on('close', (code) => {
          if (code === 0) {
            console.log('Playwright browsers installed successfully');
            resolve(true);
          } else {
            console.warn(`Playwright install failed with code ${code} - skipping social cards`);
            resolve(false);
          }
        });

        install.on('error', (error) => {
          console.warn(
            `Failed to install Playwright browsers: ${error.message} - skipping social cards`
          );
          resolve(false);
        });
      });
    } else {
      console.warn(`Playwright error: ${error.message} - skipping social cards`);
      return false;
    }
  }
}

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

  // Ensure Playwright browsers are installed
  const browsersReady = await ensurePlaywrightBrowsers();
  if (!browsersReady) {
    console.log('Skipping social card generation due to Playwright installation failure');
    return;
  }

  // Start the preview server
  const server = spawn('npm', ['run', 'preview'], {
    stdio: 'pipe',
    cwd: process.cwd(),
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
