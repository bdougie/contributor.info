#!/usr/bin/env node

/**
 * Hybrid CDN Build - Quick Win Approach
 * 
 * This script:
 * 1. Builds the app normally
 * 2. Extracts vendor chunks into a single bundle
 * 3. Uploads vendor bundle to CDN
 * 4. Modifies HTML to load vendor from CDN with fallback
 */

import { build } from 'vite';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Configuration
const config = {
  vendorChunks: ['vendor-react', 'vendor-utils', 'vendor-supabase'],
  cdnBaseUrl: 'https://cdn.jsdelivr.net/gh/bdougie/contributor.info@main/dist/',
  localFallback: '/vendor-bundle.js'
};

async function hybridCDNBuild() {
  console.log('🚀 Starting Hybrid CDN Build...\n');
  
  try {
    // Step 1: Normal production build
    console.log('📦 Step 1: Building application...');
    await build({
      configFile: path.join(rootDir, 'vite.config.ts'),
      mode: 'production'
    });
    
    // Step 2: Combine vendor chunks
    console.log('🔄 Step 2: Combining vendor chunks...');
    const vendorBundle = await combineVendorChunks();
    
    // Step 3: Generate integrity hash
    console.log('🔐 Step 3: Generating integrity hash...');
    const integrity = generateIntegrity(vendorBundle);
    
    // Step 4: Save vendor bundle
    const vendorPath = path.join(rootDir, 'dist', 'vendor-bundle.js');
    await fs.writeFile(vendorPath, vendorBundle);
    console.log(`   ✅ Vendor bundle: ${(vendorBundle.length / 1024 / 1024).toFixed(2)}MB`);
    
    // Step 5: Modify HTML
    console.log('✏️  Step 4: Modifying HTML for CDN loading...');
    await modifyHTML(integrity);
    
    // Step 6: Generate upload script
    console.log('📤 Step 5: Generating CDN upload script...');
    await generateUploadScript();
    
    console.log('\n✅ Hybrid CDN build complete!');
    console.log('\n📊 Results:');
    await reportResults();
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

async function combineVendorChunks() {
  const distJs = path.join(rootDir, 'dist', 'js');
  const files = await fs.readdir(distJs);
  
  // Find vendor chunks
  const vendorFiles = files.filter(file => 
    config.vendorChunks.some(chunk => file.includes(chunk))
  );
  
  if (vendorFiles.length === 0) {
    throw new Error('No vendor chunks found!');
  }
  
  console.log(`   Found ${vendorFiles.length} vendor chunks to combine`);
  
  // Combine in order (important for dependencies)
  const combined = [];
  for (const file of vendorFiles.sort()) {
    const content = await fs.readFile(path.join(distJs, file), 'utf-8');
    combined.push(`/* ${file} */\n${content}`);
  }
  
  // Wrap in IIFE to avoid global pollution
  return `(function() {\n${combined.join('\n')}\n})();`;
}

function generateIntegrity(content) {
  const hash = crypto.createHash('sha384');
  hash.update(content);
  return `sha384-${hash.digest('base64')}`;
}

async function modifyHTML(integrity) {
  const htmlPath = path.join(rootDir, 'dist', 'index.html');
  let html = await fs.readFile(htmlPath, 'utf-8');
  
  // Remove vendor chunk references
  config.vendorChunks.forEach(chunk => {
    // Remove script tags
    html = html.replace(
      new RegExp(`<script[^>]*${chunk}[^>]*></script>`, 'g'),
      ''
    );
    // Remove modulepreload links
    html = html.replace(
      new RegExp(`<link[^>]*${chunk}[^>]*>`, 'g'),
      ''
    );
  });
  
  // Add CDN vendor bundle with fallback
  const cdnScript = `
    <!-- Vendor Bundle from CDN with fallback -->
    <script 
      src="${config.cdnBaseUrl}vendor-bundle.js"
      integrity="${integrity}"
      crossorigin="anonymous"
      onerror="loadVendorFallback()"
    ></script>
    <script>
      function loadVendorFallback() {
        console.warn('CDN failed, loading vendor bundle from local server');
        var script = document.createElement('script');
        script.src = '${config.localFallback}';
        script.onerror = function() {
          console.error('Failed to load vendor bundle from fallback!');
        };
        document.head.appendChild(script);
      }
      
      // Verify vendor libraries loaded
      window.addEventListener('DOMContentLoaded', function() {
        if (typeof React === 'undefined') {
          console.error('React not loaded! App will fail.');
        }
      });
    </script>`;
  
  // Insert before first app script
  html = html.replace(
    /<script type="module"[^>]*src="\/js\/index-[^"]*\.js"[^>]*><\/script>/,
    cdnScript + '\n    $&'
  );
  
  await fs.writeFile(htmlPath, html);
  console.log('   ✅ HTML modified with CDN vendor loading');
}

async function generateUploadScript() {
  const script = `#!/bin/bash
# Upload vendor bundle to CDN (example using GitHub as CDN)

echo "Uploading vendor bundle to CDN..."

# Option 1: GitHub Pages / jsDelivr
# Commit vendor-bundle.js to a cdn branch
git checkout -b cdn-assets
cp dist/vendor-bundle.js .
git add vendor-bundle.js
git commit -m "Update vendor bundle"
git push origin cdn-assets

# Option 2: Upload to Cloudflare R2
# wrangler r2 object put contributor-info-cdn/vendor-bundle.js --file=dist/vendor-bundle.js

# Option 3: Upload to AWS S3
# aws s3 cp dist/vendor-bundle.js s3://contributor-info-cdn/vendor-bundle.js

echo "✅ Vendor bundle uploaded to CDN"
echo "CDN URL: ${config.cdnBaseUrl}vendor-bundle.js"
`;
  
  const scriptPath = path.join(rootDir, 'dist', 'upload-to-cdn.sh');
  await fs.writeFile(scriptPath, script);
  await fs.chmod(scriptPath, 0o755);
  console.log('   ✅ CDN upload script generated: dist/upload-to-cdn.sh');
}

async function reportResults() {
  const distJs = path.join(rootDir, 'dist', 'js');
  const files = await fs.readdir(distJs);
  
  // Calculate sizes
  let appSize = 0;
  let vendorSize = 0;
  
  for (const file of files) {
    const stats = await fs.stat(path.join(distJs, file));
    if (config.vendorChunks.some(chunk => file.includes(chunk))) {
      vendorSize += stats.size;
    } else if (file.includes('index-')) {
      appSize += stats.size;
    }
  }
  
  const vendorBundleStats = await fs.stat(path.join(rootDir, 'dist', 'vendor-bundle.js'));
  
  console.log('   App Bundle:', (appSize / 1024 / 1024).toFixed(2), 'MB');
  console.log('   Vendor Bundle:', (vendorBundleStats.size / 1024 / 1024).toFixed(2), 'MB (moved to CDN)');
  console.log('   Total Initial Load:', (appSize / 1024 / 1024).toFixed(2), 'MB (vendor loaded from CDN cache)');
  console.log('\n   Savings: ~' + (vendorSize / 1024 / 1024).toFixed(2), 'MB per uncached visit');
  
  console.log('\n📝 Next Steps:');
  console.log('   1. Run: ./dist/upload-to-cdn.sh');
  console.log('   2. Update CDN URL in scripts/hybrid-cdn-build.js');
  console.log('   3. Deploy dist/ folder to production');
  console.log('   4. Monitor CDN performance and fallback usage');
}

// Run the build
hybridCDNBuild().catch(console.error);