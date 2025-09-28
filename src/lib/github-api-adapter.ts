import GitHubAPIService from '@/services/github-api.service';
import type { PRWithReviewers } from '@/lib/sync-pr-reviewers';

/**
 * Adapter to integrate GitHubAPIService with existing codebase
 * Provides backwards-compatible interface with exponential backoff
 */
export class GitHubAPIAdapter {
  private service: GitHubAPIService;

  constructor(auth?: string) {
    this.service = new GitHubAPIService(auth);
  }

  /**
   * Fetch pull requests with reviewers data using exponential backoff
   * Compatible with existing sync-pr-reviewers function signature
   */
  async fetchPullRequestsWithReviewers(
    owner: string,
    repo: string,
    options: {
      includeClosedPRs?: boolean;
      maxClosedDays?: number;
    } = {}
  ): Promise<PRWithReviewers[]> {
    const { includeClosedPRs = true, maxClosedDays = 30 } = options;
    const allPRs: PRWithReviewers[] = [];

    try {
      // Fetch open PRs with backoff
      const openPRs = await this.service.fetchPullRequests(owner, repo, {
        state: 'open',
        per_page: 100,
      });

      // Fetch closed PRs if requested
      let closedPRs: typeof openPRs = [];
      if (includeClosedPRs) {
        closedPRs = await this.service.fetchPullRequests(owner, repo, {
          state: 'closed',
          per_page: 100,
        });

        // Filter by date
        const since = new Date();
        since.setDate(since.getDate() - maxClosedDays);

        closedPRs = closedPRs.filter(pr => {
          if (!pr.closed_at && !pr.merged_at) return false;
          const closedDate = new Date(pr.closed_at || pr.merged_at || '');
          return closedDate >= since;
        });
      }

      // Combine all PRs
      const combinedPRs = [...openPRs, ...closedPRs];

      // Fetch reviews for each PR with backoff
      const results = await Promise.allSettled(
        combinedPRs.map(async (pr) => {
          const reviews = await this.service.fetchReviews(owner, repo, pr.number);

          // Transform to expected format
          const transformedPR: PRWithReviewers = {
            github_id: pr.id,
            number: pr.number,
            title: pr.title,
            state: pr.state,
            draft: pr.draft || false,
            repository_owner: owner,
            repository_name: repo,
            author: {
              username: pr.user?.login || 'unknown',
              avatar_url: pr.user?.avatar_url || '',
            },
            requested_reviewers: pr.requested_reviewers?.map(r => ({
              username: 'login' in r ? r.login : '',
              avatar_url: 'avatar_url' in r ? r.avatar_url : '',
            })) || [],
            reviewers: reviews.map(review => ({
              username: review.user?.login || '',
              avatar_url: review.user?.avatar_url || '',
              approved: review.state === 'APPROVED',
              state: review.state || '',
              submitted_at: review.submitted_at || '',
            })),
            created_at: pr.created_at,
            updated_at: pr.updated_at,
            closed_at: pr.closed_at,
            merged_at: pr.merged_at,
          };

          return transformedPR;
        })
      );

      // Collect successful results
      for (const result of results) {
        if (result.status === 'fulfilled') {
          allPRs.push(result.value);
        } else {
          console.warn('Failed to fetch PR data:', result.reason);
        }
      }

      console.log(
        'Successfully fetched %d PRs with exponential backoff (%d open, %d closed)',
        allPRs.length,
        openPRs.length,
        closedPRs.length
      );

      return allPRs;
    } catch (error) {
      console.error('Error fetching PRs with backoff:', error);
      // Return partial results even on error
      return allPRs;
    }
  }

  /**
   * Fetch repository data with exponential backoff
   */
  async fetchRepository(owner: string, repo: string) {
    return this.service.fetchRepository(owner, repo);
  }

  /**
   * Fetch contributors with exponential backoff
   */
  async fetchContributors(owner: string, repo: string, options?: { per_page?: number; page?: number }) {
    return this.service.fetchContributors(owner, repo, options);
  }

  /**
   * Fetch issues with exponential backoff
   */
  async fetchIssues(owner: string, repo: string, options?: {
    state?: 'open' | 'closed' | 'all';
    per_page?: number;
    page?: number;
  }) {
    return this.service.fetchIssues(owner, repo, options);
  }

  /**
   * Get current rate limit info
   */
  getRateLimitInfo() {
    return this.service.getRateLimitInfo();
  }

  /**
   * Check rate limit status
   */
  async checkRateLimit() {
    return this.service.checkRateLimit();
  }
}

// Export singleton instance for default use
let defaultAdapter: GitHubAPIAdapter | null = null;

export function getGitHubAPIAdapter(auth?: string): GitHubAPIAdapter {
  if (!defaultAdapter || auth) {
    defaultAdapter = new GitHubAPIAdapter(auth);
  }
  return defaultAdapter;
}