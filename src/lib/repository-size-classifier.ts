import { supabase } from './supabase';
import { RepositorySize, RepositoryMetrics } from './validation/database-schemas';
import { Octokit } from '@octokit/rest';

// Type for tracked repository with nested repository data
interface TrackedRepositoryWithRepo {
  id: string;
  repository_id: string;
  repositories: {
    id: string;
    owner: string;
    name: string;
  };
}

/**
 * Repository Size Classifier Service
 * Classifies repositories into size categories based on activity metrics
 */

interface RepoMetrics {
  stars: number;
  forks: number;
  monthlyPRs: number;
  monthlyCommits: number;
  activeContributors: number;
}

interface ClassificationThresholds {
  small: RepoMetrics;
  medium: RepoMetrics;
  large: RepoMetrics;
  xl: RepoMetrics;
}

export class RepositorySizeClassifier {
  private octokit: Octokit;

  // Size classification thresholds
  private readonly thresholds: ClassificationThresholds = {
    small: {
      stars: 1000,
      forks: 100,
      monthlyPRs: 100,
      monthlyCommits: 500,
      activeContributors: 10,
    },
    medium: {
      stars: 10000,
      forks: 1000,
      monthlyPRs: 500,
      monthlyCommits: 2000,
      activeContributors: 50,
    },
    large: {
      stars: 50000,
      forks: 5000,
      monthlyPRs: 2000,
      monthlyCommits: 10000,
      activeContributors: 200,
    },
    xl: {
      stars: Infinity,
      forks: Infinity,
      monthlyPRs: Infinity,
      monthlyCommits: Infinity,
      activeContributors: Infinity,
    },
  };

  constructor(githubToken: string) {
    this.octokit = new Octokit({
      auth: githubToken,
    });
  }

  /**
   * Calculate repository metrics from GitHub API
   */
  async calculateMetrics(owner: string, repo: string): Promise<RepoMetrics> {
    try {
      // Get repository basic info
      const { data: repoData } = await this.octokit.repos.get({
        owner,
        repo,
      });

      // Get recent pull requests (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: pullRequests } = await this.octokit.pulls.list({
        owner,
        repo,
        state: 'all',
        sort: 'created',
        direction: 'desc',
        per_page: 100,
        since: thirtyDaysAgo.toISOString(),
      });

      // Count PRs in the last 30 days
      const monthlyPRs = pullRequests.filter(
        (pr) => new Date(pr.created_at) >= thirtyDaysAgo,
      ).length;

      // Get contributor stats
      const { data: contributors } = await this.octokit.repos.listContributors({
        owner,
        repo,
        per_page: 100,
      });

      // Get commit activity
      const { data: commitActivity } = await this.octokit.repos.getCommitActivityStats({
        owner,
        repo,
      });

      // Calculate monthly commits (average of last 4 weeks)
      const monthlyCommits = commitActivity.slice(-4).reduce((sum, week) => sum + week.total, 0);

      // Count active contributors (those who contributed in the last 30 days)
      const activeContributors = contributors.filter(
        (contributor) => contributor.contributions > 0,
      ).length;

