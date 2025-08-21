#!/usr/bin/env node

/**
 * Smoke test to ensure the site loads correctly after bundle splitting changes
 * Run with: node scripts/test-site-loading.js
 */

import { spawn } from 'child_process';
import http from 'http';

const PORT = 5173; // Default Vite dev server port
const TEST_URLS = [
  '/',
  '/contributors',
  '/pull-requests',
  '/contribution-graph',
  '/contribution-flow'
];

let devServer;

function startDevServer() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting dev server...');
    devServer = spawn('npm', ['run', 'dev'], {
      stdio: 'pipe',
      shell: true
    });

    devServer.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Local:') || output.includes('ready in')) {
        console.log('✅ Dev server started');
        setTimeout(resolve, 2000); // Give it 2 seconds to fully initialize
      }
    });

    devServer.stderr.on('data', (data) => {
      console.error(`Dev server error: ${data}`);
    });

    devServer.on('error', reject);
    
    // Handle server crash before becoming ready
    devServer.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Dev server exited with code ${code}`));
      }
    });
    
    devServer.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Dev server exited unexpectedly with code ${code}`));
      }
    });
  });
}

function testUrl(url) {
  return new Promise((resolve, reject) => {
    const fullUrl = `http://localhost:${PORT}${url}`;
    
    http.get(fullUrl, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        // Check for critical elements that indicate the app loaded
        const hasReactRoot = data.includes('id="root"');
        const hasViteScripts = data.includes('type="module"');
        const hasNoErrors = !data.includes('Error:') && !data.includes('Cannot read');
        
        if (hasReactRoot && hasViteScripts && hasNoErrors) {
          console.log(`✅ ${url} - Loaded successfully`);
          resolve(true);
        } else {
          console.error(`❌ ${url} - Missing critical elements`);
          console.error(`  React root: ${hasReactRoot}`);
          console.error(`  Vite scripts: ${hasViteScripts}`);
          console.error(`  No errors: ${hasNoErrors}`);
          resolve(false);
        }
      });
    }).on('error', (err) => {
      console.error(`❌ ${url} - Failed to load: ${err.message}`);
      resolve(false);
    });
  });
}

async function runTests() {
  try {
    await startDevServer();
    
    console.log('\n📋 Testing routes...\n');
    
    const results = [];
    for (const url of TEST_URLS) {
      const result = await testUrl(url);
      results.push({ url, success: result });
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between tests
    }
    
    console.log('\n📊 Test Results:');
    console.log('================');
    
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    results.forEach(r => {
      console.log(`${r.success ? '✅' : '❌'} ${r.url}`);
    });
    
    console.log(`\nPassed: ${passed}/${results.length}`);
    
    if (failed > 0) {
      console.error('\n⚠️  Some routes failed to load properly!');
      process.exit(1);
    } else {
      console.log('\n🎉 All routes loaded successfully!');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  } finally {
    if (devServer) {
      console.log('\n🛑 Stopping dev server...');
      devServer.kill();
    }
  }
}

// Also test production build
async function testProductionBuild() {
  console.log('\n📦 Testing production build...\n');
  
  return new Promise((resolve, reject) => {
    const buildProcess = spawn('npm', ['run', 'build'], {
      stdio: 'inherit',
      shell: true
    });
    
    buildProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Production build successful');
        resolve();
      } else {
        console.error('❌ Production build failed');
        reject(new Error('Build failed'));
      }
    });
  });
}

// Run the tests
async function main() {
  console.log('🧪 Starting site loading tests...\n');
  
  try {
    // Test production build first
    await testProductionBuild();
    
    // Then test dev server
    await runTests();
    
    process.exit(0);
  } catch (error) {
    console.error('Tests failed:', error);
    process.exit(1);
  }
}

main();