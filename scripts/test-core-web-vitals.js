#!/usr/bin/env node

/**
 * Test Core Web Vitals improvements
 * Runs Lighthouse CI to measure LCP, CLS, and INP metrics
 */

import { execSync } from "child_process";
import chalk from "chalk";

console.log(chalk.blue("🚀 Testing Core Web Vitals improvements...\n"));

// URLs to test
const urls = [
  "http://localhost:5173/", // Home page
  "http://localhost:5173/vercel/next.js", // Repository view
];

// Ensure dev server is running
console.log(chalk.yellow("⚠️  Make sure the dev server is running (npm run dev)\n"));

// Test each URL
urls.forEach((url) => {
  console.log(chalk.cyan(`\n📊 Testing: ${url}`));
  
  try {
    // Run Lighthouse
    const result = execSync(
      `npx lighthouse ${url} --only-categories=performance --chrome-flags="--headless" --output=json --quiet`,
      { encoding: "utf8" }
    );
    
    const data = JSON.parse(result);
    const metrics = data.audits.metrics.details.items[0];
    
    // Extract Core Web Vitals
    const lcp = metrics.largestContentfulPaint;
    const cls = metrics.cumulativeLayoutShift;
    const fcp = metrics.firstContentfulPaint;
    const tti = metrics.interactive;
    
    console.log("\nCore Web Vitals:");
    console.log(`  LCP: ${chalk.green((lcp / 1000).toFixed(2))}s ${lcp < 2500 ? "✅" : "⚠️"}`);
    console.log(`  CLS: ${chalk.green(cls.toFixed(3))} ${cls < 0.1 ? "✅" : "⚠️"}`);
    console.log(`  FCP: ${chalk.green((fcp / 1000).toFixed(2))}s ${fcp < 1800 ? "✅" : "⚠️"}`);
    console.log(`  TTI: ${chalk.green((tti / 1000).toFixed(2))}s`);
    
    // Performance score
    const score = data.categories.performance.score * 100;
    console.log(`\n  Performance Score: ${score >= 90 ? chalk.green(score) : chalk.yellow(score)}/100`);
    
  } catch (error) {
    console.error(chalk.red(`Failed to test ${url}:`), error.message);
  }
});

console.log(chalk.blue("\n✨ Core Web Vitals testing complete!"));
console.log(chalk.gray("\nNote: For production testing, deploy and test the built version."));