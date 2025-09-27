#!/usr/bin/env node

/**
 * Lighthouse Performance Check
 * Runs lighthouse audits to ensure performance hasn't regressed
 */

import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const URL = process.env.LIGHTHOUSE_URL || 'http://localhost:4173'; // Default to preview server
const OUTPUT_PATH = join(__dirname, '..', 'lighthouse-current.json');

// Performance thresholds (based on the existing score of 74)
const PERFORMANCE_THRESHOLDS = {
  performance: 70, // Allow 4 point regression from 74
  'first-contentful-paint': 4000, // 4 seconds max
  'largest-contentful-paint': 4000, // 4 seconds max
  'cumulative-layout-shift': 0.1,
  'total-blocking-time': 600, // 600ms max
};

async function runLighthouse() {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox'],
  });

  const options = {
    logLevel: 'info',
    output: 'json',
    onlyCategories: ['performance'],
    port: chrome.port,
    throttling: {
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0,
      cpuSlowdownMultiplier: 1,
    },
  };

  try {
    console.log(`🔍 Running Lighthouse on ${URL}...`);
    const runnerResult = await lighthouse(URL, options);

    if (!runnerResult) {
      throw new Error('Lighthouse runner returned no results');
    }

    // Save results
    fs.writeFileSync(OUTPUT_PATH, runnerResult.report);
    console.log(`💾 Results saved to ${OUTPUT_PATH}`);

    // Parse and analyze results
    const results = JSON.parse(runnerResult.report);
    return analyzeResults(results);
  } finally {
    await chrome.kill();
  }
}

function analyzeResults(results) {
  const { categories, audits } = results;
  const performance = categories.performance;

  console.log('\n📊 Performance Results:');
  console.log('=' + '='.repeat(50));

  // Overall score
  const score = Math.round(performance.score * 100);
  const scoreStatus = score >= PERFORMANCE_THRESHOLDS.performance ? '✅' : '❌';
  console.log(
    `${scoreStatus} Performance Score: ${score}/100 (threshold: ${PERFORMANCE_THRESHOLDS.performance})`
  );

  // Key metrics
  const metrics = [
    {
      name: 'First Contentful Paint',
      audit: 'first-contentful-paint',
      threshold: PERFORMANCE_THRESHOLDS['first-contentful-paint'],
      unit: 'ms',
    },
    {
      name: 'Largest Contentful Paint',
      audit: 'largest-contentful-paint',
      threshold: PERFORMANCE_THRESHOLDS['largest-contentful-paint'],
      unit: 'ms',
    },
    {
      name: 'Cumulative Layout Shift',
      audit: 'cumulative-layout-shift',
      threshold: PERFORMANCE_THRESHOLDS['cumulative-layout-shift'],
      unit: '',
    },
    {
      name: 'Total Blocking Time',
      audit: 'total-blocking-time',
      threshold: PERFORMANCE_THRESHOLDS['total-blocking-time'],
      unit: 'ms',
    },
  ];

  const failures = [];

  metrics.forEach((metric) => {
    const audit = audits[metric.audit];
    if (!audit) return;

    const value = audit.numericValue || 0;
    const passed = value <= metric.threshold;
    const status = passed ? '✅' : '❌';

    console.log(
      `${status} ${metric.name}: ${Math.round(value)}${metric.unit} (threshold: ${metric.threshold}${metric.unit})`
    );

    if (!passed) {
      failures.push({
        metric: metric.name,
        value: Math.round(value),
        threshold: metric.threshold,
        unit: metric.unit,
      });
    }
  });

  // Analysis
  console.log('\n🔍 Analysis:');
  console.log('-'.repeat(50));

  if (failures.length === 0) {
    console.log('✅ All performance metrics are within acceptable thresholds');
    console.log('✅ No performance regression detected');
  } else {
    console.log('❌ Performance regressions detected:');
    failures.forEach((failure) => {
      const regression = failure.value - failure.threshold;
      console.log(
        `   • ${failure.metric}: ${failure.value}${failure.unit} (${regression > 0 ? '+' : ''}${regression}${failure.unit} over threshold)`
      );
    });
  }

  // Recommendations
  if (score < 90) {
    console.log('\n💡 Performance Recommendations:');
    console.log('-'.repeat(50));

    if (audits['unused-javascript']?.score < 1) {
      console.log('• Consider removing unused JavaScript');
    }
    if (audits['render-blocking-resources']?.score < 1) {
      console.log('• Eliminate render-blocking resources');
    }
    if (audits['largest-contentful-paint']?.numericValue > 2500) {
      console.log('• Optimize Largest Contentful Paint');
    }
    if (audits['cumulative-layout-shift']?.numericValue > 0.1) {
      console.log('• Reduce Cumulative Layout Shift');
    }
  }

  return {
    score,
    passed: failures.length === 0 && score >= PERFORMANCE_THRESHOLDS.performance,
    failures,
    metrics: metrics.map((m) => ({
      name: m.name,
      value: Math.round(audits[m.audit]?.numericValue || 0),
      threshold: m.threshold,
    })),
  };
}

// Helper function to compare with baseline
function compareWithBaseline(current) {
  const baselinePath = join(__dirname, '..', 'lighthouse-final.json');

  if (!fs.existsSync(baselinePath)) {
    console.log('\n⚠️  No baseline report found for comparison');
    return;
  }

  try {
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    const baselineScore = Math.round(baseline.categories.performance.score * 100);
    const currentScore = current.score;

    console.log('\n📊 Comparison with Baseline:');
    console.log('-'.repeat(50));
    console.log(`Baseline Score: ${baselineScore}/100`);
    console.log(`Current Score:  ${currentScore}/100`);

    const difference = currentScore - baselineScore;
    if (difference >= 0) {
      console.log(`✅ Performance improved by ${difference} points`);
    } else {
      console.log(`❌ Performance regressed by ${Math.abs(difference)} points`);
    }
  } catch (error) {
    console.log('⚠️  Could not compare with baseline:', error.message);
  }
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting Lighthouse Performance Check...\n');

    const results = await runLighthouse();
    compareWithBaseline(results);

    console.log('\n' + '='.repeat(60));

    if (results.passed) {
      console.log('✅ Performance check passed!');
      process.exit(0);
    } else {
      console.log('❌ Performance check failed!');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Lighthouse check failed:', error.message);
    process.exit(1);
  }
}

// Run only if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { runLighthouse, analyzeResults };
