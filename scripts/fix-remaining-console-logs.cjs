#!/usr/bin/env node

/**
 * Script to fix remaining console.log template literal security vulnerabilities
 * This script targets specific patterns found in the codebase
 */

const fs = require('fs');
const path = require('path');

// List of files with confirmed vulnerabilities
const filesToFix = [
  'supabase/functions/purge-old-file-data/index.ts',
  'netlify/functions/webhook-backfill-complete.ts',
  'netlify/functions/inngest-local.mts',
  'app/services/reviewers.ts',
  'supabase/functions/spam-detection/index.ts',
  'netlify/functions/sync-router.mts',
  'netlify/functions/docs-content.mts',
  'app/services/file-embeddings.ts',
  'netlify/functions/widget-badge.mjs',
  '.github/scripts/prepare-release.js',
  'app/services/github-api.ts',
  'app/webhooks/issues.ts',
  'app/webhooks/pull-request.ts',
  'supabase/functions/_shared/spam-detection-integration.ts',
  'app/services/embeddings.ts',
  'app/webhooks/pull-request-improved.ts',
  'app/webhooks/installation.ts',
  'app/webhooks/issues-direct.ts',
  'app/webhooks/issue-comment.ts',
  'app/webhooks/labeled.ts',
  '.github/workflows/tier-labeler.yml',
  '.github/workflows/scheduled-data-sync.yml',
  'supabase/functions/github-sync/index.ts'
];

// Common replacements
const replacements = [
  // Simple single variable
  { 
    pattern: /console\.log\(`([^$]*)\$\{([^}]+)\}([^`]*)`\)/g,
    replace: (match, before, variable, after) => {
      return `console.log('${before}%s${after}', ${variable})`;
    }
  },
  // Two variables
  {
    pattern: /console\.log\(`([^$]*)\$\{([^}]+)\}([^$]*)\$\{([^}]+)\}([^`]*)`\)/g,
    replace: (match, before, var1, middle, var2, after) => {
      return `console.log('${before}%s${middle}%s${after}', ${var1}, ${var2})`;
    }
  },
  // Three variables
  {
    pattern: /console\.log\(`([^$]*)\$\{([^}]+)\}([^$]*)\$\{([^}]+)\}([^$]*)\$\{([^}]+)\}([^`]*)`\)/g,
    replace: (match, before, var1, mid1, var2, mid2, var3, after) => {
      return `console.log('${before}%s${mid1}%s${mid2}%s${after}', ${var1}, ${var2}, ${var3})`;
    }
  },
  // console.error patterns
  {
    pattern: /console\.error\(`([^$]*)\$\{([^}]+)\}([^`]*)`\)/g,
    replace: (match, before, variable, after) => {
      return `console.error('${before}%s${after}', ${variable})`;
    }
  },
  // console.warn patterns
  {
    pattern: /console\.warn\(`([^$]*)\$\{([^}]+)\}([^`]*)`\)/g,
    replace: (match, before, variable, after) => {
      return `console.warn('${before}%s${after}', ${variable})`;
    }
  }
];

function fixFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log('Skipping (not found): %s', filePath);
    return 0;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;
  
  replacements.forEach(({ pattern, replace }) => {
    const newContent = content.replace(pattern, replace);
    if (newContent !== content) {
      content = newContent;
      modified = true;
    }
  });
  
  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log('Fixed: %s', filePath);
    return 1;
  }
  
  return 0;
}

console.log('Fixing remaining console.log security vulnerabilities...\n');

let totalFixed = 0;
filesToFix.forEach(file => {
  totalFixed += fixFile(file);
});

console.log('\nSummary:');
console.log('  Files fixed: %d', totalFixed);
console.log('  Total files checked: %d', filesToFix.length);

if (totalFixed > 0) {
  console.log('\n✅ Additional vulnerabilities fixed!');
} else {
  console.log('\n✅ No additional vulnerabilities found!');
}