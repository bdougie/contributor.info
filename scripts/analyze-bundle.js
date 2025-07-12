#!/usr/bin/env node

/**
 * Bundle Analysis Script
 * Analyzes the Vite build output to identify optimization opportunities
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const distDir = 'dist/assets';

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function analyzeBundle() {
  console.log('📦 Bundle Analysis Report\n');
  
  try {
    const files = readdirSync(distDir);
    const assets = [];
    let totalSize = 0;
    
    for (const file of files) {
      const filePath = join(distDir, file);
      const stat = statSync(filePath);
      
      if (stat.isFile()) {
        assets.push({
          name: file,
          size: stat.size,
          type: extname(file)
        });
        totalSize += stat.size;
      }
    }
    
    // Sort by size
    assets.sort((a, b) => b.size - a.size);
    
    console.log(`🎯 Total Bundle Size: ${formatBytes(totalSize)}\n`);
    
    // Group by type
    const byType = {};
    assets.forEach(asset => {
      if (!byType[asset.type]) byType[asset.type] = [];
      byType[asset.type].push(asset);
    });
    
    // JavaScript files analysis
    if (byType['.js']) {
      console.log('📊 JavaScript Chunks:');
      byType['.js'].forEach((file, index) => {
        const gzipEst = Math.round(file.size * 0.3); // Rough gzip estimate
        console.log(`${index + 1}. ${file.name} - ${formatBytes(file.size)} (${formatBytes(gzipEst)} gzipped)`);
        
        // Identify chunk types
        if (file.name.includes('react-core')) {
          console.log('   ✅ Critical Path: React core');
        } else if (file.name.includes('react-ecosystem')) {
          console.log('   ✅ Critical Path: Router & utilities');
        } else if (file.name.includes('charts-essential')) {
          console.log('   ✅ Critical Path: Essential charts');
        } else if (file.name.includes('ui-radix')) {
          console.log('   ⏳ Deferred: UI components');
        } else if (file.name.includes('charts-advanced')) {
          console.log('   ⏳ Deferred: Advanced charts');
        } else if (file.name.includes('analytics')) {
          console.log('   ⏳ Deferred: Analytics');
        } else if (file.name.includes('icons')) {
          console.log('   ⏳ Deferred: Icons');
        } else if (file.name.includes('data')) {
          console.log('   ⏳ Deferred: Data layer');
        } else if (file.name.includes('utils')) {
          console.log('   ⏳ Deferred: Utilities');
        } else {
          console.log('   📄 Other chunk');
        }
      });
      console.log('');
    }
    
    // CSS files analysis
    if (byType['.css']) {
      console.log('🎨 CSS Files:');
      byType['.css'].forEach((file, index) => {
        console.log(`${index + 1}. ${file.name} - ${formatBytes(file.size)}`);
      });
      console.log('');
    }
    
    // Critical path calculation
    const criticalChunks = byType['.js']?.filter(file => 
      file.name.includes('react-core') || 
      file.name.includes('react-ecosystem') || 
      file.name.includes('charts-essential')
    ) || [];
    
    const criticalSize = criticalChunks.reduce((sum, chunk) => sum + chunk.size, 0);
    const criticalGzipped = Math.round(criticalSize * 0.3);
    
    console.log(`🎯 Critical Path Analysis:`);
    console.log(`   Size: ${formatBytes(criticalSize)}`);
    console.log(`   Gzipped: ${formatBytes(criticalGzipped)}`);
    console.log(`   Target: <200 KB gzipped`);
    console.log(`   Status: ${criticalGzipped < 200000 ? '✅ Good' : '⚠️ Could be optimized'}\n`);
    
    // Recommendations
    console.log('💡 Optimization Opportunities:');
    
    const largeChunks = assets.filter(asset => asset.size > 100000 && asset.type === '.js');
    if (largeChunks.length > 0) {
      console.log('   📦 Large Chunks (>100KB):');
      largeChunks.forEach(chunk => {
        console.log(`      - ${chunk.name} (${formatBytes(chunk.size)})`);
        if (!chunk.name.includes('react-core') && !chunk.name.includes('charts-essential')) {
          console.log('        💡 Consider lazy loading or further splitting');
        }
      });
    }
    
    const totalJS = byType['.js']?.reduce((sum, file) => sum + file.size, 0) || 0;
    const totalCSS = byType['.css']?.reduce((sum, file) => sum + file.size, 0) || 0;
    
    console.log(`\n📈 Bundle Composition:`);
    console.log(`   JavaScript: ${formatBytes(totalJS)} (${Math.round(totalJS/totalSize*100)}%)`);
    console.log(`   CSS: ${formatBytes(totalCSS)} (${Math.round(totalCSS/totalSize*100)}%)`);
    
    // Web Vitals impact estimate
    console.log(`\n⚡ Performance Impact:`);
    console.log(`   LCP Impact: ${criticalGzipped < 150000 ? 'Low' : criticalGzipped < 200000 ? 'Medium' : 'High'}`);
    console.log(`   FID Impact: ${totalJS < 1000000 ? 'Low' : 'Medium'}`);
    
  } catch (error) {
    console.error('❌ Error analyzing bundle:', error.message);
    console.log('\n💡 Make sure to run "npm run build" first');
  }
}

analyzeBundle();