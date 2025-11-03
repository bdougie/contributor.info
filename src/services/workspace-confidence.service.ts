import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import {
  calculateRepositoryConfidence,
  type ConfidenceBreakdown,
} from '@/lib/insights/health-metrics';
import {
  getConfidenceHistory,
  calculateConfidenceTrend,
  type ConfidenceTrend,
  type ConfidenceHistoryPoint,
} from '@/lib/insights/confidence-history.service';

/**
 * Repository confidence data with trend information
 */
export interface RepositoryConfidenceData {
  repositoryId: string;
  owner: string;
  name: string;
  fullName: string;
  confidenceScore: number;
  breakdown?: ConfidenceBreakdown['breakdown'];
  trend?: ConfidenceTrend;
  history?: ConfidenceHistoryPoint[];
}

/**
 * Workspace-level confidence trends
 */
export interface WorkspaceConfidenceTrends {
  averageConfidence: number;
  trend: ConfidenceTrend | null;
  repositories: RepositoryConfidenceData[];
  calculatedAt: Date;
}

/**
 * Get confidence trends for all repositories in a workspace
 */
export async function getWorkspaceConfidenceTrends(
  client: SupabaseClient<Database>,
  workspaceId: string,
  timeRangeDays: number = 30
): Promise<WorkspaceConfidenceTrends> {
  // Fetch all repositories in the workspace
  const { data: workspaceRepos, error: repoError } = await client
    .from('workspace_repositories')
    .select(
      `
      repositories!inner (
        id,
        owner,
        name,
        full_name
      )
    `
    )
    .eq('workspace_id', workspaceId);

  if (repoError) {
    console.error('[Workspace Confidence] Error fetching workspace repositories:', repoError);
    throw repoError;
  }

  if (!workspaceRepos || workspaceRepos.length === 0) {
    return {
      averageConfidence: 0,
      trend: null,
      repositories: [],
      calculatedAt: new Date(),
    };
  }

  const repositories: RepositoryConfidenceData[] = [];
  const confidenceScores: number[] = [];

  // Calculate confidence for all repositories in parallel
  const repositoryPromises = workspaceRepos.map(async (wr) => {
    const repo = wr.repositories as unknown as {
      id: string;
      owner: string;
      name: string;
      full_name: string;
    } | null;

    if (!repo) return null;

    try {
      // Get current confidence score with breakdown and history in parallel
      const [result, history] = await Promise.all([
        calculateRepositoryConfidence(
          repo.owner,
          repo.name,
          timeRangeDays.toString(),
          false,
          false,
          true // return breakdown
        ),
        getConfidenceHistory(
          client,
          repo.owner,
          repo.name,
          timeRangeDays,
          4 // Look back 4 periods
        ),
      ]);

      const confidenceScore =
        typeof result === 'number' ? result : (result as ConfidenceBreakdown).score;
      const breakdown =
        typeof result === 'object' ? (result as ConfidenceBreakdown).breakdown : undefined;

      const trendResult = history.length >= 2 ? calculateConfidenceTrend(history) : null;
      const trend = trendResult ?? undefined;

      return {
        repositoryId: repo.id,
        owner: repo.owner,
        name: repo.name,
        fullName: repo.full_name,
        confidenceScore,
        breakdown,
        trend,
        history,
      };
    } catch (error) {
      console.warn(`[Workspace Confidence] Failed to get confidence for ${repo.full_name}:`, error);
      return null;
    }
  });

  // Wait for all repository calculations to complete
  const results = await Promise.all(repositoryPromises);

  // Filter out null results and build the repositories array
  for (const result of results) {
    if (result) {
      repositories.push(result);
      if (result.confidenceScore > 0) {
        confidenceScores.push(result.confidenceScore);
      }
    }
  }

  // Calculate workspace average confidence
  const averageConfidence =
    confidenceScores.length > 0
      ? confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length
      : 0;

  // Calculate workspace-level trend from all repository trends
  const workspaceTrend = calculateWorkspaceTrend(repositories);

  return {
    averageConfidence: Math.round(averageConfidence * 10) / 10, // Round to 1 decimal
    trend: workspaceTrend,
    repositories,
    calculatedAt: new Date(),
  };
}

