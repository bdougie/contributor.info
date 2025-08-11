#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_IMAGES_DIR = path.join(__dirname, '../../public/docs/images');
const REPORT_PATH = path.join(__dirname, '../../supabase-storage-migration-report.json');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer);
    });
  });
}

async function loadMigrationReport() {
  try {
    const reportContent = await fs.readFile(REPORT_PATH, 'utf-8');
    return JSON.parse(reportContent);
  } catch (error) {
    console.error('❌ Failed to load migration report:', error.message);
    return null;
  }
}

async function calculateDirectorySize(dir) {
  let totalSize = 0;
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        totalSize += await calculateDirectorySize(fullPath);
      } else if (entry.isFile()) {
        const stats = await fs.stat(fullPath);
        totalSize += stats.size;
      }
    }
  } catch (error) {
    console.warn(`⚠️  Error calculating size for ${dir}:`, error.message);
  }
  
  return totalSize;
}

async function deleteDirectory(dir) {
  try {
    await fs.rm(dir, { recursive: true, force: true });
    return true;
  } catch (error) {
    console.error(`❌ Failed to delete ${dir}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🧹 Local Images Cleanup');
  console.log('=======================\n');
  
  // Check if migration was successful
  const report = await loadMigrationReport();
  
  if (!report) {
    console.log('⚠️  No migration report found.');
    console.log('Please run npm run migrate-images first.\n');
    rl.close();
    return;
  }
  
  const { statistics } = report;
  
  console.log('📊 Migration Statistics:');
  console.log(`  ✅ Successfully uploaded: ${statistics.uploaded} files`);
  console.log(`  ❌ Failed uploads: ${statistics.failed} files`);
  console.log(`  📦 Total files: ${statistics.totalFiles} files\n`);
  
  if (statistics.failed > 0) {
    console.log('⚠️  WARNING: Some files failed to upload.');
    console.log('You may want to fix these issues before cleaning up local files.\n');
    
    const continueAnyway = await askQuestion('Continue anyway? (y/N): ');
    if (continueAnyway.toLowerCase() !== 'y') {
      console.log('\n❌ Cleanup cancelled');
      rl.close();
      return;
    }
  }
  
  // Calculate size to be freed
  console.log('\n📁 Calculating space to be freed...');
  const directorySize = await calculateDirectorySize(PUBLIC_IMAGES_DIR);
  const sizeMB = (directorySize / 1024 / 1024).toFixed(2);
  
  console.log(`📊 Space to be freed: ${sizeMB}MB`);
  console.log(`📁 Directory to delete: ${PUBLIC_IMAGES_DIR}\n`);
  
  // Confirm deletion
  console.log('⚠️  WARNING: This action cannot be undone!');
  console.log('Make sure you have:');
  console.log('  1. Successfully migrated all images to Supabase');
  console.log('  2. Updated all image URLs in the codebase');
  console.log('  3. Tested the application locally\n');
  
  const confirm = await askQuestion('Delete local images? Type "DELETE" to confirm: ');
  
  if (confirm !== 'DELETE') {
    console.log('\n❌ Cleanup cancelled');
    rl.close();
    return;
  }
  
  // Delete the directory
  console.log('\n🗑️  Deleting local images...');
  const deleted = await deleteDirectory(PUBLIC_IMAGES_DIR);
  
  if (deleted) {
    console.log('✅ Local images deleted successfully');
    console.log(`📊 Freed ${sizeMB}MB of space`);
    
    // Update .gitignore to ensure images aren't re-added
    console.log('\n📝 Updating .gitignore...');
    try {
      const gitignorePath = path.join(__dirname, '../../.gitignore');
      let gitignoreContent = '';
      
      try {
        gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
      } catch (error) {
        // .gitignore might not exist
      }
      
      if (!gitignoreContent.includes('public/docs/images')) {
        gitignoreContent += '\n# Images migrated to Supabase Storage\npublic/docs/images/\n';
        await fs.writeFile(gitignorePath, gitignoreContent);
        console.log('✅ Updated .gitignore');
      } else {
        console.log('✅ .gitignore already contains image exclusion');
      }
    } catch (error) {
      console.warn('⚠️  Failed to update .gitignore:', error.message);
    }
    
    console.log('\n✅ Cleanup complete!');
    console.log('\n📝 Next Steps:');
    console.log('1. Run: npm run build');
    console.log('2. Verify bundle size is under 5MB');
    console.log('3. Commit and push the changes');
  } else {
    console.log('❌ Failed to delete local images');
  }
  
  rl.close();
}

// Run the cleanup
main().catch(error => {
  console.error('\n❌ Cleanup failed:', error);
  rl.close();
  process.exit(1);
});