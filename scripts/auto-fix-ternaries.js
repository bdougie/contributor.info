#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

// Find all TypeScript/TSX files
const files = glob.sync('src/**/*.{ts,tsx}');

let totalFixed = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  let hasChanges = false;

  // Fix common patterns that we have helper functions for
  
  // Pattern 1: ? '...' : ... ? '...' : '...' (optional strings)
  content = content.replace(
    /(\w+)\s*\?\s*(['"`][^'"`]*['"`])\s*:\s*('')/g,
    (match, variable, value) => {
      hasChanges = true;
      return `${variable} || ''`;
    }
  );

  // Pattern 2: Simple boolean ternaries in JSX
  content = content.replace(
    /\{(\w+)\s*\?\s*'([^']*)'\s*:\s*'([^']*)'\}/g,
    (match, condition, trueVal, falseVal) => {
      // Only for simple cases where it's clearly a boolean
      if (trueVal === 'Yes' && falseVal === 'No') {
        hasChanges = true;
        return `{${condition} ? 'Yes' : 'No'}`;
      }
      if (trueVal === 'true' && falseVal === 'false') {
        hasChanges = true;
        return `{String(${condition})}`;
      }
      return match;
    }
  );

  // Pattern 3: Optional chaining replacements
  content = content.replace(
    /(\w+)\s*\?\s*(\w+\.\w+)\s*:\s*(undefined|null)/g,
    (match, condition, access) => {
      hasChanges = true;
      return `${condition}?.${access.split('.')[1]}`;
    }
  );

  if (hasChanges && content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    totalFixed++;
    console.log(`Fixed: ${file}`);
  }
});

console.log(`\nTotal files fixed: ${totalFixed}`);

// Now show remaining nested ternaries that need manual fixing
console.log('\n=== Remaining nested ternaries requiring manual fixes ===\n');

const remainingIssues = [];
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // Pattern to match nested ternaries
    if (line.match(/\?.*:.*\?.*:/)) {
      // Skip if it's a type definition (contains : string, : number, etc)
      if (line.match(/:\s*(string|number|boolean|any|unknown|void|null|undefined)\s*[;,\)\}]/)) {
        return;
      }
      remainingIssues.push({
        file,
        line: index + 1,
        content: line.trim()
      });
    }
  });
});

if (remainingIssues.length > 0) {
  console.log(`Found ${remainingIssues.length} remaining nested ternaries:\n`);
  
  // Group by similar patterns
  const patterns = {};
  remainingIssues.forEach(issue => {
    // Try to categorize the pattern
    let category = 'other';
    if (issue.content.includes('className')) category = 'className';
    else if (issue.content.includes('style')) category = 'style';
    else if (issue.content.includes('aria-')) category = 'aria';
    else if (issue.content.includes('?.[')) category = 'optional-access';
    
    if (!patterns[category]) patterns[category] = [];
    patterns[category].push(issue);
  });

  Object.entries(patterns).forEach(([category, issues]) => {
    console.log(`\n${category} (${issues.length} occurrences):`);
    issues.slice(0, 3).forEach(issue => {
      console.log(`  ${issue.file}:${issue.line}`);
      console.log(`    ${issue.content.substring(0, 80)}${issue.content.length > 80 ? '...' : ''}`);
    });
    if (issues.length > 3) {
      console.log(`  ... and ${issues.length - 3} more`);
    }
  });
}

console.log('\n=== Recommendations ===');
console.log('1. For className patterns: Use classNames() or clsx() helper');
console.log('2. For aria patterns: Create descriptive helper functions');
console.log('3. For optional access: Use optional chaining (?.)');
console.log('4. For complex logic: Extract to named functions');
console.log('\nRun "npm run lint" to see all ESLint errors');