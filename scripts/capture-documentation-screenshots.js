#!/usr/bin/env node

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base URL configuration
const BASE_URL = 'http://localhost:5173';

// Configuration for documentation screenshots
const SCREENSHOTS = [
  // ========== FEATURE: Repository Search ==========
  {
    url: `${BASE_URL}`,
    filename: 'features/repository-search/homepage-featured.png',
    description: 'Homepage with featured repositories',
    waitFor: '.repository-card',
    viewport: { width: 1440, height: 900 }
  },
  {
    url: `${BASE_URL}`,
    filename: 'features/repository-search/search-input.png',
    description: 'Search bar with placeholder text',
    waitFor: 'input[placeholder*="Search"]',
    viewport: { width: 1440, height: 900 },
    clip: { x: 0, y: 0, width: 1440, height: 200 }
  },
  {
    url: `${BASE_URL}/facebook/react`,
    filename: 'features/repository-search/multi-tab-navigation.png',
    description: 'Repository tabs navigation',
    waitFor: '[role="tablist"]',
    viewport: { width: 1440, height: 900 },
    clip: { x: 0, y: 100, width: 1440, height: 300 }
  },

  // ========== FEATURE: Contribution Analytics ==========
  {
    url: `${BASE_URL}/facebook/react`,
    filename: 'features/contribution-analytics/quadrant-scatter-plot.png',
    description: 'Contribution quadrant visualization',
    waitFor: '.quadrant-chart',
    viewport: { width: 1440, height: 900 }
  },
  {
    url: `${BASE_URL}/facebook/react`,
    filename: 'features/contribution-analytics/time-range-selector.png',
    description: 'Time range selection controls',
    waitFor: '[data-testid="time-range-selector"]',
    viewport: { width: 1440, height: 900 },
    clip: { x: 1000, y: 150, width: 440, height: 100 }
  },

  // ========== FEATURE: Repository Health ==========
  {
    url: `${BASE_URL}/facebook/react/health`,
    filename: 'features/repository-health/lottery-factor-visualization.png',
    description: 'Lottery factor risk assessment',
    waitFor: '.lottery-factor-chart',
    viewport: { width: 1440, height: 900 }
  },
  {
    url: `${BASE_URL}/facebook/react/health`,
    filename: 'features/repository-health/yolo-coders.png',
    description: 'YOLO coders section',
    waitFor: '.yolo-coders-section',
    viewport: { width: 1440, height: 900 }
  },
  {
    url: `${BASE_URL}/facebook/react/health`,
    filename: 'features/repository-health/health-indicators.png',
    description: 'Color-coded health status indicators',
    waitFor: '.health-metrics',
    viewport: { width: 1440, height: 900 }
  },

  // ========== FEATURE: Distribution Charts ==========
  {
    url: `${BASE_URL}/facebook/react/distribution`,
    filename: 'features/distribution-charts/language-treemap.png',
    description: 'Language distribution treemap',
    waitFor: '.treemap-container',
    viewport: { width: 1440, height: 900 }
  },
  {
    url: `${BASE_URL}/facebook/react/distribution`,
    filename: 'features/distribution-charts/contribution-patterns.png',
    description: 'Contribution pattern analysis',
    waitFor: '.distribution-chart',
    viewport: { width: 1440, height: 900 }
  },

  // ========== FEATURE: Activity Feed ==========
  {
    url: `${BASE_URL}/facebook/react/feed`,
    filename: 'features/activity-feed/pr-timeline.png',
    description: 'Pull request activity timeline',
    waitFor: '.activity-feed',
    viewport: { width: 1440, height: 900 }
  },
  {
    url: `${BASE_URL}/facebook/react/feed`,
    filename: 'features/activity-feed/velocity-indicators.png',
    description: 'Velocity and workflow indicators',
    waitFor: '.velocity-metrics',
    viewport: { width: 1440, height: 900 }
  },

  // ========== FEATURE: Contributor Profiles ==========
  {
    url: `${BASE_URL}/facebook/react`,
    filename: 'features/contributor-profiles/hover-card.png',
    description: 'Contributor hover card example',
    waitFor: '.contributor-avatar',
    viewport: { width: 1440, height: 900 },
    hoverOn: '.contributor-avatar:first-of-type',
    waitAfterHover: 1000
  },
  {
    url: `${BASE_URL}/facebook/react`,
    filename: 'features/contributor-profiles/profile-stats.png',
    description: 'Detailed contributor statistics',
    waitFor: '.contributor-list',
    viewport: { width: 1440, height: 900 }
  },

  // ========== FEATURE: Contributor of the Month ==========
  {
    url: `${BASE_URL}`,
    filename: 'features/contributor-of-month/winner-display.png',
    description: 'Contributor of the month winner',
    waitFor: '.contributor-of-month',
    viewport: { width: 1440, height: 900 }
  },
  {
    url: `${BASE_URL}`,
    filename: 'features/contributor-of-month/leaderboard.png',
    description: 'Monthly contributor leaderboard',
    waitFor: '.leaderboard-section',
    viewport: { width: 1440, height: 900 }
  },

  // ========== FEATURE: Time Range Analysis ==========
  {
    url: `${BASE_URL}/microsoft/vscode?range=30`,
    filename: 'features/time-range-analysis/30-day-view.png',
    description: '30-day analysis view',
    waitFor: '.contributions-chart',
    viewport: { width: 1440, height: 900 }
  },
  {
    url: `${BASE_URL}/microsoft/vscode?range=90`,
    filename: 'features/time-range-analysis/90-day-view.png',
    description: '90-day analysis view',
    waitFor: '.contributions-chart',
    viewport: { width: 1440, height: 900 }
  },

  // ========== FEATURE: Authentication ==========
  {
    url: `${BASE_URL}`,
    filename: 'features/authentication/github-login-button.png',
    description: 'GitHub OAuth login button',
    waitFor: '[data-testid="login-button"]',
    viewport: { width: 1440, height: 900 },
    clip: { x: 1200, y: 20, width: 240, height: 60 }
  },

  // ========== FEATURE: Social Cards ==========
  {
    url: `${BASE_URL}/social-cards/home`,
    filename: 'features/social-cards/home-card.png',
    description: 'Homepage social card',
    waitFor: '.social-card',
    viewport: { width: 1200, height: 630 }
  },
  {
    url: `${BASE_URL}/social-cards/facebook/react`,
    filename: 'features/social-cards/repository-card.png',
    description: 'Repository-specific social card',
    waitFor: '.social-card',
    viewport: { width: 1200, height: 630 }
  },

  // ========== INSIGHTS: Needs Attention ==========
  {
    url: `${BASE_URL}/facebook/react`,
    filename: 'insights/needs-attention/scoring-display.png',
    description: 'Needs attention scoring visualization',
    waitFor: '.needs-attention-card',
    viewport: { width: 1440, height: 900 }
  },

  // ========== INSIGHTS: PR Activity ==========
  {
    url: `${BASE_URL}/facebook/react`,
    filename: 'insights/pr-activity/metrics-dashboard.png',
    description: 'PR activity metrics dashboard',
    waitFor: '.pr-activity-metrics',
    viewport: { width: 1440, height: 900 }
  },
  {
    url: `${BASE_URL}/facebook/react`,
    filename: 'insights/pr-activity/weekly-velocity.png',
    description: 'Weekly velocity comparison',
    waitFor: '.velocity-chart',
    viewport: { width: 1440, height: 900 }
  },

  // ========== INSIGHTS: Recommendations ==========
  {
    url: `${BASE_URL}/facebook/react`,
    filename: 'insights/recommendations/ai-suggestions.png',
    description: 'AI-powered recommendations panel',
    waitFor: '.recommendations-panel',
    viewport: { width: 1440, height: 900 }
  },

  // ========== INSIGHTS: Repository Health Summary ==========
  {
    url: `${BASE_URL}/facebook/react/health`,
    filename: 'insights/repository-health/summary-dashboard.png',
    description: 'Repository health summary dashboard',
    waitFor: '.health-summary',
    viewport: { width: 1440, height: 900 }
  },

  // ========== GUIDE: Contributor Confidence ==========
  {
    url: `${BASE_URL}/facebook/react`,
    filename: 'guides/contributor-confidence/confidence-indicators.png',
    description: 'Contributor confidence level indicators',
    waitFor: '.confidence-indicator',
    viewport: { width: 1440, height: 900 }
  },

  // ========== Mobile Views ==========
  {
    url: `${BASE_URL}`,
    filename: 'mobile/homepage-mobile.png',
    description: 'Mobile homepage view',
    waitFor: '.repository-card',
    viewport: { width: 375, height: 812 }
  },
  {
    url: `${BASE_URL}/facebook/react`,
    filename: 'mobile/repository-mobile.png',
    description: 'Mobile repository view',
    waitFor: '.contributions-chart',
    viewport: { width: 375, height: 812 }
  }
];

