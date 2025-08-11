#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, '../../public');

// Files to delete
const ROOT_IMAGES = [
  'homepage.png', 'homepage.webp', 'homepage-sm.webp', 'homepage-md.webp',
  'homepage-mobile.png', 'homepage-mobile.webp',
  'repo-distribution-view.png', 'repo-distribution-view.webp', 
  'repo-distribution-view-sm.webp', 'repo-distribution-view-md.webp',
  'repo-health-view.png', 'repo-health-view.webp',
  'repo-health-view-sm.webp', 'repo-health-view-md.webp',
  'repo-nextjs.png', 'repo-nextjs.webp',
  'repo-nextjs-sm.webp', 'repo-nextjs-md.webp',
  'repo-react.png', 'repo-react.webp',
  'repo-react-sm.webp', 'repo-react-md.webp',
  'repo-react-mobile.png', 'repo-react-mobile.webp',
  'repo-vscode.png', 'repo-vscode.webp',
  'repo-vscode-sm.webp', 'repo-vscode-md.webp',
  'social-card-home.png', 'social-card-home.webp',
  'social-card-react.png', 'social-card-react.webp',
  'social.png', 'social.webp'
];

const DIRECTORIES = ['screenshots', 'icons'];

async function deleteFile(relativePath) {
  const fullPath = path.join(PUBLIC_DIR, relativePath);
  try {
    await fs.unlink(fullPath);
    return true;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`❌ Failed to delete ${relativePath}:`, error.message);
    }
    return false;
  }
}

async function deleteDirectory(dirName) {
  const fullPath = path.join(PUBLIC_DIR, dirName);
  try {
    await fs.rm(fullPath, { recursive: true, force: true });
    return true;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`❌ Failed to delete ${dirName}:`, error.message);
    }
    return false;
  }
}

async function main() {
  console.log('🧹 Cleaning up root public images');
  console.log('==================================\n');
  
  let deletedCount = 0;
  let totalSize = 0;
  
  // Delete individual files
  console.log('🗑️  Deleting image files...');
  for (const file of ROOT_IMAGES) {
    const fullPath = path.join(PUBLIC_DIR, file);
    try {
      const stats = await fs.stat(fullPath);
      totalSize += stats.size;
      if (await deleteFile(file)) {
        deletedCount++;
      }
    } catch (error) {
      // File doesn't exist, skip
    }
  }
  
  // Delete directories
  console.log('🗑️  Deleting directories...');
  for (const dir of DIRECTORIES) {
    const fullPath = path.join(PUBLIC_DIR, dir);
    try {
      // Calculate size before deletion
      const calculateDirSize = async (dirPath) => {
        let size = 0;
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          const entryPath = path.join(dirPath, entry.name);
          if (entry.isDirectory()) {
            size += await calculateDirSize(entryPath);
          } else {
            const stats = await fs.stat(entryPath);
            size += stats.size;
          }
        }
        return size;
      };
      
      const dirSize = await calculateDirSize(fullPath);
      totalSize += dirSize;
      
      if (await deleteDirectory(dir)) {
        console.log(`  ✅ Deleted directory: ${dir}`);
      }
    } catch (error) {
      // Directory doesn't exist, skip
    }
  }
  
  console.log('\n=====================================');
  console.log('📊 Cleanup Summary:');
  console.log(`  ✅ Deleted ${deletedCount} files`);
  console.log(`  📦 Freed ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
  
  console.log('\n✅ Cleanup complete!');
  console.log('\n📝 Next Step: Run npm run build to verify bundle size');
}

main().catch(error => {
  console.error('\n❌ Cleanup failed:', error);
  process.exit(1);
});