      return {
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        monthlyPRs,
        monthlyCommits,
        activeContributors: Math.min(activeContributors, contributors.length),
      };
    } catch (_error) {
      console.error('Error calculating repository metrics:', _error);
      throw error;
    }
  }

  /**
   * Classify repository size based on metrics
   */
  classifySize(metrics: RepoMetrics): RepositorySize {
    // Score each metric against thresholds
    const scores = {
      small: 0,
      medium: 0,
      large: 0,
      xl: 0,
    };

    // Check each metric against thresholds
    const metricKeys: (keyof RepoMetrics)[] = [
      'stars',
      'forks',
      'monthlyPRs',
      'monthlyCommits',
      'activeContributors',
    ];

    for (const metric of metricKeys) {
      const value = metrics[metric];

      if (value < this.thresholds.small[metric]) {
        scores.small++;
      } else if (value < this.thresholds.medium[metric]) {
        scores.medium++;
      } else if (value < this.thresholds.large[metric]) {
        scores.large++;
      } else {
        scores.xl++;
      }
    }

    // Determine size based on majority scoring
    const maxScore = Math.max(scores.small, scores.medium, scores.large, scores.xl);

    if (scores.xl === maxScore && scores.xl >= 2) {
      return 'xl';
    } else if (scores.large === maxScore && scores.large >= 2) {
      return 'large';
    } else if (scores.medium === maxScore && scores.medium >= 2) {
      return 'medium';
    } else {
      return 'small';
    }
  }

  /**
   * Enhanced classification for edge cases using weighted scoring
   * This handles repositories that don't fit neatly into categories
   */
  classifySizeWithEdgeCaseHandling(
    metrics: RepoMetrics,
    repoContext?: {
      isMonorepo?: boolean;
      isMirror?: boolean;
      primaryLanguage?: string;
      organizationType?: 'enterprise' | 'community' | 'personal';
    },
  ): RepositorySize {
    // Get base classification
    let baseSize = this.classifySize(metrics);

    // Apply edge case adjustments
    if (repoContext) {
      // Monorepos tend to have more activity, adjust thresholds
      if (repoContext.isMonorepo) {
        // If it's classified as small/medium but has high activity, bump it up
        if (baseSize === 'small' && metrics.monthlyCommits > 1000) {
          baseSize = 'medium';
        } else if (baseSize === 'medium' && metrics.monthlyCommits > 5000) {
          baseSize = 'large';
        }
      }

      // Mirror repositories have inflated metrics, adjust down
      if (repoContext.isMirror) {
        if (baseSize === 'xl') {
          baseSize = 'large';
        } else if (baseSize === 'large') {
          baseSize = 'medium';
        }
      }

      // Enterprise repos might have fewer public contributors but high activity
      if (repoContext.organizationType === 'enterprise') {
        const activityScore = metrics.monthlyPRs + metrics.monthlyCommits;
        if (activityScore > 3000 && baseSize === 'medium') {
          baseSize = 'large';
        }
      }

      // Documentation or website repos (detected by language) have different patterns
      if (
        repoContext.primaryLanguage &&
        ['HTML', 'CSS', 'Markdown'].includes(repoContext.primaryLanguage)
      ) {
        // These repos typically have lower commit activity but might still be important
        if (metrics.stars > 5000 && baseSize === 'small') {
          baseSize = 'medium';
        }
      }
    }

    // Handle extreme edge cases
    if (this.isEdgeCase(metrics)) {
      baseSize = this.handleExtremeEdgeCase(metrics, baseSize);
    }

    return baseSize;
  }

  /**
   * Detect if metrics represent an edge case
   */
  private isEdgeCase(metrics: RepoMetrics): boolean {
    // High stars but low activity (abandoned popular project)
    const highStarsLowActivity = metrics.stars > 10000 && metrics.monthlyPRs < 10;

    // Very high activity but low stars (internal tool made public)
    const highActivityLowStars = metrics.monthlyPRs > 500 && metrics.stars < 100;

    // Unusual contributor patterns
    const unusualContributors =
      metrics.activeContributors > 500 ||
      (metrics.activeContributors < 5 && metrics.monthlyPRs > 100);

    return highStarsLowActivity || highActivityLowStars || unusualContributors;
  }

  /**
   * Handle extreme edge cases with custom logic
   */
  private handleExtremeEdgeCase(metrics: RepoMetrics, currentSize: RepositorySize): RepositorySize {
    // Abandoned popular project - reduce size classification
    if (metrics.stars > 10000 && metrics.monthlyPRs < 10) {
      if (currentSize === 'xl' || currentSize === 'large') {
        return 'medium'; // Still important but not actively maintained
      }
    }

    // Very active internal tool - increase size classification
    if (metrics.monthlyPRs > 500 && metrics.stars < 100) {
      if (currentSize === 'small') {
        return 'medium'; // High activity warrants higher classification
      }
    }

    // Bot-driven repository (few contributors, many PRs)
    if (metrics.activeContributors < 5 && metrics.monthlyPRs > 100) {
      return 'medium'; // Standardize bot-driven repos as medium
    }

    return currentSize;
  }

  /**
   * Classify and update a repository in the database
   */
  async classifyAndUpdateRepository(
    repositoryId: string,
    owner: string,
    repo: string,
  ): Promise<RepositorySize> {
    try {
      // Calculate metrics
      const metrics = await this.calculateMetrics(owner, repo);

      // Classify size
      const size = this.classifySize(metrics);

      // Prepare metrics for storage
      const metricsData: RepositoryMetrics = {
        ...metrics,
        lastCalculated: new Date(),
      };

      // Update in database
      const { error: _error } = await supabase
        .from('tracked_repositories')
        .update({
          size,
          metrics: metricsData,
          size_calculated_at: new Date().toISOString(),
        })
        .eq('repository_id', repositoryId);

      if (_error) {
        throw error;
      }

      console.log('Repository %s/%s classified as %s', owner, repo, size);
      return size;
    } catch (_error) {
      console.error(`Error classifying repository ${owner}/${repo}:`, _error);
      throw error;
    }
  }

  /**
   * Classify multiple repositories (batch operation)
   */
  async classifyBatch(
    repositories: Array<{ id: string; owner: string; name: string }>,
  ): Promise<void> {
    const results = await Promise.allSettled(
      repositories.map((repo) => this.classifyAndUpdateRepository(repo.id, repo.owner, repo.name)),
    );

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    console.log('Batch classification complete: %s successful, %s failed', successful, failed);
  }

  /**
   * Get all unclassified repositories
   */
  async getUnclassifiedRepositories(): Promise<Array<{ id: string; owner: string; name: string }>> {
    const { data, error: _error } = await supabase
      .from('tracked_repositories')
      .select(
        `
        id,
        repository_id,
        repositories!inner(
          id,
          owner,
          name
        )
      `,
      )
      .is('size', null)
      .eq('tracking_enabled', true);

    if (_error) {
      throw error;
    }

    // Cast the data to the expected shape
    const typedData = data as unknown as TrackedRepositoryWithRepo[];

    return (
      typedData?.map((item) => ({
        id: item.id,
        owner: item.repositories.owner,
        name: item.repositories.name,
      })) || []
    );
  }

  /**
   * Reclassify repositories older than specified days
   */
  async reclassifyOldRepositories(daysOld: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { data, error: _error } = await supabase
      .from('tracked_repositories')
      .select(
        `
        id,
        repository_id,
        repositories!inner(
          id,
          owner,
          name
        )
      `,
      )
      .or(`size_calculated_at.is.null,size_calculated_at.lt.${cutoffDate.toISOString()}`)
      .eq('tracking_enabled', true);

    if (_error) {
      throw error;
    }

    if (data && _data.length > 0) {
      console.log('Found %s repositories to reclassify', _data.length);

      // Cast the data to the expected shape
      const typedData = data as unknown as TrackedRepositoryWithRepo[];

      await this.classifyBatch(
        typedData.map((item) => ({
          id: item.id,
          owner: item.repositories.owner,
          name: item.repositories.name,
        })),
      );
    }
  }
}
