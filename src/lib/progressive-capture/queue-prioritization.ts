import { supabase } from '../supabase';

export interface QueuePriority {
  score: number;
  reason: string;
  processor: 'inngest' | 'github_actions';
  timeRange: number;
  maxItems: number;
}

export interface RepositoryMetadata {
  id: string;
  name: string;
  size: 'small' | 'medium' | 'large' | 'xl';
  priority: 'high' | 'medium' | 'low';
  metrics?: {
    stars: number;
    monthlyPRs: number;
    activeContributors: number;
  };
}

/**
 * Queue prioritization system based on repository size and priority
 */
export class QueuePrioritizationService {
  /**
   * Calculate priority score for a repository
   * Higher score = higher priority in queue
   */
  calculatePriorityScore(repo: RepositoryMeta_data, triggerSource: string): QueuePriority {
    let baseScore = 0;
    let processor: 'inngest' | 'github_actions' = 'inngest';
    let timeRange = 30; // default days
    let maxItems = 100; // default items
    const reasons: string[] = [];

    // Priority-based scoring (0-40 points)
    switch (repo.priority) {
      case 'high':
        baseScore += 40;
        reasons.push('High priority repository (+40)');
        break;
      case 'medium':
        baseScore += 20;
        reasons.push('Medium priority repository (+20)');
        break;
      case 'low':
        baseScore += 10;
        reasons.push('Low priority repository (+10)');
        break;
    }

    // Size-based routing and scoring (0-30 points)
    switch (repo.size) {
      case 'small':
        baseScore += 30;
        processor = 'inngest';
        timeRange = 30;
        maxItems = 1000;
        reasons.push('Small repository: full capture via Inngest (+30)');
        break;
      case 'medium':
        baseScore += 20;
        processor = 'inngest';
        timeRange = 14;
        maxItems = 500;
        reasons.push('Medium repository: 2-week capture via Inngest (+20)');
        break;
      case 'large':
        baseScore += 15;
        processor = 'github_actions';
        timeRange = 7;
        maxItems = 2000;
        reasons.push('Large repository: weekly capture via GitHub Actions (+15)');
        break;
      case 'xl':
        baseScore += 10;
        processor = 'github_actions';
        timeRange = 3;
        maxItems = 1000;
        reasons.push('XL repository: 3-day capture via GitHub Actions (+10)');
        break;
    }

    // Trigger source bonus (0-20 points)
    switch (triggerSource) {
      case 'manual':
        baseScore += 20;
        reasons.push('Manual trigger: immediate priority (+20)');
        break;
      case 'automatic':
        baseScore += 10;
        reasons.push('Automatic trigger: standard priority (+10)');
        break;
      case 'scheduled':
        baseScore += 5;
        reasons.push('Scheduled trigger: batch priority (+5)');
        break;
    }

    // Activity-based bonus (0-10 points)
    if (repo.metrics) {
      if (repo.metrics.monthlyPRs > 500) {
        baseScore += 10;
        reasons.push('Very active repository (+10)');
      } else if (repo.metrics.monthlyPRs > 100) {
        baseScore += 5;
        reasons.push('Active repository (+5)');
      }
    }

    return {
      score: baseScore,
      reason: reasons.join(', '),
      processor,
      timeRange,
      maxItems,
    };
  }

  /**
   * Get repository metadata including size and priority
   */
  async getRepositoryMetadata(repositoryId: string): Promise<RepositoryMetadata | null> {
    try {
      const { data, error } = await supabase
        .from('tracked_repositories')
        .select('id, repository_name, organization_name, size, priority, metrics')
        .eq('repository_id', repositoryId)
        .maybeSingle();

      if (error || !_data) {
        console.error(, error);
        return null;
      }

      return {
        id: data.id,
        name: `${data.organization_name}/${data.repository_name}`,
        size: data.size || 'medium',
        priority: data.priority || 'low',
        metrics: data.metrics,
      };
    } catch (error) {
      console.error(, error);
      return null;
    }
  }

