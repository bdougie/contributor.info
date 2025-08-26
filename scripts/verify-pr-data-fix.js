#!/usr/bin/env node

/**
 * Simple verification script for PR data corruption fix
 * This is NOT a test - just a verification tool
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://egcxzonpmmcirmgqdrla.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  console.error('❌ Missing VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verifyFix() {
  console.log('🔍 Verifying PR data fix...\n');
  
  // Check specific PR #7273
  const { data: pr7273, error: prError } = await supabase
    .from('pull_requests')
    .select('number, title, additions, deletions, changed_files, commits')
    .eq('number', 7273)
    .eq('repository_id', '98b0e461-ea5c-4916-99c0-402fbff5950a')
    .single();
  
  if (prError) {
    console.error('❌ Error fetching PR 7273:', prError);
    return false;
  }
  
  console.log('✅ PR #7273 Data:');
  console.log(`  Title: ${pr7273.title}`);
  console.log(`  Additions: ${pr7273.additions}`);
  console.log(`  Deletions: ${pr7273.deletions}`);
  console.log(`  Changed files: ${pr7273.changed_files}`);
  console.log(`  Commits: ${pr7273.commits}`);
  
  const isFixed = pr7273.additions > 0 || pr7273.deletions > 0 || 
                  pr7273.changed_files > 0 || pr7273.commits > 0;
  
  if (!isFixed) {
    console.error('\n❌ PR #7273 still has corrupted data!');
    return false;
  }
  
  // Check overall corruption rate
  const { count: totalPRs } = await supabase
    .from('pull_requests')
    .select('*', { count: 'exact', head: true })
    .eq('repository_id', '98b0e461-ea5c-4916-99c0-402fbff5950a')
    .gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString());
  
  const { count: corruptedPRs } = await supabase
    .from('pull_requests')
    .select('*', { count: 'exact', head: true })
    .eq('repository_id', '98b0e461-ea5c-4916-99c0-402fbff5950a')
    .eq('additions', 0)
    .eq('deletions', 0)
    .eq('changed_files', 0)
    .eq('commits', 0)
    .gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString());
  
  console.log('\n📊 Overall Statistics (last 14 days):');
  console.log(`  Total PRs: ${totalPRs}`);
  console.log(`  Corrupted PRs: ${corruptedPRs}`);
  console.log(`  Fixed PRs: ${totalPRs - corruptedPRs}`);
  console.log(`  Corruption rate: ${((corruptedPRs / totalPRs) * 100).toFixed(1)}%`);
  
  if (corruptedPRs === 0) {
    console.log('\n✅ All PRs have been fixed successfully!');
    return true;
  } else {
    console.log(`\n⚠️  Still ${corruptedPRs} corrupted PRs remaining`);
    return false;
  }
}

// Run verification
verifyFix()
  .then(success => {
    if (success) {
      console.log('\n🎉 PR data corruption fix verified successfully!');
      process.exit(0);
    } else {
      console.log('\n❌ PR data corruption fix incomplete');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });