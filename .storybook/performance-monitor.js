/**
 * Storybook Performance Monitoring
 * 
 * This script monitors Storybook build performance and provides
 * optimization recommendations for better development experience.
 */

import fs from 'fs';
import path from 'path';

class StorybookPerformanceMonitor {
  constructor() {
    this.startTime = Date.now();
    this.metrics = {
      buildStart: this.startTime,
      storyCount: 0,
      componentCount: 0,
      bundleSize: 0,
      buildTime: 0,
      errors: [],
      warnings: [],
    };
  }

  /**
   * Analyze story files and gather metrics
   */
  analyzeStories() {
    const storyPattern = /\.stories\.(ts|tsx|js|jsx)$/;
    const componentPattern = /\.(ts|tsx)$/;
    
    const srcDir = path.join(process.cwd(), 'src');
    
    const analyzeDirectory = (dir) => {
      const files = fs.readdirSync(dir);
      
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          analyzeDirectory(filePath);
        } else {
          if (storyPattern.test(file)) {
            this.metrics.storyCount++;
            this.analyzeStoryFile(filePath);
          } else if (componentPattern.test(file) && !file.includes('.test.') && !file.includes('.stories.')) {
            this.metrics.componentCount++;
          }
        }
      });
    };
    
    try {
      analyzeDirectory(srcDir);
    } catch (error) {
      this.metrics.errors.push(`Failed to analyze stories: ${error.message}`);
    }
  }

  /**
   * Analyze individual story file for performance issues
   */
  analyzeStoryFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Check for performance anti-patterns
      if (content.includes('import React from')) {
        this.metrics.warnings.push(
          `${path.relative(process.cwd(), filePath)}: Unnecessary React import (use JSX Transform)`
        );
      }
      
      // Check for large inline data
      const lines = content.split('\n');
      const longLines = lines.filter(line => line.length > 200);
      if (longLines.length > 5) {
        this.metrics.warnings.push(
          `${path.relative(process.cwd(), filePath)}: Consider extracting large mock data to separate files`
        );
      }
      
      // Check for missing performance optimizations
      if (!content.includes('loading')) {
        this.metrics.warnings.push(
          `${path.relative(process.cwd(), filePath)}: Consider adding loading states for better UX`
        );
      }
      
    } catch (error) {
      this.metrics.errors.push(`Failed to analyze ${filePath}: ${error.message}`);
    }
  }

  /**
   * Check bundle size and build performance
   */
  analyzeBuildPerformance() {
    const storybookStaticDir = path.join(process.cwd(), 'storybook-static');
    
    if (fs.existsSync(storybookStaticDir)) {
      try {
        const calculateDirSize = (dir) => {
          let size = 0;
          const files = fs.readdirSync(dir);
          
          files.forEach(file => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            
            if (stat.isDirectory()) {
              size += calculateDirSize(filePath);
            } else {
              size += stat.size;
            }
          });
          
          return size;
        };
        
        this.metrics.bundleSize = calculateDirSize(storybookStaticDir);
        
        // Bundle size warnings
        const bundleSizeMB = this.metrics.bundleSize / (1024 * 1024);
        if (bundleSizeMB > 50) {
          this.metrics.warnings.push(
            `Large bundle size: ${bundleSizeMB.toFixed(2)}MB. Consider code splitting or lazy loading.`
          );
        }
        
      } catch (error) {
        this.metrics.errors.push(`Failed to analyze bundle size: ${error.message}`);
      }
    }
  }

  /**
   * Generate performance report
   */
  generateReport() {
    this.metrics.buildTime = Date.now() - this.metrics.buildStart;
    
    const report = {
      timestamp: new Date().toISOString(),
      buildTime: `${(this.metrics.buildTime / 1000).toFixed(2)}s`,
      storyCount: this.metrics.storyCount,
      componentCount: this.metrics.componentCount,
      storyCoverage: this.metrics.componentCount > 0 
        ? `${((this.metrics.storyCount / this.metrics.componentCount) * 100).toFixed(1)}%`
        : '0%',
      bundleSize: this.metrics.bundleSize > 0 
        ? `${(this.metrics.bundleSize / (1024 * 1024)).toFixed(2)}MB`
        : 'Unknown',
      errors: this.metrics.errors,
      warnings: this.metrics.warnings,
      recommendations: this.generateRecommendations(),
    };
    
    return report;
  }

  /**
   * Generate optimization recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    
    // Story coverage recommendations
    const coverageRatio = this.metrics.storyCount / this.metrics.componentCount;
    if (coverageRatio < 0.5) {
      recommendations.push(
        'Low story coverage detected. Consider adding stories for more components to improve documentation and testing.'
      );
    }
    
    // Build time recommendations
    if (this.metrics.buildTime > 60000) { // > 1 minute
      recommendations.push(
        'Slow build time detected. Consider optimizing imports, reducing decorators, or enabling lazy loading.'
      );
    }
    
    // Bundle size recommendations
    const bundleSizeMB = this.metrics.bundleSize / (1024 * 1024);
    if (bundleSizeMB > 30) {
      recommendations.push(
        'Large bundle size. Consider code splitting, tree shaking, or moving large assets to external CDN.'
      );
    }
    
    // Error handling recommendations
    if (this.metrics.errors.length > 0) {
      recommendations.push(
        'Build errors detected. Fix these issues to improve reliability and development experience.'
      );
    }
    
    // Warning handling recommendations
    if (this.metrics.warnings.length > 5) {
      recommendations.push(
        'Multiple performance warnings detected. Address these to improve build performance and user experience.'
      );
    }
    
    return recommendations;
  }

  /**
   * Save report to file
   */
  saveReport(report) {
    const reportsDir = path.join(process.cwd(), '.storybook', 'reports');
    
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    const reportFile = path.join(reportsDir, `performance-${Date.now()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    console.log(`📊 Performance report saved to: ${reportFile}`);
    return reportFile;
  }

  /**
   * Display report in console
   */
  displayReport(report) {
    console.log('\n🚀 Storybook Performance Report');
    console.log('═'.repeat(50));
    console.log(`📅 Timestamp: ${report.timestamp}`);
    console.log(`⏱️  Build Time: ${report.buildTime}`);
    console.log(`📚 Stories: ${report.storyCount}`);
    console.log(`🧩 Components: ${report.componentCount}`);
    console.log(`📊 Coverage: ${report.storyCoverage}`);
    console.log(`📦 Bundle Size: ${report.bundleSize}`);
    
    if (report.errors.length > 0) {
      console.log('\n❌ Errors:');
      report.errors.forEach(error => console.log(`  • ${error}`));
    }
    
    if (report.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      report.warnings.forEach(warning => console.log(`  • ${warning}`));
    }
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach(rec => console.log(`  • ${rec}`));
    }
    
    console.log('\n' + '═'.repeat(50));
  }

  /**
   * Run complete performance analysis
   */
  run() {
    console.log('🔍 Starting Storybook performance analysis...');
    
    this.analyzeStories();
    this.analyzeBuildPerformance();
    
    const report = this.generateReport();
    
    this.displayReport(report);
    this.saveReport(report);
    
    return report;
  }
}

// Export for use in other scripts
export default StorybookPerformanceMonitor;

// Run if called directly (ES module equivalent)
if (import.meta.url === `file://${process.argv[1]}`) {
  const monitor = new StorybookPerformanceMonitor();
  monitor.run();
}