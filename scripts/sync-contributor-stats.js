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
 * Fetches first 100 reviews/comments directly, uses pagination for larger PRs
 */
const GET_CONTRIBUTOR_STATS_QUERY = `
  query GetContributorStats($owner: String!, $name: String!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      pullRequests(first: 50, after: $cursor, states: [OPEN, CLOSED, MERGED]) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          number
          author {
            login
          }
          reviews(first: 100) {
            totalCount
            nodes {
              author {
                login
              }
            }
          }
          comments(first: 100) {
            totalCount
            nodes {
              author {
                login
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * GraphQL query to fetch all reviews for a specific PR
 */
const GET_PR_REVIEWS_QUERY = `
  query GetPRReviews($owner: String!, $name: String!, $number: Int!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      pullRequest(number: $number) {
        reviews(first: 100, after: $cursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            author {
              login
            }
          }
        }
      }
    }
  }
`;

/**
 * GraphQL query to fetch all comments for a specific PR
 */
const GET_PR_COMMENTS_QUERY = `
  query GetPRComments($owner: String!, $name: String!, $number: Int!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      pullRequest(number: $number) {
        comments(first: 100, after: $cursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            author {
              login
            }
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
 * Fetch all reviews for a specific PR with pagination
 */
async function fetchAllPRReviews(owner, repo, prNumber) {
  const reviewerCounts = new Map();
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data = await executeGraphQLQuery(GET_PR_REVIEWS_QUERY, {
      owner,
      name: repo,
      number: prNumber,
      cursor,
    });

    const reviews = data.repository.pullRequest.reviews;
    
    // Count reviews by author
    for (const review of reviews.nodes) {
      if (review.author?.login) {
        const currentCount = reviewerCounts.get(review.author.login) || 0;
        reviewerCounts.set(review.author.login, currentCount + 1);
      }
    }

    hasNextPage = reviews.pageInfo.hasNextPage;
    cursor = reviews.pageInfo.endCursor;
  }

  return reviewerCounts;
}

/**
 * Fetch all comments for a specific PR with pagination
 */
async function fetchAllPRComments(owner, repo, prNumber) {
  const commenterCounts = new Map();
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data = await executeGraphQLQuery(GET_PR_COMMENTS_QUERY, {
      owner,
      name: repo,
      number: prNumber,
      cursor,
    });

    const comments = data.repository.pullRequest.comments;
    
    // Count comments by author
    for (const comment of comments.nodes) {
      if (comment.author?.login) {
        const currentCount = commenterCounts.get(comment.author.login) || 0;
        commenterCounts.set(comment.author.login, currentCount + 1);
      }
    }

    hasNextPage = comments.pageInfo.hasNextPage;
    cursor = comments.pageInfo.endCursor;
  }

  return commenterCounts;
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
  console.log('Fetching contributor stats for %s/%s...', owner, repo);
  
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

        // Process reviews
        if (pr.reviews.totalCount > 0) {
          // First, count reviews from the initial nodes
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
          
          // If there are more than 100 reviews, fetch the rest
          if (pr.reviews.totalCount > 100) {
            console.log('PR #%d has %d reviews, fetching remaining...', pr.number, pr.reviews.totalCount);
            const additionalReviewerCounts = await fetchAllPRReviews(owner, repo, pr.number);
            
            // Merge additional counts with existing counts
            for (const [login, count] of additionalReviewerCounts) {
              if (!contributorMap.has(login)) {
                contributorMap.set(login, {
                  login,
                  reviewsCount: 0,
                  commentsCount: 0,
                  pullRequestsCount: 0,
                });
              }
              // Note: We already counted first 100, so we add the full count from pagination
              // and subtract what we already counted to avoid double-counting
              const existingCount = pr.reviews.nodes.filter(r => r.author?.login === login).length;
              contributorMap.get(login).reviewsCount += (count - existingCount);
            }
          }
        }

        // Process comments
        if (pr.comments.totalCount > 0) {
          // First, count comments from the initial nodes
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
          
          // If there are more than 100 comments, fetch the rest
          if (pr.comments.totalCount > 100) {
            console.log('PR #%d has %d comments, fetching remaining...', pr.number, pr.comments.totalCount);
            const additionalCommenterCounts = await fetchAllPRComments(owner, repo, pr.number);
            
            // Merge additional counts with existing counts
            for (const [login, count] of additionalCommenterCounts) {
              if (!contributorMap.has(login)) {
                contributorMap.set(login, {
                  login,
                  reviewsCount: 0,
                  commentsCount: 0,
                  pullRequestsCount: 0,
                });
              }
              // Note: We already counted first 100, so we add the full count from pagination
              // and subtract what we already counted to avoid double-counting
              const existingCount = pr.comments.nodes.filter(c => c.author?.login === login).length;
              contributorMap.get(login).commentsCount += (count - existingCount);
            }
          }
        }
      }

      // Update pagination
      hasNextPage = pullRequests.pageInfo.hasNextPage;
      cursor = pullRequests.pageInfo.endCursor;
      
      console.log('Processed %d PRs, %d contributors found so far', pullRequests.nodes.length, contributorMap.size);
      
    } catch (error) {
      console.error('Error fetching page:', error);
      throw error;
    }
  }

  console.log('Completed fetching stats for %s/%s: %d contributors', owner, repo, contributorMap.size);

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
  console.log('Updating database for %s/%s...', stats.owner, stats.repo);

  // First, get the repository ID from Supabase
  const { data: repoData, error: repoError } = await supabase
    .from('repositories')
    .select('id')
    .eq('owner', stats.owner)
    .eq('name', stats.repo)
    .single();

  if (repoError || !repoData) {
    throw new Error('Repository not found in database');
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
            github_id: 0, // GitHub ID not available from GraphQL query, using 0 as placeholder
          })
          .select('id')
          .single();

        if (insertError) {
          console.error('Failed to create contributor %s:', contributor.login, insertError);
          continue;
        }

        contributorId = newContributor.id;
      } else if (contributorError) {
        console.error('Error fetching contributor %s:', contributor.login, contributorError);
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
        console.error('Failed to update stats for %s:', contributor.login, upsertError);
      } else {
        console.log('Updated stats for %s: %d PRs, %d reviews, %d comments', contributor.login, contributor.pullRequestsCount, contributor.reviewsCount, contributor.commentsCount);
      }

    } catch (error) {
      console.error('Error processing contributor %s:', contributor.login, error);
      continue;
    }
  }

  console.log('Database update completed for %s/%s', stats.owner, stats.repo);
}

