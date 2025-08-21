#!/usr/bin/env node

/**
 * Build script for CDN optimization
 * This replaces React imports with CDN globals after build
 */

import { build } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function buildWithCDN() {
  console.log('🚀 Building with CDN optimization...');
  
  // First, do a regular build
  await build({
    configFile: path.join(rootDir, 'vite.config.ts'),
    mode: 'production'
  });
  
  console.log('📦 Build complete, post-processing for CDN...');
  
  // Read the built index.html
  const indexPath = path.join(rootDir, 'dist', 'index.html');
  let html = fs.readFileSync(indexPath, 'utf-8');
  
  // Find the main JS file
  const mainJsMatch = html.match(/src="(\/js\/index-[^"]+\.js)"/);
  if (!mainJsMatch) {
    console.error('❌ Could not find main JS file in index.html');
    process.exit(1);
  }
  
  const mainJsPath = path.join(rootDir, 'dist', mainJsMatch[1].substring(1));
  let jsContent = fs.readFileSync(mainJsPath, 'utf-8');
  
  console.log('🔄 Replacing React imports with CDN globals...');
  
  // Count replacements
  let replacements = 0;
  
  // Replace import statements with global references
  // This is a simplified approach - in production you'd want more robust AST transformation
  const patterns = [
    // Replace React imports
    [/import\s+(?:\*\s+as\s+)?React(?:,?\s*{[^}]*})?\s+from\s+["']react["']/g, '/* React from CDN */'],
    [/import\s+{([^}]+)}\s+from\s+["']react["']/g, (match, imports) => {
      replacements++;
      return `const {${imports}} = window.React`;
    }],
    
    // Replace ReactDOM imports
    [/import\s+(?:\*\s+as\s+)?ReactDOM\s+from\s+["']react-dom["']/g, '/* ReactDOM from CDN */'],
    [/import\s+ReactDOM\s+from\s+["']react-dom\/client["']/g, '/* ReactDOM from CDN */'],
    [/import\s+{([^}]+)}\s+from\s+["']react-dom["']/g, (match, imports) => {
      replacements++;
      return `const {${imports}} = window.ReactDOM`;
    }],
    
    // Replace React Router imports
    [/import\s+{([^}]+)}\s+from\s+["']react-router-dom["']/g, (match, imports) => {
      replacements++;
      return `const {${imports}} = window.ReactRouterDOM`;
    }],
  ];
  
  for (const [pattern, replacement] of patterns) {
    jsContent = jsContent.replace(pattern, replacement);
  }
  
  console.log(`✅ Made ${replacements} import replacements`);
  
  // Write back the modified JS
  fs.writeFileSync(mainJsPath, jsContent);
  
  // Add CDN scripts to HTML
  const cdnScripts = `
    <!-- CDN Libraries -->
    <script crossorigin src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-router-dom@6.28.0/dist/umd/react-router-dom.production.min.js"></script>
    
    <!-- CDN Preconnect -->
    <link rel="preconnect" href="https://unpkg.com" crossorigin>
    <link rel="dns-prefetch" href="https://unpkg.com">`;
  
  // Insert CDN scripts before the main script
  html = html.replace('</head>', cdnScripts + '\n  </head>');
  
  // Write back the modified HTML
  fs.writeFileSync(indexPath, html);
  
  console.log('✅ CDN optimization complete!');
  
  // Report file sizes
  const stats = fs.statSync(mainJsPath);
  console.log(`📊 Main bundle size: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
}

// Run the build
buildWithCDN().catch(console.error);