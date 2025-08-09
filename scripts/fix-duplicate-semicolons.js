#!/usr/bin/env node

/**
 * Fix duplicate semicolons in migrated files
 */

import fs from 'fs/promises';
import { glob } from 'glob';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function fixFile(filePath) {
  try {
    let content = await fs.readFile(filePath, 'utf8');
    let hasChanges = false;
    
    // Fix duplicate semicolons
    if (content.includes(';;')) {
      content = content.replace(/;;+/g, ';');
      hasChanges = true;
    }
    
    // Fix empty import lines
    if (content.includes(';\n;')) {
      content = content.replace(/;\n;/g, ';');
      hasChanges = true;
    }
    
    if (hasChanges) {
      await fs.writeFile(filePath, content);
      console.log(`✅ Fixed: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🔧 Fixing duplicate semicolons...\n');
  
  const files = await glob('src/**/*.{tsx,ts}', {
    cwd: path.join(__dirname, '..')
  });
  
  let fixedCount = 0;
  
  for (const file of files) {
    const fullPath = path.join(__dirname, '..', file);
    const fixed = await fixFile(fullPath);
    if (fixed) {
      fixedCount++;
    }
  }
  
  console.log(`\n✨ Fixed ${fixedCount} files`);
}

main().catch(console.error);