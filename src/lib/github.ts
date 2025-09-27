import { supabase } from './supabase';
import type { PullRequest } from './types';
import { env } from './env';
import { githubApiRequest } from './github-rate-limit';
import { trackRateLimit, startSpan } from './simple-logging';
import { detectBot } from './utils/bot-detection';

const GITHUB_API_BASE = 'https://api.github.com';

// Use universal environment access
const VITE_GITHUB_TOKEN = env.GITHUB_TOKEN;
const NODE_ENV = env.MODE;

// Type for repository search results
export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  private: boolean;
  pushed_at?: string;
  language?: string | null;
}

// GitHub API PR response type
export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  state: string;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  closed_at: string | null;
  html_url: string;
  user: {
    id: number;
    login: string;
    avatar_url: string;
    type?: string;
  };
  additions?: number;
  deletions?: number;
  changed_files?: number;
}

// GitHub API interfaces for better type safety
interface GitHubOrganization {
  login: string;
  avatar_url: string;
}

interface GitHubReview {
  id: number;
  user: {
    login: string;
    avatar_url: string;
  };
  state: string;
  body: string;
  submitted_at: string;
}

interface GitHubComment {
  id: number;
  user: {
    login: string;
    avatar_url: string;
  };
  body: string;
  created_at: string;
}

interface GitHubStargazer {
  login: string;
  avatar_url: string;
  starred_at: string;
  user?: {
    login: string;
    avatar_url: string;
  };
}

interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    committer?: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
  author?: {
    login: string;
    avatar_url: string;
  };
  committer?: {
    login: string;
    avatar_url: string;
  };
}

export async function searchGitHubRepositories(
  query: string,
  limit: number = 10
): Promise<GitHubRepository[]> {
  if (!query.trim()) {
    return [];
  }

  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json',
  };

  // Try to get user's GitHub token from Supabase session
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userToken = session?.provider_token;

  // Use user's token if available, otherwise fall back to env token
  const token = userToken || VITE_GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `token ${token}`;
  }

  return startSpan(
    {
      name: 'github.api.search_repositories',
      op: 'http.client',
      attributes: {
        'github.search_query': query,
        'github.search_limit': limit,
        'github.has_token': !!token,
        'github.token_type': userToken ? 'user' : 'app',
      },
    },
    async (span) => {
      try {
        // Use GitHub search API to find repositories
        const searchQuery = encodeURIComponent(`${query} in:name,description fork:true`);
        const response = await fetch(
          `${GITHUB_API_BASE}/search/repositories?q=${searchQuery}&sort=stars&order=desc&per_page=${Math.min(limit, 100)}`,
          { headers }
        );

        if (!response.ok) {
          const error = await response.json();
          if (response.status === 403 && error.message?.includes('rate limit')) {
            // Track rate limiting
            const rateLimitReset = response.headers.get('X-RateLimit-Reset');
            const resetTime = rateLimitReset
              ? new Date(parseInt(rateLimitReset) * 1000)
              : undefined;

            trackRateLimit('github', 'search/repositories', undefined, resetTime);

            span.setAttributes({
              'http.status_code': 403,
              'error.type': 'rate_limit',
            });

            if (!token) {
              throw new Error(
                'GitHub API rate limit exceeded. Please log in to continue searching.'
              );
            }
            throw new Error('GitHub API rate limit exceeded. Please try again later.');
          }

          span.setAttributes({
            'http.status_code': response.status,
            'error.type': 'api_error',
          });
          throw new Error(`GitHub API error: ${error.message || response.statusText}`);
        }

        const data = await response.json();
        const results = data.items || [];

        span.setAttributes({
          'github.results_count': results.length,
          'github.success': true,
        });

        // Simple logging without analytics
        console.log('Repository search completed: %s results for "%s"', results.length, query);

        return results;
      } catch (error) {
        span.setAttributes({
          'github.success': false,
          'error.type': error instanceof Error ? error.constructor.name : 'Unknown',
        });

        // Simple error logging without analytics
        console.error('GitHub search error:', error, { query, limit });

        console.error('Error searching GitHub repositories:', error);
        throw error;
      }
    }
  );
}

