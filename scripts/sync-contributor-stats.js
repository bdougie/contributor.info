#!/usr/bin/env node

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const GITHUB_GRAPHQL_API = 'https://api.github.com/graphql';
const GITHUB_TOKEN = process.env.VITE_GITHUB_TOKEN;

/**
 * GraphQL query to fetch PR review and comment counts for contributors
 */
const GET_CONTRIBUTOR_STATS_QUERY = `
  query GetContributorStats($owner: String!, $name: String!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      pullRequests(first: 100, after: $cursor, states: [OPEN, CLOSED, MERGED]) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          author {
            login
          }
          reviews(first: 100) {
            nodes {
              author {
                login
              }
            }
            totalCount
          }
          comments(first: 100) {
            nodes {
              author {
                login
              }
            }
            totalCount
          }
        }
      }
    }
  }
`;

/**
 * Execute GraphQL query against GitHub API
 */
async function executeGraphQLQuery(query, variables) {
  const response = await fetch(GITHUB_GRAPHQL_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  
  if (result.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
  }

  return result.data;
}

/**
 * Calculate weighted score for contributor ranking
 */
function calculateWeightedScore(
  pullRequestsCount,
  reviewsCount,
  commentsCount,
  repositoriesCount = 1,
  linesAdded = 0,
  linesRemoved = 0
) {
  return (
    (pullRequestsCount * 10.0) +
    (reviewsCount * 3.0) +
    (commentsCount * 1.0) +
    (repositoriesCount * 5.0) +
    (Math.min(linesAdded + linesRemoved, 10000) * 0.01)
  );
}

/**
 * Fetch contributor statistics for a repository using GraphQL
 */
async function fetchContributorStats(owner, repo) {
  console.log(`Fetching contributor stats for ${owner}/${repo}...`);
  
  const contributorMap = new Map();
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    try {
      const data = await executeGraphQLQuery(GET_CONTRIBUTOR_STATS_QUERY, {
        owner,
        name: repo,
        cursor,
      });

      const pullRequests = data.repository.pullRequests;
      
      // Process each PR to collect contributor stats
      for (const pr of pullRequests.nodes) {
        // Count PR author
        if (pr.author?.login) {
          const login = pr.author.login;
          if (!contributorMap.has(login)) {
            contributorMap.set(login, {
              login,
              reviewsCount: 0,
              commentsCount: 0,
              pullRequestsCount: 0,
            });
          }
          contributorMap.get(login).pullRequestsCount += 1;
        }

        // Count reviewers
        for (const review of pr.reviews.nodes) {
          if (review.author?.login) {
            const login = review.author.login;
            if (!contributorMap.has(login)) {
              contributorMap.set(login, {
                login,
                reviewsCount: 0,
                commentsCount: 0,
                pullRequestsCount: 0,
              });
            }
            contributorMap.get(login).reviewsCount += 1;
          }
        }

        // Count commenters
        for (const comment of pr.comments.nodes) {
          if (comment.author?.login) {
            const login = comment.author.login;
            if (!contributorMap.has(login)) {
              contributorMap.set(login, {
                login,
                reviewsCount: 0,
                commentsCount: 0,
                pullRequestsCount: 0,
              });
            }
            contributorMap.get(login).commentsCount += 1;
          }
        }
      }

      // Update pagination
      hasNextPage = pullRequests.pageInfo.hasNextPage;
      cursor = pullRequests.pageInfo.endCursor;
      
      console.log(`Processed ${pullRequests.nodes.length} PRs, ${contributorMap.size} contributors found so far`);
      
    } catch (error) {
      console.error('Error fetching page:', error);
      throw error;
    }
  }

  console.log(`Completed fetching stats for ${owner}/${repo}: ${contributorMap.size} contributors`);

  return {
    owner,
    repo,
    contributors: Array.from(contributorMap.values()),
  };
}

/**
 * Update Supabase database with contributor statistics
 */
async function updateContributorStatsInDatabase(stats) {
  console.log(`Updating database for ${stats.owner}/${stats.repo}...`);

  // First, get the repository ID from Supabase
  const { data: repoData, error: repoError } = await supabase
    .from('repositories')
    .select('id')
    .eq('owner', stats.owner)
    .eq('name', stats.repo)
    .single();

  if (repoError || !repoData) {
    throw new Error(`Repository ${stats.owner}/${stats.repo} not found in database`);
  }

  const repositoryId = repoData.id;

  // Get current month and year
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Process each contributor
  for (const contributor of stats.contributors) {
    try {
      // First, ensure the contributor exists in the contributors table
      const { data: existingContributor, error: contributorError } = await supabase
        .from('contributors')
        .select('id')
        .eq('username', contributor.login)
        .single();

      let contributorId;

      if (contributorError && contributorError.code === 'PGRST116') {
        // Contributor doesn't exist, create them
        const { data: newContributor, error: insertError } = await supabase
          .from('contributors')
          .insert({
            username: contributor.login,
            display_name: contributor.login,
            github_id: 0, // We don't have GitHub ID from GraphQL, could be fetched separately if needed
          })
          .select('id')
          .single();

        if (insertError) {
          console.error(`Failed to create contributor ${contributor.login}:`, insertError);
          continue;
        }

        contributorId = newContributor.id;
      } else if (contributorError) {
        console.error(`Error fetching contributor ${contributor.login}:`, contributorError);
        continue;
      } else {
        contributorId = existingContributor.id;
      }

      // Update or insert monthly rankings
      const { error: upsertError } = await supabase
        .from('monthly_rankings')
        .upsert({
          month: currentMonth,
          year: currentYear,
          contributor_id: contributorId,
          repository_id: repositoryId,
          pull_requests_count: contributor.pullRequestsCount,
          reviews_count: contributor.reviewsCount,
          comments_count: contributor.commentsCount,
          rank: 1, // Will be recalculated later based on scores
          weighted_score: calculateWeightedScore(
            contributor.pullRequestsCount,
            contributor.reviewsCount,
            contributor.commentsCount
          ),
        }, {
          onConflict: 'month,year,contributor_id,repository_id',
        });

      if (upsertError) {
        console.error(`Failed to update stats for ${contributor.login}:`, upsertError);
      } else {
        console.log(`Updated stats for ${contributor.login}: ${contributor.pullRequestsCount} PRs, ${contributor.reviewsCount} reviews, ${contributor.commentsCount} comments`);
      }

    } catch (error) {
      console.error(`Error processing contributor ${contributor.login}:`, error);
      continue;
    }
  }

  console.log(`Database update completed for ${stats.owner}/${stats.repo}`);
}

