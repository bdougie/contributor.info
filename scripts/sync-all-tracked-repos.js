import { createClient } from '@supabase/supabase-js';
import { Inngest } from 'inngest';
import { config } from 'dotenv';
config();

// Initialize clients
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://egcxzonpmmcirmgqdrla.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_TOKEN || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const inngest = new Inngest({ 
  id: 'sync-all-repos',
  eventKey: process.env.INNGEST_EVENT_KEY || process.env.VITE_INNGEST_EVENT_KEY
});

async function getAllTrackedRepos() {
  console.log('📊 Fetching all tracked repositories...\n');
  
  const { data: trackedRepos, error } = await supabase
    .from('tracked_repositories')
    .select(`
      repository_id,
      tracking_enabled,
      last_sync_at,
      repositories!inner(
        id,
        owner,
        name,
        is_active,
        last_updated_at
      )
    `)
    .eq('tracking_enabled', true)
    .eq('repositories.is_active', true);

  if (error) {
    console.error('❌ Failed to fetch tracked repositories:', error);
    return [];
  }

  return trackedRepos || [];
}

async function triggerSyncForRepository(repo) {
  const { owner, name, id } = repo.repositories;
  const fullName = `${owner}/${name}`;
  
  console.log(`\n🔄 Triggering sync for ${fullName}...`);
  
  try {
    // Send multiple sync events to ensure coverage
    const events = [
      {
        name: 'capture/repository.sync',
        data: {
          repositoryId: id,
          repositoryFullName: fullName,
          source: 'bulk-sync',
          syncMode: 'enhanced'
        }
      },
      {
        name: 'progressive-capture/sync.repository',
        data: {
          repositoryId: id,
          repositoryName: fullName,
          mode: 'recent',
          source: 'bulk-sync'
        }
      },
      {
        name: 'capture/repository.sync.graphql',
        data: {
          repositoryId: id,
          repositoryFullName: fullName,
          days: 30,
          source: 'bulk-sync'
        }
      }
    ];

    const results = [];
    for (const event of events) {
      try {
        const result = await inngest.send(event);
        results.push({ event: event.name, status: 'sent', id: result.ids[0] });
      } catch (err) {
        results.push({ event: event.name, status: 'failed', error: err.message });
      }
    }
    
    // Also create a queue job directly as fallback
    const { error: queueError } = await supabase
      .from('progressive_capture_queue')
      .insert({
        repository_id: id,
        repository_name: fullName,
        job_type: 'capture-repository-enhanced',
        priority: 100,
        status: 'pending',
        metadata: {
          source: 'bulk-sync-all',
          sync_mode: 'enhanced',
          triggered_at: new Date().toISOString()
        }
      });

    if (queueError) {
      console.warn('⚠️ Failed to create queue job:', queueError.message);
    }

    console.log(`✅ Sync triggered for ${fullName}`);
    return { repository: fullName, status: 'triggered', events: results };
    
  } catch (error) {
    console.error(`❌ Failed to trigger sync for ${fullName}:`, error);
    return { repository: fullName, status: 'failed', error: error.message };
  }
}

async function syncAllRepos(options = {}) {
  const { batchSize = 5, delayMs = 3000 } = options;
  
  console.log('🚀 Starting sync for all tracked repositories\n');
  console.log(`⚙️ Settings:`);
  console.log(`   - Batch size: ${batchSize}`);
  console.log(`   - Delay between batches: ${delayMs}ms`);
  console.log('');
  
  const repos = await getAllTrackedRepos();
  
  if (repos.length === 0) {
    console.log('❌ No tracked repositories found');
    return;
  }
  
  console.log(`📦 Found ${repos.length} active tracked repositories\n`);
  
  // Sort by last sync time (never synced first)
  repos.sort((a, b) => {
    if (!a.last_sync_at && !b.last_sync_at) return 0;
    if (!a.last_sync_at) return -1;
    if (!b.last_sync_at) return 1;
    return new Date(a.last_sync_at) - new Date(b.last_sync_at);
  });
  
  const results = [];
  
  // Process in batches
  for (let i = 0; i < repos.length; i += batchSize) {
    const batch = repos.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(repos.length / batchSize);
    
    console.log(`\n📋 Processing batch ${batchNum}/${totalBatches}`);
    console.log('─'.repeat(50));
    
    // Process batch in parallel
    const batchPromises = batch.map(repo => triggerSyncForRepository(repo));
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Delay between batches (except for last batch)
    if (i + batchSize < repos.length) {
      console.log(`\n⏳ Waiting ${delayMs / 1000}s before next batch...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  // Summary
  const successful = results.filter(r => r.status === 'triggered').length;
  const failed = results.filter(r => r.status === 'failed').length;
  
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 Sync Summary');
  console.log('='.repeat(60));
  console.log(`✅ Successfully triggered: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📋 Total: ${results.length}`);
  
  if (failed > 0) {
    console.log('\n❌ Failed repositories:');
    results
      .filter(r => r.status === 'failed')
      .forEach(r => console.log(`   - ${r.repository}: ${r.error}`));
  }
  
  // Create a summary log
  await supabase
    .from('sync_logs')
    .insert({
      sync_type: 'bulk-sync-all',
      status: 'completed',
      started_at: new Date(Date.now() - (results.length * 1000)).toISOString(),
      completed_at: new Date().toISOString(),
      records_processed: results.length,
      records_inserted: successful,
      records_failed: failed,
      metadata: {
        source: 'manual-bulk-sync',
        repositories_synced: results.map(r => r.repository),
        batch_size: batchSize,
        delay_ms: delayMs
      }
    });
  
  console.log('\n✅ Bulk sync completed!');
  console.log('\n💡 Next steps:');
  console.log('   1. Monitor the Inngest dashboard for job progress');
  console.log('   2. Check GitHub Actions for bulk processing jobs');
  console.log('   3. Visit https://contributor.info to see updated data');
}

// Parse command line arguments
async function main() {
  const args = process.argv.slice(2);
  const options = {};
  
  // Parse options
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    
    switch (key) {
      case '--batch-size':
        options.batchSize = parseInt(value) || 5;
        break;
      case '--delay':
        options.delayMs = parseInt(value) || 3000;
        break;
      case '--help':
        console.log(`
Usage: node scripts/sync-all-tracked-repos.js [options]

Options:
  --batch-size <number>  Number of repos to sync in parallel (default: 5)
  --delay <ms>          Delay between batches in milliseconds (default: 3000)
  --help               Show this help message

Example:
  node scripts/sync-all-tracked-repos.js --batch-size 10 --delay 5000
        `);
        process.exit(0);
    }
  }
  
  await syncAllRepos(options);
}

main().catch(console.error);