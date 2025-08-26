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

async function fetchPRDetailsFromGitHub(owner, name, prNumber, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${name}/pulls/${prNumber}`, {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
        }
      });

      if (response.status === 429) {
        // Rate limit hit - check retry-after header
        const retryAfter = response.headers.get('retry-after') || response.headers.get('x-ratelimit-reset');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 60000; // Default to 1 minute
        console.log(`⏳ Rate limited. Waiting ${waitTime / 1000} seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return response.json();
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      
      // Exponential backoff for transient errors
      const backoffTime = Math.min(1000 * Math.pow(2, attempt), 10000);
      console.log(`⚠️ Attempt ${attempt} failed for PR #${prNumber}: ${error.message}`);
      console.log(`⏳ Retrying in ${backoffTime / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, backoffTime));
    }
  }
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
  let skipped = 0;
  const errors = { rateLimit: 0, notFound: 0, database: 0, other: 0 };
  
  // Progress reporting
  const total = corruptedPRs.length;
  const startTime = Date.now();

  for (let i = 0; i < corruptedPRs.length; i++) {
    const pr = corruptedPRs[i];
    const progress = Math.round(((i + 1) / total) * 100);
    const elapsedTime = Math.round((Date.now() - startTime) / 1000);
    try {
      console.log(`\n[${i + 1}/${total}] (${progress}%) - Processing PR #${pr.number} - Elapsed: ${elapsedTime}s`);
      
      // Fetch fresh data from GitHub
      const prData = await fetchPRDetailsFromGitHub('continuedev', 'continue', pr.number);
      
      // Check if data is actually corrupted
      if (prData.additions === 0 && prData.deletions === 0 && prData.changed_files === 0) {
        console.log(`⏭️ Skipping PR #${pr.number} - Legitimately has zero changes`);
        skipped++;
        continue;
      }
      
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
        console.error(`❌ Database update failed for PR #${pr.number}:`, updateError);
        errors.database++;
        failed++;
      } else {
        console.log(`✅ Fixed PR #${pr.number}: +${prData.additions} -${prData.deletions} (${prData.changed_files} files, ${prData.commits} commits)`);
        fixed++;
      }

      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (err) {
      // Categorize errors
      if (err.message.includes('429') || err.message.includes('Rate limit')) {
        errors.rateLimit++;
        console.error(`⏳ Rate limit error for PR #${pr.number}`);
      } else if (err.message.includes('404')) {
        errors.notFound++;
        console.error(`🔍 PR #${pr.number} not found on GitHub (may have been deleted)`);
      } else {
        errors.other++;
        console.error(`❌ Unexpected error for PR #${pr.number}: ${err.message}`);
      }
      failed++;
    }
  }

  const totalTime = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n📊 Summary (completed in ${totalTime}s):`);
  console.log(`  ✅ Fixed: ${fixed} PRs`);
  console.log(`  ⏭️ Skipped: ${skipped} PRs (legitimately zero changes)`);
  console.log(`  ❌ Failed: ${failed} PRs`);
  
  if (failed > 0) {
    console.log(`\n📈 Error breakdown:`);
    if (errors.rateLimit > 0) console.log(`  ⏳ Rate limit errors: ${errors.rateLimit}`);
    if (errors.notFound > 0) console.log(`  🔍 Not found errors: ${errors.notFound}`);
    if (errors.database > 0) console.log(`  💾 Database errors: ${errors.database}`);
    if (errors.other > 0) console.log(`  ⚠️ Other errors: ${errors.other}`);
  }
  
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