// Export the fetchUserOrganizations function to fix the missing export error
export async function fetchUserOrganizations(
  username: string,
  headers: HeadersInit
): Promise<{ login: string; avatar_url: string }[]> {
  try {
    const response = await fetch(`${GITHUB_API_BASE}/users/${username}/orgs`, { headers });

    if (!response.ok) {
      return [];
    }

    const orgs = await response.json();
    return orgs.slice(0, 3).map((org: GitHubOrganization) => ({
      login: org.login,
      avatar_url: org.avatar_url,
    }));
  } catch {
    return [];
  }
}

async function fetchPRReviews(owner: string, repo: string, prNumber: number, headers: HeadersInit) {
  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
      { headers }
    );

    if (!response.ok) {
      return [];
    }

    const reviews = await response.json();
    return reviews.map((review: GitHubReview) => ({
      id: review.id,
      state: review.state,
      user: {
        login: review.user.login,
        avatar_url: review.user.avatar_url,
      },
      submitted_at: review.submitted_at,
    }));
  } catch {
    return [];
  }
}

async function fetchPRComments(
  owner: string,
  repo: string,
  prNumber: number,
  headers: HeadersInit
) {
  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${prNumber}/comments`,
      { headers }
    );

    if (!response.ok) {
      return [];
    }

    const comments = await response.json();
    return comments.map((comment: GitHubComment) => ({
      id: comment.id,
      user: {
        login: comment.user.login,
        avatar_url: comment.user.avatar_url,
      },
      created_at: comment.created_at,
    }));
  } catch {
    return [];
  }
}

export async function fetchPullRequests(
  owner: string,
  repo: string,
  timeRange: string = '30',
  limit?: number
): Promise<PullRequest[]> {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json',
  };

  // Try to get user's GitHub token from Supabase session
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userToken = session?.provider_token;

  // Use user's token if available, otherwise fall back to env token
  const token = userToken || VITE_GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `token ${token}`;
  }

  return startSpan(
    {
      name: 'github.api.fetch_pull_requests',
      op: 'http.client',
      attributes: {
        'github.owner': owner,
        'github.repo': repo,
        'github.time_range': timeRange,
        'github.has_token': !!token,
        'github.token_type': userToken ? 'user' : 'app',
      },
    },
    async (span) => {
      try {
        // Calculate date range based on timeRange parameter
        const since = new Date();
        since.setDate(since.getDate() - parseInt(timeRange));

        // Fetch multiple pages of PRs to ensure we get all recent ones
        const allPRs: GitHubPullRequest[] = [];
        let page = 1;
        const perPage = 100;

        while (page <= 10) {
          // Limit to 10 pages (1000 PRs) for very active repositories
          // Check if we've reached the limit
          if (limit !== undefined && allPRs.length >= limit) {
            break;
          }
          // In test environment, use direct fetch to maintain test compatibility
          if (NODE_ENV === 'test' || process.env.VITEST) {
            const response = await fetch(
              `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=${perPage}&page=${page}`,
              { headers }
            );

            if (!response.ok) {
              if (page === 1) {
                if (response.status === 404) {
                  span.setAttributes({
                    'http.status_code': 404,
                    'error.type': 'repository_not_found',
                  });
                  throw new Error(
                    `Repository "${owner}/${repo}" not found. Please check if the repository exists and is public.`
                  );
                }
                throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
              }
              break; // Stop fetching if later pages fail
            }

            const prs = await response.json();

            // If we have a limit, only take what we need
            if (limit && allPRs.length + prs.length > limit) {
              const remaining = limit - allPRs.length;
              allPRs.push(...prs.slice(0, remaining));
              break;
            } else {
              allPRs.push(...prs);
            }

            // If we got less than a full page, we're done
            if (prs.length < perPage) {
              break;
            }

            // Check if all PRs are too old to be relevant
            const oldestPRDate = new Date(prs[prs.length - 1].updated_at);
            if (oldestPRDate < since) {
              break; // No point in fetching older PRs
            }
          } else {
            // Production: Use enhanced API request with retry logic and 503 handling
            try {
              const { data: prs, rateLimitInfo } = await githubApiRequest<GitHubPullRequest[]>(
                `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=${perPage}&page=${page}`,
                { headers }
              );

              // Handle case where API request failed or returned invalid data
              if (!prs || !Array.isArray(prs)) {
                if (page === 1) {
                  span.setAttributes({
                    'http.status_code': 404,
                    'error.type': 'repository_not_found',
                  });
                  throw new Error(
                    `Repository "${owner}/${repo}" not found. Please check if the repository exists and is public.`
                  );
                }
                break; // Stop fetching if later pages fail
              }

              // Track rate limit info if available
              if (rateLimitInfo) {
                span.setAttributes({
                  'github.rate_limit.remaining': rateLimitInfo.remaining,
                  'github.rate_limit.limit': rateLimitInfo.limit,
                });
              }

              // If we have a limit, only take what we need
              if (limit && allPRs.length + prs.length > limit) {
                const remaining = limit - allPRs.length;
                allPRs.push(...prs.slice(0, remaining));
                break;
              } else {
                allPRs.push(...prs);
              }

              // If we got less than a full page, we're done
              if (prs.length < perPage) {
                break;
              }

              // Check if all PRs are too old to be relevant
              if (prs.length > 0) {
                const oldestPRDate = new Date(prs[prs.length - 1].updated_at);
                if (oldestPRDate < since) {
                  break; // No point in fetching older PRs
                }
              }
            } catch (error) {
              // If this is the first page and we get an error, it's likely a 404 or auth issue
              if (page === 1) {
                throw error; // Re-throw the error for proper handling
              }
              // For subsequent pages, just stop fetching
              break;
            }
          }

          page++;
        }

        // Filter PRs by the time range
        const filteredPRs = allPRs.filter((pr: GitHubPullRequest) => {
          const prDate = new Date(pr.updated_at);
          return prDate >= since;
        });

        // Fetch additional details for each PR to get additions/deletions
        const detailedPRs = await Promise.all(
          filteredPRs.map(async (pr: GitHubPullRequest) => {
            const detailsResponse = await fetch(
              `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${pr.number}`,
              { headers }
            );

            if (!detailsResponse.ok) {
              return {
                ...pr,
                additions: 0,
                deletions: 0,
              };
            }

            const details = await detailsResponse.json();

            // Fetch user's organizations
            const organizations = await fetchUserOrganizations(pr.user.login, headers);

            // Fetch PR reviews and comments (in parallel)
            const [reviews, comments] = await Promise.all([
              fetchPRReviews(owner, repo, pr.number, headers),
              fetchPRComments(owner, repo, pr.number, headers),
            ]);

            // Check if user is a bot using centralized detection
            const isBot = detectBot({ githubUser: pr.user }).isBot;

            return {
              id: pr.id,
              number: pr.number,
              title: pr.title,
              state: pr.state,
              created_at: pr.created_at,
              updated_at: pr.updated_at,
              merged_at: pr.merged_at,
              closed_at: pr.closed_at,
              additions: details.additions,
              deletions: details.deletions,
              changed_files: details.changed_files,
              repository_owner: owner,
              repository_name: repo,
              html_url: pr.html_url,
              user: {
                id: pr.user.id,
                login: pr.user.login,
                avatar_url: pr.user.avatar_url,
                type: isBot ? 'Bot' : 'User',
              },
              organizations,
              reviews,
              comments,
            };
          })
        );

        // Track successful completion
        span.setAttributes({
          'github.prs_fetched': detailedPRs.length,
          'github.pages_fetched': page - 1,
          'github.success': true,
        });

        // Simple logging without analytics
        console.log('Successfully fetched %s PRs for %s/%s', detailedPRs.length, owner, repo);

        return detailedPRs;
      } catch (error) {
        span.setAttributes({
          'github.success': false,
          'error.type': error instanceof Error ? error.constructor.name : 'Unknown',
        });

        // Simple error logging without analytics
        console.error('GitHub API error:', error, { owner, repo, timeRange });

        if (error instanceof Error) {
          throw error;
        }
        throw new Error('An unexpected error occurred while fetching repository data.');
      }
    }
  );
}

export async function fetchRepositoryInfo(
  owner: string,
  repo: string
): Promise<{
  id: number;
  name: string;
  full_name: string;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  open_issues_count: number;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  size: number;
  language: string | null;
  fork: boolean;
  archived: boolean;
  disabled: boolean;
  private: boolean;
} | null> {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json',
  };

  // Try to get user's GitHub token from Supabase session
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userToken = session?.provider_token;

  // Use user's token if available, otherwise fall back to env token
  const token = userToken || VITE_GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `token ${token}`;
  }

  try {
    const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Repository not found or not accessible
      }
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    const repoData = await response.json();
    return {
      id: repoData.id,
      name: repoData.name,
      full_name: repoData.full_name,
      stargazers_count: repoData.stargazers_count,
      forks_count: repoData.forks_count,
      watchers_count: repoData.watchers_count,
      open_issues_count: repoData.open_issues_count,
      created_at: repoData.created_at,
      updated_at: repoData.updated_at,
      pushed_at: repoData.pushed_at,
      size: repoData.size,
      language: repoData.language,
      fork: repoData.fork,
      archived: repoData.archived,
      disabled: repoData.disabled,
      private: repoData.private,
    };
  } catch (error) {
    console.error('Error fetching repository info:', error);
    return null;
  }
}

export async function fetchRepositoryStargazers(
  owner: string,
  repo: string,
  limit: number = 100
): Promise<
  {
    login: string;
    avatar_url: string;
    starred_at: string;
  }[]
> {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3.star+json', // This gives us starred_at timestamps
  };

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userToken = session?.provider_token;
  const token = userToken || VITE_GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `token ${token}`;
  }

  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/stargazers?per_page=${Math.min(limit, 100)}&sort=created&direction=desc`,
      { headers }
    );

    if (!response.ok) {
      return [];
    }

    const stargazers = await response.json();
    return stargazers.map((star: GitHubStargazer) => ({
      login: star.user?.login || star.login,
      avatar_url: star.user?.avatar_url || star.avatar_url,
      starred_at: star.starred_at || new Date().toISOString(), // Fallback if no timestamp
    }));
  } catch (error) {
    console.error('Error fetching stargazers:', error);
    return [];
  }
}

