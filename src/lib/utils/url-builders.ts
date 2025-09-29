/**
 * Centralized URL construction utilities
 */

import { API_PATHS } from '@/lib/constants/api-constants';

/**
 * Validates that the provided string is a valid GitHub username or organization name
 */
function validateGitHubName(name: string): string {
  if (!name || typeof name !== 'string') {
    throw new Error('Invalid GitHub name provided');
  }
  // GitHub usernames can only contain alphanumeric characters or hyphens
  const sanitized = name.replace(/[^a-zA-Z0-9-]/g, '');
  if (sanitized !== name) {
    console.warn(`GitHub name contained invalid characters: ${name}`);
  }
  return sanitized;
}

/**
 * Validates that the provided string is a valid repository name
 */
function validateRepoName(name: string): string {
  if (!name || typeof name !== 'string') {
    throw new Error('Invalid repository name provided');
  }
  // Repository names can contain alphanumeric, hyphens, underscores, and dots
  const sanitized = name.replace(/[^a-zA-Z0-9-_.]/g, '');
  if (sanitized !== name) {
    console.warn(`Repository name contained invalid characters: ${name}`);
  }
  return sanitized;
}

/**
 * GitHub URL builders
 */
export const githubUrls = {
  // Web URLs
  repo: (owner: string, repo: string) =>
    `${API_PATHS.GITHUB_WEB}/${validateGitHubName(owner)}/${validateRepoName(repo)}`,

  issue: (owner: string, repo: string, issueNumber: number) =>
    `${API_PATHS.GITHUB_WEB}/${validateGitHubName(owner)}/${validateRepoName(repo)}/issues/${issueNumber}`,

  pullRequest: (owner: string, repo: string, prNumber: number) =>
    `${API_PATHS.GITHUB_WEB}/${validateGitHubName(owner)}/${validateRepoName(repo)}/pull/${prNumber}`,

  commit: (owner: string, repo: string, sha: string) =>
    `${API_PATHS.GITHUB_WEB}/${validateGitHubName(owner)}/${validateRepoName(repo)}/commit/${sha}`,

  user: (username: string) => `${API_PATHS.GITHUB_WEB}/${validateGitHubName(username)}`,

  file: (owner: string, repo: string, branch: string, path: string) =>
    `${API_PATHS.GITHUB_WEB}/${validateGitHubName(owner)}/${validateRepoName(repo)}/blob/${branch}/${path}`,

  raw: (owner: string, repo: string, branch: string, path: string) =>
    `${API_PATHS.GITHUB_RAW}/${validateGitHubName(owner)}/${validateRepoName(repo)}/${branch}/${path}`,

  releases: (owner: string, repo: string) =>
    `${API_PATHS.GITHUB_WEB}/${validateGitHubName(owner)}/${validateRepoName(repo)}/releases`,

  actions: (owner: string, repo: string) =>
    `${API_PATHS.GITHUB_WEB}/${validateGitHubName(owner)}/${validateRepoName(repo)}/actions`,

  compare: (owner: string, repo: string, base: string, head: string) =>
    `${API_PATHS.GITHUB_WEB}/${validateGitHubName(owner)}/${validateRepoName(repo)}/compare/${base}...${head}`,
} as const;

/**
 * GitHub API URL builders
 */
