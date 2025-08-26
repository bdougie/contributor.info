import { supabase } from '../supabase';

interface CommitPRAssociation {
  sha: string;
  associatedPRs: unknown[];
  isDirectCommit: boolean;
  analyzed_at: string;
}

interface CommitAnalysisResult {
  analyzed: CommitPRAssociation[];
  errors: Array<{ sha: string; error: string }>;
  summary: {
    total: number;
    directCommits: number;
    prCommits: number;
    errors: number;
  };
}

/**
 * Smart Commit Analyzer using efficient GitHub API calls
 * Uses /repos/{owner}/{repo}/commits/{sha}/pulls endpoint for direct PR association checking
 * Much more efficient than the old heavy YOLO analysis approach
 */
export class SmartCommitAnalyzer {
  private readonly GITHUB_API_BASE = 'https://api.github.com';
  private token: string | null = null;

  constructor() {
    // Try to get GitHub token from environment
    this.token = import.meta.env.VITE_GITHUB_TOKEN || null;
  }

  /**
   * Analyze a single commit to check if it's associated with any PRs
   * Uses the efficient GitHub API endpoint: /repos/{owner}/{repo}/commits/{sha}/pulls
   */
  async analyzeCommit(owner: string, repo: string, sha: string): Promise<CommitPRAssociation> {
    const headers: HeadersInit = {
      Accept: 'application/vnd.github.v3+json',
    };

    if (this.token) {
      headers.Authorization = `token ${this.token}`;
    }

    try {
      // Use the efficient GitHub API endpoint to check PR associations
      const response = await fetch(
        `${this.GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${sha}/pulls`,
        { headers },
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Commit ${sha} not found in ${owner}/${repo}`);
        } else if (response.status === 403) {
          throw new Error('GitHub API rate limit exceeded or access denied');
        } else if (response.status === 422) {
          throw new Error(`Invalid commit SHA: ${sha}`);
        }
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const associatedPRs = await response.json();
      const isDirectCommit = associatedPRs.length === 0;

      return {
        sha,
        associatedPRs,
        isDirectCommit,
        analyzed_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error(, error);
      throw error;
    }
  }

  /**
   * Analyze multiple commits in batches with rate limiting
   */
  async analyzeCommitBatch(
    owner: string,
    repo: string,
    commitShas: string[],
    batchSize: number = 10,
  ): Promise<CommitAnalysisResult> {
    const results: CommitPRAssociation[] = [];
    const errors: Array<{ sha: string; error: string }> = [];

    // Process commits in batches to avoid overwhelming the API
    for (let i = 0; i < commitShas.length; i += batchSize) {
      const batch = commitShas.slice(i, i + batchSize);

      // Process batch with delay between requests
      for (const sha of batch) {
        try {
          const result = await this.analyzeCommit(owner, repo, sha);
          results.push(result);

          // Small delay between individual API calls to be respectful
          await this.delay(200); // 200ms between calls = max 5 calls/second
        } catch (error) {
          errors.push({
            sha,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Longer delay between batches
      if (i + batchSize < commitShas.length) {
        await this.delay(2000); // 2 second delay between batches
      }
    }

    const summary = {
      total: results.length,
      directCommits: results.filter((r) => r.isDirectCommit).length,
      prCommits: results.filter((r) => !r.isDirectCommit).length,
      errors: errors.length,
    };

    return {
      analyzed: results,
      errors,
      summary,
    };
  }

  /**
   * Store commit analysis results in the database
   */
  async storeAnalysisResults(repositoryId: string, results: CommitPRAssociation[]): Promise<void> {
    for (const result of results) {
      try {
        // Update the commit record with PR association info
        const { error: updateError } = await supabase
          .from('commits')
          .update({
            is_direct_commit: result.isDirectCommit,
            pull_request_id:
              result.associatedPRs.length > 0
                ? this.extractPrimaryPRId(result.associatedPRs)
                : null,
            updated_at: new Date().toISOString(),
          })
          .eq('repository_id', repositoryId)
          .eq('sha', result.sha);

        if (updateError) {
          console.warn(`[Smart Commit] Failed to update commit ${result.sha}:`, updateError);
        }
      } catch (error) {
        console.error(, error);
      }
    }
  }

  /**
   * Process a commit analysis job from the queue
   */
  async processCommitAnalysisJob(
    job: { repository_id: string; resource_id: string; meta_data: Record<string, unknown> | null },
    repoInfo: { owner: string; name: string },
  ): Promise<void> {
    const commitSha = job.resource_id;

    try {
      // Analyze the single commit
      const result = await this.analyzeCommit(repoInfo.owner, repoInfo.name, commitSha);

      // Store the result in database
      await this.storeAnalysisResults(job.repository_id, [result]);
    } catch (error) {
      console.error(, error);
      throw error;
    }
  }

  /**
   * Get direct commits analysis from database (replaces heavy GitHub API calls)
   */
  async getDirectCommitsFromDatabase(
    repositoryId: string,
    timeRange: string = '30',
  ): Promise<{
    hasYoloCoders: boolean;
    yoloCoderStats: Array<{
      login: string;
      avatar_url: string;
      directCommits: number;
      totalCommits: number;
      directCommitPercentage: number;
    }>;
  }> {
    try {
      const days = parseInt(timeRange) || 30;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Query database for commit analysis (no GitHub API calls needed!)
      const { data: commits, error } = await supabase
        .from('commits')
        .select(
          `
          sha,
          is_direct_commit,
          authored_at,
          contributors!commits_author_id_fkey(
            username,
            avatar_url
          )
        `,
        )
        .eq('repository_id', repositoryId)
        .gte('authored_at', since.toISOString())
        .not('is_direct_commit', 'is', null) // Only include analyzed commits
        .order('authored_at', { ascending: false });

      if (error) {
        console.error(, error);
        return { hasYoloCoders: false, yoloCoderStats: [] };
      }

      if (!commits || commits.length === 0) {
        return { hasYoloCoders: false, yoloCoderStats: [] };
      }

      // Calculate YOLO coder stats from database
      const contributorStats = this.calculateYoloCoderStats(commits);

      return {
        hasYoloCoders: contributorStats.length > 0,
        yoloCoderStats: contributorStats,
      };
    } catch (error) {
      console.error(, error);
      return { hasYoloCoders: false, yoloCoderStats: [] };
    }
  }

  /**
   * Calculate YOLO coder statistics from analyzed commits
   */
  private calculateYoloCoderStats(commits: unknown[]): Array<{
    login: string;
    avatar_url: string;
    directCommits: number;
    totalCommits: number;
    directCommitPercentage: number;
  }> {
    const contributorMap = new Map<
      string,
      {
        username: string;
        avatar_url: string;
        directCommits: number;
        totalCommits: number;
      }
    >();

    // Count commits by contributor
    commits.forEach((commit) => {
      if (commit.contributors) {
        const username = commit.contributors.username;
        const existing = contributorMap.get(username);

        if (existing) {
          existing.totalCommits++;
          if (commit.is_direct_commit) {
            existing.directCommits++;
          }
        } else {
          contributorMap.set(username, {
            username,
            avatar_url: commit.contributors.avatar_url || '',
            directCommits: commit.is_direct_commit ? 1 : 0,
            totalCommits: 1,
          });
        }
      }
    });

    // Calculate percentages and filter for significant YOLO coders
    const yoloCoders: Array<{
      login: string;
      avatar_url: string;
      directCommits: number;
      totalCommits: number;
      directCommitPercentage: number;
    }> = [];

    contributorMap.forEach((stats) => {
      const directCommitPercentage = (stats.directCommits / stats.totalCommits) * 100;

      // Only include contributors with significant direct commit activity
      if (stats.directCommits >= 2 && directCommitPercentage >= 15) {
        yoloCoders.push({
          login: stats.username,
          avatar_url: stats.avatar_url,
          directCommits: stats.directCommits,
          totalCommits: stats.totalCommits,
          directCommitPercentage: Math.round(directCommitPercentage),
        });
      }
    });

    // Sort by direct commit percentage, then by count
    return yoloCoders.sort((a, b) => {
      if (b.directCommitPercentage !== a.directCommitPercentage) {
        return b.directCommitPercentage - a.directCommitPercentage;
      }
      return b.directCommits - a.directCommits;
    });
  }

  /**
   * Extract the primary PR ID from associated PRs (usually the first one)
   */
  private extractPrimaryPRId(associatedPRs: unknown[]): string | null {
    if (associatedPRs.length === 0) return null;

    // For commits associated with multiple PRs, use the earliest one
    const sortedPRs = associatedPRs.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    return sortedPRs[0].id?.toString() || null;
  }

  /**
   * Simple delay utility for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const smartCommitAnalyzer = new SmartCommitAnalyzer();