async function ensureDirectoryExists(filePath) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

async function captureScreenshots() {
  console.log('🎬 Starting documentation screenshot capture...');
  
  // Base directory for documentation images
  const docsImagesDir = path.join(__dirname, '..', 'public', 'docs', 'images');
  
  // Launch browser
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    let successCount = 0;
    let failureCount = 0;
    
    for (const config of SCREENSHOTS) {
      console.log(`\n📸 Capturing: ${config.description}`);
      console.log(`   URL: ${config.url}`);
      
      const page = await browser.newPage();
      
      try {
        // Set viewport
        await page.setViewportSize(config.viewport);
        
        // Navigate to URL
        await page.goto(config.url, {
          waitUntil: 'networkidle',
          timeout: 30000
        });
        
        // Wait for specific selector
        if (config.waitFor && typeof config.waitFor === 'string') {
          try {
            await page.waitForSelector(config.waitFor, { timeout: 5000 });
          } catch (err) {
            console.log(`   ⚠️  Selector '${config.waitFor}' not found, continuing...`);
          }
        }
        
        // Handle hover interactions
        if (config.hoverOn) {
          await page.hover(config.hoverOn);
          await page.waitForTimeout(config.waitAfterHover || 500);
        }
        
        // Additional wait for dynamic content
        await page.waitForTimeout(2000);
        
        // Take screenshot
        const screenshotPath = path.join(docsImagesDir, config.filename);
        await ensureDirectoryExists(screenshotPath);
        
        const screenshotOptions = {
          path: screenshotPath,
          fullPage: config.fullPage || false
        };
        
        // Add clipping if specified
        if (config.clip) {
          screenshotOptions.clip = config.clip;
        }
        
        await page.screenshot(screenshotOptions);
        
        console.log(`   ✅ Saved: ${config.filename}`);
        successCount++;
        
      } catch (error) {
        console.error(`   ❌ Failed: ${error.message}`);
        failureCount++;
      } finally {
        await page.close();
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`   ✅ Success: ${successCount} screenshots`);
    console.log(`   ❌ Failed: ${failureCount} screenshots`);
    console.log(`   📁 Saved to: ${docsImagesDir}`);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
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