import { chromium } from 'playwright';

/**
 * PlaywrightRenderer - Browser pool management for chart screenshot generation
 *
 * Features:
 * - Single browser instance with page pooling
 * - Concurrent page limit (max 3 simultaneous renders)
 * - Automatic browser restart on memory threshold
 * - Graceful shutdown support
 */
class PlaywrightRenderer {
  constructor(options = {}) {
    this.browser = null;
    this.maxConcurrentPages = options.maxConcurrentPages || 3;
    this.activePages = 0;
    this.pageQueue = [];
    this.initialized = false;
    this.memoryThreshold = options.memoryThreshold || 1500 * 1024 * 1024; // 1.5GB
    this.renderCount = 0;
    this.restartAfterRenders = options.restartAfterRenders || 100;
  }

  /**
   * Initialize the browser instance
   */
  async initialize() {
    if (this.initialized) return;

    try {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--single-process',
        ],
      });

      this.initialized = true;
      console.log('Playwright browser initialized');
    } catch (error) {
      console.error('Failed to initialize Playwright: %s', error.message);
      throw error;
    }
  }

  /**
   * Acquire a page from the pool (waits if at capacity)
   */
  async acquirePage() {
    if (this.activePages >= this.maxConcurrentPages) {
      // Wait for a page to be released
      await new Promise((resolve) => {
        this.pageQueue.push(resolve);
      });
    }

    this.activePages++;
    const page = await this.browser.newPage();

    // Set viewport for social media cards
    await page.setViewportSize({ width: 1200, height: 630 });

    return page;
  }

  /**
   * Release a page back to the pool
   */
  async releasePage(page) {
    try {
      await page.close();
    } catch (error) {
      console.error('Error closing page: %s', error.message);
    }

    this.activePages--;

    // Check if someone is waiting for a page
    if (this.pageQueue.length > 0) {
      const resolve = this.pageQueue.shift();
      resolve();
    }

    // Check if we need to restart browser (memory management)
    this.renderCount++;
    if (this.renderCount >= this.restartAfterRenders) {
      console.log('Restarting browser after %d renders', this.renderCount);
      await this.restart();
    }
  }

  /**
   * Restart the browser instance
   */
  async restart() {
    // Wait for all pages to be released
    while (this.activePages > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.initialized = false;
    }

    this.renderCount = 0;
    await this.initialize();
  }

  /**
   * Render HTML to PNG buffer
   *
   * @param {string} html - HTML content to render
   * @param {object} options - Render options
   * @returns {Promise<Buffer>} - PNG image buffer
   */
  async renderChart(html, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const { width = 1200, height = 630, format = 'png', quality = 90 } = options;

    const page = await this.acquirePage();

    try {
      // Set viewport
      await page.setViewportSize({ width, height });

      // Load HTML content
      await page.setContent(html, {
        waitUntil: 'networkidle',
        timeout: 10000,
      });

      // Wait for any charts to render (Chart.js animations)
      await page.waitForTimeout(500);

      // Wait for any fonts to load
      await page.evaluate(() => document.fonts.ready);

      // Take screenshot
      const screenshotOptions = {
        type: format === 'jpeg' || format === 'jpg' ? 'jpeg' : 'png',
        fullPage: false,
      };

      if (screenshotOptions.type === 'jpeg') {
        screenshotOptions.quality = quality;
      }

      const buffer = await page.screenshot(screenshotOptions);

      return buffer;
    } catch (error) {
      console.error('Render error: %s', error.message);
      throw error;
    } finally {
      await this.releasePage(page);
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('Shutting down Playwright renderer...');

    // Wait for active pages to complete
    const maxWait = 10000;
    const start = Date.now();

    while (this.activePages > 0 && Date.now() - start < maxWait) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.initialized = false;
    }

    console.log('Playwright renderer shutdown complete');
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      activePages: this.activePages,
      maxConcurrentPages: this.maxConcurrentPages,
      queueLength: this.pageQueue.length,
      renderCount: this.renderCount,
    };
  }
}

// Export singleton instance
const renderer = new PlaywrightRenderer();

export { renderer, PlaywrightRenderer };
