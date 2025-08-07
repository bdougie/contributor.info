#!/usr/bin/env node

/**
 * Fix the GitHub ID for bdougie/contributor.info repository in the database
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://egcxzonpmmcirmgqdrla.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_TOKEN || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('Missing Supabase key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixRepositoryGithubId() {
  console.log('🔧 Fixing GitHub ID for bdougie/contributor.info repository\n');
  
  const correctGithubId = 967062465; // From GitHub API
  const incorrectGithubId = 1483108308; // Currently in database
  
  // First, check current state
  console.log('1. Checking current repository record...');
  const { data: repo, error: fetchError } = await supabase
    .from('repositories')
    .select('*')
    .eq('owner', 'bdougie')
    .eq('name', 'contributor.info')
    .single();
  
  if (fetchError || !repo) {
    console.error('❌ Could not find repository:', fetchError);
    return;
  }
  
  console.log('Current record:');
  console.log(`  - ID: ${repo.id}`);
  console.log(`  - GitHub ID: ${repo.github_id} (incorrect)`);
  console.log(`  - Owner/Name: ${repo.owner}/${repo.name}`);
  
  // Update the GitHub ID
  console.log('\n2. Updating GitHub ID...');
  const { error: updateError } = await supabase
    .from('repositories')
    .update({ github_id: correctGithubId })
    .eq('id', repo.id);
  
  if (updateError) {
    console.error('❌ Failed to update:', updateError);
    return;
  }
  
  console.log(`✅ Updated GitHub ID from ${incorrectGithubId} to ${correctGithubId}`);
  
  // Verify the update
  console.log('\n3. Verifying update...');
  const { data: updatedRepo, error: verifyError } = await supabase
    .from('repositories')
    .select('github_id')
    .eq('id', repo.id)
    .single();
  
  if (verifyError || !updatedRepo) {
    console.error('❌ Could not verify update:', verifyError);
    return;
  }
  
  if (updatedRepo.github_id === correctGithubId) {
    console.log('✅ Successfully updated GitHub ID!');
    console.log('\nThe webhook should now work correctly for future PRs.');
  } else {
    console.error('❌ Update verification failed. GitHub ID is still:', updatedRepo.github_id);
  }
  
  // Also check if there are any issues to match against
  console.log('\n4. Checking for issues in the repository...');
  const { data: issues, count } = await supabase
    .from('issues')
    .select('*', { count: 'exact', head: true })
    .eq('repository_id', repo.id);
  
  console.log(`Found ${count || 0} issues in the repository.`);
  if (count === 0) {
    console.log('⚠️  No issues found. The webhook will still not post similarity comments.');
    console.log('   Consider syncing issues or modifying the webhook to post reviewer suggestions without similar issues.');
  }
}

fixRepositoryGithubId().catch(console.error);