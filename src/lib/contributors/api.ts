/**
 * API integration functions for fetching contributor activity data
 */

import { ContributorActivity, ContributorApiResponse, RepositoryFilter } from './types';
import { getMonthDateRange } from '../utils/date-helpers';

/**
 * Base configuration for GitHub API calls
 */
const GITHUB_API_BASE = 'https://api.github.com';

/**
 * GitHub API types
 */
interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
}

interface GitHubPullRequest {
  number: number;
  user: GitHubUser;
  created_at: string;
  merged_at: string | null;
  closed_at: string | null;
  html_url: string;
}

interface GitHubReview {
  user: GitHubUser;
  submitted_at: string;
  state: string;
}

interface GitHubComment {
  user: GitHubUser;
  created_at: string;
  body: string;
}

interface GitHubRepository {
  name: string;
  full_name: string;
  stargazers_count: number;
  fork: boolean;
  html_url: string;
}

/**
 * Error class for API-related errors
 */
export class ContributorApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: string
  ) {
    super(message);
    this.name = 'ContributorApiError';
  }
}

/**
 * GitHub API client for fetching repository activity
 */
export class GitHubApiClient {
  private token?: string;
  private baseUrl: string;

  constructor(token?: string, baseUrl: string = GITHUB_API_BASE) {
    this.token = token;
    this.baseUrl = baseUrl;
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'ContributorInfo/1.0',
    };

    // Add any additional headers from options
    if (options.headers) {
      Object.assign(headers, options.headers);
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new ContributorApiError(
        `GitHub API request failed: ${response.status} ${response.statusText}`,
        response.status,
        await response.text()
      );
    }

    return response.json();
  }

  /**
   * Fetches pull requests for a repository within a date range
   */
  async getPullRequests(
    owner: string,
    repo: string,
    startDate: Date,
    endDate: Date,
    state: 'open' | 'closed' | 'all' = 'all'
  ): Promise<GitHubPullRequest[]> {
    const endpoint = `/repos/${owner}/${repo}/pulls`;
    const params = new URLSearchParams({
      state,
      sort: 'created',
      direction: 'desc',
      per_page: '100',
    });

    const allPulls: GitHubPullRequest[] = [];
    let page = 1;
    
    while (true) {
      params.set('page', page.toString());
      const pulls = await this.makeRequest<GitHubPullRequest[]>(`${endpoint}?${params}`);
      
      if (pulls.length === 0) break;
      
      // Filter by date range
      const filteredPulls = pulls.filter(pr => {
        const createdAt = new Date(pr.created_at);
        return createdAt >= startDate && createdAt <= endDate;
      });
      
      allPulls.push(...filteredPulls);
      
      // If we got less than 100 results or the oldest PR is before our date range, we're done
      if (pulls.length < 100 || new Date(pulls[pulls.length - 1].created_at) < startDate) {
        break;
      }
      
      page++;
    }

    return allPulls;
  }

  /**
   * Fetches reviews for a specific pull request
   */
  async getPullRequestReviews(owner: string, repo: string, pullNumber: number): Promise<GitHubReview[]> {
    const endpoint = `/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`;
    return this.makeRequest<GitHubReview[]>(endpoint);
  }

  /**
   * Fetches comments for a specific pull request
   */
  async getPullRequestComments(owner: string, repo: string, pullNumber: number): Promise<GitHubComment[]> {
    const endpoint = `/repos/${owner}/${repo}/pulls/${pullNumber}/comments`;
    return this.makeRequest<GitHubComment[]>(endpoint);
  }

  /**
   * Fetches issue comments for a repository within a date range
   */
  async getIssueComments(
    owner: string,
    repo: string,
    startDate: Date,
    endDate: Date
  ): Promise<GitHubComment[]> {
    const endpoint = `/repos/${owner}/${repo}/issues/comments`;
    const params = new URLSearchParams({
      sort: 'created',
      direction: 'desc',
      per_page: '100',
    });

    const allComments: GitHubComment[] = [];
    let page = 1;
    
    while (true) {
      params.set('page', page.toString());
      const comments = await this.makeRequest<GitHubComment[]>(`${endpoint}?${params}`);
      
      if (comments.length === 0) break;
      
      // Filter by date range
      const filteredComments = comments.filter(comment => {
        const createdAt = new Date(comment.created_at);
        return createdAt >= startDate && createdAt <= endDate;
      });
      
      allComments.push(...filteredComments);
      
      // If we got less than 100 results or the oldest comment is before our date range, we're done
      if (comments.length < 100 || new Date(comments[comments.length - 1].created_at) < startDate) {
        break;
      }
      
      page++;
    }

    return allComments;
  }

  /**
   * Fetches repository information
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    const endpoint = `/repos/${owner}/${repo}`;
    return this.makeRequest<GitHubRepository>(endpoint);
  }

  /**
   * Fetches user information
   */
  async getUser(username: string): Promise<GitHubUser> {
    const endpoint = `/users/${username}`;
    return this.makeRequest<GitHubUser>(endpoint);
  }
}

/**
 * Aggregates activity data for a single repository
 */
export async function fetchRepositoryActivity(
  client: GitHubApiClient,
  owner: string,
  repo: string,
  startDate: Date,
  endDate: Date
): Promise<Map<string, ContributorActivity>> {
  const contributors = new Map<string, ContributorActivity>();

  try {
    // Fetch pull requests
    const pullRequests = await client.getPullRequests(owner, repo, startDate, endDate);
    
    // Process pull requests and their associated reviews/comments
    for (const pr of pullRequests) {
      const author = pr.user;
      const contributorId = author.login;

      // Initialize contributor if not exists
      if (!contributors.has(contributorId)) {
        contributors.set(contributorId, {
          id: contributorId,
          username: author.login,
          displayName: author.name || author.login,
          avatarUrl: author.avatar_url,
          profileUrl: author.html_url,
          pullRequests: 0,
          mergedPullRequests: 0,
          comments: 0,
          reviews: 0,
          earliestContribution: new Date(pr.created_at),
          latestContribution: new Date(pr.created_at),
          repositoriesContributed: 1,
        });
      }

      const contributor = contributors.get(contributorId)!;
      contributor.pullRequests++;
      
      // Only count merged PRs for scoring
      if (pr.merged_at) {
        contributor.mergedPullRequests++;
      }

      // Update contribution dates
      const prDate = new Date(pr.created_at);
      if (prDate < contributor.earliestContribution) {
        contributor.earliestContribution = prDate;
      }
      if (prDate > contributor.latestContribution) {
        contributor.latestContribution = prDate;
      }

      // Fetch and process reviews for this PR
      try {
        const reviews = await client.getPullRequestReviews(owner, repo, pr.number);
        for (const review of reviews) {
          const reviewerId = review.user.login;
          const reviewDate = new Date(review.submitted_at);
          
          // Only count reviews within our date range
          if (reviewDate >= startDate && reviewDate <= endDate) {
            if (!contributors.has(reviewerId)) {
              contributors.set(reviewerId, {
                id: reviewerId,
                username: review.user.login,
                displayName: review.user.name || review.user.login,
                avatarUrl: review.user.avatar_url,
                profileUrl: review.user.html_url,
                pullRequests: 0,
                mergedPullRequests: 0,
                comments: 0,
                reviews: 0,
                earliestContribution: reviewDate,
                latestContribution: reviewDate,
                repositoriesContributed: 1,
              });
            }

            const reviewer = contributors.get(reviewerId)!;
            reviewer.reviews++;

            // Update contribution dates for reviewer
            if (reviewDate < reviewer.earliestContribution) {
              reviewer.earliestContribution = reviewDate;
            }
            if (reviewDate > reviewer.latestContribution) {
              reviewer.latestContribution = reviewDate;
            }
          }
        }
      } catch (_error) {
        console.warn(`Failed to fetch reviews for PR ${pr.number}:`, _error);
      }

      // Fetch and process comments for this PR
      try {
        const comments = await client.getPullRequestComments(owner, repo, pr.number);
        for (const comment of comments) {
          const commenterId = comment.user.login;
          const commentDate = new Date(comment.created_at);
          
          // Only count comments within our date range
          if (commentDate >= startDate && commentDate <= endDate) {
            if (!contributors.has(commenterId)) {
              contributors.set(commenterId, {
                id: commenterId,
                username: comment.user.login,
                displayName: comment.user.name || comment.user.login,
                avatarUrl: comment.user.avatar_url,
                profileUrl: comment.user.html_url,
                pullRequests: 0,
                mergedPullRequests: 0,
                comments: 0,
                reviews: 0,
                earliestContribution: commentDate,
                latestContribution: commentDate,
                repositoriesContributed: 1,
              });
            }

            const commenter = contributors.get(commenterId)!;
            commenter.comments++;

            // Update contribution dates for commenter
            if (commentDate < commenter.earliestContribution) {
              commenter.earliestContribution = commentDate;
            }
            if (commentDate > commenter.latestContribution) {
              commenter.latestContribution = commentDate;
            }
          }
        }
      } catch (_error) {
        console.warn(`Failed to fetch comments for PR ${pr.number}:`, _error);
      }
    }

    // Fetch general issue comments (not tied to specific PRs)
    try {
      const issueComments = await client.getIssueComments(owner, repo, startDate, endDate);
      for (const comment of issueComments) {
        const commenterId = comment.user.login;
        const commentDate = new Date(comment.created_at);

        if (!contributors.has(commenterId)) {
          contributors.set(commenterId, {
            id: commenterId,
            username: comment.user.login,
            displayName: comment.user.name || comment.user.login,
            avatarUrl: comment.user.avatar_url,
            profileUrl: comment.user.html_url,
            pullRequests: 0,
            mergedPullRequests: 0,
            comments: 0,
            reviews: 0,
            earliestContribution: commentDate,
            latestContribution: commentDate,
            repositoriesContributed: 1,
          });
        }

        const commenter = contributors.get(commenterId)!;
        commenter.comments++;

        // Update contribution dates
        if (commentDate < commenter.earliestContribution) {
          commenter.earliestContribution = commentDate;
        }
        if (commentDate > commenter.latestContribution) {
          commenter.latestContribution = commentDate;
        }
      }
    } catch (_error) {
      console.warn(`Failed to fetch issue comments:`, _error);
    }

  } catch (_error) {
    throw new ContributorApiError(
      `Failed to fetch activity for repository ${owner}/${repo}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  return contributors;
}

/**
 * Fetches contributor activity data for multiple repositories
 */
export async function fetchContributorActivity(
  repositories: string[], // Format: "owner/repo"
  month: number,
  year: number,
  token?: string,
  filter?: RepositoryFilter
): Promise<ContributorApiResponse<ContributorActivity[]>> {
  const startTime = Date.now();
  const client = new GitHubApiClient(token);
  const { startDate, endDate } = getMonthDateRange(month, year);
  
  const allContributors = new Map<string, ContributorActivity>();

  try {
    // Apply repository filters
    let filteredRepos = repositories;
    if (filter?.includeRepositories && filter.includeRepositories.length > 0) {
      filteredRepos = repositories.filter(repo => filter.includeRepositories!.includes(repo));
    }
    if (filter?.excludeRepositories && filter.excludeRepositories.length > 0) {
      filteredRepos = filteredRepos.filter(repo => !filter.excludeRepositories!.includes(repo));
    }

    // Fetch activity for each repository
    for (const repoString of filteredRepos) {
      const [owner, repo] = repoString.split('/');
      if (!owner || !repo) {
        console.warn(`Invalid repository format: ${repoString}`);
        continue;
      }

      try {
        // Apply repository-level filters
        if (filter?.minimumStars || filter?.excludeForks) {
          const repoInfo = await client.getRepository(owner, repo);
          
          if (filter.minimumStars && repoInfo.stargazers_count < filter.minimumStars) {
            continue;
          }
          
          if (filter.excludeForks && repoInfo.fork) {
            continue;
          }
        }

        const repoContributors = await fetchRepositoryActivity(client, owner, repo, startDate, endDate);
        
        // Merge repository contributors with overall contributors
        for (const [contributorId, activity] of repoContributors) {
          if (allContributors.has(contributorId)) {
            const existing = allContributors.get(contributorId)!;
            existing.pullRequests += activity.pullRequests;
            existing.mergedPullRequests += activity.mergedPullRequests;
            existing.comments += activity.comments;
            existing.reviews += activity.reviews;
            existing.repositoriesContributed++;
            
            // Update date ranges
            if (activity.earliestContribution < existing.earliestContribution) {
              existing.earliestContribution = activity.earliestContribution;
            }
            if (activity.latestContribution > existing.latestContribution) {
              existing.latestContribution = activity.latestContribution;
            }
          } else {
            allContributors.set(contributorId, { ...activity });
          }
        }
      } catch (_error) {
        console.error(`Failed to fetch activity for ${repoString}:`, _error);
        // Continue with other repositories
      }
    }

    const processingTime = Date.now() - startTime;
    const contributorArray = Array.from(allContributors.values());

    return {
      data: contributorArray,
      success: true,
      metadata: {
        total: contributorArray.length,
        processingTime,
        fromCache: false,
      },
    };

  } catch (_error) {
    const processingTime = Date.now() - startTime;
    
    return {
      data: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      metadata: {
        total: 0,
        processingTime,
        fromCache: false,
      },
    };
  }
}

/**
 * Simple in-memory cache for API responses
 */
class SimpleCache<T> {
  private cache = new Map<string, { data: T; timestamp: number; ttl: number }>();
  
  set(key: string, _data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }
  
  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  size(): number {
    return this.cache.size;
  }
}

// Global cache instance
const contributorCache = new SimpleCache<ContributorActivity[]>();

/**
 * Cached version of fetchContributorActivity
 */
export async function fetchContributorActivityCached(
  repositories: string[],
  month: number,
  year: number,
  token?: string,
  filter?: RepositoryFilter,
  cacheTtl: number = 5 * 60 * 1000 // 5 minutes default
): Promise<ContributorApiResponse<ContributorActivity[]>> {
  const cacheKey = `contributors:${repositories.join(',')}:${month}:${year}:${JSON.stringify(filter)}`;
  
  // Try to get from cache first
  const cached = contributorCache.get(cacheKey);
  if (cached) {
    return {
      data: cached,
      success: true,
      metadata: {
        total: cached.length,
        processingTime: 0,
        fromCache: true,
      },
    };
  }
  
  // Fetch fresh data
  const result = await fetchContributorActivity(repositories, month, year, token, filter);
  
  // Cache successful results
  if (result.success) {
    contributorCache.set(cacheKey, result._data, cacheTtl);
  }
  
  return result;
}
