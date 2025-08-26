#!/usr/bin/env node

/**
 * Script to fix corrupted PR data for continuedev/continue repository
 * This will trigger a fresh sync to get proper additions/deletions/commits data
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://egcxzonpmmcirmgqdrla.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const GITHUB_TOKEN = process.env.VITE_GITHUB_TOKEN;

if (!SUPABASE_ANON_KEY) {
  console.error('❌ Missing VITE_SUPABASE_ANON_KEY environment variable');
  process.exit(1);
}

if (!GITHUB_TOKEN) {
  console.error('❌ Missing VITE_GITHUB_TOKEN environment variable');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fetchPRDetailsFromGitHub(owner, name, prNumber) {
  const response = await fetch(`https://api.github.com/repos/${owner}/${name}/pulls/${prNumber}`, {
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function fixCorruptedPRs() {
  console.log('🔍 Finding corrupted PRs for continuedev/continue...');
  
  // Find all PRs with zero values
  const { data: corruptedPRs, error } = await supabase
    .from('pull_requests')
    .select('id, github_id, number')
    .eq('repository_id', '98b0e461-ea5c-4916-99c0-402fbff5950a') // continuedev/continue
    .eq('additions', 0)
    .eq('deletions', 0)
    .eq('changed_files', 0)
    .eq('commits', 0)
    .order('created_at', { ascending: false })
    .limit(100); // Fix up to 100 PRs at once

  if (error) {
    console.error('❌ Error fetching corrupted PRs:', error);
    return;
  }

  console.log(`Found ${corruptedPRs.length} corrupted PRs to fix`);

  let fixed = 0;
  let failed = 0;

  for (const pr of corruptedPRs) {
    try {
      console.log(`Fixing PR #${pr.number}...`);
      
      // Fetch fresh data from GitHub
      const prData = await fetchPRDetailsFromGitHub('continuedev', 'continue', pr.number);
      
      // Update the PR with correct data
      const { error: updateError } = await supabase
        .from('pull_requests')
        .update({
          additions: prData.additions || 0,
          deletions: prData.deletions || 0,
          changed_files: prData.changed_files || 0,
          commits: prData.commits || 0,
          title: prData.title,
          body: prData.body,
          state: prData.state.toLowerCase(),
          merged: prData.merged || false,
          merged_at: prData.merged_at,
          base_branch: prData.base?.ref || 'main',
          head_branch: prData.head?.ref || 'unknown',
          html_url: prData.html_url,
        })
        .eq('id', pr.id);

      if (updateError) {
        console.error(`❌ Failed to update PR #${pr.number}:`, updateError);
        failed++;
      } else {
        console.log(`✅ Fixed PR #${pr.number}: +${prData.additions} -${prData.deletions} (${prData.changed_files} files, ${prData.commits} commits)`);
        fixed++;
      }

      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (err) {
      console.error(`❌ Error fixing PR #${pr.number}:`, err.message);
      failed++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`  ✅ Fixed: ${fixed} PRs`);
  console.log(`  ❌ Failed: ${failed} PRs`);
  
  // Verify the fix
  const { data: checkPR } = await supabase
    .from('pull_requests')
    .select('number, additions, deletions, changed_files, commits')
    .eq('number', 7273)
    .eq('repository_id', '98b0e461-ea5c-4916-99c0-402fbff5950a')
    .single();
    
  if (checkPR) {
    console.log(`\n🔍 PR #7273 status: +${checkPR.additions} -${checkPR.deletions} (${checkPR.changed_files} files, ${checkPR.commits} commits)`);
  }
}

// Run the fix
fixCorruptedPRs().catch(console.error);