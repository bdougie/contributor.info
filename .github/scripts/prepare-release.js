#!/usr/bin/env node

/**
 * Prepare release based on workflow input
 * This script handles manual release type overrides for semantic-release
 */

const fs = require('fs');
const path = require('path');

const releaseType = process.env.RELEASE_TYPE || 'auto';

if (releaseType === 'auto') {
  console.log('Using automatic version detection from commit messages');
  process.exit(0);
}

// For manual release types, we need to create a commit that triggers the right version
const packagePath = path.join(process.cwd(), 'package.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// Create a temporary file to trigger the release type
const triggerFile = path.join(process.cwd(), '.release-trigger');
let triggerContent = '';

switch (releaseType) {
  case 'major':
    triggerContent = 'BREAKING CHANGE: Manual major release triggered via workflow';
    console.log('Preparing major release...');
    break;
  case 'minor':
    triggerContent = 'feat: Manual minor release triggered via workflow';
    console.log('Preparing minor release...');
    break;
  case 'patch':
    triggerContent = 'fix: Manual patch release triggered via workflow';
    console.log('Preparing patch release...');
    break;
  default:
    console.log(`Unknown release type: ${releaseType}, using auto`);
    process.exit(0);
}

// Write trigger file
fs.writeFileSync(triggerFile, triggerContent);

// Output for GitHub Actions
console.log(`Release type: ${releaseType}`);
console.log(`Current version: ${pkg.version}`);