/**
 * Sync repository contributor stats
 */
async function syncRepositoryContributorStats(owner, repo) {
  try {
    console.log('Starting sync for %s/%s', owner, repo);
    
    const stats = await fetchContributorStats(owner, repo);
    await updateContributorStatsInDatabase(stats);
    
    console.log('Successfully synced contributor stats for %s/%s', owner, repo);
  } catch (error) {
    console.error('Failed to sync contributor stats for %s/%s:', owner, repo, error);
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
    console.log('📦 Syncing specific repository: %s/%s', specificOwner, specificRepo);
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
    
    console.log('📦 Found %d tracked repositories to sync', repos?.length || 0);
    
    if (!repos || repos.length === 0) {
      console.log('⚠️  No active tracked repositories found');
      return;
    }
    
    for (const repo of repos) {
      const { owner, name, full_name } = repo.repositories;
      console.log('  - Syncing %s...', full_name);
      
      try {
        await syncSingleRepository(owner, name);
        console.log('    ✅ Successfully synced %s', full_name);
      } catch (error) {
        console.error('    ❌ Failed to sync %s:', full_name, error.message);
        // Continue with other repositories even if one fails
      }
      
      // Small delay to avoid overwhelming the GitHub API
      const delayMs = parseInt(process.env.SYNC_DELAY_MS || '2000');
      if (delayMs > 0) {
        console.log('    ⏳ Waiting %dms before next repository...', delayMs);
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
    console.log('    ⏱️  Sync took %ss', (duration / 1000).toFixed(2));
    
    // Log sync completion to database
    await logSyncOperation(owner, repo, 'completed', duration);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('    ❌ Sync failed after %ss:', (duration / 1000).toFixed(2), error.message);
    
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