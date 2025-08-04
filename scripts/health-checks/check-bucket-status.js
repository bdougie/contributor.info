import { createClient } from '@supabase/supabase-js';

// Use the hardcoded URL and try with available keys
const supabaseUrl = 'https://egcxzonpmmcirmgqdrla.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_TOKEN;

console.log('🔍 Checking social-cards bucket status...\n');
console.log(`Supabase URL: ${supabaseUrl}`);
console.log(`Anon key available: ${supabaseAnonKey ? 'Yes' : 'No'}`);
console.log(`Service key available: ${supabaseServiceKey ? 'Yes' : 'No'}`);

if (supabaseServiceKey) {
  console.log(`Service key preview: ${supabaseServiceKey.substring(0, 10)}...`);
}

// Try to create client - prefer service key for storage operations
const keyToUse = supabaseServiceKey || supabaseAnonKey;
if (!keyToUse) {
  console.log('\n❌ No Supabase keys found in environment');
  console.log('Please check your .env file for SUPABASE_TOKEN or VITE_SUPABASE_ANON_KEY\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, keyToUse);
console.log(`Using ${supabaseServiceKey ? 'service' : 'anon'} key for connection\n`);

async function checkBucketStatus() {
  try {
    console.log('📂 Checking if social-cards bucket exists...');
    
    // Try to list buckets (might fail with anon key)
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.log(`❌ Error listing buckets: ${listError.message}`);
      console.log('This is expected with anon key - service role key needed for bucket management\n');
    } else {
      console.log(`✅ Found ${buckets.length} buckets:`);
      buckets.forEach(bucket => {
        console.log(`  • ${bucket.id} (public: ${bucket.public})`);
      });
      
      const socialCardsBucket = buckets.find(b => b.id === 'social-cards');
      if (socialCardsBucket) {
        console.log(`\n✅ social-cards bucket exists and is ${socialCardsBucket.public ? 'public' : 'private'}`);
      } else {
        console.log('\n❌ social-cards bucket not found');
      }
    }
    
    // Try to list files in social-cards bucket (this might work with public bucket)
    console.log('\n📁 Checking bucket contents...');
    const { data: files, error: filesError } = await supabase.storage
      .from('social-cards')
      .list('', { limit: 10 });
      
    if (filesError) {
      console.log(`❌ Error listing files: ${filesError.message}`);
      if (filesError.message.includes('not found')) {
        console.log('🔧 This suggests the social-cards bucket doesn\'t exist yet');
      }
    } else {
      console.log(`✅ Bucket accessible! Found ${files.length} files:`);
      files.forEach(file => {
        const size = file.metadata?.size ? `(${Math.round(file.metadata.size/1024)}KB)` : '';
        console.log(`  • ${file.name} ${size}`);
      });
      
      if (files.length === 0) {
        console.log('📝 Bucket exists but is empty - no social cards generated yet');
      }
    }
    
    // Test public URL generation
    console.log('\n🌐 Testing public URL generation...');
    const { data: { publicUrl } } = supabase.storage
      .from('social-cards')
      .getPublicUrl('test-file.png');
      
    console.log(`Public URL pattern: ${publicUrl}`);
    console.log('This is what social card URLs will look like');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

// Test the connection
async function testConnection() {
  try {
    // Try a simple query to test basic connectivity
    const { data, error } = await supabase.from('contributors').select('count').limit(1);
    
    if (error) {
      console.log(`🔌 Connection test failed: ${error.message}`);
    } else {
      console.log('✅ Basic Supabase connection working');
    }
  } catch (error) {
    console.log(`🔌 Connection error: ${error.message}`);
  }
}

async function main() {
  await testConnection();
  await checkBucketStatus();
  
  console.log('\n💡 Next steps:');
  console.log('1. Set SUPABASE_TOKEN environment variable (service role key)');
  console.log('2. Run "npm run setup-storage" to create the bucket');
  console.log('3. Run "npm run generate-social-cards" to populate it');
  console.log('4. The bucket should then appear in your Supabase dashboard');
}

main().catch(console.error);