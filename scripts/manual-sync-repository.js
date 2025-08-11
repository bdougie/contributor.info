import { createClient } from '@supabase/supabase-js';
import { Inngest } from 'inngest';
import { config } from 'dotenv';
config();

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://egcxzonpmmcirmgqdrla.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Inngest client
const inngest = new Inngest({ 
  id: 'manual-sync',
  eventKey: process.env.INNGEST_EVENT_KEY || process.env.VITE_INNGEST_EVENT_KEY
});

async function syncRepository(owner, repo) {
  console.log(`\n🔄 Starting sync for ${owner}/${repo}...`);
  
  try {
    // 1. Get repository details
    const { data: repoData, error: repoError } = await supabase
      .from('repositories')
      .select('id, is_active, last_updated_at')
      .eq('owner', owner)
      .eq('name', repo)
      .single();

    if (repoError || !repoData) {
      console.error('❌ Repository not found in database:', repoError);
      return;
    }

    console.log('✅ Repository found:', {
      id: repoData.id,
      is_active: repoData.is_active,
      last_updated_at: repoData.last_updated_at
    });

    // 2. Send sync event to Inngest
    console.log('\n📤 Sending sync event to Inngest...');
    
    try {
      // Try to send events to trigger sync
      const events = [
        {
          name: 'capture/repository.sync',
          data: {
            repositoryId: repoData.id,
            repositoryFullName: `${owner}/${repo}`,
            source: 'manual',
            syncMode: 'enhanced'
          }
        },
        {
          name: 'progressive-capture/sync.repository',
          data: {
            repositoryId: repoData.id,
            repositoryName: `${owner}/${repo}`,
            mode: 'recent',
            source: 'manual'
          }
        }
      ];

      for (const event of events) {
        console.log(`📨 Sending event: ${event.name}`);
        const result = await inngest.send(event);
        console.log(`✅ Event sent successfully:`, result);
      }
      
    } catch (inngestError) {
      console.error('⚠️ Could not send Inngest events:', inngestError.message);
      console.log('\n💡 Alternative approach: Direct database job creation...');
      
      // Alternative: Create job directly in queue
      const { data: jobData, error: jobError } = await supabase
        .from('progressive_capture_queue')
        .insert({
          repository_id: repoData.id,
          repository_name: `${owner}/${repo}`,
          job_type: 'capture-repository-enhanced',
          priority: 100,
          status: 'pending',
          metadata: {
            source: 'manual-sync',
            sync_mode: 'enhanced'
          }
        })
        .select()
        .single();

      if (jobError) {
        console.error('❌ Failed to create queue job:', jobError);
      } else {
        console.log('✅ Queue job created:', jobData);
      }
    }

    // 3. Check if sync started
    console.log('\n⏳ Waiting for sync to start...');
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    
    const { data: newLogs, error: logError } = await supabase
      .from('sync_logs')
      .select('sync_type, status, started_at')
      .eq('repository_id', repoData.id)
      .order('started_at', { ascending: false })
      .limit(1);

    if (!logError && newLogs && newLogs.length > 0) {
      console.log('✅ Sync started:', newLogs[0]);
    } else {
      console.log('⚠️ No new sync logs found yet. Sync might be queued or rate-limited.');
    }

    // 4. Show manual browser instructions
    console.log('\n📝 Manual sync instructions:');
    console.log('If the automatic sync doesn\'t start, you can trigger it manually:');
    console.log('\n1. Open https://contributor.info in your browser');
    console.log(`2. Navigate to /${owner}/${repo}`);
    console.log('3. The app will automatically detect missing data and start syncing');
    console.log('4. Check the browser console for sync progress');
    
  } catch (error) {
    console.error('❌ Sync failed:', error);
  }
}

async function checkAllTrackedRepos() {
  console.log('\n📊 Checking all tracked repositories...\n');
  
  const { data: trackedRepos, error } = await supabase
    .from('tracked_repositories')
    .select(`
      repository_id,
      tracking_enabled,
      last_sync_at,
      repositories!inner(
        owner,
        name,
        is_active,
        last_updated_at
      )
    `)
    .eq('tracking_enabled', true)
    .order('last_sync_at', { ascending: true, nullsFirst: true })
    .limit(10);

  if (error) {
    console.error('❌ Failed to fetch tracked repositories:', error);
    return;
  }

  console.log(`Found ${trackedRepos?.length || 0} tracked repositories:\n`);
  
  trackedRepos?.forEach((tracked, index) => {
    const repo = tracked.repositories;
    const lastSync = tracked.last_sync_at ? new Date(tracked.last_sync_at).toLocaleString() : 'Never';
    const lastUpdate = repo.last_updated_at ? new Date(repo.last_updated_at).toLocaleString() : 'Never';
    
    console.log(`${index + 1}. ${repo.owner}/${repo.name}`);
    console.log(`   - Active: ${repo.is_active ? '✅' : '❌'}`);
    console.log(`   - Last sync: ${lastSync}`);
    console.log(`   - Last update: ${lastUpdate}`);
    console.log('');
  });
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('📋 Usage: node scripts/manual-sync-repository.js <owner> <repo>');
    console.log('Example: node scripts/manual-sync-repository.js bdougie contributor.info');
    console.log('\nOr use --list to see all tracked repositories');
    return;
  }

  if (args[0] === '--list') {
    await checkAllTrackedRepos();
    return;
  }

  const [owner, repo] = args;
  if (!owner || !repo) {
    console.error('❌ Please provide both owner and repository name');
    return;
  }

  await syncRepository(owner, repo);
}

main().catch(console.error);