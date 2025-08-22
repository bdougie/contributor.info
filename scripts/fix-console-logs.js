#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

// Find all TypeScript/JavaScript files in src directory
const files = await glob('src/**/*.{ts,tsx,js,jsx}', {
  ignore: ['**/node_modules/**', '**/*.test.*', '**/*.spec.*']
});

console.log('Found %s files to check', files.length);

let totalFixed = 0;

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  // Match console.log with template literals containing ${...}
  const regex = /console\.log\(`([^`]*\$\{[^}]+\}[^`]*)`(?:,\s*(.+?))?\)/g;
  
  let fixedContent = content;
  let fixCount = 0;
  
  fixedContent = fixedContent.replace(regex, (match, template, additionalArgs) => {
    // Extract variables from template literal
    const variables = [];
    let formatString = template;
    
    // Replace ${var} with %s and collect variables
    formatString = formatString.replace(/\$\{([^}]+)\}/g, (m, varName) => {
      variables.push(varName);
      return '%s';
    });
    
    fixCount++;
    
    // Build the new console.log statement
    const args = variables.join(', ');
    if (additionalArgs) {
      return `console.log('${formatString}', ${args}, ${additionalArgs})`;
    }
    return `console.log('${formatString}', ${args})`;
  });
  
  if (fixCount > 0) {
    fs.writeFileSync(file, fixedContent);
    console.log('Fixed %s occurrences in %s', fixCount, file);
    totalFixed += fixCount;
  }
});

console.log('\nTotal fixed: %s template literal console.log statements', totalFixed);