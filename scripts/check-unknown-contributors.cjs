#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://egcxzonpmmcirmgqdrla.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnY3h6b25wbW1jaXJtZ3FkcmxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTcyNzEzNzksImV4cCI6MjAzMjg0NzM3OX0.w7F1XKj5kOx4UvqR_3XYQs5a_xBV3D8EWJZvnwE88h0'
);

async function checkUnknownContributors() {
  console.log('🔍 Checking for unknown contributors in pull requests...\n');

  // Get all repositories
  const { data: repos } = await supabase
    .from('repositories')
    .select('id, owner, name')
    .limit(10);

  for (const repo of repos || []) {
    console.log(`\n📁 Repository: ${repo.owner}/${repo.name}`);
    
    // Get pull requests with their contributors using the same query as the app
    const { data: dbPRs } = await supabase
      .from('pull_requests')
      .select(`
        id,
        github_id,
        number,
        title,
        author_id,
        contributors:author_id(
          github_id,
          username,
          avatar_url,
          is_bot
        )
      `)
      .eq('repository_id', repo.id)
      .limit(5);

    if (!dbPRs || dbPRs.length === 0) {
      console.log('   No pull requests found');
      continue;
    }

    console.log(`   Found ${dbPRs.length} pull requests`);

    // Check for PRs with null contributors
    const orphanedPRs = dbPRs.filter(pr => !pr.contributors);
    
    if (orphanedPRs.length > 0) {
      console.log(`   ❌ Found ${orphanedPRs.length} PRs with missing contributors:`);
      orphanedPRs.forEach(pr => {
        console.log(`      - PR #${pr.number}: "${pr.title.substring(0, 40)}..." (author_id: ${pr.author_id})`);
      });
    } else {
      console.log('   ✅ All PRs have valid contributor data');
    }

    // Check for PRs that would show "unknown" 
    const unknownContributors = dbPRs.filter(pr => 
      !pr.contributors || pr.contributors.username === 'unknown'
    );

    if (unknownContributors.length > 0) {
      console.log(`   ⚠️ PRs that would show "unknown": ${unknownContributors.length}`);
    }
  }
}

checkUnknownContributors().catch(console.error);