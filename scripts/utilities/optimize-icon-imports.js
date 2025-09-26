#!/usr/bin/env node

/**
 * Script to analyze and suggest optimizations for lucide-react icon imports
 * Based on Vite performance recommendations to avoid barrel imports
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const sourceDir = 'src';

// Find all .ts/.tsx files
function findFiles(dir, files = []) {
  const items = readdirSync(dir);

  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      findFiles(fullPath, files);
    } else if (['.ts', '.tsx'].includes(extname(item))) {
      files.push(fullPath);
    }
  }

  return files;
}

// Extract lucide-react imports from file content
function analyzeLucideImports(content, filePath) {
  const lucideImportRegex = /import\s*\{\s*([^}]+)\s*\}\s*from\s*['"]lucide-react['"]/g;
  const matches = Array.from(content.matchAll(lucideImportRegex));

  if (matches.length === 0) return null;

  const icons = matches.flatMap((match) => match[1].split(',').map((icon) => icon.trim()));

  return {
    file: filePath,
    icons: icons,
    count: icons.length,
    originalImport: matches[0][0],
  };
}

// Convert icon name to file path
function iconToFilePath(iconName) {
  // Convert PascalCase to kebab-case
  return iconName
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '');
}

// Generate optimized import statement
function generateOptimizedImports(icons) {
  return icons
    .map((icon) => `import ${icon} from 'lucide-react/dist/esm/icons/${iconToFilePath(icon)}';`)
    .join('\n');
}

console.log('🔍 Analyzing lucide-react imports...\n');

const files = findFiles(sourceDir);
const lucideFiles = [];
let totalIcons = 0;

for (const filePath of files) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const analysis = analyzeLucideImports(content, filePath);

    if (analysis) {
      lucideFiles.push(analysis);
      totalIcons += analysis.count;
    }
  } catch (error) {
    console.warn(`⚠️  Could not read ${filePath}: ${error.message}`);
  }
}

// Sort by icon count (highest impact first)
lucideFiles.sort((a, b) => b.count - a.count);

console.log(`📊 Found ${lucideFiles.length} files with lucide-react imports`);
console.log(`📦 Total icons imported: ${totalIcons}\n`);

console.log('🎯 Top files by impact:');
lucideFiles.slice(0, 10).forEach((file, index) => {
  console.log(`${index + 1}. ${file.file} (${file.count} icons)`);
  console.log(`   Icons: ${file.icons.join(', ')}`);
  console.log('');
});

console.log('\n💡 Example optimization for highest-impact file:');
if (lucideFiles.length > 0) {
  const topFile = lucideFiles[0];
  console.log(`\n📁 File: ${topFile.file}`);
  console.log('\n❌ Current (barrel import):');
  console.log(topFile.originalImport);
  console.log('\n✅ Optimized (specific imports):');
  console.log(generateOptimizedImports(topFile.icons));

  console.log(
    `\n📈 Potential savings: Only loads ${topFile.count} icons instead of entire lucide-react library`
  );
}

console.log('\n🚀 Next steps:');
console.log('1. Start with the highest-impact files');
console.log('2. Replace barrel imports with specific imports');
console.log('3. Test that icons still work correctly');
console.log('4. Measure bundle size improvement');

console.log('\n⚡ Expected benefits:');
console.log('- Smaller initial bundle size');
console.log('- Better tree-shaking');
console.log('- Faster icon loading');
console.log('- Improved Lighthouse scores');
