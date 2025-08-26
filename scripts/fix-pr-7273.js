#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://egcxzonpmmcirmgqdrla.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const GITHUB_TOKEN = process.env.VITE_GITHUB_TOKEN;

if (!SUPABASE_ANON_KEY || !GITHUB_TOKEN) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fixPR7273() {
  console.log('🔍 Fetching PR #7273 from GitHub...');
  
  const response = await fetch('https://api.github.com/repos/continuedev/continue/pulls/7273', {
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
    }
  });

  if (!response.ok) {
    console.error(`❌ GitHub API error: ${response.status}`);
    return;
  }

  const prData = await response.json();
  
  console.log('📊 GitHub data for PR #7273:');
  console.log(`  Title: ${prData.title}`);
  console.log(`  State: ${prData.state}`);
  console.log(`  Additions: ${prData.additions}`);
  console.log(`  Deletions: ${prData.deletions}`);
  console.log(`  Changed files: ${prData.changed_files}`);
  console.log(`  Commits: ${prData.commits}`);
  console.log(`  Merged: ${prData.merged}`);
  
  // Update in database
  console.log('\n📝 Updating database...');
  
  const { data, error } = await supabase
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
    .eq('number', 7273)
    .eq('repository_id', '98b0e461-ea5c-4916-99c0-402fbff5950a')
    .select()
    .single();

  if (error) {
    console.error('❌ Update failed:', error);
  } else {
    console.log('✅ PR #7273 updated successfully!');
    console.log('\n📊 Database record:');
    console.log(`  Additions: ${data.additions}`);
    console.log(`  Deletions: ${data.deletions}`);
    console.log(`  Changed files: ${data.changed_files}`);
    console.log(`  Commits: ${data.commits}`);
  }
}

fixPR7273().catch(console.error);