export async function fetchRepositoryCommitActivity(
  owner: string,
  repo: string,
  timeRange: string = '30'
): Promise<{
  totalCommits: number;
  commitFrequency: number; // commits per day
  uniqueCommitters: number;
  recentCommits: Array<{
    sha: string;
    author: {
      login: string;
      avatar_url: string;
    };
    commit: {
      message: string;
      author: {
        date: string;
      };
    };
  }>;
}> {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json',
  };

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userToken = session?.provider_token;
  const token = userToken || VITE_GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `token ${token}`;
  }

  try {
    // Calculate date range
    const since = new Date();
    since.setDate(since.getDate() - parseInt(timeRange));

    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits?since=${since.toISOString()}&per_page=100`,
      { headers }
    );

    if (!response.ok) {
      return { totalCommits: 0, commitFrequency: 0, uniqueCommitters: 0, recentCommits: [] };
    }

    const commits = await response.json();
    const uniqueCommitters = new Set();
    const recentCommits = commits.slice(0, 10).map((commit: GitHubCommit) => {
      if (commit.author?.login) {
        uniqueCommitters.add(commit.author.login);
      }
      return {
        sha: commit.sha,
        author: {
          login: commit.author?.login || 'unknown',
          avatar_url: commit.author?.avatar_url || '',
        },
        commit: {
          message: commit.commit.message,
          author: {
            date: commit.commit.author.date,
          },
        },
      };
    });

    const totalCommits = commits.length;
    const commitFrequency = totalCommits / parseInt(timeRange);

    return {
      totalCommits,
      commitFrequency,
      uniqueCommitters: uniqueCommitters.size,
      recentCommits,
    };
  } catch (error) {
    console.error('Error fetching commit activity:', error);
    return { totalCommits: 0, commitFrequency: 0, uniqueCommitters: 0, recentCommits: [] };
  }
}

export async function fetchDirectCommits(
  owner: string,
  repo: string,
  timeRange: string = '30'
): Promise<{
  directCommits: Array<{
    sha: string;
    actor: {
      login: string;
      avatar_url: string;
      type?: 'User' | 'Bot';
    };
    event_time: string;
    push_num_commits: number;
  }>;
  hasYoloCoders: boolean;
  yoloCoderStats: Array<{
    login: string;
    avatar_url: string;
    directCommits: number;
    totalCommits: number;
    directCommitPercentage: number;
    type?: 'User' | 'Bot';
  }>;
}> {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json',
  };

  // Try to get user's GitHub token from Supabase session
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userToken = session?.provider_token;

  // Use user's token if available, otherwise fall back to env token
  const token = userToken || VITE_GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `token ${token}`;
  }

  try {
    // First, get the default branch for the repository
    const repoResponse = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, { headers });

    if (!repoResponse.ok) {
      throw new Error(`Failed to fetch repository information: ${repoResponse.statusText}`);
    }

    const repoData = await repoResponse.json();
    const defaultBranch = repoData.default_branch;

    // Calculate date range based on timeRange parameter (support up to 90 days)
    const since = new Date();
    since.setDate(since.getDate() - Math.min(parseInt(timeRange), 90));

    // Get merged PRs for the repository in the time range to identify PR-related commits
    const pullRequests = await fetchPullRequests(owner, repo, timeRange);
    const mergedPRs = pullRequests.filter((pr) => {
      if (!pr.merged_at) return false;
      // Only include PRs merged within our time range
      const mergedDate = new Date(pr.merged_at);
      return mergedDate >= since;
    });

    // Debug logging (can be removed in production)
    if (NODE_ENV === 'development') {
      console.log('YOLO Debug - Total PRs found: %s', pullRequests.length);
      console.log('YOLO Debug - Merged PRs found: %s', mergedPRs.length);
      console.log(
        'YOLO Debug - Time range: %s to %s',
        since.toISOString(),
        new Date().toISOString()
      );
      if (mergedPRs.length > 0) {
        console.log(
          `YOLO Debug - Sample merged PR dates:`,
          mergedPRs.slice(0, 3).map((pr) => pr.merged_at)
        );
      }
    }

    // Collect all commit SHAs that are associated with merged PRs
    const prCommitShaSet = new Set<string>();

    await Promise.all(
      mergedPRs.map(async (pr) => {
        try {
          // Fetch the commits for this PR to get all commit SHAs
          const prCommitsResponse = await fetch(
            `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${pr.number}/commits`,
            { headers }
          );

          if (prCommitsResponse.ok) {
            const prCommits = await prCommitsResponse.json();
            if (NODE_ENV === 'development') {
              console.log('YOLO Debug - PR #%s has %s commits', pr.number, prCommits.length);
            }
            prCommits.forEach((commit: GitHubCommit) => {
              prCommitShaSet.add(commit.sha);
            });
          } else if (NODE_ENV === 'development') {
            console.log(
              'YOLO Debug - Failed to fetch commits for PR #%s: %s',
              pr.number,
              prCommitsResponse.statusText
            );
          }
        } catch (error) {
          if (NODE_ENV === 'development') {
            console.log('YOLO Debug - Error fetching commits for PR #%s:', pr.number, error);
          }
          // Silently continue - error fetching commits for individual PRs shouldn't break the whole process
        }
      })
    );

    // Fetch commits directly from the default branch using commits API
    // This is more reliable than the events API for longer time ranges
    const allCommits: GitHubCommit[] = [];
    let page = 1;
    const perPage = 100;

    while (page <= 10) {
      // Limit to 10 pages (1000 commits) to avoid rate limiting
      const commitsResponse = await fetch(
        `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits?sha=${defaultBranch}&since=${since.toISOString()}&per_page=${perPage}&page=${page}`,
        { headers }
      );

      if (!commitsResponse.ok) {
        if (page === 1) {
          throw new Error(`Failed to fetch repository commits: ${commitsResponse.statusText}`);
        }
        break; // Stop fetching if later pages fail
      }

      const commits = await commitsResponse.json();
      if (commits.length === 0) {
        break; // No more commits
      }

      allCommits.push(...commits);

      // If we got less than a full page, we're done
      if (commits.length < perPage) {
        break;
      }

      page++;
    }

    // Filter commits to find direct commits (those not associated with merged PRs)
    if (NODE_ENV === 'development') {
      console.log('YOLO Debug - Total commits on main branch: %s', allCommits.length);
      console.log('YOLO Debug - PR commit SHAs collected: %s', prCommitShaSet.size);
      console.log('YOLO Debug - Sample PR commit SHAs:', Array.from(prCommitShaSet).slice(0, 5));
    }

    const directCommitData = allCommits.filter((commit: GitHubCommit) => {
      const isDirectCommit = !prCommitShaSet.has(commit.sha);
      if (isDirectCommit && NODE_ENV === 'development') {
        console.log(
          'YOLO Debug - Direct commit found: %s by %s',
          commit.sha,
          commit.author?.login || commit.committer?.login || 'unknown'
        );
      }
      return isDirectCommit;
    });

    if (NODE_ENV === 'development') {
      console.log('YOLO Debug - Direct commits found: %s', directCommitData.length);
    }

    // Format the direct commits data
    const directCommits = directCommitData.map((commit: GitHubCommit) => {
      const author = commit.author || commit.committer || { login: 'unknown', avatar_url: '' };
      const login = author.login || 'unknown';
      const avatar_url = author.avatar_url || '';
      const isBot = login.includes('[bot]');

      return {
        sha: commit.sha,
        actor: {
          login,
          avatar_url,
          type: isBot ? ('Bot' as const) : ('User' as const),
        },
        event_time:
          commit.commit.author?.date || commit.commit.committer?.date || new Date().toISOString(),
        push_num_commits: 1, // Each commit represents one commit
      };
    });

    // Calculate statistics for YOLO coders (authors with direct commits)
    const yoloCoderMap = new Map<
      string,
      {
        login: string;
        avatar_url: string;
        directCommits: number;
        totalCommits: number;
        directCommitPercentage: number;
        type?: 'User' | 'Bot';
      }
    >();

    for (const commit of directCommits) {
      const login = commit.actor.login;

      // Check if this is a bot
      const isBot = login.includes('[bot]');

      if (yoloCoderMap.has(login)) {
        const coder = yoloCoderMap.get(login)!;
        coder.directCommits += 1;
        coder.totalCommits += commit.push_num_commits;
      } else {
        yoloCoderMap.set(login, {
          login,
          avatar_url: commit.actor.avatar_url,
          directCommits: 1,
          totalCommits: commit.push_num_commits,
          directCommitPercentage: 0, // Will be calculated below
          type: isBot ? ('Bot' as const) : ('User' as const),
        });
      }
    }

    const yoloCoderStats = Array.from(yoloCoderMap.values())
      .map((coder) => ({
        ...coder,
        directCommitPercentage:
          coder.totalCommits > 0 ? Math.round((coder.directCommits / coder.totalCommits) * 100) : 0,
      }))
      .sort((a, b) => b.directCommits - a.directCommits);

    return {
      directCommits,
      hasYoloCoders: directCommits.length > 0,
      yoloCoderStats,
    };
  } catch {
    return {
      directCommits: [],
      hasYoloCoders: false,
      yoloCoderStats: [],
    };
  }
}
