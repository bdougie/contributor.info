#!/usr/bin/env node

/**
 * Debug script to understand why PR #310 didn't get a reviewer recommendation comment
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://egcxzonpmmcirmgqdrla.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_TOKEN;

if (!supabaseKey) {
  console.error('Missing VITE_SUPABASE_ANON_KEY or SUPABASE_TOKEN');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugWebhookIssue() {
  console.log('🔍 Debugging why PR #310 didn\'t get a reviewer recommendation comment\n');
  
  // 1. Check if the repository is tracked
  const repositoryGithubId = 967062465; // from the webhook payload
  
  console.log('1. Checking if repository is tracked in database...');
  const { data: repo, error: repoError } = await supabase
    .from('repositories')
    .select('*')
    .eq('github_id', repositoryGithubId)
    .single();
  
  if (repoError || !repo) {
    console.log('❌ Repository not found in database!');
    console.log('   This is likely why the webhook didn\'t post a comment.');
    console.log('   The webhook handler returns early if the repository isn\'t tracked.');
    
    // Check if any bdougie repos are tracked
    console.log('\n2. Checking what repositories are tracked for bdougie...');
    const { data: bdougieRepos } = await supabase
      .from('repositories')
      .select('*')
      .eq('owner', 'bdougie');
    
    if (bdougieRepos && bdougieRepos.length > 0) {
      console.log(`   Found ${bdougieRepos.length} bdougie repositories:`);
      bdougieRepos.forEach(r => {
        console.log(`   - ${r.owner}/${r.name} (github_id: ${r.github_id})`);
      });
    } else {
      console.log('   No bdougie repositories found in database');
    }
    
    return;
  }
  
  console.log('✅ Repository found:', repo.owner + '/' + repo.name);
  console.log('   Internal ID:', repo.id);
  
  // 2. Check if there are any issues for this repository
  console.log('\n2. Checking for issues in this repository...');
  const { data: issues, error: issuesError } = await supabase
    .from('issues')
    .select('*')
    .eq('repository_id', repo.id)
    .limit(10);
  
  if (issuesError || !issues || issues.length === 0) {
    console.log('❌ No issues found for this repository!');
    console.log('   This explains why findSimilarIssues returned empty.');
    console.log('   The webhook only posts comments when similar issues are found.');
  } else {
    console.log(`✅ Found ${issues.length} issues`);
    issues.forEach(issue => {
      console.log(`   - #${issue.number}: ${issue.title}`);
    });
  }
  
  // 3. Check PR insights to see if anything was stored
  console.log('\n3. Checking if PR insights were stored...');
  const prGithubId = 2726194102; // from the webhook payload
  
  const { data: insights, error: insightsError } = await supabase
    .from('pr_insights')
    .select('*')
    .eq('github_pr_id', prGithubId);
  
  if (insights && insights.length > 0) {
    console.log(`✅ Found ${insights.length} PR insights records`);
    insights.forEach(insight => {
      console.log(`   - Comment posted: ${insight.comment_posted}`);
      console.log(`   - Comment type: ${insight.comment_type || 'full'}`);
      console.log(`   - Similar issues: ${insight.similar_issues?.length || 0}`);
    });
  } else {
    console.log('❌ No PR insights found');
    console.log('   This confirms the webhook didn\'t process the PR fully.');
  }
  
  // 4. Check installation settings
  console.log('\n4. Checking GitHub App installation settings...');
  const installationId = 75772461; // from the webhook payload
  
  const { data: settings } = await supabase
    .from('github_app_installation_settings')
    .select('*')
    .eq('installation_id', installationId)
    .single();
  
  if (settings) {
    console.log('✅ Installation settings found:');
    console.log(`   - Comment on PRs: ${settings.comment_on_prs}`);
    console.log(`   - Excluded repos: ${settings.excluded_repos?.join(', ') || 'none'}`);
    console.log(`   - Excluded users: ${settings.excluded_users?.join(', ') || 'none'}`);
  } else {
    console.log('⚠️  No installation settings found (uses defaults)');
  }
  
  // Summary
  console.log('\n📝 Summary:');
  console.log('The webhook likely didn\'t post a comment because:');
  if (!repo) {
    console.log('1. The repository isn\'t tracked in the database');
    console.log('   Solution: Add bdougie/contributor.info to tracked repositories');
  } else if (!issues || issues.length === 0) {
    console.log('1. No issues exist in the database for similarity matching');
    console.log('   Solution: Sync issues for this repository first');
  }
  console.log('2. The webhook only posts comments when similar issues are found');
  console.log('   Solution: Consider posting reviewer suggestions even without similar issues');
}

debugWebhookIssue().catch(console.error);