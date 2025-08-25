#!/usr/bin/env node

/**
 * Test script for workspace issues sync
 * Usage: node scripts/test-workspace-issues-sync.js [--workspace-id=<id>] [--hours-back=<hours>] [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  workspaceId: null,
  hoursBack: 24,
  limit: 5,
  dryRun: false
};

args.forEach(arg => {
  if (arg.startsWith('--workspace-id=')) {
    options.workspaceId = arg.split('=')[1];
  } else if (arg.startsWith('--hours-back=')) {
    options.hoursBack = parseInt(arg.split('=')[1]);
  } else if (arg.startsWith('--limit=')) {
    options.limit = parseInt(arg.split('=')[1]);
  } else if (arg === '--dry-run') {
    options.dryRun = true;
  }
});

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testWorkspaceIssuesSync() {
  console.log('🚀 Testing Workspace Issues Sync');
  console.log('Options:', options);
  console.log('');

  try {
    // First, let's check what workspaces exist
    if (!options.workspaceId) {
      console.log('📊 Available workspaces:');
      const { data: workspaces, error: wsError } = await supabase
        .from('workspaces')
        .select('id, name, tier, current_repository_count')
        .eq('is_active', true);

      if (wsError) {
        console.error('Error fetching workspaces:', wsError);
        return;
      }

      if (workspaces && workspaces.length > 0) {
        workspaces.forEach(ws => {
          console.log(`  - ${ws.name} (${ws.id})`);
          console.log(`    Tier: ${ws.tier}, Repos: ${ws.current_repository_count}`);
        });
        console.log('');
        console.log('Tip: Use --workspace-id=<id> to sync a specific workspace');
        console.log('');
      } else {
        console.log('No active workspaces found');
        return;
      }
    }

    // Get workspace repositories that need sync
    let query = supabase
      .from('workspace_tracked_repositories')
      .select(`
        workspace_id,
        tracked_repository_id,
        priority_score,
        last_sync_at,
        next_sync_at,
        fetch_issues,
        workspaces!inner(
          name,
          tier
        ),
        tracked_repositories!inner(
          repository_id,
          repositories!inner(
            id,
            full_name,
            owner,
            name,
            has_issues
          )
        )
      `)
      .eq('is_active', true)
      .eq('fetch_issues', true)
      .order('priority_score', { ascending: false })
      .limit(options.limit);

    if (options.workspaceId) {
      query = query.eq('workspace_id', options.workspaceId);
    }

    const { data: workspaceRepos, error: reposError } = await query;

    if (reposError) {
      console.error('❌ Error fetching workspace repositories:', reposError);
      return;
    }

    if (!workspaceRepos || workspaceRepos.length === 0) {
      console.log('ℹ️ No repositories need issues sync');
      return;
    }

    console.log(`📦 Found ${workspaceRepos.length} repositories to check:\n`);

    // Display repositories that would be synced
    for (const repo of workspaceRepos) {
      const repository = repo.tracked_repositories?.repositories;
      if (!repository) continue;

      const workspace = repo.workspaces;
      console.log(`Repository: ${repository.full_name}`);
      console.log(`  Workspace: ${workspace?.name} (${workspace?.tier})`);
      console.log(`  Priority Score: ${repo.priority_score}`);
      console.log(`  Last Sync: ${repo.last_sync_at || 'Never'}`);
      console.log(`  Next Sync: ${repo.next_sync_at || 'Not scheduled'}`);
      console.log(`  Has Issues: ${repository.has_issues ? 'Yes' : 'No'}`);
      console.log('');
    }

    if (options.dryRun) {
      console.log('🔍 DRY RUN MODE - Not actually syncing issues');
      console.log('Remove --dry-run flag to perform actual sync');
    } else {
      console.log('⚠️  To actually sync issues, you need to:');
      console.log('1. Deploy the Supabase Edge Function: supabase functions deploy workspace-issues-sync');
      console.log('2. Run the GitHub Action: gh workflow run capture-workspace-issues.yml');
      console.log('   Or call the edge function directly with curl');
    }

    // Calculate time window (use setTime to avoid DST issues)
    const sinceDate = new Date();
    sinceDate.setTime(sinceDate.getTime() - (options.hoursBack * 60 * 60 * 1000));
    console.log(`\n📅 Would fetch issues since: ${sinceDate.toISOString()}`);

    // If not dry run and specific workspace, show sample API call
    if (!options.dryRun && options.workspaceId) {
      const sampleRepo = workspaceRepos[0]?.tracked_repositories?.repositories;
      if (sampleRepo) {
        console.log('\n📝 Sample GitHub API call that would be made:');
        console.log(`GET https://api.github.com/repos/${sampleRepo.owner}/${sampleRepo.name}/issues`);
        console.log(`  ?state=all&since=${sinceDate.toISOString()}&per_page=100&sort=updated`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the test
testWorkspaceIssuesSync().then(() => {
  console.log('\n✅ Test completed');
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});