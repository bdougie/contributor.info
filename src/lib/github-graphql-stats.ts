import { supabase } from './supabase';
import { createClient } from '@supabase/supabase-js';
import { env, serverEnv } from './env';

const GITHUB_GRAPHQL_API = 'https://api.github.com/graphql';

// Use universal environment access
const VITE_GITHUB_TOKEN = env.GITHUB_TOKEN;

// Create admin client for write operations if service role key is available
const adminSupabase = serverEnv.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(env.SUPABASE_URL, serverEnv.SUPABASE_SERVICE_ROLE_KEY)
  : null;

export interface ContributorStats {
  login: string;
  reviewsCount: number;
  commentsCount: number;
  pullRequestsCount: number;
}

export interface RepositoryContributorStats {
  owner: string;
  repo: string;
  contributors: ContributorStats[];
}

interface GraphQLResponse {
  repository: {
    pullRequests: {
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string;
      };
      nodes: Array<{
        number: number;
        author: { login: string } | null;
        updatedAt: string;
        createdAt: string;
        reviews: {
          totalCount: number;
          nodes: Array<{
            author: { login: string } | null;
            submittedAt: string;
          }>;
        };
        comments: {
          totalCount: number;
          nodes: Array<{
            author: { login: string } | null;
            createdAt: string;
          }>;
        };
      }>;
    };
  };
}

interface ReviewsResponse {
  repository: {
    pullRequest: {
      reviews: {
        pageInfo: {
          hasNextPage: boolean;
          endCursor: string;
        };
        nodes: Array<{
          author: { login: string } | null;
          submittedAt: string;
        }>;
      };
    };
  };
}

interface CommentsResponse {
  repository: {
    pullRequest: {
      comments: {
        pageInfo: {
          hasNextPage: boolean;
          endCursor: string;
        };
        nodes: Array<{
          author: { login: string } | null;
          createdAt: string;
        }>;
      };
    };
  };
}

/**
 * GraphQL query to fetch PR review and comment counts for contributors
 * Fetches first 100 reviews/comments directly, uses pagination for larger PRs
 * Filters to last 30 days of activity
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
          updatedAt
          createdAt
          reviews(first: 100) {
            totalCount
            nodes {
              author {
                login
              }
              submittedAt
            }
          }
          comments(first: 100) {
            totalCount
            nodes {
              author {
                login
              }
              createdAt
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
            submittedAt
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
            createdAt
          }
        }
      }
    }
  }
`;

/**
 * Fetch headers for GitHub GraphQL API
 */
async function getGraphQLHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Try to get user's GitHub token from Supabase session
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userToken = session?.provider_token;

  // Use user's token if available, otherwise fall back to env token
  const token = userToken || VITE_GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Execute GraphQL query against GitHub API
 */