/**
 * Calculate workspace-level confidence score (weighted average by repository activity)
 */
export function calculateWorkspaceConfidence(
  repoConfidences: Array<{ score: number; weight?: number }>
): number {
  if (repoConfidences.length === 0) {
    return 0;
  }

  // If weights are provided, calculate weighted average
  const hasWeights = repoConfidences.some((r) => r.weight !== undefined);

  if (hasWeights) {
    const totalWeight = repoConfidences.reduce((sum, r) => sum + (r.weight || 1), 0);
    const weightedSum = repoConfidences.reduce((sum, r) => sum + r.score * (r.weight || 1), 0);
    return Math.round((weightedSum / totalWeight) * 10) / 10;
  }

  // Otherwise, simple average
  const sum = repoConfidences.reduce((acc, r) => acc + r.score, 0);
  return Math.round((sum / repoConfidences.length) * 10) / 10;
}

/**
 * Calculate workspace-level trend from individual repository trends
 */
function calculateWorkspaceTrend(repositories: RepositoryConfidenceData[]): ConfidenceTrend | null {
  const reposWithTrends = repositories.filter((r) => r.trend !== null && r.trend !== undefined);

  if (reposWithTrends.length === 0) {
    return null;
  }

  // Calculate average change percent across all repos
  const avgChangePercent =
    reposWithTrends.reduce((sum, r) => sum + (r.trend?.changePercent || 0), 0) /
    reposWithTrends.length;

  // Calculate average current and previous scores
  const avgCurrentScore =
    reposWithTrends.reduce((sum, r) => sum + (r.trend?.currentScore || 0), 0) /
    reposWithTrends.length;

  const avgPreviousScore =
    reposWithTrends.reduce((sum, r) => sum + (r.trend?.previousScore || 0), 0) /
    reposWithTrends.length;

  // Determine overall direction with 5% threshold
  let direction: 'improving' | 'declining' | 'stable';
  if (Math.abs(avgChangePercent) < 5) {
    direction = 'stable';
  } else if (avgChangePercent > 0) {
    direction = 'improving';
  } else {
    direction = 'declining';
  }

  return {
    direction,
    changePercent: Math.round(avgChangePercent * 10) / 10,
    currentScore: Math.round(avgCurrentScore * 10) / 10,
    previousScore: Math.round(avgPreviousScore * 10) / 10,
    dataPoints: reposWithTrends.length,
  };
}

/**
 * Get confidence summary for a single repository with trend
 */
export async function getRepositoryConfidenceSummary(
  client: SupabaseClient<Database>,
  owner: string,
  repo: string,
  timeRangeDays: number = 30
): Promise<RepositoryConfidenceData> {
  // Get current confidence score with breakdown
  const result = await calculateRepositoryConfidence(
    owner,
    repo,
    timeRangeDays.toString(),
    false,
    false,
    true // return breakdown
  );

  const confidenceScore =
    typeof result === 'number' ? result : (result as ConfidenceBreakdown).score;
  const breakdown =
    typeof result === 'object' ? (result as ConfidenceBreakdown).breakdown : undefined;

  // Get historical data for trend analysis
  const history = await getConfidenceHistory(client, owner, repo, timeRangeDays, 4);
  const trendResult = history.length >= 2 ? calculateConfidenceTrend(history) : null;
  const trend = trendResult ?? undefined;

  return {
    repositoryId: '', // Will be set by caller if needed
    owner,
    name: repo,
    fullName: `${owner}/${repo}`,
    confidenceScore,
    breakdown,
    trend,
    history,
  };
}
