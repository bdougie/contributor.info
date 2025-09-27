#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://egcxzonpmmcirmgqdrla.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_TOKEN;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_KEY or SUPABASE_TOKEN is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const BUCKET_NAME = 'assets';
const PUBLIC_DIR = path.join(__dirname, '../../public');

// Files to migrate
const ROOT_IMAGES = [
  'homepage.png',
  'homepage.webp',
  'homepage-sm.webp',
  'homepage-md.webp',
  'homepage-mobile.png',
  'homepage-mobile.webp',
  'repo-distribution-view.png',
  'repo-distribution-view.webp',
  'repo-distribution-view-sm.webp',
  'repo-distribution-view-md.webp',
  'repo-health-view.png',
  'repo-health-view.webp',
  'repo-health-view-sm.webp',
  'repo-health-view-md.webp',
  'repo-nextjs.png',
  'repo-nextjs.webp',
  'repo-nextjs-sm.webp',
  'repo-nextjs-md.webp',
  'repo-react.png',
  'repo-react.webp',
  'repo-react-sm.webp',
  'repo-react-md.webp',
  'repo-react-mobile.png',
  'repo-react-mobile.webp',
  'repo-vscode.png',
  'repo-vscode.webp',
  'repo-vscode-sm.webp',
  'repo-vscode-md.webp',
  'social-card-home.png',
  'social-card-home.webp',
  'social-card-react.png',
  'social-card-react.webp',
  'social.png',
  'social.webp',
];

const SCREENSHOT_FILES = [
  'screenshots/desktop-1280x720.png',
  'screenshots/desktop-1280x720.webp',
  'screenshots/desktop-1280x720-sm.webp',
  'screenshots/desktop-1280x720-md.webp',
  'screenshots/mobile-375x667.png',
  'screenshots/mobile-375x667.webp',
];

const ICON_FILES = [
  'icons/icon-192x192.png',
  'icons/icon-192x192.webp',
  'icons/icon-192x192-maskable.png',
  'icons/icon-192x192-maskable.webp',
  'icons/icon-512x512.png',
  'icons/icon-512x512.webp',
  'icons/icon-512x512-maskable.png',
  'icons/icon-512x512-maskable.webp',
  'icons/search-96x96.png',
  'icons/search-96x96.webp',
];

async function uploadFile(relativePath) {
  const fullPath = path.join(PUBLIC_DIR, relativePath);

  try {
    const fileBuffer = await fs.readFile(fullPath);
    const fileStats = await fs.stat(fullPath);

    // Determine content type
    const ext = path.extname(fullPath).toLowerCase();
    const contentTypes = {
      '.png': 'image/png',
      '.webp': 'image/webp',
    };
    const contentType = contentTypes[ext] || 'application/octet-stream';

    // Upload path in Supabase
    const storagePath = `public/${relativePath}`;

    console.log(`  📤 Uploading: ${relativePath} (${(fileStats.size / 1024).toFixed(1)}KB)`);

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType,
        cacheControl: '31536000', // 1 year cache
        upsert: true,
      });

    if (error) {
      throw error;
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);

    return {
      success: true,
      originalPath: `/${relativePath}`,
      publicUrl,
      size: fileStats.size,
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, skip it
      return { success: false, skipped: true, originalPath: relativePath };
    }

    console.error(`    ❌ Failed: ${error.message}`);
    return {
      success: false,
      originalPath: relativePath,
      error: error.message,
    };
  }
}

async function main() {
  console.log('🚀 Migrating Root Public Images to Supabase');
  console.log('===========================================\n');

  const allFiles = [...ROOT_IMAGES, ...SCREENSHOT_FILES, ...ICON_FILES];
  const results = [];
  let totalSize = 0;
  let uploaded = 0;
  let skipped = 0;

  console.log(`📤 Uploading ${allFiles.length} files...\n`);

  for (const file of allFiles) {
    const result = await uploadFile(file);

    if (result.success) {
      results.push(result);
      totalSize += result.size;
      uploaded++;
    } else if (result.skipped) {
      skipped++;
    }
  }

  // Save URL mappings
  const urlMappings = {};
  for (const result of results) {
    if (result.success) {
      urlMappings[result.originalPath] = result.publicUrl;
    }
  }

  const mappingPath = path.join(__dirname, '../../root-images-mapping.json');
  await fs.writeFile(
    mappingPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        uploaded,
        skipped,
        totalSize,
        urlMappings,
      },
      null,
      2
    )
  );

  console.log('\n=====================================');
  console.log('📊 Migration Summary:');
  console.log(`  ✅ Uploaded: ${uploaded} files`);
  console.log(`  ⏭️  Skipped: ${skipped} files`);
  console.log(`  📦 Total size: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
  console.log(`\n📊 Mapping saved to: ${mappingPath}`);

  console.log('\n📝 Next Steps:');
  console.log('1. Run: npm run update-root-image-urls');
  console.log('2. Delete local files: npm run cleanup-root-images');
  console.log('3. Build and verify bundle size');

  console.log('\n✅ Migration complete!');
}

main().catch((error) => {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
});
