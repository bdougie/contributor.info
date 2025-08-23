#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

// Color codes for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

// Budget thresholds
const BUDGETS = {
  maxInitialKB: 500,
  maxChunkKB: 250,
  maxTotalMB: 2.0,
  maxCssKB: 200,
  maxVendorMB: 0.5
};

// Libraries that should be lazy loaded
const SHOULD_BE_LAZY = ['recharts', 'inngest', 'html2canvas', 'markdown', 'uplot'];

async function analyzeBundles() {
  const distPath = path.join(process.cwd(), 'dist');
  
  // Check if dist folder exists
  if (!fs.existsSync(distPath)) {
    console.error(`${colors.red}✗ No dist folder found. Run "npm run build" first.${colors.reset}`);
    process.exit(1);
  }

  console.log(`\n${colors.bold}📦 Bundle Size Analysis${colors.reset}\n`);

  // Find all JS and CSS files
  const jsFiles = await glob('dist/**/*.js');
  const cssFiles = await glob('dist/**/*.css');
  
  const files = [...jsFiles, ...cssFiles].map(file => {
    const stats = fs.statSync(file);
    const size = stats.size;
    return {
      name: path.basename(file),
      path: file,
      size,
      sizeKB: size / 1024,
      sizeMB: size / (1024 * 1024)
    };
  }).sort((a, b) => b.size - a.size);

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const totalMB = totalSize / (1024 * 1024);
  
  // Display results
  console.log(`Total Size: ${colors.bold}${totalMB.toFixed(2)}MB${colors.reset}`);
  console.log(`Total Files: ${files.length}\n`);
  
  // Top 10 largest files
  console.log(`${colors.bold}Top 10 Largest Files:${colors.reset}`);
  files.slice(0, 10).forEach(file => {
    const bar = '█'.repeat(Math.max(1, Math.floor(file.sizeMB * 20)));
    const color = file.sizeKB > BUDGETS.maxChunkKB ? colors.red : colors.green;
    console.log(`  ${file.name.padEnd(40)} ${color}${bar}${colors.reset} ${file.sizeKB.toFixed(1)}KB`);
  });

  // Check violations
  const violations = [];
  let hasErrors = false;

  // Check initial bundle
  const indexBundle = files.find(f => f.name.includes('index') && !f.name.includes('chunk'));
  if (indexBundle && indexBundle.sizeKB > BUDGETS.maxInitialKB) {
    violations.push({
      type: 'error',
      message: `Initial bundle (${indexBundle.name}) is ${indexBundle.sizeKB.toFixed(1)}KB (budget: ${BUDGETS.maxInitialKB}KB)`
    });
    hasErrors = true;
  }

  // Check total size
  if (totalMB > BUDGETS.maxTotalMB) {
    violations.push({
      type: 'error',
      message: `Total bundle size is ${totalMB.toFixed(2)}MB (budget: ${BUDGETS.maxTotalMB}MB)`
    });
    hasErrors = true;
  }

  // Check vendor bundles
  const vendorBundles = files.filter(f => f.name.includes('vendor'));
  vendorBundles.forEach(vendor => {
    if (vendor.sizeMB > BUDGETS.maxVendorMB) {
      violations.push({
        type: 'warning',
        message: `Vendor bundle ${vendor.name} is ${vendor.sizeMB.toFixed(2)}MB (should be < ${BUDGETS.maxVendorMB}MB)`
      });
    }
  });

  // Check for libraries that should be lazy loaded
  const mainBundles = files.filter(f => 
    f.name.includes('index') || 
    f.name.includes('app') || 
    (f.name.includes('vendor') && !f.name.includes('chunk'))
  );

  for (const bundle of mainBundles) {
    const content = fs.readFileSync(bundle.path, 'utf-8');
    
    SHOULD_BE_LAZY.forEach(lib => {
      if (content.includes(lib)) {
        violations.push({
          type: 'warning',
          message: `${lib} found in main bundle (${bundle.name}) - should be lazy loaded`
        });
      }
    });
  }

  // Check CSS size
  const totalCss = cssFiles.reduce((sum, file) => {
    const stats = fs.statSync(file);
    return sum + stats.size;
  }, 0);
  const totalCssKB = totalCss / 1024;
  
  if (totalCssKB > BUDGETS.maxCssKB) {
    violations.push({
      type: 'warning',
      message: `Total CSS is ${totalCssKB.toFixed(1)}KB (budget: ${BUDGETS.maxCssKB}KB)`
    });
  }

  // Display violations
  if (violations.length > 0) {
    console.log(`\n${colors.bold}Issues Found:${colors.reset}`);
    violations.forEach(v => {
      const icon = v.type === 'error' ? '✗' : '⚠';
      const color = v.type === 'error' ? colors.red : colors.yellow;
      console.log(`  ${color}${icon} ${v.message}${colors.reset}`);
    });
  } else {
    console.log(`\n${colors.green}✓ All bundle size checks passed!${colors.reset}`);
  }

  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    totalSizeMB: totalMB.toFixed(2),
    fileCount: files.length,
    largestFiles: files.slice(0, 5).map(f => ({
      name: f.name,
      sizeKB: f.sizeKB.toFixed(1)
    })),
    violations: violations.map(v => v.message),
    budgets: BUDGETS,
    passed: !hasErrors
  };

  const reportPath = path.join(process.cwd(), 'bundle-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📊 Bundle report saved to: ${reportPath}`);

  // Exit with error if budget exceeded
  if (hasErrors) {
    console.log(`\n${colors.red}${colors.bold}✗ Bundle size budget exceeded!${colors.reset}`);
    process.exit(1);
  }

  console.log(`\n${colors.green}${colors.bold}✓ Bundle size within budget!${colors.reset}`);
}

// Run the analysis
analyzeBundles().catch(error => {
  console.error(`${colors.red}Error analyzing bundles:${colors.reset}`, error);
  process.exit(1);
});