async function executeGraphQLQuery<T>(
  query: string,
  variables: Record<string, string | number | null | undefined>,
): Promise<T> {
  const headers = await getGraphQLHeaders();

  const response = await fetch(GITHUB_GRAPHQL_API, {
    method: 'POST',
    headers,
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
async function fetchAllPRReviews(
  owner: string,
  repo: string,
  prNumber: number,
  sinceDate: Date,
): Promise<Map<string, number>> {
  const reviewerCounts = new Map<string, number>();
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data: ReviewsResponse = await executeGraphQLQuery<ReviewsResponse>(GET_PR_REVIEWS_QUERY, {
      owner,
      name: repo,
      number: prNumber,
      cursor,
    });

    const { reviews } = data.repository.pullRequest;

    // Count reviews by author, filtering by date
    for (const review of reviews.nodes) {
      if (review.author?.login && new Date(review.submittedAt) >= sinceDate) {
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
async function fetchAllPRComments(
  owner: string,
  repo: string,
  prNumber: number,
  sinceDate: Date,
): Promise<Map<string, number>> {
  const commenterCounts = new Map<string, number>();
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data: CommentsResponse = await executeGraphQLQuery<CommentsResponse>(
      GET_PR_COMMENTS_QUERY,
      {
        owner,
        name: repo,
        number: prNumber,
        cursor,
      },
    );

    const { comments } = data.repository.pullRequest;

    // Count comments by author, filtering by date
    for (const comment of comments.nodes) {
      if (comment.author?.login && new Date(comment.createdAt) >= sinceDate) {
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
 * Fetch contributor statistics for a repository using GraphQL
 */
export async function fetchContributorStats(
  owner: string,
  repo: string,
): Promise<RepositoryContributorStats> {
  // Calculate date 30 days ago
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sinceDate = thirtyDaysAgo.toISOString();

  console.log('Fetching contributor stats for %s/%s since %s...', owner, repo, sinceDate);

  const contributorMap = new Map<string, ContributorStats>();
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    try {
      const response: GraphQLResponse = await executeGraphQLQuery<GraphQLResponse>(
        GET_CONTRIBUTOR_STATS_QUERY,
        {
          owner,
          name: repo,
          cursor,
        },
      );

      const { pullRequests } = response.repository;

      // Process each PR to collect contributor stats
      for (const pr of pullRequests.nodes) {
        // Skip PRs that haven't been updated in the last 30 days
        if (new Date(pr.updatedAt) < thirtyDaysAgo) {
          continue;
        }

        // Count PR author only if PR was created in the last 30 days
        if (pr.author?.login && new Date(pr.createdAt) >= thirtyDaysAgo) {
          const login = pr.author.login;
          if (!contributorMap.has(login)) {
            contributorMap.set(login, {
              login,
              reviewsCount: 0,
              commentsCount: 0,
              pullRequestsCount: 0,
            });
          }
          contributorMap.get(login)!.pullRequestsCount += 1;
        }

        // Process reviews
        if (pr.reviews.totalCount > 0) {
          // First, count reviews from the initial nodes
          for (const review of pr.reviews.nodes) {
            // Only count reviews submitted in the last 30 days
            if (review.author?.login && new Date(review.submittedAt) >= thirtyDaysAgo) {
              const login = review.author.login;
              if (!contributorMap.has(login)) {
                contributorMap.set(login, {
                  login,
                  reviewsCount: 0,
                  commentsCount: 0,
                  pullRequestsCount: 0,
                });
              }
              contributorMap.get(login)!.reviewsCount += 1;
            }
          }

          // If there are more than 100 reviews, fetch the rest
          if (pr.reviews.totalCount > 100) {
            console.log(
              'PR #%d has %d reviews, fetching remaining...',
              pr.number,
              pr.reviews.totalCount,
            );
            const additionalReviewerCounts = await fetchAllPRReviews(
              owner,
              repo,
              pr.number,
              thirtyDaysAgo,
            );

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
              const existingCount = pr.reviews.nodes.filter(
                (r) => r.author?.login === login && new Date(r.submittedAt) >= thirtyDaysAgo,
              ).length;
              contributorMap.get(login)!.reviewsCount += count - existingCount;
            }
          }
        }

        // Process comments
        if (pr.comments.totalCount > 0) {
          // First, count comments from the initial nodes
          for (const comment of pr.comments.nodes) {
            // Only count comments created in the last 30 days
            if (comment.author?.login && new Date(comment.createdAt) >= thirtyDaysAgo) {
              const login = comment.author.login;
              if (!contributorMap.has(login)) {
                contributorMap.set(login, {
                  login,
                  reviewsCount: 0,
                  commentsCount: 0,
                  pullRequestsCount: 0,
                });
              }
              contributorMap.get(login)!.commentsCount += 1;
            }
          }

          // If there are more than 100 comments, fetch the rest
          if (pr.comments.totalCount > 100) {
            console.log(
              'PR #%d has %d comments, fetching remaining...',
              pr.number,
              pr.comments.totalCount,
            );
            const additionalCommenterCounts = await fetchAllPRComments(
              owner,
              repo,
              pr.number,
              thirtyDaysAgo,
            );

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
              const existingCount = pr.comments.nodes.filter(
                (c) => c.author?.login === login && new Date(c.createdAt) >= thirtyDaysAgo,
              ).length;
              contributorMap.get(login)!.commentsCount += count - existingCount;
            }
          }
        }
      }

      // Update pagination
      hasNextPage = pullRequests.pageInfo.hasNextPage;
      cursor = pullRequests.pageInfo.endCursor;

      console.log(
        'Processed %d PRs, %d contributors found so far',
        pullRequests.nodes.length,
        contributorMap.size,
      );
    } catch (error) {
      console.error(, error);
      throw error;
    }
  }

  console.log(
    'Completed fetching stats for %s/%s: %d contributors',
    owner,
    repo,
    contributorMap.size,
  );

  return {
    owner,
    repo,
    contributors: Array.from(contributorMap.values()),
  };
}

/**
 * Update Supabase database with contributor statistics
 */
export async function updateContributorStatsInDatabase(
  stats: RepositoryContributorStats,
): Promise<void> {
  console.log('Updating _database for %s/%s...', stats.owner, stats.repo);

  // Use admin client if available for write operations
  const dbClient = adminSupabase || supabase;

  if (!adminSupabase) {
    console.warn('⚠️  Using regular client - write operations may fail due to RLS policies');
  }

  // First, get the repository ID from Supabase
  const { data: repoData, error: repoError } = await dbClient
    .from('repositories')
    .select('id')
    .eq('owner', stats.owner)
    .eq('name', stats.repo)
    .maybeSingle();

  if (repoError || !repoData) {
    throw new Error('Repository not found in _database');
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
      const { data: existingContributor, error: contributorError } = await dbClient
        .from('contributors')
        .select('id')
        .eq('username', contributor.login)
        .maybeSingle();

      let contributorId: string;

      if (contributorError && contributorError.code === 'PGRST116') {
        // Contributor doesn't exist, create them
        const { data: newContributor, error: insertError } = await dbClient
          .from('contributors')
          .insert({
            username: contributor.login,
            display_name: contributor.login,
            github_id: 0, // GitHub ID not available from GraphQL query, using 0 as placeholder
          })
          .select('id')
          .maybeSingle();

        if (insertError || !newContributor) {
          console.error('Failed to create contributor %s:', contributor.login, insertError);
          continue;
        }

        contributorId = newContributor.id;
      } else if (contributorError) {
        console.error('Error fetching contributor %s:', contributor.login, contributorError);
        continue;
      } else if (existingContributor) {
        contributorId = existingContributor.id;
      } else {
        continue;
      }

      // Update or insert monthly rankings
      const { error: upsertError } = await dbClient.from('monthly_rankings').upsert(
        {
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
            contributor.commentsCount,
          ),
        },
        {
          onConflict: 'month,year,contributor_id,repository_id',
        },
      );

      if (upsertError) {
        console.error('Failed to update stats for %s:', contributor.login, upsertError);
      } else {
        console.log(
          'Updated stats for %s: %d PRs, %d reviews, %d comments',
          contributor.login,
          contributor.pullRequestsCount,
          contributor.reviewsCount,
          contributor.commentsCount,
        );
      }
    } catch (error) {
      console.error('Error processing contributor %s:', contributor.login, error);
      continue;
    }
  }

  console.log('Database update completed for %s/%s', stats.owner, stats.repo);
}

/**
 * Calculate weighted score for contributor ranking
 * Based on the algorithm from the database schema
 */
function calculateWeightedScore(
  pullRequestsCount: number,
  reviewsCount: number,
  commentsCount: number,
  repositoriesCount: number = 1,
  linesAdded: number = 0,
  linesRemoved: number = 0,
): number {
  return (
    pullRequestsCount * 10.0 +
    reviewsCount * 3.0 +
    commentsCount * 1.0 +
    repositoriesCount * 5.0 +
    Math.min(linesAdded + linesRemoved, 10000) * 0.01
  );
}

/**
 * Fetch and update contributor statistics for a repository
 */
export async function syncRepositoryContributorStats(owner: string, repo: string): Promise<void> {
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
