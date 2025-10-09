#!/usr/bin/env node

/**
 * Sync GitHub discussions to Supabase
 * This will fetch discussions from GitHub and store them in the database
 */

import { config } from 'dotenv';
config();

const SUPABASE_URL = 'https://egcxzonpmmcirmgqdrla.supabase.co';
const GITHUB_TOKEN = process.env.VITE_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!GITHUB_TOKEN || !SUPABASE_KEY) {
  console.error('❌ Missing required environment variables:');
  if (!GITHUB_TOKEN) console.error('  - VITE_GITHUB_TOKEN or GITHUB_TOKEN');
  if (!SUPABASE_KEY) console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function fetchDiscussions(owner, repo) {
  const query = `
    query($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        discussions(first: 100) {
          nodes {
            id
            number
            title
            body
            createdAt
            updatedAt
            isAnswered
            author {
              login
              avatarUrl
            }
            category {
              name
            }
          }
        }
      }
    }
  `;

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables: { owner, repo },
    }),
  });

  const data = await response.json();
  if (data.errors) {
    console.error('GraphQL errors:', data.errors);
    return [];
  }

  return data.data?.repository?.discussions?.nodes || [];
}

async function syncDiscussions() {
  console.log('🚀 Starting discussions sync...\n');

  try {
    // First, get workspace repositories
    const workspaceResp = await fetch(
      `${SUPABASE_URL}/rest/v1/workspaces?slug=eq.continue&select=id`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    const workspaces = await workspaceResp.json();
    if (!workspaces[0]) {
      console.error('❌ Workspace "continue" not found');
      return;
    }

    const workspaceId = workspaces[0].id;
    console.log(`📋 Found workspace: ${workspaceId}\n`);

    // Get workspace repositories
    const reposResp = await fetch(
      `${SUPABASE_URL}/rest/v1/workspace_repositories?workspace_id=eq.${workspaceId}&select=repository_id,repositories(*)`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    const workspaceRepos = await reposResp.json();
    console.log(`📦 Found ${workspaceRepos.length} repositories in workspace\n`);

    let totalDiscussions = 0;

    for (const wr of workspaceRepos) {
      const repo = wr.repositories;
      if (!repo) continue;

      const [owner, name] = repo.full_name.split('/');
      console.log(`\n🔍 Fetching discussions for ${repo.full_name}...`);

      const discussions = await fetchDiscussions(owner, name);
      console.log(`   Found ${discussions.length} discussions`);

      for (const discussion of discussions) {
        // Prepare discussion data
        const discussionData = {
          github_id: discussion.id,
          number: discussion.number,
          title: discussion.title,
          body: discussion.body,
          is_answered: discussion.isAnswered,
          author_login: discussion.author.login,
          author_id: 0, // We'd need to look this up or create a placeholder
          author_avatar_url: discussion.author.avatarUrl,
          category: discussion.category?.name || 'general',
          repository_id: repo.id,
          created_at: discussion.createdAt,
          updated_at: discussion.updatedAt,
        };

        // Insert or update discussion
        const upsertResp = await fetch(
          `${SUPABASE_URL}/rest/v1/discussions?on_conflict=github_id`,
          {
            method: 'POST',
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              Prefer: 'resolution=merge-duplicates',
            },
            body: JSON.stringify(discussionData),
          }
        );

        if (!upsertResp.ok) {
          const error = await upsertResp.text();
          console.error(`   ❌ Failed to upsert discussion #${discussion.number}:`, error);
        } else {
          totalDiscussions++;
        }
      }
    }

    console.log(`\n✅ Synced ${totalDiscussions} discussions total\n`);

    // Now check what's in the database
    console.log('📊 Checking database state...\n');

    const checkResp = await fetch(
      `${SUPABASE_URL}/rest/v1/discussions?is_answered=eq.false&select=id,title,repository_id&limit=10`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    const unanswered = await checkResp.json();
    console.log(`Found ${unanswered.length} unanswered discussions in database`);

    if (unanswered.length > 0) {
      console.log('\nSample unanswered discussions:');
      unanswered.slice(0, 5).forEach((d, i) => {
        console.log(`${i + 1}. ${d.title}`);
      });
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

syncDiscussions();
