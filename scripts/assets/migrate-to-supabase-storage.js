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
  console.error('Please set it in your .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Configuration
const BUCKET_NAME = 'assets';
const PUBLIC_IMAGES_DIR = path.join(__dirname, '../../public/docs/images');
const BATCH_SIZE = 5; // Upload 5 files at a time

// Statistics
const stats = {
  totalFiles: 0,
  uploaded: 0,
  failed: 0,
  skipped: 0,
  totalSize: 0,
  errors: []
};

async function ensureBucketExists() {
  console.log(`\n🪣 Checking if bucket '${BUCKET_NAME}' exists...`);
  
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  
  if (listError) {
    console.error('❌ Failed to list buckets:', listError.message);
    return false;
  }
  
  const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);
  
  if (!bucketExists) {
    console.log(`📦 Creating public bucket '${BUCKET_NAME}'...`);
    
    const { data, error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 5242880, // 5MB max per file
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif']
    });
    
    if (error) {
      console.error('❌ Failed to create bucket:', error.message);
      return false;
    }
    
    console.log(`✅ Bucket '${BUCKET_NAME}' created successfully`);
  } else {
    console.log(`✅ Bucket '${BUCKET_NAME}' already exists`);
  }
  
  return true;
}

async function getFilesRecursively(dir, baseDir = dir) {
  const files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      files.push(...await getFilesRecursively(fullPath, baseDir));
    } else if (entry.isFile() && /\.(png|jpg|jpeg|webp|svg|gif)$/i.test(entry.name)) {
      const relativePath = path.relative(baseDir, fullPath);
      files.push({ fullPath, relativePath });
    }
  }
  
  return files;
}

async function uploadFile(file) {
  try {
    const fileBuffer = await fs.readFile(file.fullPath);
    const fileStats = await fs.stat(file.fullPath);
    
    // Determine content type
    const ext = path.extname(file.fullPath).toLowerCase();
    const contentTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.gif': 'image/gif'
    };
    const contentType = contentTypes[ext] || 'application/octet-stream';
    
    // Upload path in Supabase (preserve directory structure)
    const storagePath = `docs/images/${file.relativePath.replace(/\\/g, '/')}`;
    
    console.log(`  📤 Uploading: ${file.relativePath} (${(fileStats.size / 1024).toFixed(1)}KB)`);
    
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType,
        cacheControl: '31536000', // 1 year cache
        upsert: true // Replace if exists
      });
    
    if (error) {
      throw error;
    }
    
    stats.uploaded++;
    stats.totalSize += fileStats.size;
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);
    
    return {
      success: true,
      originalPath: file.relativePath,
      storagePath,
      publicUrl,
      size: fileStats.size
    };
  } catch (error) {
    stats.failed++;
    stats.errors.push({
      file: file.relativePath,
      error: error.message
    });
    
    console.error(`    ❌ Failed: ${error.message}`);
    return {
      success: false,
      originalPath: file.relativePath,
      error: error.message
    };
  }
}

async function uploadBatch(files) {
  const results = await Promise.all(files.map(uploadFile));
  return results;
}

async function generateMigrationReport(results) {
  const report = {
    timestamp: new Date().toISOString(),
    statistics: stats,
    urlMappings: {},
    failedUploads: []
  };
  
  for (const result of results) {
    if (result.success) {
      // Create mapping from old path to new URL
      const oldPath = `/docs/images/${result.originalPath}`;
      report.urlMappings[oldPath] = result.publicUrl;
    } else {
      report.failedUploads.push(result);
    }
  }
  
  const reportPath = path.join(__dirname, '../../supabase-storage-migration-report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`\n📊 Migration report saved to: ${reportPath}`);
  
  return report;
}

async function main() {
  console.log('🚀 Starting Supabase Storage Migration');
  console.log('=====================================\n');
  
  // Step 1: Ensure bucket exists
  const bucketReady = await ensureBucketExists();
  if (!bucketReady) {
    console.error('\n❌ Failed to prepare storage bucket');
    process.exit(1);
  }
  
  // Step 2: Get all image files
  console.log('\n📁 Scanning for images...');
  const files = await getFilesRecursively(PUBLIC_IMAGES_DIR);
  stats.totalFiles = files.length;
  
  console.log(`📊 Found ${files.length} images to upload`);
  
  if (files.length === 0) {
    console.log('\n✅ No images to migrate');
    return;
  }
  
  // Step 3: Upload files in batches
  console.log(`\n📤 Uploading images to Supabase Storage...\n`);
  
  const allResults = [];
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(files.length / BATCH_SIZE);
    
    console.log(`📦 Batch ${batchNum}/${totalBatches}:`);
    const results = await uploadBatch(batch);
    allResults.push(...results);
    
    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < files.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Step 4: Generate migration report
  const report = await generateMigrationReport(allResults);
  
  // Step 5: Print summary
  console.log('\n=====================================');
  console.log('📊 Migration Summary:');
  console.log(`  ✅ Uploaded: ${stats.uploaded} files`);
  console.log(`  ❌ Failed: ${stats.failed} files`);
  console.log(`  📦 Total size: ${(stats.totalSize / 1024 / 1024).toFixed(2)}MB`);
  
  if (stats.failed > 0) {
    console.log('\n❌ Failed uploads:');
    stats.errors.forEach(err => {
      console.log(`  - ${err.file}: ${err.error}`);
    });
  }
  
  // Step 6: Print next steps
  console.log('\n📝 Next Steps:');
  console.log('1. Run: npm run update-image-urls');
  console.log('2. Test the application locally');
  console.log('3. If everything works, run: npm run cleanup-local-images');
  console.log('4. Commit and push the changes');
  
  console.log('\n✅ Migration complete!');
}

// Run the migration
main().catch(error => {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
});