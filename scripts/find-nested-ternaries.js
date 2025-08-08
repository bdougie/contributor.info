#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

// Find all TypeScript/TSX files
const files = glob.sync('src/**/*.{ts,tsx}');

const nestedTernaries = [];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // Pattern to match nested ternaries (? ... : ... ? ... :)
    if (line.match(/\?.*:.*\?.*:/)) {
      nestedTernaries.push({
        file,
        line: index + 1,
        content: line.trim(),
        // Try to extract the pattern
        pattern: extractPattern(line)
      });
    }
  });
});

function extractPattern(line) {
  // Try to identify common patterns
  if (line.includes('>= 80') || line.includes('>= 90')) {
    return 'score-rating';
  }
  if (line.includes('variant ===')) {
    return 'variant-check';
  }
  if (line.includes('> 0') || line.includes('< 0')) {
    return 'trend-direction';
  }
  if (line.includes('timeRange ===')) {
    return 'time-range';
  }
  if (line.includes('className') || line.includes('bg-')) {
    return 'style-class';
  }
  return 'other';
}

// Group by pattern
const grouped = nestedTernaries.reduce((acc, item) => {
  if (!acc[item.pattern]) {
    acc[item.pattern] = [];
  }
  acc[item.pattern].push(item);
  return acc;
}, {});

console.log(`Found ${nestedTernaries.length} nested ternary operators\n`);

// Output grouped results
Object.entries(grouped).forEach(([pattern, items]) => {
  console.log(`\n## Pattern: ${pattern} (${items.length} occurrences)`);
  items.forEach(item => {
    console.log(`  ${item.file}:${item.line}`);
    console.log(`    ${item.content.substring(0, 100)}${item.content.length > 100 ? '...' : ''}`);
  });
});

// Suggest refactoring strategies
console.log('\n## Refactoring Suggestions:\n');
console.log('1. score-rating: Use a getRatingClass() helper function or RATING_CLASSES enum');
console.log('2. variant-check: Use a VARIANT_VALUES object/map');
console.log('3. trend-direction: Use a getTrendDirection() helper function');
console.log('4. time-range: Use a TIME_RANGE_HOURS map');
console.log('5. style-class: Use classNames() helper with conditions object');