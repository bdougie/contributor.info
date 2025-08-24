#!/usr/bin/env node

/**
 * Upload default avatar to Supabase Storage
 * This reduces bundle size by serving the fallback avatar from CDN
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get Supabase credentials from environment
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://egcxzonpmmcirmgqdrla.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseKey) {
  console.error('❌ VITE_SUPABASE_ANON_KEY or SUPABASE_SERVICE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function uploadDefaultAvatar() {
  try {
    console.log('📤 Uploading default avatar to Supabase Storage...');
    
    // Read the avatar file
    const avatarPath = path.join(__dirname, '..', 'public', 'avatar.png');
    const avatarBuffer = fs.readFileSync(avatarPath);
    
    // Use the existing 'assets' bucket which is already public
    const bucketName = 'assets';
    
    // Upload the file to public folder to match existing pattern
    const fileName = 'public/default-avatar.png';
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, avatarBuffer, {
        contentType: 'image/png',
        cacheControl: '31536000', // 1 year cache
        upsert: true // Replace if exists
      });
    
    if (error) {
      console.error('❌ Error uploading avatar:', error.message);
      return;
    }
    
    // Get the public URL
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);
    
    console.log('✅ Avatar uploaded successfully!');
    console.log('📍 Public URL:', urlData.publicUrl);
    console.log('\n💡 Update VITE_DEFAULT_AVATAR_URL in your .env file:');
    console.log(`VITE_DEFAULT_AVATAR_URL=${urlData.publicUrl}`);
    
    // Also write to a file for CI/CD
    const envContent = `# Default avatar URL from Supabase Storage
VITE_DEFAULT_AVATAR_URL=${urlData.publicUrl}
`;
    fs.writeFileSync(path.join(__dirname, '..', '.env.avatar'), envContent);
    console.log('\n📝 URL saved to .env.avatar file');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

uploadDefaultAvatar();