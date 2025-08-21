#!/usr/bin/env node

/**
 * Prepare CDN fallback files
 * Copies vendor libraries to public/vendor for fallback loading
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Libraries to copy for fallback
const fallbackLibraries = [
  {
    name: 'react',
    source: 'node_modules/react/umd/react.production.min.js',
    dest: 'public/vendor/react.production.min.js'
  },
  {
    name: 'react-dom',
    source: 'node_modules/react-dom/umd/react-dom.production.min.js',
    dest: 'public/vendor/react-dom.production.min.js'
  },
  {
    name: 'react-router-dom',
    source: 'node_modules/react-router-dom/dist/umd/react-router-dom.production.min.js',
    dest: 'public/vendor/react-router-dom.production.min.js'
  },
  {
    name: '@tanstack/react-query',
    source: 'node_modules/@tanstack/react-query/build/umd/index.production.js',
    dest: 'public/vendor/react-query.production.min.js'
  },
  {
    name: 'recharts',
    source: 'node_modules/recharts/umd/Recharts.min.js',
    dest: 'public/vendor/recharts.min.js'
  },
  {
    name: '@supabase/supabase-js',
    source: 'node_modules/@supabase/supabase-js/dist/umd/supabase.min.js',
    dest: 'public/vendor/supabase.min.js'
  }
];

// Create vendor directory if it doesn't exist
const vendorDir = path.join(rootDir, 'public', 'vendor');
if (!fs.existsSync(vendorDir)) {
  fs.mkdirSync(vendorDir, { recursive: true });
  console.log('✅ Created vendor directory');
}

// Copy each library
let copiedCount = 0;
let errorCount = 0;

for (const lib of fallbackLibraries) {
  const sourcePath = path.join(rootDir, lib.source);
  const destPath = path.join(rootDir, lib.dest);
  
  try {
    // Check if source file exists
    if (!fs.existsSync(sourcePath)) {
      console.warn(`⚠️  Source file not found for ${lib.name}: ${lib.source}`);
      console.log(`   You may need to install the package or check the path`);
      errorCount++;
      continue;
    }
    
    // Copy the file
    fs.copyFileSync(sourcePath, destPath);
    
    // Get file size for reporting
    const stats = fs.statSync(destPath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    
    console.log(`✅ Copied ${lib.name} (${sizeKB} KB)`);
    copiedCount++;
  } catch (error) {
    console.error(`❌ Failed to copy ${lib.name}:`, error.message);
    errorCount++;
  }
}

// Summary
console.log('\n📊 Summary:');
console.log(`   ✅ Successfully copied: ${copiedCount} libraries`);
if (errorCount > 0) {
  console.log(`   ❌ Failed: ${errorCount} libraries`);
  console.log('\n💡 Tip: Some libraries might use different paths.');
  console.log('   Check node_modules for the correct UMD build location.');
  process.exit(1);
} else {
  console.log('\n🎉 All CDN fallback files prepared successfully!');
  console.log('   These will be used if CDN loading fails in production.');
}