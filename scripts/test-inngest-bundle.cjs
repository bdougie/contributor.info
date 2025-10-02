#!/usr/bin/env node
/**
 * Test script to check for import.meta references in the Netlify function bundle
 * and simulate the function execution to catch the error locally
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function buildNetlifyFunctions() {
  console.log('🔨 Building Netlify functions...');
  try {
    const { stdout, stderr } = await execPromise('npx netlify build', {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: 'production' }
    });
    if (stderr && !stderr.includes('Warning')) {
      console.error('Build stderr:', stderr);
    }
    console.log('✅ Functions built successfully');
    return true;
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    return false;
  }
}

function checkForImportMeta() {
  const functionPath = path.join(process.cwd(), '.netlify', 'functions', 'inngest-prod.js');

  if (!fs.existsSync(functionPath)) {
    console.error('❌ Function bundle not found at:', functionPath);
    return false;
  }

  console.log(`📦 Checking bundle at: ${functionPath}`);
  const content = fs.readFileSync(functionPath, 'utf8');

  // Check for import.meta references
  const importMetaMatches = content.match(/import\.meta/g);
  const fileURLToPathMatches = content.match(/fileURLToPath/g);

  if (importMetaMatches) {
    console.log(`⚠️  Found ${importMetaMatches.length} import.meta references`);

    // Find line numbers
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (line.includes('import.meta')) {
        console.log(`   Line ${index + 1}: ${line.substring(0, 100)}...`);
      }
    });
  } else {
    console.log('✅ No import.meta references found');
  }

  if (fileURLToPathMatches) {
    console.log(`📍 Found ${fileURLToPathMatches.length} fileURLToPath calls`);

    // Find the specific line mentioned in the error (85512)
    const lines = content.split('\n');
    if (lines[85511]) { // Line 85512 is index 85511
      console.log(`\n🔍 Line 85512 (from error):`);
      console.log(lines[85511].substring(0, 200));

      // Show context around that line
      console.log('\n📖 Context (lines 85510-85514):');
      for (let i = 85509; i <= 85513 && i < lines.length; i++) {
        console.log(`${i + 1}: ${lines[i].substring(0, 150)}`);
      }
    }
  }

  return !importMetaMatches;
}

async function testFunctionExecution() {
  console.log('\n🧪 Testing function execution...');
  const functionPath = path.join(process.cwd(), '.netlify', 'functions', 'inngest-prod.js');

  try {
    // Try to require the function to see if it throws the error
    console.log('Loading function module...');
    const func = require(functionPath);
    console.log('✅ Function loaded without error');
    return true;
  } catch (error) {
    console.error('❌ Function failed to load:');
    console.error('   Error:', error.message);
    if (error.stack) {
      const stackLines = error.stack.split('\n').slice(0, 5);
      stackLines.forEach(line => console.error('   ', line));
    }
    return false;
  }
}

async function main() {
  console.log('🚀 Testing Inngest Function Bundle\n');

  // Step 1: Build the functions
  const buildSuccess = await buildNetlifyFunctions();
  if (!buildSuccess) {
    process.exit(1);
  }

  // Step 2: Check for import.meta in bundle
  console.log('\n📋 Analyzing bundle...');
  const noImportMeta = checkForImportMeta();

  // Step 3: Try to load the function
  const loadSuccess = await testFunctionExecution();

  // Summary
  console.log('\n📊 Summary:');
  console.log(`   Build: ${buildSuccess ? '✅' : '❌'}`);
  console.log(`   No import.meta: ${noImportMeta ? '✅' : '❌'}`);
  console.log(`   Loads without error: ${loadSuccess ? '✅' : '❌'}`);

  if (buildSuccess && noImportMeta && loadSuccess) {
    console.log('\n✨ All tests passed!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Issues found - see above for details');
    process.exit(1);
  }
}

main().catch(console.error);