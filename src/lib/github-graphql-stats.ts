import { supabase } from './supabase';
import { env } from './env';

const GITHUB_GRAPHQL_API = 'https://api.github.com/graphql';

// Use universal environment access
const VITE_GITHUB_TOKEN = env.GITHUB_TOKEN;

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
        author: { login: string } | null;
        reviews: {
          nodes: Array<{ author: { login: string } | null }>;
          totalCount: number;
        };
        comments: {
          nodes: Array<{ author: { login: string } | null }>;
          totalCount: number;
        };
      }>;
    };
  };
}

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
 * Fetch headers for GitHub GraphQL API
 */
async function getGraphQLHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Try to get user's GitHub token from Supabase session
  const { data: { session } } = await supabase.auth.getSession();
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
  variables: Record<string, any>
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
 * Fetch contributor statistics for a repository using GraphQL
 */
export async function fetchContributorStats(
  owner: string,
  repo: string
): Promise<RepositoryContributorStats> {
  console.log(`Fetching contributor stats for ${owner}/${repo}...`);
  
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
        }
      );

      const { pullRequests } = response.repository;
      
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
          contributorMap.get(login)!.pullRequestsCount += 1;
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
            contributorMap.get(login)!.reviewsCount += 1;
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
            contributorMap.get(login)!.commentsCount += 1;
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
export async function updateContributorStatsInDatabase(
  stats: RepositoryContributorStats
): Promise<void> {
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

      let contributorId: string;

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
 * Calculate weighted score for contributor ranking
 * Based on the algorithm from the database schema
 */
function calculateWeightedScore(
  pullRequestsCount: number,
  reviewsCount: number,
  commentsCount: number,
  repositoriesCount: number = 1,
  linesAdded: number = 0,
  linesRemoved: number = 0
): number {
  return (
    (pullRequestsCount * 10.0) +
    (reviewsCount * 3.0) +
    (commentsCount * 1.0) +
    (repositoriesCount * 5.0) +
    (Math.min(linesAdded + linesRemoved, 10000) * 0.01)
  );
}

/**
 * Fetch and update contributor statistics for a repository
 */
export async function syncRepositoryContributorStats(
  owner: string,
  repo: string
): Promise<void> {
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