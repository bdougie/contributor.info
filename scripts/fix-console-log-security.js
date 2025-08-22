#!/usr/bin/env node

/**
 * Script to fix console.log security vulnerabilities
 * Replaces template literals in console.log with safe string formatting
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Patterns to fix console.log with template literals
const patterns = [
  {
    // Pattern: console.log(`text ${var}`)
    regex: /console\.log\(`([^`]*)\$\{([^}]+)\}([^`]*)`\)/g,
    replacement: (match, before, variable, after) => {
      // Count the number of interpolations
      const fullMatch = match;
      const interpolations = fullMatch.match(/\$\{[^}]+\}/g) || [];
      
      if (interpolations.length === 1) {
        // Single interpolation
        return `console.log('${before}%s${after}', ${variable})`;
      } else {
        // Multiple interpolations - need to handle carefully
        return match; // Will be handled by multi-pattern
      }
    }
  },
  {
    // Pattern: console.log(`text ${var1} more text ${var2}`)
    regex: /console\.log\(`([^`]+)`\)/g,
    replacement: (match, content) => {
      // Extract all interpolations
      const interpolations = [];
      let modifiedContent = content;
      
      // Replace all ${...} with %s and collect the variables
      modifiedContent = modifiedContent.replace(/\$\{([^}]+)\}/g, (m, variable) => {
        interpolations.push(variable);
        return '%s';
      });
      
      if (interpolations.length > 0) {
        return `console.log('${modifiedContent}', ${interpolations.join(', ')})`;
      }
      
      // No interpolations, just convert to single quotes
      return `console.log('${content}')`;
    }
  }
];

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Apply each pattern
  patterns.forEach(pattern => {
    const originalContent = content;
    content = content.replace(pattern.regex, pattern.replacement);
    if (content !== originalContent) {
      modified = true;
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed: %s', filePath);
    return 1;
  }
  
  return 0;
}

function main() {
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.mts'];
  let totalFixed = 0;
  
  console.log('Scanning for console.log security vulnerabilities...\n');
  
  // Find all relevant files
  const files = [];
  extensions.forEach(ext => {
    files.push(...glob.sync(`**/*${ext}`, {
      ignore: ['node_modules/**', 'dist/**', 'build/**', '.next/**', 'storybook-static/**', '.storybook-cleanup/**']
    }));
  });
  
  // Also check workflow files
  files.push(...glob.sync('.github/workflows/*.yml'));
  
  console.log('Found %d files to check\n', files.length);
  
  files.forEach(file => {
    totalFixed += fixFile(file);
  });
  
  console.log('\nSummary:');
  console.log('  Files fixed: %d', totalFixed);
  console.log('  Files checked: %d', files.length);
  
  if (totalFixed > 0) {
    console.log('\n✅ Security vulnerabilities fixed!');
    console.log('Please review the changes and test your application.');
  } else {
    console.log('\n✅ No vulnerabilities found!');
  }
}

main();