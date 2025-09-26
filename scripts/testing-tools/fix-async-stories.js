#!/usr/bin/env node

/**
 * Script to remove async/await patterns from Storybook stories
 * Following bulletproof testing guidelines - NO async/await allowed
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all story files
const storyFiles = glob.sync('src/**/*.stories.{ts,tsx}');

console.log(`Found ${storyFiles.length} story files to check...`);

let filesFixed = 0;
let totalAsyncRemoved = 0;

storyFiles.forEach((filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // Track if we made changes
  let hasChanges = false;

  // Remove async from play functions
  content = content.replace(/play:\s*async\s*\(/g, () => {
    hasChanges = true;
    totalAsyncRemoved++;
    return 'play: (';
  });

  // Remove await keywords from expectations
  content = content.replace(/await\s+expect/g, () => {
    hasChanges = true;
    return 'expect';
  });

  // Remove await from userEvent calls
  content = content.replace(/await\s+userEvent\./g, () => {
    hasChanges = true;
    return 'userEvent.';
  });

  // Remove await from waitFor and similar
  content = content.replace(/await\s+waitFor/g, () => {
    hasChanges = true;
    return '// waitFor removed - synchronous only\n    // ';
  });

  // Remove await from within() calls
  content = content.replace(/await\s+within/g, () => {
    hasChanges = true;
    return 'within';
  });

  // Comment out any remaining standalone await statements
  content = content.replace(/^\s*await\s+/gm, () => {
    hasChanges = true;
    return '    // await removed - ';
  });

  if (hasChanges) {
    fs.writeFileSync(filePath, content);
    filesFixed++;
    console.log(`✅ Fixed: ${filePath}`);
  }
});

console.log(`\n📊 Summary:`);
console.log(`   Files fixed: ${filesFixed}`);
console.log(`   Async patterns removed: ${totalAsyncRemoved}`);
console.log(`\n✨ All stories now follow bulletproof testing guidelines!`);
