#!/usr/bin/env node

/**
 * Install husky for local development
 * Skip in CI/production environments where git hooks aren't needed
 */

const { execSync } = require('child_process');

// Skip husky install in CI/production environments
if (process.env.CI || process.env.NETLIFY || process.env.NODE_ENV === 'production') {
  console.log('Skipping husky install in CI/production environment');
  process.exit(0);
}

try {
  console.log('Installing husky git hooks...');
  execSync('husky install', { stdio: 'inherit' });
  console.log('✓ Husky installed successfully');
} catch (error) {
  // If husky is not available (e.g., in production builds), that's okay
  console.log('Husky not available - skipping git hooks setup');
  // Exit successfully - this is not a critical error
  process.exit(0);
}
