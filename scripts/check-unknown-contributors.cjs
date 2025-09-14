#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env file
function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      if (line.trim() && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        if (key && value) {
          process.env[key.trim()] = value;
        }
      }
    });
  }
}

loadEnvFile();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUnknownContributors() {
  console.log('🔍 Checking for unknown contributors in pull requests...\n');

  // Get all repositories
  const { data: repos, error: repoError } = await supabase
    .from('repositories')
    .select('id, owner, name')
    .limit(10);

  if (repoError) {
    console.error('❌ Failed to fetch repositories:', repoError.message);
    throw repoError;
  }

  for (const repo of repos || []) {
    console.log(`\n📁 Repository: ${repo.owner}/${repo.name}`);
    
    // Get pull requests with their contributors using the same query as the app
    const { data: dbPRs, error: prError } = await supabase
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

    if (prError) {
      console.error(`❌ Failed to fetch pull requests for ${repo.owner}/${repo.name}:`, prError.message);
      throw prError;
    }

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
        const title = pr.title || 'No title';
        const truncatedTitle = title.length > 40 ? title.substring(0, 40) + '...' : title;
        console.log(`      - PR #${pr.number}: "${truncatedTitle}" (author_id: ${pr.author_id})`);
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