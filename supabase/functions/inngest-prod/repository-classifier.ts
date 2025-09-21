import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { Octokit } from 'https://esm.sh/@octokit/rest@20.0.2';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Repository size type
type RepositorySize = 'small' | 'medium' | 'large' | 'xl';

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
      stars: 100000,
      forks: 10000,
      monthlyPRs: 5000,
      monthlyCommits: 20000,
      activeContributors: 500,
    },
  };

  constructor(githubToken: string) {
    this.octokit = new Octokit({
      auth: githubToken,
    });
  }

  /**
   * Fetch repository metrics from GitHub
   */
  async fetchMetrics(owner: string, repo: string): Promise<RepoMetrics> {
    try {
      // Get basic repo info
      const { data: repoData } = await this.octokit.repos.get({
        owner,
        repo,
      });

      // Get PR statistics
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: recentPRs } = await this.octokit.pulls.list({
        owner,
        repo,
        state: 'all',
        since: thirtyDaysAgo.toISOString(),
        per_page: 100,
      });

      // Get commit activity
      const { data: commitActivity } = await this.octokit.repos.getCommitActivityStats({
        owner,
        repo,
      });

      // Calculate monthly commits (last 4 weeks)
      const monthlyCommits = commitActivity
        .slice(-4)
        .reduce((sum, week) => sum + week.total, 0);

      // Get contributor statistics
      const { data: contributors } = await this.octokit.repos.getContributorsStats({
        owner,
        repo,
      });

      // Calculate active contributors (contributed in last 30 days)
      const activeContributors = contributors.filter((contributor) => {
        const lastWeek = contributor.weeks[contributor.weeks.length - 1];
        return lastWeek && (lastWeek.a > 0 || lastWeek.d > 0 || lastWeek.c > 0);
      }).length;

      return {
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        monthlyPRs: recentPRs.length,
        monthlyCommits,
        activeContributors,
      };
    } catch (error) {
      console.error(`Error fetching metrics for ${owner}/${repo}:`, error);
      throw error;
    }
  }

  /**
   * Classify repository size based on metrics
   */
  classifySize(metrics: RepoMetrics): RepositorySize {
    // Check each threshold level from highest to lowest
    if (this.meetsThreshold(metrics, this.thresholds.xl)) {
      return 'xl';
    } else if (this.meetsThreshold(metrics, this.thresholds.large)) {
      return 'large';
    } else if (this.meetsThreshold(metrics, this.thresholds.medium)) {
      return 'medium';
    } else {
      return 'small';
    }
  }

  /**
   * Check if metrics meet a specific threshold
   */
  private meetsThreshold(metrics: RepoMetrics, threshold: RepoMetrics): boolean {
    // Repository meets threshold if it exceeds at least 2 of the 5 criteria
    let criteriaMet = 0;

    if (metrics.stars >= threshold.stars) criteriaMet++;
    if (metrics.forks >= threshold.forks) criteriaMet++;
    if (metrics.monthlyPRs >= threshold.monthlyPRs) criteriaMet++;
    if (metrics.monthlyCommits >= threshold.monthlyCommits) criteriaMet++;
    if (metrics.activeContributors >= threshold.activeContributors) criteriaMet++;

    return criteriaMet >= 2;
  }

  /**
   * Classify and update repository in database
   */
  async classifyAndUpdateRepository(
    repositoryId: string,
    owner: string,
    repo: string
  ): Promise<RepositorySize> {
    try {
      console.log(`Classifying repository size for ${owner}/${repo}`);

      // Fetch current metrics
      const metrics = await this.fetchMetrics(owner, repo);
      console.log(`Metrics for ${owner}/${repo}:`, metrics);

      // Classify the repository
      const size = this.classifySize(metrics);
      console.log(`Repository ${owner}/${repo} classified as: ${size}`);

      // Update the database
      const { error: updateError } = await supabase
        .from('repositories')
        .update({
          size_classification: size,
          stars_count: metrics.stars,
          forks_count: metrics.forks,
          monthly_pr_count: metrics.monthlyPRs,
          monthly_commit_count: metrics.monthlyCommits,
          active_contributor_count: metrics.activeContributors,
          classification_updated_at: new Date().toISOString(),
        })
        .eq('id', repositoryId);

      if (updateError) {
        console.error('Error updating repository classification:', updateError);
        throw updateError;
      }

      // Log the classification
      const { error: logError } = await supabase.from('repository_classification_logs').insert({
        repository_id: repositoryId,
        size_classification: size,
        metrics,
        classified_at: new Date().toISOString(),
      });

      if (logError) {
        console.warn('Failed to log classification:', logError);
      }

      return size;
    } catch (error) {
      console.error(`Failed to classify repository ${owner}/${repo}:`, error);
      throw error;
    }
  }

  /**
   * Batch classify multiple repositories
   */
  async classifyRepositories(repositories: Array<{ id: string; owner: string; name: string }>) {
    const results = [];

    for (const repo of repositories) {
      try {
        const size = await this.classifyAndUpdateRepository(repo.id, repo.owner, repo.name);
        results.push({
          repositoryId: repo.id,
          repository: `${repo.owner}/${repo.name}`,
          size,
          success: true,
        });
      } catch (error) {
        console.error(`Failed to classify ${repo.owner}/${repo.name}:`, error);
        results.push({
          repositoryId: repo.id,
          repository: `${repo.owner}/${repo.name}`,
          error: error.message,
          success: false,
        });
      }

      // Add a small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return results;
  }
}