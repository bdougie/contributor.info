/**
 * Pure GitHub API service functions
 * These functions are dependency-free and easily testable
 */

const GITHUB_API_BASE = 'https://api.github.com';

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  used: number;
}

export interface GitHubApiConfig {
  token: string | null;
}

/**
 * Parse rate limit information from response headers
 */
export function parseRateLimit(headers: Headers): RateLimitInfo | null {
  const limit = headers.get('x-ratelimit-limit');
  const remaining = headers.get('x-ratelimit-remaining');
  const reset = headers.get('x-ratelimit-reset');
  const used = headers.get('x-ratelimit-used');

  if (limit && remaining && reset && used) {
    return {
      limit: parseInt(limit, 10),
      remaining: parseInt(remaining, 10),
      reset: new Date(parseInt(reset, 10) * 1000),
      used: parseInt(used, 10),
    };
  }

  return null;
}

/**
 * Create headers for GitHub API requests
 */
export function createHeaders(token: string | null): HeadersInit {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Check if rate limited based on rate limit info
 */
export function isRateLimited(rateLimit: RateLimitInfo | null): boolean {
  if (!rateLimit) return false;
  return rateLimit.remaining === 0;
}

/**
 * Make a request to the GitHub API
 */
export async function fetchFromGitHub<T = unknown>(
  path: string,
  config: GitHubApiConfig,
): Promise<{ data: T; rateLimit: RateLimitInfo | null }> {
  const headers = createHeaders(config.token);
  const response = await fetch(`${GITHUB_API_BASE}${path}`, { headers });

  const rateLimit = parseRateLimit(response.headers);

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}. ${_errorBody}`);
  }

  const _data = (await response.json()) as T;
  return { data, rateLimit };
}

/**
 * Fetch repository information
 */
export async function fetchRepository(owner: string, repo: string, config: GitHubApiConfig) {
  return fetchFromGitHub(`/repos/${owner}/${repo}`, config);
}

/**
 * Fetch user information
 */
export async function fetchUser(username: string, config: GitHubApiConfig) {
  return fetchFromGitHub(`/users/${username}`, config);
}

/**
 * Fetch user organizations
 */
export async function fetchUserOrganizations(username: string, config: GitHubApiConfig) {
  return fetchFromGitHub(`/users/${username}/orgs`, config);
}

/**
 * Fetch pull requests for a repository
 */
export async function fetchPullRequests(
  owner: string,
  repo: string,
  state: 'open' | 'closed' | 'all' = 'all',
  config: GitHubApiConfig,
) {
  return fetchFromGitHub(`/repos/${owner}/${repo}/pulls?state=${state}&per_page=100`, config);
}