export const githubApiUrls = {
  // Repository endpoints
  repo: (owner: string, repo: string) =>
    `${API_PATHS.GITHUB_BASE}/repos/${validateGitHubName(owner)}/${validateRepoName(repo)}`,

  repos: (owner: string) => `${API_PATHS.GITHUB_BASE}/users/${validateGitHubName(owner)}/repos`,

  // Issues and PRs
  issues: (owner: string, repo: string) =>
    `${API_PATHS.GITHUB_BASE}/repos/${validateGitHubName(owner)}/${validateRepoName(repo)}/issues`,

  issue: (owner: string, repo: string, issueNumber: number) =>
    `${API_PATHS.GITHUB_BASE}/repos/${validateGitHubName(owner)}/${validateRepoName(repo)}/issues/${issueNumber}`,

  pulls: (owner: string, repo: string) =>
    `${API_PATHS.GITHUB_BASE}/repos/${validateGitHubName(owner)}/${validateRepoName(repo)}/pulls`,

  pull: (owner: string, repo: string, prNumber: number) =>
    `${API_PATHS.GITHUB_BASE}/repos/${validateGitHubName(owner)}/${validateRepoName(repo)}/pulls/${prNumber}`,

  // Commits
  commits: (owner: string, repo: string) =>
    `${API_PATHS.GITHUB_BASE}/repos/${validateGitHubName(owner)}/${validateRepoName(repo)}/commits`,

  commit: (owner: string, repo: string, sha: string) =>
    `${API_PATHS.GITHUB_BASE}/repos/${validateGitHubName(owner)}/${validateRepoName(repo)}/commits/${sha}`,

  // Contributors
  contributors: (owner: string, repo: string) =>
    `${API_PATHS.GITHUB_BASE}/repos/${validateGitHubName(owner)}/${validateRepoName(repo)}/contributors`,

  // Stargazers
  stargazers: (owner: string, repo: string) =>
    `${API_PATHS.GITHUB_BASE}/repos/${validateGitHubName(owner)}/${validateRepoName(repo)}/stargazers`,

  // Releases
  releases: (owner: string, repo: string) =>
    `${API_PATHS.GITHUB_BASE}/repos/${validateGitHubName(owner)}/${validateRepoName(repo)}/releases`,

  // Users
  user: (username: string) => `${API_PATHS.GITHUB_BASE}/users/${validateGitHubName(username)}`,

  // Rate limit
  rateLimit: () => `${API_PATHS.GITHUB_BASE}/rate_limit`,

  // Search
  searchRepos: () => `${API_PATHS.GITHUB_BASE}/search/repositories`,

  searchIssues: () => `${API_PATHS.GITHUB_BASE}/search/issues`,

  searchUsers: () => `${API_PATHS.GITHUB_BASE}/search/users`,
} as const;

/**
 * Application-specific URL builders
 */
export const appUrls = {
  // User pages
  userProfile: (username: string) => `/user/${validateGitHubName(username)}`,

  // Repository pages
  repository: (owner: string, repo: string) =>
    `/repo/${validateGitHubName(owner)}/${validateRepoName(repo)}`,

  // Workspace pages
  workspace: (workspaceId: string) => `/workspace/${workspaceId}`,

  // Settings
  settings: () => '/settings',
  settingsProfile: () => '/settings/profile',
  settingsWorkspaces: () => '/settings/workspaces',

  // Admin
  admin: () => '/admin',
  adminUsers: () => '/admin/users',
  adminRepos: () => '/admin/repositories',
} as const;

/**
 * External service URL builders
 */
export const externalUrls = {
  // NPM
  npmPackage: (packageName: string) =>
    `https://www.npmjs.com/package/${encodeURIComponent(packageName)}`,

  // PyPI
  pypiPackage: (packageName: string) =>
    `https://pypi.org/project/${encodeURIComponent(packageName)}`,

  // Docker Hub
  dockerImage: (image: string) => `https://hub.docker.com/r/${encodeURIComponent(image)}`,
} as const;

/**
 * Builds a URL with query parameters
 * Handles both absolute and relative URLs
 */
export function buildUrlWithParams(
  baseUrl: string,
  params: Record<string, string | number | boolean | undefined>
): string {
  // Check if it's a relative URL (doesn't start with http:// or https://)
  const isRelative = !baseUrl.startsWith('http://') && !baseUrl.startsWith('https://');

  if (isRelative) {
    // For relative URLs, build the query string separately
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });

    const queryString = searchParams.toString();
    if (!queryString) {
      return baseUrl;
    }

    // Append query string to relative URL
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}${queryString}`;
  }

  // For absolute URLs, use URL constructor
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.append(key, String(value));
    }
  });
  return url.toString();
}
