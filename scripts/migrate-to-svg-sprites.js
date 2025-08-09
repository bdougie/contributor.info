#!/usr/bin/env node

/**
 * Migrate from lucide-react to SVG sprite icons
 * This script replaces all lucide-react imports with our Icon component
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Files to migrate
const PATTERN = 'src/**/*.{tsx,ts}';

// Exclude patterns
const EXCLUDE = [
  'src/components/ui/icon.tsx', // Don't modify the icon component itself
  'src/types/icons.ts', // Don't modify the types file
  '**/*.test.tsx',
  '**/*.test.ts',
  '**/*.stories.tsx'
];

async function migrateFile(filePath) {
  try {
    let content = await fs.readFile(filePath, 'utf8');
    let hasChanges = false;
    
    // Check if file has lucide-react imports
    if (!content.includes('lucide-react')) {
      return false;
    }
    
    console.log(`📝 Migrating: ${filePath}`);
    
    // Extract lucide-react imports (including type imports)
    const lucideImportRegex = /import\s+(?:type\s+)?\{([^}]+)\}\s*from\s*['"]lucide-react['"]/g;
    const matches = [...content.matchAll(lucideImportRegex)];
    
    if (matches.length > 0) {
      // Get all imported icons
      const allIcons = matches.flatMap(match => 
        match[1].split(',').map(icon => icon.trim())
      );
      
      // Remove duplicate icons
      const uniqueIcons = [...new Set(allIcons)];
      
      // Replace all lucide-react imports with a single icon import
      content = content.replace(lucideImportRegex, '');
      
      // Add the new import at the top (after React imports if they exist)
      const reactImportMatch = content.match(/import.*from\s*['"]react['"]/);
      if (reactImportMatch) {
        const insertPos = content.indexOf(reactImportMatch[0]) + reactImportMatch[0].length;
        content = content.slice(0, insertPos) + 
          `\nimport { ${uniqueIcons.join(', ')} } from '@/components/ui/icon';` +
          content.slice(insertPos);
      } else {
        content = `import { ${uniqueIcons.join(', ')} } from '@/components/ui/icon';\n` + content;
      }
      
      hasChanges = true;
    }
    
    // Clean up any empty lines from removed imports
    content = content.replace(/\n\n\n+/g, '\n\n');
    
    if (hasChanges) {
      await fs.writeFile(filePath, content);
      console.log(`✅ Migrated: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error migrating ${filePath}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting migration from lucide-react to SVG sprites...\n');
  
  // Find all TypeScript/React files
  const files = await glob(PATTERN, {
    ignore: EXCLUDE,
    cwd: path.join(__dirname, '..')
  });
  
  console.log(`Found ${files.length} files to check\n`);
  
  let migratedCount = 0;
  
  for (const file of files) {
    const fullPath = path.join(__dirname, '..', file);
    const migrated = await migrateFile(fullPath);
    if (migrated) {
      migratedCount++;
    }
  }
  
  console.log(`\n✨ Migration complete!`);
  console.log(`📊 Migrated ${migratedCount} files`);
  console.log(`\n📋 Next steps:`);
  console.log(`1. Run 'npm run build' to verify the migration`);
  console.log(`2. Test the application to ensure all icons render correctly`);
  console.log(`3. Remove lucide-react from package.json`);
  console.log(`4. Run 'npm install' to remove the package`);
}

main().catch(console.error);