/**
 * GitHub API Utilities for Edge Functions
 * 
 * Shared utilities for interacting with the GitHub API, including common
 * operations, rate limit handling, and standardized request patterns.
 * 
 * @module github
 */

/**
 * GitHub API configuration
 */
export const GITHUB_API_BASE = 'https://api.github.com';
export const DEFAULT_USER_AGENT = 'Contributor-Info-Bot';

/**
 * Creates standard GitHub API headers
 * 
 * @param {string} token - GitHub API token (optional, uses env var if not provided)
 * @param {string} userAgent - User agent string (optional)
 * @returns {HeadersInit} Headers object for fetch requests
 * @throws {Error} If no token is available
 * 
 * @example
 * const headers = getGitHubHeaders();
 * const response = await fetch(`${GITHUB_API_BASE}/repos/owner/name`, { headers });
 */
export function getGitHubHeaders(
  token?: string,
  userAgent: string = DEFAULT_USER_AGENT
): HeadersInit {
  const githubToken = token || Deno.env.get('GITHUB_TOKEN');
  
  if (!githubToken) {
    throw new Error('GitHub token not configured');
  }

  return {
    'Authorization': `Bearer ${githubToken}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': userAgent,
  };
}

/**
 * Rate limit information from GitHub API response
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
}

/**
 * Extracts rate limit information from GitHub API response headers
 * 
 * @param {Response} response - Fetch response from GitHub API
 * @returns {RateLimitInfo | null} Rate limit information or null if headers not present
 * 
 * @example
 * const response = await fetch(url, { headers });
 * const rateLimit = getRateLimitInfo(response);
 * if (rateLimit && rateLimit.remaining < 100) {
 *   console.warn(`Low rate limit: ${rateLimit.remaining} remaining`);
 * }
 */
export function getRateLimitInfo(response: Response): RateLimitInfo | null {
  const limit = response.headers.get('x-ratelimit-limit');
  const remaining = response.headers.get('x-ratelimit-remaining');
  const reset = response.headers.get('x-ratelimit-reset');
  const used = response.headers.get('x-ratelimit-used');

  if (!limit || !remaining || !reset) {
    return null;
  }

  return {
    limit: parseInt(limit),
    remaining: parseInt(remaining),
    reset: parseInt(reset),
    used: used ? parseInt(used) : 0,
  };
}

/**
 * Checks if rate limit is low and logs a warning
 * 
 * @param {Response} response - Fetch response from GitHub API
 * @param {number} threshold - Remaining requests threshold to warn at (default: 100)
 * @returns {boolean} True if rate limit is low
 * 
 * @example
 * const response = await fetch(url, { headers });
 * if (checkRateLimit(response, 50)) {
 *   // Consider pausing or slowing down requests
 * }
 */
export function checkRateLimit(response: Response, threshold: number = 100): boolean {
  const rateLimit = getRateLimitInfo(response);
  
  if (!rateLimit) {
    return false;
  }

  if (rateLimit.remaining < threshold) {
    const resetDate = new Date(rateLimit.reset * 1000);
    console.warn(
      'Low GitHub API rate limit: %s remaining (resets at %s)',
      rateLimit.remaining,
      resetDate.toISOString()
    );
    return true;
  }

  return false;
}

/**
 * Fetches data from GitHub API with error handling
 * 
 * @param {string} url - GitHub API URL
 * @param {string} token - GitHub API token (optional)
 * @returns {Promise<T>} Parsed JSON response
 * @throws {Error} If request fails
 * 
 * @example
 * const repo = await fetchGitHubAPI<Repository>(
 *   `${GITHUB_API_BASE}/repos/owner/name`
 * );
 */
export async function fetchGitHubAPI<T = unknown>(
  url: string,
  token?: string
): Promise<T> {
  const headers = getGitHubHeaders(token);
  const response = await fetch(url, { headers });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `GitHub API error: ${response.status} ${response.statusText} - ${errorBody}`
    );
  }

  return await response.json() as T;
}

/**
 * GitHub repository information
 */
export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    id: number;
    avatar_url: string;
    type: string;
  };
  description: string | null;
  private: boolean;
  html_url: string;
  default_branch: string;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  open_issues_count: number;
  topics?: string[];
  language: string | null;
  archived: boolean;
  disabled: boolean;
}

/**
 * Fetches repository information from GitHub
 * 
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} token - GitHub API token (optional)
 * @returns {Promise<GitHubRepository>} Repository information
 * 
 * @example
 * const repo = await fetchRepository('facebook', 'react');
 */
export async function fetchRepository(
  owner: string,
  repo: string,
  token?: string
): Promise<GitHubRepository> {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}`;
  return await fetchGitHubAPI<GitHubRepository>(url, token);
}

/**
 * GitHub user information
 */
export interface GitHubUserInfo {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  html_url: string;
  type: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  twitter_username: string | null;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
}

/**
 * Fetches user information from GitHub
 * 
 * @param {string} username - GitHub username
 * @param {string} token - GitHub API token (optional)
 * @returns {Promise<GitHubUserInfo>} User information
 * 
 * @example
 * const user = await fetchUser('octocat');
 */
export async function fetchUser(
  username: string,
  token?: string
): Promise<GitHubUserInfo> {
  const url = `${GITHUB_API_BASE}/users/${username}`;
  return await fetchGitHubAPI<GitHubUserInfo>(url, token);
}

/**
 * Paginated fetch options
 */
export interface PaginatedFetchOptions {
  token?: string;
  perPage?: number;
  maxPages?: number;
  since?: string;
}

/**
 * Fetches paginated data from GitHub API
 * 
 * Automatically handles pagination and rate limiting
 * 
 * @param {string} baseUrl - Base GitHub API URL (without pagination params)
 * @param {PaginatedFetchOptions} options - Fetch options
 * @returns {Promise<T[]>} Array of all fetched items
 * 
 * @example
 * const events = await fetchPaginated<GitHubEvent>(
 *   `${GITHUB_API_BASE}/repos/owner/name/events`,
 *   { perPage: 100, maxPages: 3 }
 * );
 */
export async function fetchPaginated<T = unknown>(
  baseUrl: string,
  options: PaginatedFetchOptions = {}
): Promise<T[]> {
  const {
    token,
    perPage = 100,
    maxPages = 10,
  } = options;

  const headers = getGitHubHeaders(token);
  const allItems: T[] = [];
  let page = 1;

  while (page <= maxPages) {
    const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}per_page=${perPage}&page=${page}`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        console.error('Resource not found: %s', baseUrl);
        break;
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const items = await response.json() as T[];
    
    if (items.length === 0) {
      break;
    }

    allItems.push(...items);

    // Check rate limit
    if (checkRateLimit(response, 100)) {
      console.warn('Stopping pagination due to low rate limit');
      break;
    }

    // If we got less than a full page, we're done
    if (items.length < perPage) {
      break;
    }

    page++;
  }

  return allItems;
}

/**
 * Checks if a user is a bot account
 * 
 * @param {string} login - GitHub username
 * @param {string} type - GitHub account type
 * @returns {boolean} True if account is a bot
 * 
 * @example
 * if (isBotUser(user.login, user.type)) {
 *   console.log('Skipping bot account');
 * }
 */
export function isBotUser(login: string, type?: string): boolean {
  return type === 'Bot' || login.includes('[bot]') || login.endsWith('-bot');
}
