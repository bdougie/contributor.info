#!/usr/bin/env node

/**
 * Verification script for ES module fix
 * This script runs a series of checks to ensure the fix is working correctly
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Verifying ES Module Fix Implementation...');
console.log('============================================\n');

// Track results
const results = {
  tests: false,
  build: false,
  typeCheck: false,
  ci: false
};

function runCommand(command, args, description) {
  return new Promise((resolve) => {
    console.log(`🏃 ${description}...`);
    const child = spawn(command, args, {
      stdio: ['inherit', 'pipe', 'pipe'],
      cwd: process.cwd(),
      env: { ...process.env, CI: 'true' }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${description} - PASSED\n`);
        resolve({ success: true, stdout, stderr });
      } else {
        console.log(`❌ ${description} - FAILED (exit code: ${code})`);
        console.log('STDERR:', stderr.slice(-500)); // Last 500 chars
        console.log('');
        resolve({ success: false, stdout, stderr });
      }
    });

    child.on('error', (error) => {
      console.log(`❌ ${description} - ERROR:`, error.message);
      resolve({ success: false, stdout, stderr, error });
    });
  });
}

async function checkConfiguration() {
  console.log('📋 Configuration Check...');
  
  try {
    // Check vitest.config.ts
    const vitestConfig = readFileSync('vitest.config.ts', 'utf8');
    const hasInlineDeps = vitestConfig.includes('inline:') && vitestConfig.includes('@nivo');
    const hasServerDeps = vitestConfig.includes('server:') && vitestConfig.includes('deps:');
    
    console.log(`   📝 Vitest config has inline deps: ${hasInlineDeps ? '✅' : '❌'}`);
    console.log(`   📝 Vitest config has server deps: ${hasServerDeps ? '✅' : '❌'}`);
    
    // Check mock files
    const setupExists = readFileSync('src/__mocks__/setup.ts', 'utf8').includes('@nivo/scatterplot');
    const nivoMockExists = readFileSync('src/__mocks__/@nivo/scatterplot.tsx', 'utf8').includes('ResponsiveScatterPlot');
    
    console.log(`   📝 Setup mock exists: ${setupExists ? '✅' : '❌'}`);
    console.log(`   📝 @nivo mock exists: ${nivoMockExists ? '✅' : '❌'}`);
    
    // Check wrapper component
    const wrapperExists = readFileSync('src/components/features/activity/contributions-wrapper.tsx', 'utf8').includes('lazy');
    console.log(`   📝 Wrapper component exists: ${wrapperExists ? '✅' : '❌'}`);
    
    console.log('');
    return hasInlineDeps && hasServerDeps && setupExists && nivoMockExists && wrapperExists;
  } catch (error) {
    console.log(`❌ Configuration check failed: ${error.message}\n`);
    return false;
  }
}

async function main() {
  // Check configuration first
  const configOk = await checkConfiguration();
  if (!configOk) {
    console.log('❌ Configuration check failed. Please ensure all files are present.');
    process.exit(1);
  }

  // Run tests
  const testResult = await runCommand('npm', ['test'], 'Running test suite');
  results.tests = testResult.success;

  // Check test output for specific patterns
  if (testResult.success) {
    const hasAllTests = testResult.stdout.includes('291 passed') || testResult.stdout.includes('289 passed');
    const noEsModuleErrors = !testResult.stderr.includes('require() of ES Module');
    
    console.log(`   📊 All tests passed: ${hasAllTests ? '✅' : '❌'}`);
    console.log(`   📊 No ES module errors: ${noEsModuleErrors ? '✅' : '❌'}`);
  }

  // Type check
  const typeResult = await runCommand('npx', ['tsc', '-b'], 'TypeScript compilation');
  results.typeCheck = typeResult.success;

  // Production build
  const buildResult = await runCommand('npm', ['run', 'build:production'], 'Production build');
  results.build = buildResult.success;

  // CI environment simulation
  const ciResult = await runCommand('node', ['scripts/test-ci-environment.js'], 'CI environment simulation');
  results.ci = ciResult.success;

  // Summary
  console.log('📋 VERIFICATION SUMMARY');
  console.log('======================');
  console.log(`Tests:       ${results.tests ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Type Check:  ${results.typeCheck ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Build:       ${results.build ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`CI Env:      ${results.ci ? '✅ PASS' : '❌ FAIL'}`);

  const allPassed = Object.values(results).every(Boolean);
  
  if (allPassed) {
    console.log('\n🎉 ALL CHECKS PASSED! ES Module fix is working correctly.');
    console.log('The CI environment should now run tests successfully.');
  } else {
    console.log('\n❌ Some checks failed. Please review the errors above.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Verification script failed:', error);
  process.exit(1);
});