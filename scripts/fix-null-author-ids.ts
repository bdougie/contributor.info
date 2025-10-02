#!/usr/bin/env tsx

/**
 * Script to fix null author_id values in pull_requests table
 * Fetches actual author data from GitHub API and updates the database
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// Environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN;

if (!SUPABASE_URL) {
  console.error(
    '❌ Missing SUPABASE_URL. Set VITE_SUPABASE_URL or SUPABASE_URL environment variable'
  );
  process.exit(1);
}

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!GITHUB_TOKEN) {
  console.error('❌ Missing GITHUB_TOKEN');
  process.exit(1);
}

// Initialize Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface GitHubPR {
  user: {
    id: number;
    login: string;
    avatar_url: string;
    type: string;
    name?: string;
    email?: string;
    bio?: string;
    company?: string;
    location?: string;
    blog?: string;
    public_repos?: number;
    public_gists?: number;
    followers?: number;
    following?: number;
    created_at?: string;
  } | null;
}

async function fetchGitHubPRAuthor(
  owner: string,
  repo: string,
  prNumber: number
): Promise<GitHubPR['user']> {
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as GitHubPR;
  return data.user;
}

async function ensureContributorExists(githubUser: GitHubPR['user']): Promise<string | null> {
  if (!githubUser) {
    console.warn('No GitHub user data available');
    return null;
  }

  // First check if contributor already exists
  const { data: existing } = await supabase
    .from('contributors')
    .select('id')
    .eq('github_id', githubUser.id.toString())
    .maybeSingle();

  if (existing) {
    return existing.id;
  }

  // Create new contributor
  const { data, error } = await supabase
    .from('contributors')
    .upsert(
      {
        github_id: githubUser.id.toString(),
        username: githubUser.login,
        display_name: githubUser.name || null,
        email: githubUser.email || null,
        avatar_url: githubUser.avatar_url || null,
        profile_url: `https://github.com/${githubUser.login}`,
        bio: githubUser.bio || null,
        company: githubUser.company || null,
        location: githubUser.location || null,
        blog: githubUser.blog || null,
        public_repos: githubUser.public_repos || 0,
        public_gists: githubUser.public_gists || 0,
        followers: githubUser.followers || 0,
        following: githubUser.following || 0,
        github_created_at: githubUser.created_at || new Date().toISOString(),
        is_bot: githubUser.type === 'Bot',
        is_active: true,
        first_seen_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'github_id',
        ignoreDuplicates: false,
      }
    )
    .select('id')
    .maybeSingle();

  if (error) {
    console.error(`Error creating contributor ${githubUser.login}: ${error.message}`);
    return null;
  }

  return data?.id || null;
}

async function fixNullAuthorIds() {
  console.log('🔍 Finding PRs with null author_id...');

  // Find PRs with null author_id
  const { data: prsWithNullAuthor, error: fetchError } = await supabase
    .from('pull_requests')
    .select('id, number, repository_full_name, github_id, title')
    .is('author_id', null)
    .order('created_at', { ascending: false })
    .limit(100);

  if (fetchError) {
    console.error('Error fetching PRs:', fetchError);
    return;
  }

  if (!prsWithNullAuthor || prsWithNullAuthor.length === 0) {
    console.log('✅ No PRs with null author_id found');
    return;
  }

  console.log(`Found ${prsWithNullAuthor.length} PRs with null author_id`);

  // Process each PR
  let fixed = 0;
  let failed = 0;

  for (const pr of prsWithNullAuthor) {
    const [owner, repo] = pr.repository_full_name.split('/');

    console.log(`\n📌 Processing PR #${pr.number} from ${pr.repository_full_name}`);
    console.log(`   Title: ${pr.title}`);

    try {
      // Fetch author from GitHub
      const githubUser = await fetchGitHubPRAuthor(owner, repo, pr.number);

      if (!githubUser) {
        console.warn(`   ⚠️  No author found on GitHub (possibly deleted account)`);
        failed++;
        continue;
      }

      console.log(`   👤 Author: ${githubUser.login} (GitHub ID: ${githubUser.id})`);

      // Ensure contributor exists and get UUID
      const authorId = await ensureContributorExists(githubUser);

      if (!authorId) {
        console.error(`   ❌ Failed to create/find contributor`);
        failed++;
        continue;
      }

      // Update PR with author_id
      const { error: updateError } = await supabase
        .from('pull_requests')
        .update({ author_id: authorId })
        .eq('id', pr.id);

      if (updateError) {
        console.error(`   ❌ Failed to update PR: ${updateError.message}`);
        failed++;
      } else {
        console.log(`   ✅ Fixed author_id for PR #${pr.number}`);
        fixed++;
      }

      // Rate limit: wait 100ms between API calls
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`   ❌ Error processing PR #${pr.number}:`, error);
      failed++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   ✅ Fixed: ${fixed} PRs`);
  console.log(`   ❌ Failed: ${failed} PRs`);
  console.log(`   📝 Total: ${prsWithNullAuthor.length} PRs`);
}

// Run the script
fixNullAuthorIds().catch(console.error);
