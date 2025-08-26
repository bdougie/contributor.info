import { supabase } from '../supabase';
import {
  getTimeSensitivityFactor,
  getBatchSizeFactor,
  getPriorityFactor,
} from '../utils/performance-helpers';
import type { HybridJob } from './hybrid-queue-manager';

export interface RoutingDecision {
  processor: 'inngest' | 'github_actions';
  reason: string;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface BackfillState {
  id: string;
  repository_id: string;
  status: 'active' | 'paused' | 'completed' | 'failed';
  total_prs: number;
  processed_prs: number;
  chunk_size: number;
}

export class EnhancedHybridRouter {
  private readonly GITHUB_ACTIONS_PERCENTAGE = 0.25; // 25% to GitHub Actions
  private readonly LARGE_REPO_THRESHOLD = 1000;
  private readonly HISTORICAL_DATA_DAYS = 7;

  /**
   * Route a job to the appropriate processor based on multiple factors
   */
  async routeJob(job: HybridJob): Promise<RoutingDecision> {
    try {
      // Always use GitHub Actions for progressive backfill
      if (job.job_type === 'progressive_backfill' || job.type === 'progressive_backfill') {
        return {
          processor: 'github_actions',
          reason: 'progressive_backfill_always_actions',
          confidence: 1.0,
          metadata: { job_type: 'progressive_backfill' },
        };
      }

      // Get repository metadata
      const repository = await this.getRepositoryMetadata(job.repository_id || job.repositoryId);

      if (!repository) {
        // Default to Inngest if we can't find repository info
        return {
          processor: 'inngest',
          reason: 'repository_not_found',
          confidence: 0.5,
        };
      }

      // Check if repository is being backfilled
      const backfillState = await this.getBackfillState(repository.id);

      if (backfillState?.status === 'active') {
        // If backfill is active, route based on data recency
        const timeRange = job.time_range || job.timeRange || 30;

        if (timeRange <= 1) {
          // Recent data goes to Inngest
          return {
            processor: 'inngest',
            reason: 'recent_data_during_backfill',
            confidence: 0.9,
            metadata: { backfill_active: true, time_range: timeRange },
          };
        } else {
          // Skip historical data during backfill to avoid conflicts
          return {
            processor: 'github_actions',
            reason: 'skip_historical_during_backfill',
            confidence: 0.9,
            metadata: { backfill_active: true, time_range: timeRange, skip: true },
          };
        }
      }

      // Calculate routing factors
      const factors = await this.calculateRoutingFactors(job, repository);

      // Make routing decision
      const decision = this.makeRoutingDecision(factors);

      return decision;
    } catch (error) {
      console.error("Error:", error);

      // Default to Inngest on error
      return {
        processor: 'inngest',
        reason: 'routingerror_fallback',
        confidence: 0.3,
      };
    }
  }

  /**
   * Calculate routing factors for decision making
   */
  private async calculateRoutingFactors(
    job: HybridJob,
    repository: { id: string; full_name: string; size?: number; [key: string]: unknown },
  ) {
    const timeRange = job.time_range || job.timeRange || 30;
    const maxItems = job.max_items || job.maxItems || 100;

    // Time sensitivity (recent = Inngest)
    const timeSensitivity = getTimeSensitivityFactor(timeRange);

    // Batch size (small = Inngest, large = GitHub Actions)
    const batchSizeFactor = getBatchSizeFactor(maxItems);

    // Repository size (large repos = GitHub Actions)
    const repoSizeFactor = repository.pull_request_count > this.LARGE_REPO_THRESHOLD ? 0.2 : 0.7;

    // Historical vs real-time
    const isHistorical = timeRange > this.HISTORICAL_DATA_DAYS;
    const dataAgeFactor = isHistorical ? 0.1 : 0.9;

    // Current system load
    const systemLoad = await this.getCurrentLoadBalance();

    // Priority
    const priority = job.priority || 'medium';
    const priorityFactor = getPriorityFactor(priority);

    return {
      timeSensitivity,
      batchSizeFactor,
      repoSizeFactor,
      dataAgeFactor,
      systemLoad,
      priorityFactor,
      isHistorical,
      repositorySize: repository.pull_request_count,
      timeRange,
      maxItems,
    };
  }

