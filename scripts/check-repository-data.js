#!/usr/bin/env node

/**
 * Check repository data in the database
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://egcxzonpmmcirmgqdrla.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('Missing VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRepositoryData() {
  console.log('🔍 Checking repository data in database\n');

  // 1. Check all bdougie repositories
  console.log('1. All bdougie repositories in database:');
  const { data: repos, error } = await supabase
    .from('repositories')
    .select('id, github_id, full_name, owner, name, github_created_at')
    .eq('owner', 'bdougie');

  if (error) {
    console.error('Error fetching repositories:', error);
    return;
  }

  if (repos && repos.length > 0) {
    console.log(`Found ${repos.length} repositories:\n`);
    repos.forEach((repo) => {
      console.log(`  Repository: ${repo.owner}/${repo.name}`);
      console.log(`    - Internal ID: ${repo.id}`);
      console.log(`    - GitHub ID: ${repo.github_id}`);
      console.log(`    - Full name: ${repo.full_name}`);
      console.log(`    - Created at: ${repo.github_created_at}`);
      console.log('');
    });
  } else {
    console.log('No bdougie repositories found');
  }

  // 2. Check if there's a mismatch issue
  console.log('2. Checking GitHub API for correct ID:');
  const correctGithubId = 967062465; // From the webhook payload
  console.log(`  Expected GitHub ID (from webhook): ${correctGithubId}`);

  // 3. Check if this ID exists anywhere
  console.log('\n3. Checking if correct GitHub ID exists in database:');
  const { data: correctRepo, error: correctError } = await supabase
    .from('repositories')
    .select('*')
    .eq('github_id', correctGithubId)
    .single();

  if (correctRepo) {
    console.log('✅ Found repository with correct GitHub ID:');
    console.log(`  - ${correctRepo.owner}/${correctRepo.name}`);
  } else {
    console.log('❌ No repository found with the correct GitHub ID');
  }

  // 4. Check using full_name
  console.log('\n4. Checking by full_name (bdougie/contributor.info):');
  const { data: byName, error: nameError } = await supabase
    .from('repositories')
    .select('*')
    .eq('full_name', 'bdougie/contributor.info')
    .single();

  if (byName) {
    console.log('✅ Found by full_name:');
    console.log(`  - GitHub ID in DB: ${byName.github_id}`);
    console.log(`  - Expected GitHub ID: ${correctGithubId}`);
    console.log(`  - Match: ${byName.github_id === correctGithubId ? '✅ Yes' : '❌ No'}`);
  } else {
    console.log('❌ Not found by full_name');
  }

  // 5. Summary
  console.log('\n📝 Summary:');
  if (repos && repos.length > 0) {
    const contributorInfo = repos.find((r) => r.name === 'contributor.info');
    if (contributorInfo) {
      if (contributorInfo.github_id !== correctGithubId) {
        console.log('❌ The repository IS in the database but with WRONG GitHub ID');
        console.log(`   Current: ${contributorInfo.github_id}`);
        console.log(`   Should be: ${correctGithubId}`);
        console.log('\n   This is why the webhook fails - it looks up by GitHub ID');
        console.log("   and can't find the repository.");
      } else {
        console.log('✅ Repository has correct GitHub ID');
      }
    } else {
      console.log('❌ Repository not found in database');
    }
  }
}

checkRepositoryData().catch(console.error);
