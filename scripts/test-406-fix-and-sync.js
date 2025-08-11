import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://egcxzonpmmcirmgqdrla.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testRepositoryMetadataQuery(owner, repo) {
  console.log(`\n🔍 Testing metadata query for ${owner}/${repo}...`);
  
  try {
    // Get repository ID
    const { data: repoData, error: repoError } = await supabase
      .from('repositories')
      .select('id, is_active, last_updated_at')
      .eq('owner', owner)
      .eq('name', repo)
      .single();

    if (repoError) {
      console.error('❌ Failed to find repository:', repoError);
      return null;
    }

    console.log('✅ Repository found:', {
      id: repoData.id,
      is_active: repoData.is_active,
      last_updated_at: repoData.last_updated_at
    });

    // Test the old query (that causes 406 error)
    console.log('\n🧪 Testing old query pattern (with .single())...');
    try {
      const { data: oldQueryData, error: oldQueryError } = await supabase
        .from('pull_requests')
        .select('created_at')
        .eq('repository_id', repoData.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      console.log('✅ Old query succeeded (has PRs):', oldQueryData);
    } catch (err) {
      console.error('❌ Old query failed (expected for repos without PRs):', err.message);
    }

    // Test the new query (fixed version)
    console.log('\n🧪 Testing new query pattern (without .single())...');
    const { data: newQueryData, error: newQueryError } = await supabase
      .from('pull_requests')
      .select('created_at')
      .eq('repository_id', repoData.id)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (newQueryError) {
      console.error('❌ New query failed:', newQueryError);
    } else {
      console.log('✅ New query succeeded:', {
        hasData: newQueryData && newQueryData.length > 0,
        latestPR: newQueryData?.[0] || 'No PRs found'
      });
    }

    return repoData.id;
  } catch (error) {
    console.error('❌ Test failed:', error);
    return null;
  }
}

async function checkSyncStatus(repositoryId) {
  console.log('\n📊 Checking sync status...');
  
  const { data: syncLogs, error } = await supabase
    .from('sync_logs')
    .select('sync_type, status, started_at, error_message')
    .eq('repository_id', repositoryId)
    .order('started_at', { ascending: false })
    .limit(5);
  
  if (error) {
    console.error('❌ Failed to fetch sync logs:', error);
    return;
  }

  if (!syncLogs || syncLogs.length === 0) {
    console.log('ℹ️ No sync logs found for this repository');
  } else {
    console.log(`📋 Recent sync logs (${syncLogs.length} found):`);
    syncLogs.forEach((log, i) => {
      console.log(`  ${i + 1}. ${log.sync_type} - ${log.status} - ${new Date(log.started_at).toLocaleString()}`);
      if (log.error_message) {
        console.log(`     Error: ${log.error_message}`);
      }
    });
  }
}

async function checkPullRequestCount(repositoryId) {
  console.log('\n📈 Checking pull request count...');
  
  const { count, error } = await supabase
    .from('pull_requests')
    .select('*', { count: 'exact', head: true })
    .eq('repository_id', repositoryId);
  
  if (error) {
    console.error('❌ Failed to count pull requests:', error);
  } else {
    console.log(`✅ Total pull requests in database: ${count || 0}`);
  }
}

async function triggerSync(owner, repo, repositoryId) {
  console.log(`\n🚀 Attempting to trigger sync for ${owner}/${repo}...`);
  
  // Import and use the manual trigger
  try {
    const { ProgressiveCaptureTrigger } = await import('../src/lib/progressive-capture/manual-trigger.ts');
    
    console.log('📊 Analyzing data gaps...');
    const gaps = await ProgressiveCaptureTrigger.analyze();
    
    if (gaps.repositoriesWithStaleData > 0) {
      console.log('🔄 Bootstrapping queue with missing data...');
      await ProgressiveCaptureTrigger.bootstrap();
      console.log('✅ Bootstrap completed! Jobs have been queued.');
    } else {
      console.log('ℹ️ No stale data detected. Repository might be up to date.');
    }
    
    // Check queue status
    const status = await ProgressiveCaptureTrigger.status();
    console.log(`📋 Queue has ${status.total.pending} pending jobs`);
    
  } catch (error) {
    console.error('❌ Failed to trigger sync:', error);
    console.log('\n💡 Alternative: You can manually trigger sync from the browser console:');
    console.log('   1. Open https://contributor.info');
    console.log('   2. Open browser console (F12)');
    console.log('   3. Run: await window.ProgressiveCaptureTrigger.analyze()');
    console.log('   4. Run: await window.ProgressiveCaptureTrigger.bootstrap()');
  }
}

// Main execution
async function main() {
  console.log('🔧 Testing 406 fix and repository sync status\n');
  console.log('═══════════════════════════════════════════\n');
  
  const repositories = [
    { owner: 'bdougie', name: 'contributor.info' },
    { owner: 'bdougie', name: 'open-sauced' },
    { owner: 'open-sauced', name: 'app' }
  ];
  
  for (const { owner, name } of repositories) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📦 Repository: ${owner}/${name}`);
    console.log('─'.repeat(60));
    
    const repoId = await testRepositoryMetadataQuery(owner, name);
    
    if (repoId) {
      await checkPullRequestCount(repoId);
      await checkSyncStatus(repoId);
      
      // Only trigger sync for bdougie/contributor.info as requested
      if (owner === 'bdougie' && name === 'contributor.info') {
        await triggerSync(owner, name, repoId);
      }
    }
  }
  
  console.log('\n\n✅ Test completed!');
  console.log('\n📝 Summary:');
  console.log('- Fixed the 406 error by removing .single() from queries that might return empty results');
  console.log('- The fix allows the app to gracefully handle repositories without pull requests');
  console.log('- Sync can be triggered through the progressive capture system');
}

main().catch(console.error);