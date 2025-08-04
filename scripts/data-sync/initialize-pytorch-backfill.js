#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Supabase client with service role key for admin operations
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_TOKEN || process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function initializePytorchBackfill() {
  console.log('🐍 Initializing pytorch/pytorch backfill...\n');

  try {
    // First, get the pytorch repository information
    const { data: repository, error: repoError } = await supabase
      .from('repositories')
      .select('id, owner, name, pull_request_count')
      .eq('owner', 'pytorch')
      .eq('name', 'pytorch')
      .single();

    if (repoError || !repository) {
      console.error('❌ Failed to find pytorch/pytorch repository:', repoError?.message);
      console.log('\n💡 The repository might not be tracked yet. You may need to add it first.');
      return;
    }

    console.log(`✅ Found repository: ${repository.owner}/${repository.name}`);
    console.log(`   Repository ID: ${repository.id}`);
    console.log(`   Total PRs: ${repository.pull_request_count || 'Unknown'}`);

    // Check if there's already an active backfill
    const { data: existingBackfill, error: checkError } = await supabase
      .from('progressive_backfill_state')
      .select('*')
      .eq('repository_id', repository.id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ Error checking existing backfill:', checkError.message);
      return;
    }

    if (existingBackfill) {
      console.log(`\n⚠️  Backfill already exists for ${repository.owner}/${repository.name}:`);
      console.log(`   Status: ${existingBackfill.status}`);
      console.log(`   Progress: ${existingBackfill.processed_prs}/${existingBackfill.total_prs} PRs (${Math.round((existingBackfill.processed_prs / existingBackfill.total_prs) * 100)}%)`);
      console.log(`   Created: ${new Date(existingBackfill.created_at).toLocaleString()}`);
      console.log(`   Last processed: ${existingBackfill.last_processed_at ? new Date(existingBackfill.last_processed_at).toLocaleString() : 'Never'}`);
      
      if (existingBackfill.status === 'paused') {
        console.log('\n💡 The backfill is paused. You can resume it by updating the status to "active".');
      } else if (existingBackfill.status === 'completed') {
        console.log('\n✅ The backfill is already completed!');
      }
      
      return;
    }

    // Check current data completeness
    const { count: capturedPRs, error: countError } = await supabase
      .from('pull_requests')
      .select('*', { count: 'exact', head: true })
      .eq('repository_id', repository.id);

    if (countError) {
      console.error('❌ Error counting existing PRs:', countError.message);
      return;
    }

    const totalPRs = repository.pull_request_count || 50000; // Default to 50k if unknown
    const completeness = (capturedPRs || 0) / totalPRs;

    console.log(`\n📊 Current data status:`);
    console.log(`   Captured PRs: ${capturedPRs || 0}`);
    console.log(`   Expected PRs: ${totalPRs}`);
    console.log(`   Completeness: ${Math.round(completeness * 100)}%`);

    if (completeness >= 0.95) {
      console.log('\n✅ Repository is already >95% complete. Backfill may not be necessary.');
      console.log('   Continue anyway? (This will create a backfill for the remaining PRs)');
    }

    // Create the backfill entry
    console.log('\n🚀 Creating backfill entry...');
    
    const { data: newBackfill, error: createError } = await supabase
      .from('progressive_backfill_state')
      .insert({
        repository_id: repository.id,
        total_prs: totalPRs,
        processed_prs: capturedPRs || 0,
        status: 'active',
        chunk_size: 25, // Conservative chunk size for large repository
        metadata: {
          initial_completeness: completeness,
          initiated_by: 'manual_initialization',
          repository_name: `${repository.owner}/${repository.name}`,
          estimated_hours: Math.ceil((totalPRs - (capturedPRs || 0)) / 25 / 10), // Rough estimate
          initialization_timestamp: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Failed to create backfill:', createError.message);
      return;
    }

    console.log('\n✅ Backfill initialized successfully!');
    console.log(`   Backfill ID: ${newBackfill.id}`);
    console.log(`   Status: ${newBackfill.status}`);
    console.log(`   PRs to process: ${totalPRs - (capturedPRs || 0)}`);
    console.log(`   Chunk size: ${newBackfill.chunk_size} PRs per chunk`);
    console.log(`   Estimated time: ~${Math.ceil((totalPRs - (capturedPRs || 0)) / 25 / 10)} hours`);

    console.log('\n📋 Next steps:');
    console.log('   1. The GitHub Actions workflow will automatically pick up this backfill');
    console.log('   2. Monitor progress using the backfill_progress_summary view');
    console.log('   3. Check GitHub Actions logs for processing details');
    console.log('   4. The workflow runs every 30 minutes and processes up to 250 PRs per run');

    // Show how to monitor
    console.log('\n🔍 To monitor progress, run this SQL query:');
    console.log(`
SELECT 
  owner,
  name,
  status,
  total_prs,
  processed_prs,
  progress_percentage,
  last_processed_at,
  error_count
FROM backfill_progress_summary
WHERE owner = 'pytorch' AND name = 'pytorch';
`);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run the initialization
initializePytorchBackfill()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });