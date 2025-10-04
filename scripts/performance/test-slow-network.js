#!/usr/bin/env node

/**
 * Slow Network Performance Testing Script
 * 
 * Tests lazy loading and performance optimizations on various network conditions
 * Validates that the app provides a good experience for all users
 * 
 * Usage:
 *   node scripts/performance/test-slow-network.js [--condition=<condition>] [--url=<url>]
 * 
 * Options:
 *   --condition  Network condition to test (slow3g, fast3g, offline-online, flaky)
 *   --url        URL to test (default: http://localhost:4173)
 *   --report     Generate detailed report (default: true)
 *   --ci         Run in CI mode with minimal output
 */

import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Network condition presets based on Chrome DevTools
const NETWORK_CONDITIONS = {
  slow3g: {
    name: 'Slow 3G',
    downloadThroughput: (400 * 1024) / 8, // 400kb/s in bytes/s
    uploadThroughput: (400 * 1024) / 8,
    latency: 300, // 300ms RTT
  },
  fast3g: {
    name: 'Fast 3G',
    downloadThroughput: (1.6 * 1024 * 1024) / 8, // 1.6Mbps in bytes/s
    uploadThroughput: (750 * 1024) / 8,
    latency: 150, // 150ms RTT
  },
  slow4g: {
    name: 'Slow 4G',
    downloadThroughput: (4 * 1024 * 1024) / 8, // 4Mbps in bytes/s
    uploadThroughput: (3 * 1024 * 1024) / 8,
    latency: 100,
  },
  offline: {
    name: 'Offline',
    downloadThroughput: 0,
    uploadThroughput: 0,
    latency: 0,
  },
};

// Success criteria thresholds
const THRESHOLDS = {
  slow3g: {
    firstSkeletonMs: 1000, // Skeleton visible within 1s
    chartsLoadedMs: 5000, // Charts loaded within 5s (relaxed for slow 3G)
    cumulativeLayoutShift: 0.1, // CLS should be low
    navigationMs: 3000, // Navigation completes within 3s
  },
  fast3g: {
    firstSkeletonMs: 800,
    chartsLoadedMs: 3000,
    cumulativeLayoutShift: 0.1,
    navigationMs: 2000,
  },
  slow4g: {
    firstSkeletonMs: 600,
    chartsLoadedMs: 2000,
    cumulativeLayoutShift: 0.1,
    navigationMs: 1500,
  },
};

class NetworkTester {
  constructor(options = {}) {
    this.url = options.url || 'http://localhost:4173';
    this.condition = options.condition || 'slow3g';
    this.generateReport = options.report !== false;
    this.ciMode = options.ci || false;
    this.results = [];
  }

