import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

// Initialize Supabase client with service key for admin access
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://egcxzonpmmcirmgqdrla.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_TOKEN || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// GitHub token for API access
const githubToken = process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN;

async function fetchGitHubPRs(owner, repo) {
  console.log(`\n🔍 Fetching PRs from GitHub for ${owner}/${repo}...`);
  
  const headers = {
    'Accept': 'application/vnd.github.v3+json'
  };
  
  if (githubToken) {
    headers['Authorization'] = `token ${githubToken}`;
  }
  
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=10&sort=created&direction=desc`, {
      headers
    });
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }
    
    const prs = await response.json();
    console.log(`✅ Found ${prs.length} pull requests`);
    return prs;
  } catch (error) {
    console.error('❌ Failed to fetch PRs from GitHub:', error);
    return [];
  }
}

async function ensureContributor(githubUser) {
  // Check if contributor exists
  const { data: existing } = await supabase
    .from('contributors')
    .select('id')
    .eq('github_id', githubUser.id)
    .single();
  
  if (existing) {
    return existing.id;
  }
  
  // Create new contributor
  const { data: newContributor, error } = await supabase
    .from('contributors')
    .insert({
      github_id: githubUser.id,
      username: githubUser.login,
      avatar_url: githubUser.avatar_url,
      html_url: githubUser.html_url,
      type: githubUser.type,
      is_bot: githubUser.type === 'Bot'
    })
    .select('id')
    .single();
  
  if (error) {
    console.error('Failed to create contributor:', error);
    return null;
  }
  
  return newContributor.id;
}

async function syncPullRequests(repositoryId, owner, repo) {
  const prs = await fetchGitHubPRs(owner, repo);
  
  if (prs.length === 0) {
    console.log('⚠️ No pull requests found to sync');
    return;
  }
  
  console.log('\n📥 Syncing pull requests to database...');
  let synced = 0;
  let failed = 0;
  
  for (const pr of prs) {
    try {
      // Ensure author exists
      const authorId = await ensureContributor(pr.user);
      if (!authorId) {
        console.error(`❌ Failed to create contributor for PR #${pr.number}`);
        failed++;
        continue;
      }
      
      // Upsert pull request
      const { error } = await supabase
        .from('pull_requests')
        .upsert({
          github_id: pr.id,
          repository_id: repositoryId,
          number: pr.number,
          title: pr.title,
          body: pr.body,
          state: pr.state,
          author_id: authorId,
          created_at: pr.created_at,
          updated_at: pr.updated_at,
          closed_at: pr.closed_at,
          merged_at: pr.merged_at,
          merged: pr.merged || false,
          base_branch: pr.base?.ref,
          head_branch: pr.head?.ref,
          html_url: pr.html_url,
          additions: pr.additions || 0,
          deletions: pr.deletions || 0,
          changed_files: pr.changed_files || 0,
          commits: pr.commits || 0
        }, {
          onConflict: 'github_id'
        });
      
      if (error) {
        console.error(`❌ Failed to sync PR #${pr.number}:`, error);
        failed++;
      } else {
        console.log(`✅ Synced PR #${pr.number}: ${pr.title.substring(0, 50)}...`);
        synced++;
      }
    } catch (error) {
      console.error(`❌ Error syncing PR #${pr.number}:`, error);
      failed++;
    }
  }
  
  // Update repository last_updated_at
  await supabase
    .from('repositories')
    .update({ last_updated_at: new Date().toISOString() })
    .eq('id', repositoryId);
  
  // Create sync log
  await supabase
    .from('sync_logs')
    .insert({
      sync_type: 'manual-pr-sync',
      repository_id: repositoryId,
      status: 'completed',
      started_at: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
      completed_at: new Date().toISOString(),
      records_processed: prs.length,
      records_inserted: synced,
      records_failed: failed,
      metadata: {
        source: 'manual-script',
        pr_count: prs.length
      }
    });
  
  console.log(`\n📊 Sync Summary:`);
  console.log(`   ✅ Synced: ${synced}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📋 Total: ${prs.length}`);
}

async function main() {
  console.log('🔄 Starting manual sync for bdougie repositories\n');
  
  // List of repositories to sync
  const repositories = [
    { owner: 'bdougie', name: 'contributor.info' },
    { owner: 'bdougie', name: 'open-sauced' }
  ];
  
  for (const { owner, name } of repositories) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📦 Syncing ${owner}/${name}`);
    console.log('='.repeat(60));
    
    // Get repository from database
    const { data: repo, error } = await supabase
      .from('repositories')
      .select('id')
      .eq('owner', owner)
      .eq('name', name)
      .single();
    
    if (error || !repo) {
      console.error(`❌ Repository ${owner}/${name} not found in database`);
      continue;
    }
    
    await syncPullRequests(repo.id, owner, name);
  }
  
  console.log('\n\n✅ Manual sync completed!');
}

main().catch(console.error);