/**
 * Sync repository contributor stats
 */
async function syncRepositoryContributorStats(owner, repo) {
  try {
    console.log(`Starting sync for ${owner}/${repo}`);
    
    const stats = await fetchContributorStats(owner, repo);
    await updateContributorStatsInDatabase(stats);
    
    console.log(`Successfully synced contributor stats for ${owner}/${repo}`);
  } catch (error) {
    console.error(`Failed to sync contributor stats for ${owner}/${repo}:`, error);
    throw error;
  }
}

async function syncAllTrackedRepositories() {
  console.log('🔄 Starting contributor stats sync job...');
  
  // Get repository from environment variables (passed from GitHub Actions)
  const specificOwner = process.env.REPO_OWNER;
  const specificRepo = process.env.REPO_NAME;
  
  if (specificOwner && specificRepo) {
    // Sync specific repository
    console.log(`📦 Syncing specific repository: ${specificOwner}/${specificRepo}`);
    await syncSingleRepository(specificOwner, specificRepo);
  } else {
    // Sync all tracked repositories
    const { data: repos, error } = await supabase
      .from('tracked_repositories')
      .select(`
        repository_id,
        repositories!inner(
          owner,
          name,
          full_name
        )
      `)
      .eq('tracking_enabled', true);
      
    if (error) {
      console.error('Failed to fetch tracked repositories:', error);
      process.exit(1);
    }
    
    console.log(`📦 Found ${repos?.length || 0} tracked repositories to sync`);
    
    if (!repos || repos.length === 0) {
      console.log('⚠️  No active tracked repositories found');
      return;
    }
    
    for (const repo of repos) {
      const { owner, name, full_name } = repo.repositories;
      console.log(`  - Syncing ${full_name}...`);
      
      try {
        await syncSingleRepository(owner, name);
        console.log(`    ✅ Successfully synced ${full_name}`);
      } catch (error) {
        console.error(`    ❌ Failed to sync ${full_name}:`, error.message);
        // Continue with other repositories even if one fails
      }
      
      // Small delay to avoid overwhelming the GitHub API
      const delayMs = parseInt(process.env.SYNC_DELAY_MS || '2000');
      if (delayMs > 0) {
        console.log(`    ⏳ Waiting ${delayMs}ms before next repository...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  console.log('✅ Contributor stats sync completed!');
}

async function syncSingleRepository(owner, repo) {
  const startTime = Date.now();
  
  try {
    await syncRepositoryContributorStats(owner, repo);
    
    const duration = Date.now() - startTime;
    console.log(`    ⏱️  Sync took ${(duration / 1000).toFixed(2)}s`);
    
    // Log sync completion to database
    await logSyncOperation(owner, repo, 'completed', duration);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`    ❌ Sync failed after ${(duration / 1000).toFixed(2)}s:`, error.message);
    
    // Log sync failure to database
    await logSyncOperation(owner, repo, 'failed', duration, error.message);
    
    throw error;
  }
}

async function logSyncOperation(owner, repo, status, duration, errorMessage = null) {
  try {
    // Get repository ID
    const { data: repoData } = await supabase
      .from('repositories')
      .select('id')
      .eq('owner', owner)
      .eq('name', repo)
      .single();

    if (repoData) {
      await supabase
        .from('sync_logs')
        .insert({
          sync_type: 'contributor_stats_sync',
          repository_id: repoData.id,
          status,
          completed_at: status === 'completed' ? new Date().toISOString() : null,
          error_message: errorMessage,
          metadata: {
            duration_ms: duration,
            script_version: '1.0.0',
            sync_method: 'graphql'
          }
        });
    }
  } catch (logError) {
    console.error('Failed to log sync operation:', logError.message);
    // Don't throw here - logging failure shouldn't break the main process
  }
}

// Validate required environment variables
function validateEnvironment() {
  const required = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_GITHUB_TOKEN'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('Please ensure these are set in your environment or .env file');
    process.exit(1);
  }
}

// Main execution
async function main() {
  try {
    validateEnvironment();
    await syncAllTrackedRepositories();
  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Run the main function
main();