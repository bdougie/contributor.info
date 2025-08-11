#!/usr/bin/env node

/**
 * Script to test in a CI-like environment
 * This simulates the GitHub Actions environment for testing
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Testing in CI-like environment...');
console.log(`📍 Current directory: ${process.cwd()}`);
console.log(`🟢 Node version: ${process.version}`);
console.log(`📦 npm version: ${process.env.npm_version || 'unknown'}`);

// Set CI environment variables
const env = {
  ...process.env,
  CI: 'true',
  NODE_ENV: 'test',
  VITE_OPENAI_API_KEY: 'test-key-for-ci',
  NODE_OPTIONS: '--unhandled-rejections=strict'
};

console.log('\n🏃 Running tests with CI environment variables...');

const test = spawn('npm', ['test', '--', '--coverage', '--passWithNoTests', '--reporter=verbose'], {
  stdio: 'inherit',
  cwd: process.cwd(),
  env
});

test.on('close', (code) => {
  console.log(`\n✅ Tests completed with exit code: ${code}`);
  if (code === 0) {
    console.log('🎉 All tests passed in CI-like environment!');
  } else {
    console.log('❌ Tests failed in CI-like environment');
  }
  process.exit(code);
});

test.on('error', (error) => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});