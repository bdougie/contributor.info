// Quick Playwright screenshot script for PR #684
// Captures the Pull Request Contributions card on the demo page in
// enhanced (log scale) and non-enhanced modes.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function run() {
  const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
  const outDir = path.resolve(__dirname, '../../docs/screenshots/issue-684');
  await ensureDir(outDir);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Navigate to demo workspace page where the chart renders with demo data
  await page.goto(`${baseURL}/i/demo`, { waitUntil: 'networkidle' });

  // Wait for the card title to appear
  await page.getByRole('heading', { name: 'Pull Request Contributions' }).waitFor();

  // Locate the card container for consistent cropping
  const card = await page
    .locator('div:has(> header:has-text("Pull Request Contributions"))')
    .first();

  // Enhanced (default = on)
  await card.screenshot({ path: path.join(outDir, 'enhanced.png') });

  // Toggle enhanced off via the switch label ("Enhanced" / "Enhance")
  const label = page.getByLabel(/Enhanced|Enhance/);
  if (await label.isVisible()) {
    await label.click();
    // small delay for re-render
    await page.waitForTimeout(300);
  }

  await card.screenshot({ path: path.join(outDir, 'standard.png') });

  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