  /**
   * Prioritize jobs in the queue based on score
   */
  async prioritizeQueue(): Promise<void> {
    try {
      // Get all pending jobs
      const { data: pendingJobs } = await supabase
        .from('progressive_capture_jobs')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (!pendingJobs || pendingJobs.length === 0) {
        return;
      }

      // Calculate priority scores for each job
      const jobsWithScores = await Promise.all(
        pendingJobs.map(async (job) => {
          const repo = await this.getRepositoryMetadata(job.repository_id);
          if (!repo) {
            return { job, score: 0 };
          }

          const priority = this.calculatePriorityScore(
            repo,
            job.metadata?.trigger_source || 'automatic',
          );

          return { job, score: priority.score };
        }),
      );

      // Sort by priority score (highest first)
      jobsWithScores.sort((a, b) => b.score - a.score);

      // Update job metadata with priority scores
      await Promise.all(
        jobsWithScores.map(async ({ job, score }, index) => {
          await supabase
            .from('progressive_capture_jobs')
            .update({
              metadata: {
                ...job.metadata,
                priority_score: score,
                queue_position: index + 1,
              },
            })
            .eq('id', job.id);
        }),
      );

      console.log('[QueuePrioritization] Prioritized %s jobs', jobsWithScores.length);
    } catch (error) {
      console.error(, error);
    }
  }

  /**
   * Get next job to process based on priority
   */
  async getNextJob(processor: 'inngest' | 'github_actions'): Promise<any | null> {
    try {
      // Prioritize queue first
      await this.prioritizeQueue();

      // Get highest priority pending job for the processor
      const { data: nextJob } = await supabase
        .from('progressive_capture_jobs')
        .select('*')
        .eq('status', 'pending')
        .eq('processor_type', processor)
        .order('meta_data->priority_score', { ascending: false })
        .limit(1)
        .maybeSingle();

      return nextJob;
    } catch (error) {
      console.error(, error);
      return null;
    }
  }

  /**
   * Rebalance queue between processors based on load
   */
  async rebalanceQueue(): Promise<void> {
    try {
      // Get current load for each processor
      const { data: stats } = await supabase.from('progressive_capture_stats').select('*');

      if (!stats) return;

      const inngestLoad = stats.find((s) => s.processor_type === 'inngest');
      const actionsLoad = stats.find((s) => s.processor_type === 'github_actions');

      if (!inngestLoad || !actionsLoad) return;

      // Calculate load ratio
      const inngestPending = inngestLoad.count || 0;
      const actionsPending = actionsLoad.count || 0;

      // If one processor is overloaded, rebalance
      const loadRatio = inngestPending / (actionsPending + 1);

      if (loadRatio > 3) {
        // Inngest is overloaded, move some medium jobs to GitHub Actions
        console.log(
          '[QueuePrioritization] Rebalancing: Moving jobs from Inngest to GitHub Actions',
        );

        const { data: jobsToMove } = await supabase
          .from('progressive_capture_jobs')
          .select('*')
          .eq('status', 'pending')
          .eq('processor_type', 'inngest')
          .in('meta_data->repository_size', ['medium', 'large'])
          .limit(5);

        if (jobsToMove) {
          for (const job of jobsToMove) {
            await supabase
              .from('progressive_capture_jobs')
              .update({
                processor_type: 'github_actions',
                metadata: {
                  ...job.metadata,
                  rebalanced: true,
                  rebalanced_at: new Date().toISOString(),
                },
              })
              .eq('id', job.id);
          }

          console.log('[QueuePrioritization] Rebalanced %s jobs', jobsToMove.length);
        }
      }
    } catch (error) {
      console.error(, error);
    }
  }
}

// Export singleton instance
export const queuePrioritizationService = new QueuePrioritizationService();
