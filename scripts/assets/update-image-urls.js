#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPORT_PATH = path.join(__dirname, '../../supabase-storage-migration-report.json');
const PROJECT_ROOT = path.join(__dirname, '../..');

// Files and directories to update
const PATHS_TO_UPDATE = [
  'public/docs',
  'src/components',
  'src/pages',
  'README.md'
];

async function loadMigrationReport() {
  try {
    const reportContent = await fs.readFile(REPORT_PATH, 'utf-8');
    return JSON.parse(reportContent);
  } catch (error) {
    console.error('❌ Failed to load migration report:', error.message);
    console.error('Please run npm run migrate-images first');
    process.exit(1);
  }
}

async function updateFileContent(filePath, urlMappings) {
  try {
    let content = await fs.readFile(filePath, 'utf-8');
    let updated = false;
    
    // Replace all old image paths with new Supabase URLs
    for (const [oldPath, newUrl] of Object.entries(urlMappings)) {
      // Match various ways the path might appear
      const patterns = [
        // In markdown: ![alt](/docs/images/...)
        new RegExp(`\\]\\(${oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g'),
        // In HTML/JSX: src="/docs/images/..."
        new RegExp(`src="${oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g'),
        // In HTML/JSX: src='/docs/images/...'
        new RegExp(`src='${oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`, 'g'),
        // In imports: from '/docs/images/...'
        new RegExp(`from ['"]${oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'g'),
        // Direct reference: /docs/images/...
        new RegExp(`(['"\`\\(\\s])${oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(['"\`\\)\\s])`, 'g')
      ];
      
      for (const pattern of patterns) {
        const newContent = content.replace(pattern, (match, prefix, suffix) => {
          if (prefix && suffix) {
            return `${prefix}${newUrl}${suffix}`;
          }
          return match.replace(oldPath, newUrl);
        });
        
        if (newContent !== content) {
          updated = true;
          content = newContent;
        }
      }
    }
    
    if (updated) {
      await fs.writeFile(filePath, content);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Failed to update ${filePath}:`, error.message);
    return false;
  }
}

async function getFilesRecursively(dir, extensions = []) {
  const files = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      // Skip node_modules and dist directories
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') {
        continue;
      }
      
      if (entry.isDirectory()) {
        files.push(...await getFilesRecursively(fullPath, extensions));
      } else if (entry.isFile()) {
        if (extensions.length === 0 || extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    console.warn(`⚠️  Skipping ${dir}: ${error.message}`);
  }
  
  return files;
}

async function main() {
  console.log('🔄 Updating Image URLs to Supabase Storage');
  console.log('==========================================\n');
  
  // Load migration report
  console.log('📊 Loading migration report...');
  const report = await loadMigrationReport();
  const urlMappings = report.urlMappings;
  
  if (!urlMappings || Object.keys(urlMappings).length === 0) {
    console.log('\n⚠️  No URL mappings found in migration report');
    return;
  }
  
  console.log(`📝 Found ${Object.keys(urlMappings).length} URL mappings to apply\n`);
  
  // Find all files to update
  console.log('🔍 Scanning for files to update...');
  const filesToUpdate = [];
  
  for (const relativePath of PATHS_TO_UPDATE) {
    const fullPath = path.join(PROJECT_ROOT, relativePath);
    
    try {
      const stats = await fs.stat(fullPath);
      
      if (stats.isDirectory()) {
        const files = await getFilesRecursively(fullPath, ['.md', '.mdx', '.tsx', '.ts', '.jsx', '.js']);
        filesToUpdate.push(...files);
      } else if (stats.isFile()) {
        filesToUpdate.push(fullPath);
      }
    } catch (error) {
      console.warn(`⚠️  Skipping ${relativePath}: ${error.message}`);
    }
  }
  
  console.log(`📁 Found ${filesToUpdate.length} files to check\n`);
  
  // Update files
  console.log('✏️  Updating files...');
  let updatedCount = 0;
  
  for (const filePath of filesToUpdate) {
    const relativePath = path.relative(PROJECT_ROOT, filePath);
    const updated = await updateFileContent(filePath, urlMappings);
    
    if (updated) {
      console.log(`  ✅ Updated: ${relativePath}`);
      updatedCount++;
    }
  }
  
  // Print summary
  console.log('\n==========================================');
  console.log('📊 Update Summary:');
  console.log(`  ✅ Updated ${updatedCount} files`);
  console.log(`  📁 Checked ${filesToUpdate.length} files`);
  
  if (updatedCount > 0) {
    console.log('\n📝 Next Steps:');
    console.log('1. Test the application locally: npm run dev');
    console.log('2. Verify all images load correctly');
    console.log('3. If everything works, run: npm run cleanup-local-images');
    console.log('4. Commit and push the changes');
  } else {
    console.log('\n✅ No files needed updating - URLs may already be updated');
  }
  
  console.log('\n✅ URL update complete!');
}

// Run the update
main().catch(error => {
  console.error('\n❌ URL update failed:', error);
  process.exit(1);
});