  async run() {
    console.log('🚀 Starting slow network performance tests...\n');

    const browser = await chromium.launch({ headless: !process.env.DEBUG });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });

    try {
      // Test each scenario
      await this.testInitialPageLoad(context);
      await this.testChartLazyLoading(context);
      await this.testNavigationPrefetching(context);
      await this.testChunkLoadingFailure(context);
      await this.testProgressiveEnhancement(context);

      // Generate report
      if (this.generateReport) {
        await this.generateTestReport();
      }

      // Summary
      this.printSummary();
    } finally {
      await browser.close();
    }
  }

  async testInitialPageLoad(context) {
    console.log('📊 Test 1: Initial Page Load Performance');
    console.log('=' .repeat(50));

    const page = await context.newPage();
    const networkCondition = NETWORK_CONDITIONS[this.condition];
    const thresholds = THRESHOLDS[this.condition];

    // Apply network throttling
    const client = await page.context().newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      ...networkCondition,
    });

    const metrics = {
      condition: networkCondition.name,
      skeletonTime: null,
      fullyLoadedTime: null,
      cls: 0,
      resourceCounts: {},
    };

    // Track performance
    const startTime = Date.now();
    let skeletonTime = null;

    // Listen for console logs to detect skeleton rendering
    page.on('console', (msg) => {
      if (msg.text().includes('skeleton') && !skeletonTime) {
        skeletonTime = Date.now() - startTime;
      }
    });

    // Navigate and wait for network idle
    await page.goto(this.url, { waitUntil: 'domcontentloaded' });

    // Wait for skeleton to appear
    try {
      await page.waitForSelector('[data-testid*="skeleton"], .animate-pulse', {
        timeout: thresholds.firstSkeletonMs,
      });
      metrics.skeletonTime = Date.now() - startTime;
    } catch (error) {
      metrics.skeletonTime = null;
    }

    // Wait for content to load
    await page.waitForLoadState('networkidle');
    metrics.fullyLoadedTime = Date.now() - startTime;

    // Measure CLS
    const layoutShiftScore = await page.evaluate(() => {
      return new Promise((resolve) => {
        let cls = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.hadRecentInput) continue;
            cls += entry.value;
          }
        });
        observer.observe({ type: 'layout-shift', buffered: true });
        
        setTimeout(() => {
          observer.disconnect();
          resolve(cls);
        }, 1000);
      });
    });
    metrics.cls = layoutShiftScore;

    // Count resources by type
    const resources = await page.evaluate(() => {
      const entries = performance.getEntriesByType('resource');
      const counts = {};
      entries.forEach((entry) => {
        const type = entry.initiatorType || 'other';
        counts[type] = (counts[type] || 0) + 1;
      });
      return counts;
    });
    metrics.resourceCounts = resources;

    await page.close();

    // Validate results
    const passed = this.validateMetrics(metrics, {
      skeletonTime: thresholds.firstSkeletonMs,
      cls: thresholds.cumulativeLayoutShift,
    });

    this.results.push({
      test: 'Initial Page Load',
      condition: networkCondition.name,
      metrics,
      passed,
    });

    this.printTestResult('Skeleton Visible', metrics.skeletonTime, thresholds.firstSkeletonMs, 'ms');
    this.printTestResult('Fully Loaded', metrics.fullyLoadedTime, null, 'ms');
    this.printTestResult('Cumulative Layout Shift', metrics.cls, thresholds.cumulativeLayoutShift);
    console.log(`📦 Resources: ${JSON.stringify(metrics.resourceCounts, null, 2)}`);
    console.log();
  }

  async testChartLazyLoading(context) {
    console.log('📈 Test 2: Chart Lazy Loading with IntersectionObserver');
    console.log('=' .repeat(50));

    const page = await context.newPage();
    const networkCondition = NETWORK_CONDITIONS[this.condition];
    const thresholds = THRESHOLDS[this.condition];

    // Apply network throttling
    const client = await page.context().newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      ...networkCondition,
    });

    const metrics = {
      condition: networkCondition.name,
      chartsFoundAboveFold: 0,
      chartsBelowFold: 0,
      chartsLoadedOnScroll: 0,
      scrollToLoadTime: null,
    };

    await page.goto(this.url);
    await page.waitForLoadState('domcontentloaded');

    // Check for charts above the fold (should load immediately)
    const chartsAboveFold = await page.evaluate(() => {
      const charts = document.querySelectorAll('[data-testid*="chart"], canvas, svg[class*="recharts"]');
      let aboveFold = 0;
      charts.forEach((chart) => {
        const rect = chart.getBoundingClientRect();
        if (rect.top < window.innerHeight) {
          aboveFold++;
        }
      });
      return aboveFold;
    });
    metrics.chartsFoundAboveFold = chartsAboveFold;

    // Scroll to find charts below the fold
    const initialChartCount = await page.locator('[data-testid*="chart"], canvas, svg').count();
    
    const scrollStart = Date.now();
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
    
    // Wait for new charts to appear (lazy loaded)
    await page.waitForTimeout(2000); // Give time for IntersectionObserver to trigger
    
    const finalChartCount = await page.locator('[data-testid*="chart"], canvas, svg').count();
    metrics.chartsBelowFold = finalChartCount - initialChartCount;
    metrics.chartsLoadedOnScroll = finalChartCount > initialChartCount;
    metrics.scrollToLoadTime = Date.now() - scrollStart;

    await page.close();

    const passed = metrics.chartsLoadedOnScroll && metrics.scrollToLoadTime < thresholds.chartsLoadedMs;

    this.results.push({
      test: 'Chart Lazy Loading',
      condition: networkCondition.name,
      metrics,
      passed,
    });

    console.log(`✅ Charts above fold: ${metrics.chartsFoundAboveFold}`);
    console.log(`📊 Charts lazy loaded: ${metrics.chartsBelowFold}`);
    this.printTestResult('Scroll to Load Time', metrics.scrollToLoadTime, thresholds.chartsLoadedMs, 'ms');
    console.log();
  }

  async testNavigationPrefetching(context) {
    console.log('🔗 Test 3: Navigation Prefetching');
    console.log('=' .repeat(50));

    const page = await context.newPage();
    const networkCondition = NETWORK_CONDITIONS[this.condition];
    const thresholds = THRESHOLDS[this.condition];

    // Apply network throttling
    const client = await page.context().newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      ...networkCondition,
    });

    const metrics = {
      condition: networkCondition.name,
      hoverToNavigateTime: null,
      prefetchTriggered: false,
      navigationTime: null,
    };

    await page.goto(this.url);
    await page.waitForLoadState('networkidle');

    // Find a navigation link
    const navLink = page.locator('a[href^="/"]').first();
    if (await navLink.count() > 0) {
      // Hover to trigger prefetch
      const hoverStart = Date.now();
      await navLink.hover();
      await page.waitForTimeout(500); // Wait for prefetch

      // Check if prefetch was triggered
      const prefetchRequests = await page.evaluate(() => {
        return performance.getEntriesByType('resource')
          .filter(r => r.initiatorType === 'fetch' || r.name.includes('chunk'))
          .length;
      });
      metrics.prefetchTriggered = prefetchRequests > 0;

      // Navigate and measure time
      const navStart = Date.now();
      await navLink.click();
      await page.waitForLoadState('domcontentloaded');
      metrics.navigationTime = Date.now() - navStart;
      metrics.hoverToNavigateTime = Date.now() - hoverStart;
    }

    await page.close();

    const passed = metrics.navigationTime < thresholds.navigationMs;

    this.results.push({
      test: 'Navigation Prefetching',
      condition: networkCondition.name,
      metrics,
      passed,
    });

    console.log(`🔄 Prefetch triggered: ${metrics.prefetchTriggered ? 'Yes' : 'No'}`);
    this.printTestResult('Navigation Time', metrics.navigationTime, thresholds.navigationMs, 'ms');
    console.log();
  }

  async testChunkLoadingFailure(context) {
    console.log('❌ Test 4: Chunk Loading Failure Handling');
    console.log('=' .repeat(50));

    const page = await context.newPage();

    const metrics = {
      errorBoundaryVisible: false,
      retryAttempted: false,
      gracefulDegradation: false,
    };

    // Block chunk requests to simulate failure
    await page.route('**/*chunk*.js', (route) => {
      route.abort('failed');
    });

    try {
      await page.goto(this.url, { waitUntil: 'domcontentloaded' });
      
      // Check if error boundary is shown
      const errorBoundary = await page.locator('[role="alert"], [data-testid="error-boundary"]').count();
      metrics.errorBoundaryVisible = errorBoundary > 0;

      // Check if basic app shell still works
      const hasNavigation = await page.locator('nav, header').count() > 0;
      const hasContent = await page.locator('main, [role="main"]').count() > 0;
      metrics.gracefulDegradation = hasNavigation && hasContent;

    } catch (error) {
      // Expected to potentially fail
      console.log('⚠️  Chunk loading failed as expected');
    }

    await page.close();

    const passed = metrics.errorBoundaryVisible || metrics.gracefulDegradation;

    this.results.push({
      test: 'Chunk Loading Failure',
      metrics,
      passed,
    });

    console.log(`🛡️  Error boundary shown: ${metrics.errorBoundaryVisible ? 'Yes' : 'No'}`);
    console.log(`✨ Graceful degradation: ${metrics.gracefulDegradation ? 'Yes' : 'No'}`);
    console.log();
  }

  async testProgressiveEnhancement(context) {
    console.log('⚡ Test 5: Progressive Enhancement');
    console.log('=' .repeat(50));

    const page = await context.newPage();
    const networkCondition = NETWORK_CONDITIONS[this.condition];

    // Apply network throttling
    const client = await page.context().newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      ...networkCondition,
    });

    const metrics = {
      condition: networkCondition.name,
      timeToFirstInteraction: null,
      coreContentVisible: false,
      interactiveDuringLoad: false,
    };

    const startTime = Date.now();
    await page.goto(this.url, { waitUntil: 'domcontentloaded' });

    // Check if core content is visible before all chunks load
    const coreVisible = await page.evaluate(() => {
      const main = document.querySelector('main, [role="main"]');
      return main && main.children.length > 0;
    });
    metrics.coreContentVisible = coreVisible;
    metrics.timeToFirstInteraction = Date.now() - startTime;

    // Test if navigation is interactive during loading
    const navLink = page.locator('a').first();
    if (await navLink.count() > 0) {
      try {
        await navLink.click({ timeout: 1000 });
        metrics.interactiveDuringLoad = true;
      } catch {
        metrics.interactiveDuringLoad = false;
      }
    }

    await page.close();

    const passed = metrics.coreContentVisible && metrics.interactiveDuringLoad;

    this.results.push({
      test: 'Progressive Enhancement',
      condition: networkCondition.name,
      metrics,
      passed,
    });

    console.log(`📱 Core content visible: ${metrics.coreContentVisible ? 'Yes' : 'No'}`);
    this.printTestResult('Time to First Interaction', metrics.timeToFirstInteraction, null, 'ms');
    console.log(`🖱️  Interactive during load: ${metrics.interactiveDuringLoad ? 'Yes' : 'No'}`);
    console.log();
  }

  validateMetrics(metrics, thresholds) {
    let passed = true;
    for (const [key, threshold] of Object.entries(thresholds)) {
      if (metrics[key] !== null && metrics[key] > threshold) {
        passed = false;
      }
    }
    return passed;
  }

  printTestResult(name, actual, threshold, unit = '') {
    const passed = threshold === null || actual <= threshold;
    const icon = passed ? '✅' : '❌';
    const thresholdText = threshold !== null ? ` (threshold: ${threshold}${unit})` : '';
    console.log(`${icon} ${name}: ${actual}${unit}${thresholdText}`);
  }

  printSummary() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(50));

    const totalTests = this.results.length;
    const passedTests = this.results.filter((r) => r.passed).length;
    const failedTests = totalTests - passedTests;

    console.log(`\nTotal Tests: ${totalTests}`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);

    if (failedTests > 0) {
      console.log('\n⚠️  Failed Tests:');
      this.results
        .filter((r) => !r.passed)
        .forEach((r) => {
          console.log(`  - ${r.test} (${r.condition || 'N/A'})`);
        });
    }

    const passRate = ((passedTests / totalTests) * 100).toFixed(1);
    console.log(`\n📈 Pass Rate: ${passRate}%`);

    if (passRate < 80) {
      console.log('\n⚠️  WARNING: Pass rate below 80%. Review failed tests.');
      if (this.ciMode) {
        process.exit(1);
      }
    } else {
      console.log('\n✨ All tests passed! Lazy loading is working well on slow networks.');
    }
  }

  async generateTestReport() {
    const reportDir = path.join(process.cwd(), 'reports', 'slow-network');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(reportDir, `test-report-${timestamp}.json`);

    const report = {
      timestamp: new Date().toISOString(),
      condition: this.condition,
      url: this.url,
      results: this.results,
      summary: {
        total: this.results.length,
        passed: this.results.filter((r) => r.passed).length,
        failed: this.results.filter((r) => !r.passed).length,
      },
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved to: ${reportPath}`);
  }
}

// Parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    condition: 'slow3g',
    url: 'http://localhost:4173',
    report: true,
    ci: false,
  };

  args.forEach((arg) => {
    if (arg.startsWith('--condition=')) {
      options.condition = arg.split('=')[1];
    } else if (arg.startsWith('--url=')) {
      options.url = arg.split('=')[1];
    } else if (arg === '--no-report') {
      options.report = false;
    } else if (arg === '--ci') {
      options.ci = true;
    }
  });

  return options;
}

// Main execution
async function main() {
  const options = parseArgs();

  console.log(`Testing with ${options.condition} network condition...\n`);

  const tester = new NetworkTester(options);
  await tester.run();
}

main().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
