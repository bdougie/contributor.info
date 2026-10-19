/**
 * Repository size classifier (Deno).
 *
 * Writes `tracked_repositories.size`, `metrics` and `size_calculated_at`, the
 * same columns the Node classifier in src/lib/repository-size-classifier.ts
 * writes (20250113000000_add_repository_size_classification.sql). An earlier
 * copy of this file wrote to columns that do not exist on `repositories`.
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { Octokit } from 'https://esm.sh/@octokit/rest@20.0.2';

export type RepositorySize = 'small' | 'medium' | 'large' | 'xl';

export interface RepoMetrics {
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

interface WeekStats {
  total?: number;
}

interface ContributorStats {
  weeks?: { a?: number; d?: number; c?: number }[];
}

function defaultClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

export class RepositorySizeClassifier {
  private octokit: Octokit;
  private supabase: SupabaseClient;

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

  constructor(githubToken: string, supabase?: SupabaseClient) {
    this.octokit = new Octokit({ auth: githubToken });
    this.supabase = supabase ?? defaultClient();
  }

  /**
   * Fetch repository metrics from GitHub. The two statistics endpoints answer
   * 202 with an empty body while GitHub computes them; those count as zero
   * rather than failing the classification.
   */
  async fetchMetrics(owner: string, repo: string): Promise<RepoMetrics> {
    const { data: repoData } = await this.octokit.repos.get({ owner, repo });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: recentPRs } = await this.octokit.pulls.list({
      owner,
      repo,
      state: 'all',
      sort: 'updated',
      direction: 'desc',
      per_page: 100,
    });
    const monthlyPRs = recentPRs.filter((pr) => new Date(pr.updated_at) >= thirtyDaysAgo).length;

    const { data: commitActivity } = await this.octokit.repos.getCommitActivityStats({
      owner,
      repo,
    });
    const weeks = Array.isArray(commitActivity) ? (commitActivity as WeekStats[]) : [];
    const monthlyCommits = weeks.slice(-4).reduce((sum, week) => sum + (week.total ?? 0), 0);

    const { data: contributors } = await this.octokit.repos.getContributorsStats({ owner, repo });
    const stats = Array.isArray(contributors) ? (contributors as ContributorStats[]) : [];
    const activeContributors = stats.filter((contributor) => {
      const lastWeek = contributor.weeks?.[contributor.weeks.length - 1];
      return lastWeek !== undefined &&
        ((lastWeek.a ?? 0) > 0 || (lastWeek.d ?? 0) > 0 || (lastWeek.c ?? 0) > 0);
    }).length;

    return {
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      monthlyPRs,
      monthlyCommits,
      activeContributors,
    };
  }

  /** Classify repository size based on metrics */
  classifySize(metrics: RepoMetrics): RepositorySize {
    if (this.meetsThreshold(metrics, this.thresholds.xl)) return 'xl';
    if (this.meetsThreshold(metrics, this.thresholds.large)) return 'large';
    if (this.meetsThreshold(metrics, this.thresholds.medium)) return 'medium';
    return 'small';
  }

  /** A repository meets a threshold when it exceeds at least 2 of the 5 criteria */
  private meetsThreshold(metrics: RepoMetrics, threshold: RepoMetrics): boolean {
    let criteriaMet = 0;
    if (metrics.stars >= threshold.stars) criteriaMet++;
    if (metrics.forks >= threshold.forks) criteriaMet++;
    if (metrics.monthlyPRs >= threshold.monthlyPRs) criteriaMet++;
    if (metrics.monthlyCommits >= threshold.monthlyCommits) criteriaMet++;
    if (metrics.activeContributors >= threshold.activeContributors) criteriaMet++;
    return criteriaMet >= 2;
  }

  /** Classify and store the result on tracked_repositories */
  async classifyAndUpdateRepository(
    repositoryId: string,
    owner: string,
    repo: string,
  ): Promise<RepositorySize> {
    const metrics = await this.fetchMetrics(owner, repo);
    const size = this.classifySize(metrics);
    console.log('Repository %s/%s classified as %s', owner, repo, size);

    const { error } = await this.supabase
      .from('tracked_repositories')
      .update({
        size,
        metrics: { ...metrics, lastCalculated: new Date().toISOString() },
        size_calculated_at: new Date().toISOString(),
      })
      .eq('repository_id', repositoryId);
    if (error) {
      throw new Error(`Failed to store classification for ${owner}/${repo}: ${error.message}`);
    }
    return size;
  }

  /** Batch classify multiple repositories, one at a time */
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
        results.push({
          repositoryId: repo.id,
          repository: `${repo.owner}/${repo.name}`,
          error: error instanceof Error ? error.message : String(error),
          success: false,
        });
      }
    }
    return results;
  }
}
