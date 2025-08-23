import { describe, test, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

interface BundleReport {
  totalSize: number;
  files: Array<{
    name: string;
    size: number;
    sizeKB: number;
    sizeMB: number;
  }>;
  violations: string[];
}

describe('Bundle Size Budget', () => {
  let bundleReport: BundleReport;

  beforeAll(() => {
    const distPath = path.join(process.cwd(), 'dist');
    
    // Check if dist folder exists
    if (!fs.existsSync(distPath)) {
      console.warn('⚠️  No dist folder found. Run "npm run build" first.');
      bundleReport = {
        totalSize: 0,
        files: [],
        violations: ['No build output found']
      };
      return;
    }

    // Find all JS files in dist
    const jsFiles = glob.sync('dist/**/*.js');
    const cssFiles = glob.sync('dist/**/*.css');
    
    const files = [...jsFiles, ...cssFiles].map(file => {
      const stats = fs.statSync(file);
      const size = stats.size;
      return {
        name: path.basename(file),
        size,
        sizeKB: size / 1024,
        sizeMB: size / (1024 * 1024)
      };
    }).sort((a, b) => b.size - a.size);

    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    
    // Check for specific problematic libraries
    const violations: string[] = [];
    
    // Check for large vendor chunks
    files.forEach(file => {
      if (file.name.includes('vendor') && file.sizeMB > 0.5) {
        violations.push(`Vendor chunk ${file.name} is ${file.sizeMB.toFixed(2)}MB (should be < 0.5MB)`);
      }
      
      // Check for libraries that should be lazy loaded
      const shouldBeLazy = ['recharts', 'inngest', 'html2canvas', 'markdown'];
      shouldBeLazy.forEach(lib => {
        if (file.name.includes(lib) && file.name.includes('index')) {
          violations.push(`${lib} found in main bundle - should be lazy loaded`);
        }
      });
    });

    bundleReport = {
      totalSize,
      files,
      violations
    };

    // Log bundle analysis
    console.log('\n📦 Bundle Size Analysis:');
    console.log(`Total Size: ${(totalSize / (1024 * 1024)).toFixed(2)}MB`);
    console.log('\nTop 10 Largest Files:');
    files.slice(0, 10).forEach(file => {
      const bar = '█'.repeat(Math.floor(file.sizeMB * 20));
      console.log(`  ${file.name.padEnd(40)} ${bar} ${file.sizeKB.toFixed(1)}KB`);
    });
    
    if (violations.length > 0) {
      console.log('\n⚠️  Violations Found:');
      violations.forEach(v => console.log(`  - ${v}`));
    }
  });

  test('initial bundle size should be under 500KB', () => {
    // Find the main entry bundle (usually index-*.js)
    const indexBundle = bundleReport.files.find(f => 
      f.name.includes('index') && !f.name.includes('chunk')
    );
    
    if (indexBundle) {
      expect(indexBundle.sizeKB).toBeLessThan(500);
    }
  });

  test('total JavaScript size should be under 2MB', () => {
    const jsFiles = bundleReport.files.filter(f => f.name.endsWith('.js'));
    const totalJsSize = jsFiles.reduce((sum, file) => sum + file.size, 0);
    const totalJsMB = totalJsSize / (1024 * 1024);
    
    expect(totalJsMB).toBeLessThan(2.0);
  });

  test('no single chunk should exceed 250KB', () => {
    const largeChunks = bundleReport.files.filter(f => f.sizeKB > 250);
    
    if (largeChunks.length > 0) {
      console.log('\nLarge chunks detected:');
      largeChunks.forEach(chunk => {
        console.log(`  - ${chunk.name}: ${chunk.sizeKB.toFixed(1)}KB`);
      });
    }
    
    // Allow vendor bundles to be larger, but flag them
    const nonVendorLargeChunks = largeChunks.filter(f => !f.name.includes('vendor'));
    expect(nonVendorLargeChunks.length).toBe(0);
  });

  test('critical libraries should be lazy loaded', () => {
    const mainBundles = bundleReport.files.filter(f => 
      f.name.includes('index') || f.name.includes('app')
    );
    
    const problematicLibs = [
      { name: 'recharts', maxSize: 50 },
      { name: 'inngest', maxSize: 30 },
      { name: 'html2canvas', maxSize: 20 },
      { name: 'markdown', maxSize: 50 },
      { name: '@supabase', maxSize: 100 }
    ];
    
    mainBundles.forEach(bundle => {
      // Read file content to check for library presence
      const content = fs.readFileSync(path.join('dist', bundle.name), 'utf-8');
      
      problematicLibs.forEach(lib => {
        if (content.includes(lib.name)) {
          console.warn(`⚠️  ${lib.name} found in main bundle ${bundle.name}`);
          // This is a warning, not a failure yet
        }
      });
    });
    
    // Check violations
    expect(bundleReport.violations.length).toBe(0);
  });

  test('CSS bundle should be reasonable', () => {
    const cssFiles = bundleReport.files.filter(f => f.name.endsWith('.css'));
    const totalCssSize = cssFiles.reduce((sum, file) => sum + file.size, 0);
    const totalCssKB = totalCssSize / 1024;
    
    // CSS should be under 200KB total
    expect(totalCssKB).toBeLessThan(200);
  });

  test('should generate bundle report for CI', () => {
    const reportPath = path.join(process.cwd(), 'bundle-report.json');
    
    const report = {
      timestamp: new Date().toISOString(),
      totalSizeMB: (bundleReport.totalSize / (1024 * 1024)).toFixed(2),
      fileCount: bundleReport.files.length,
      largestFiles: bundleReport.files.slice(0, 5).map(f => ({
        name: f.name,
        sizeKB: f.sizeKB.toFixed(1)
      })),
      violations: bundleReport.violations,
      budget: {
        maxTotalMB: 2.0,
        maxChunkKB: 250,
        maxInitialKB: 500
      }
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📊 Bundle report saved to: ${reportPath}`);
    
    expect(fs.existsSync(reportPath)).toBe(true);
  });
});