  /**
   * Make routing decision based on factors
   */
  private makeRoutingDecision(factors: {
    timeSensitivity: number;
    batchSize: number;
    priority: number;
    repoSize: number;
    historicalSuccess: number;
    currentLoad: number;
    [key: string]: unknown;
  }): RoutingDecision {
    // Calculate weighted scores
    const inngestScore =
      factors.timeSensitivity * 0.3 +
      factors.batchSizeFactor * 0.2 +
      factors.repoSizeFactor * 0.2 +
      factors.dataAgeFactor * 0.2 +
      factors.priorityFactor * 0.1;

    const actionsScore = 1 - inngestScore;

    // Apply system load balancing
    const adjustedInngestScore = inngestScore * (1 - factors.systemLoad.inngestLoad);
    const adjustedActionsScore = actionsScore * (1 - factors.systemLoad.actionsLoad);

    // Apply random distribution for 25% GitHub Actions target
    const randomFactor = Math.random();
    const useActions =
      randomFactor < this.GITHUB_ACTIONS_PERCENTAGE || adjustedActionsScore > adjustedInngestScore;

    // Build reason string
    let reason = '';
    if (factors.isHistorical && factors.repositorySize > this.LARGE_REPO_THRESHOLD) {
      reason = 'large_repo_historical_data';
    } else if (factors.timeRange <= 1) {
      reason = 'recent_data_real_time';
    } else if (useActions && randomFactor < this.GITHUB_ACTIONS_PERCENTAGE) {
      reason = 'random_distribution_25_percent';
    } else {
      reason = 'score_based_routing';
    }

    return {
      processor: useActions ? 'github_actions' : 'inngest',
      reason,
      confidence: Math.abs(adjustedInngestScore - adjustedActionsScore),
      metadata: {
        inngest_score: adjustedInngestScore.toFixed(3),
        actions_score: adjustedActionsScore.toFixed(3),
        factors,
      },
    };
  }

  /**
   * Get repository metadata from database
   */
  private async getRepositoryMetadata(repositoryId: string) {
    try {
      const { data, error } = await supabase
        .from('repositories')
        .select(
          `
          id,
          owner,
          name,
          pull_request_count,
          created_at,
          updated_at
        `,
        )
        .eq('id', repositoryId)
        .maybeSingle();

      if (error) {
        console.error("Error:", error);
        return null;
      }

      return data;
    } catch (error) {
      console.error("Error:", error);
      return null;
    }
  }

  /**
   * Get active backfill state for a repository
   */
  private async getBackfillState(repositoryId: string): Promise<BackfillState | null> {
    try {
      const { data, error } = await supabase
        .from('progressive_backfill_state')
        .select('*')
        .eq('repository_id', repositoryId)
        .eq('status', 'active')
        .maybeSingle();

      if (error || !_data) {
        return null;
      }

      return data;
    } catch (error) {
      console.error("Error:", error);
      return null;
    }
  }

  /**
   * Get current system load for load balancing
   */
  private async getCurrentLoadBalance() {
    try {
      // Get processing job counts for each processor
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const { data: jobs } = await supabase
        .from('progressive_capture_jobs')
        .select('processor_type')
        .eq('status', 'processing')
        .gte('started_at', oneHourAgo.toISOString());

      const inngestCount = jobs?.filter((j) => j.processor_type === 'inngest').length || 0;
      const actionsCount = jobs?.filter((j) => j.processor_type === 'github_actions').length || 0;

      // Normalize to 0-1 scale (assuming max 100 concurrent jobs per processor)
      return {
        inngestLoad: Math.min(inngestCount / 100, 1),
        actionsLoad: Math.min(actionsCount / 100, 1),
      };
    } catch (error) {
      console.error("Error:", error);
      return { inngestLoad: 0.5, actionsLoad: 0.5 };
    }
  }

  /**
   * Check if a repository should initiate backfill
   */
  async shouldInitiateBackfill(repository: {
    id: string;
    full_name: string;
    [key: string]: unknown;
  }): Promise<boolean> {
    // Check if repository needs backfill
    if (!repository.pull_request_count || repository.pull_request_count < 100) {
      return false; // Small repos don't need backfill
    }

    // Check if already being backfilled
    const existingBackfill = await this.getBackfillState(repository.id);
    if (existingBackfill) {
      return false;
    }

    // Check data completeness
    const { count: capturedPRs } = await supabase
      .from('pull_requests')
      .select('*', { count: 'exact', head: true })
      .eq('repository_id', repository.id);

    const completeness = (capturedPRs || 0) / repository.pull_request_count;

    // Initiate backfill if less than 80% complete
    return completeness < 0.8;
  }

  /**
   * Get routing statistics for monitoring
   */
  async getRoutingStats(timeWindowHours: number = 24) {
    try {
      const since = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);

      const { data: jobs } = await supabase
        .from('progressive_capture_jobs')
        .select('processor_type, status')
        .gte('created_at', since.toISOString());

      if (!jobs) {
        return null;
      }

      const stats = {
        total: jobs.length,
        inngest: jobs.filter((j) => j.processor_type === 'inngest').length,
        github_actions: jobs.filter((j) => j.processor_type === 'github_actions').length,
        inngest_percentage: 0,
        actions_percentage: 0,
        by_status: {
          pending: jobs.filter((j) => j.status === 'pending').length,
          processing: jobs.filter((j) => j.status === 'processing').length,
          completed: jobs.filter((j) => j.status === 'completed').length,
          failed: jobs.filter((j) => j.status === 'failed').length,
        },
      };

      if (stats.total > 0) {
        stats.inngest_percentage = Math.round((stats.inngest / stats.total) * 100);
        stats.actions_percentage = Math.round((stats.github_actions / stats.total) * 100);
      }

      return stats;
    } catch (error) {
      console.error("Error:", error);
      return null;
    }
  }
}

// Export singleton instance
export const enhancedHybridRouter = new EnhancedHybridRouter();
