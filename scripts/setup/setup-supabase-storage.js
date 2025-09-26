import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://egcxzonpmmcirmgqdrla.supabase.co';
const supabaseKey = process.env.SUPABASE_TOKEN;

if (!supabaseKey) {
  console.error('Error: SUPABASE_TOKEN environment variable is required');
  console.log('This should be the service role key, not the anon key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupStorage() {
  console.log('Setting up Supabase storage for social cards...');

  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      console.error('Error listing buckets:', listError);
      return;
    }

    const socialCardsBucket = buckets.find((bucket) => bucket.id === 'social-cards');

    if (!socialCardsBucket) {
      console.log('Creating social-cards bucket...');

      const { data, error } = await supabase.storage.createBucket('social-cards', {
        public: true,
        allowedMimeTypes: ['image/png', 'image/jpeg'],
        fileSizeLimit: 5242880, // 5MB limit
      });

      if (error) {
        console.error('Error creating bucket:', error);
        return;
      }

      console.log('Bucket created successfully:', data);
    } else {
      console.log('social-cards bucket already exists');

      // Update bucket to ensure it's public
      const { error: updateError } = await supabase.storage.updateBucket('social-cards', {
        public: true,
        allowedMimeTypes: ['image/png', 'image/jpeg'],
        fileSizeLimit: 5242880,
      });

      if (updateError) {
        console.log(
          'Note: Could not update bucket settings (may require dashboard access):',
          updateError.message
        );
      } else {
        console.log('Bucket settings updated');
      }
    }

    // Test upload permissions
    console.log('Testing upload permissions...');
    const testFileName = 'test-upload.png';
    const testData = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG header

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('social-cards')
      .upload(testFileName, testData, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      console.error('Error testing upload:', uploadError);
      return;
    }

    console.log('Upload test successful');

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from('social-cards').getPublicUrl(testFileName);

    console.log('Public URL test:', publicUrl);

    // Clean up test file
    const { error: deleteError } = await supabase.storage
      .from('social-cards')
      .remove([testFileName]);

    if (deleteError) {
      console.log('Note: Could not clean up test file:', deleteError.message);
    }

    console.log('✅ Storage setup complete!');
    console.log('\nNext steps:');
    console.log('1. Ensure your SUPABASE_TOKEN environment variable is set for builds');
    console.log('2. The bucket is public - social cards will be accessible via CDN');
    console.log('3. Run the build process to generate and upload social cards');
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the setup
setupStorage();
