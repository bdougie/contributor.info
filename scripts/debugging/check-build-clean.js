#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

/**
 * Check if the build output contains any test dependencies that could hurt Lighthouse scores
 */
async function checkBuildClean() {
  const distFiles = await glob('dist/assets/*.js');
  const testDependencies = [
    '@storybook',
    'vitest',
    '@testing-library',
    '.stories.',
    '.test.',
    '__tests__',
    '__mocks__',
  ];

  let foundTestDeps = false;

  for (const file of distFiles) {
    const content = fs.readFileSync(file, 'utf-8');

    for (const dep of testDependencies) {
      if (content.includes(dep)) {
        console.error(`❌ Found test dependency "${dep}" in ${path.basename(file)}`);
        foundTestDeps = true;
      }
    }
  }

  if (foundTestDeps) {
    console.error('\n💡 Test dependencies found in build. This could hurt Lighthouse scores.');
    console.error("   Check your imports and ensure story files aren't being bundled.");
    process.exit(1);
  } else {
    console.log('✅ Build is clean - no test dependencies found in bundle');

    // Show bundle size summary
    const totalSize = distFiles.reduce((total, file) => {
      return total + fs.statSync(file).size;
    }, 0);

    console.log(`📦 Total JS bundle size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  }
}

checkBuildClean().catch(console.error);
