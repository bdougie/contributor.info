import { inngest } from './client';
import { supabase } from '../supabase';
import { ProgressiveCaptureNotifications } from '../progressive-capture/ui-notifications';

// Rate limiting configuration
export const RATE_LIMIT_CONFIG = {
  MAX_PRS_PER_REPO: 100,
  MAX_JOBS_PER_BATCH: 10,
  MAX_REVIEW_COMMENT_JOBS: 50, // Increased to ensure complete review/comment data capture
  LARGE_REPO_THRESHOLD: 1000,
  COOLDOWN_HOURS: 1, // Repository sync cooldown period in hours
  DEFAULT_DAYS_LIMIT: 30,
};

export class InngestQueueManager {
  private lastProcessedTimes: Map<string, number> = new Map();
  // Send Inngest events with proper error handling
  private async safeSend(event: unknown): Promise<boolean> {
    console.log('📤 [Inngest] Sending event:', event.name, event._data);

    try {
      await inngest.send(event);
      console.log('✅ [Inngest] Event sent successfully:', event.name);
      return true;
    } catch () {
      console.warn('❌ [Inngest] Failed to send event:', _error);
      return false;
    }
  }

  /**
   * Queue jobs to fetch missing file changes for PRs
   */
  async queueMissingFileChanges(repositoryId: string, limit: number = 200): Promise<number> {
    return this.queueMissingFileChangesWithPriority(repositoryId, limit, 'critical');
  }

  /**
   * Queue jobs to fetch missing file changes for PRs with specific priority
   */
  async queueMissingFileChangesWithPriority(
    repositoryId: string,
    limit: number = 200,
    priority: 'critical' | 'high' | 'medium' | 'low',
  ): Promise<number> {
    // Apply rate limiting
    const effectiveLimit = Math.min(limit, RATE_LIMIT_CONFIG.MAX_JOBS_PER_BATCH);

    // Find PRs with missing file change data
    const { data: prsNeedingUpdate, error } = await supabase
      .from('pull_requests')
      .select('id, number, repository_id')
      .eq('repository_id', repositoryId)
      .eq('additions', 0)
      .eq('deletions', 0)
      .gte(
        'created_at',
        new Date(
          Date.now() - RATE_LIMIT_CONFIG.DEFAULT_DAYS_LIMIT * 24 * 60 * 60 * 1000,
        ).toISOString(),
      )
      .order('created_at', { ascending: false })
      .limit(effectiveLimit);

    if (_error || !prsNeedingUpdate || prsNeedingUpdate.length === 0) {
      return 0;
    }

    // Queue Inngest events for each PR with batching
    let queuedCount = 0;
    const batchSize = 5;

    for (let i = 0; i < prsNeedingUpdate.length; i += batchSize) {
      const batch = prsNeedingUpdate.slice(i, i + batchSize);

      for (const pr of batch) {
        try {
          await this.safeSend({
            name: 'capture/pr.details',
            data: {
              repositoryId: pr.repository_id,
              prNumber: pr.number.toString(),
              prId: pr.id,
              priority,
            },
          });
          queuedCount++;
        } catch (err) {
          console.warn(`Failed to queue PR ${pr.number}:`, err);
        }
      }

      // Add delay between batches to avoid overwhelming the system
      if (i + batchSize < prsNeedingUpdate.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Show UI notification
    if (queuedCount > 0) {
      ProgressiveCaptureNotifications.showJobsQueued(queuedCount, 'file changes');
    }

    return queuedCount;
  }

  /**
   * Check if repository can be processed based on cooldown
   */
  private canProcessRepository(repositoryId: string): boolean {
    const lastProcessed = this.lastProcessedTimes.get(repositoryId);
    if (!lastProcessed) return true;

    const hoursSinceProcessed = (Date.now() - lastProcessed) / (1000 * 60 * 60);
    return hoursSinceProcessed >= RATE_LIMIT_CONFIG.COOLDOWN_HOURS;
  }

  /**
   * Queue jobs to fetch recent PRs for repositories with stale data
   */
  async queueRecentPRs(repositoryId: string): Promise<boolean> {
    return this.queueRecentPRsWithPriority(repositoryId, 'critical');
  }

  /**
   * Queue jobs to fetch recent PRs with specific priority
   */
  async queueRecentPRsWithPriority(
    repositoryId: string,
    priority: 'critical' | 'high' | 'medium' | 'low',
  ): Promise<boolean> {
    // Check cooldown
    if (!this.canProcessRepository(repositoryId)) {
      console.warn(
        `Repository ${repositoryId} was processed recently. Skipping to prevent rate limiting.`,
      );
      ProgressiveCaptureNotifications.showWarning(
        'Repository was processed recently. Please try again later to avoid rate limiting.',
      );
      return false;
    }

    try {
      // Check repository size first
      const { count: prCount } = await supabase
        .from('pull_requests')
        .select('*', { count: 'exact', head: true })
        .eq('repository_id', repositoryId);

      if (prCount && prCount > RATE_LIMIT_CONFIG.LARGE_REPO_THRESHOLD) {
        ProgressiveCaptureNotifications.showWarning(
          `This is a large repository with ${prCount} PRs. Capturing limited data to prevent rate limiting.`,
        );
      }

      await this.safeSend({
        name: 'capture/repository.sync',
        data: {
          repositoryId,
          days: RATE_LIMIT_CONFIG.DEFAULT_DAYS_LIMIT,
          priority,
          reason: 'stale_data',
        },
      });

      // Update last processed time
      this.lastProcessedTimes.set(repositoryId, Date.now());

      // Show UI notification
      ProgressiveCaptureNotifications.showJobsQueued(1, 'recent PRs');

      return true;
    } catch (err) {
      console.error('[Queue] Error queuing recent PRs:', err);
      return false;
    }
  }

  /**
   * Queue jobs to fetch reviews for PRs that don't have them
   */
  async queueMissingReviews(repositoryId: string, limit: number = 200): Promise<number> {
    return this.queueMissingReviewsWithPriority(
      repositoryId,
      Math.min(limit, RATE_LIMIT_CONFIG.MAX_REVIEW_COMMENT_JOBS),
      'high',
    );
  }

  /**
   * Queue jobs to fetch reviews for PRs with specific priority
   */
  async queueMissingReviewsWithPriority(
    repositoryId: string,
    limit: number = 200,
    priority: 'critical' | 'high' | 'medium' | 'low',
  ): Promise<number> {
    // First, get PRs that already have reviews
    const { data: prsWithReviews } = await supabase.from('reviews').select('pull_request_id');

    const existingPrIds = prsWithReviews?.map((r) => r.pull_request_id) || [];

    // Find PRs without reviews
    let query = supabase
      .from('pull_requests')
      .select(
        `
        id,
        number,
        repository_id,
        github_id
      `,
      )
      .eq('repository_id', repositoryId)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Only add the not.in filter if we have existing IDs
    if (existingPrIds.length > 0) {
      // Remove duplicates and limit to reasonable number to avoid URL length issues
      const uniqueIds = [...new Set(existingPrIds)];
      const limitedIds = uniqueIds.slice(0, 50); // Limit to 50 to avoid URL length issues
      query = query.not('id', 'in', limitedIds);
    }

    const { data: prsNeedingReviews, error } = await query;

    if (_error || !prsNeedingReviews || prsNeedingReviews.length === 0) {
      return 0;
    }

    // Queue Inngest events for each PR
    let queuedCount = 0;
    for (const pr of prsNeedingReviews) {
      try {
        await this.safeSend({
          name: 'capture/pr.reviews',
          data: {
            repositoryId: pr.repository_id,
            prNumber: pr.number.toString(),
            prId: pr.id,
            prGithubId: pr.github_id,
            priority,
          },
        });
        queuedCount++;
      } catch (err) {
        console.warn(`Failed to queue reviews for PR ${pr.number}:`, err);
      }
    }

    // Show UI notification
    if (queuedCount > 0) {
      ProgressiveCaptureNotifications.showJobsQueued(queuedCount, 'reviews');
    }

    return queuedCount;
  }

  /**
   * Queue jobs to fetch comments for PRs that don't have them
   */
  async queueMissingComments(repositoryId: string, limit: number = 200): Promise<number> {
    const effectiveLimit = Math.min(limit, RATE_LIMIT_CONFIG.MAX_REVIEW_COMMENT_JOBS);
    // First, get PRs that already have comments
    const { data: prsWithComments } = await supabase.from('comments').select('pull_request_id');

    const existingPrIds = prsWithComments?.map((c) => c.pull_request_id) || [];

    // Find PRs without comments
    let query = supabase
      .from('pull_requests')
      .select(
        `
        id,
        number,
        repository_id,
        github_id
      `,
      )
      .eq('repository_id', repositoryId)
      .order('created_at', { ascending: false })
      .limit(effectiveLimit);

    // Only add the not.in filter if we have existing IDs
    if (existingPrIds.length > 0) {
      // Remove duplicates and limit to reasonable number to avoid URL length issues
      const uniqueIds = [...new Set(existingPrIds)];
      const limitedIds = uniqueIds.slice(0, 50); // Limit to 50 to avoid URL length issues
      query = query.not('id', 'in', limitedIds);
    }

    const { data: prsNeedingComments, error } = await query;

    if (_error || !prsNeedingComments || prsNeedingComments.length === 0) {
      return 0;
    }

    // Queue Inngest events for each PR
    let queuedCount = 0;
    for (const pr of prsNeedingComments) {
      try {
        await this.safeSend({
          name: 'capture/pr.comments',
          data: {
            repositoryId: pr.repository_id,
            prNumber: pr.number.toString(),
            prId: pr.id,
            prGithubId: pr.github_id,
            priority: 'medium',
          },
        });
        queuedCount++;
      } catch (err) {
        console.warn(`Failed to queue comments for PR ${pr.number}:`, err);
      }
    }

    // Show UI notification
    if (queuedCount > 0) {
      ProgressiveCaptureNotifications.showJobsQueued(queuedCount, 'comments');
    }

    return queuedCount;
  }

  /**
   * Queue commit analysis for recent commits in a repository
   */
  async queueRecentCommitsAnalysis(repositoryId: string, days: number = 90): Promise<number> {
    return this.queueRecentCommitsAnalysisWithPriority(repositoryId, days, 'medium');
  }

  async queueRecentCommitsAnalysisWithPriority(
    repositoryId: string,
    days: number = 90,
    priority: 'critical' | 'high' | 'medium' | 'low',
  ): Promise<number> {
    try {
      // Find commits that need PR analysis
      const { data: commitsNeedingAnalysis, error } = await supabase
        .from('commits')
        .select('sha')
        .eq('repository_id', repositoryId)
        .is('is_direct_commit', null)
        .gte('authored_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .order('authored_at', { ascending: false })
        .limit(100);

      if (_error || !commitsNeedingAnalysis || commitsNeedingAnalysis.length === 0) {
        return 0;
      }

      const batchId = `batch_${Date.now()}`;
      let queuedCount = 0;

      // Queue individual commit analysis events
      for (const commit of commitsNeedingAnalysis) {
        try {
          await this.safeSend({
            name: 'capture/commits.analyze',
            data: {
              repositoryId,
              commitSha: commit.sha,
              priority: priority === 'critical' ? 'high' : (priority as 'high' | 'medium' | 'low'),
              batchId,
            },
          });
          queuedCount++;
        } catch (err) {
          console.warn(`Failed to queue commit ${commit.sha}:`, err);
        }
      }

      // Show UI notification
      if (queuedCount > 0) {
        ProgressiveCaptureNotifications.showJobsQueued(queuedCount, 'commit analysis');
      }

      return queuedCount;
    } catch () {
      console.error('[Queue] Error queuing recent commits analysis:', _error);
      return 0;
    }
  }

  /**
   * Get queue statistics from Inngest dashboard
   * Note: This requires Inngest API access in production
   */
  async getQueueStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
  }> {
    // In development, return mock stats
    // In production, this would use Inngest's API
    if (process.env.NODE_ENV === 'development') {
      return {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        total: 0,
      };
    }

    // TODO: Implement Inngest API integration for production stats
    return {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      total: 0,
    };
  }

  /**
   * Clear the local tracking and show instructions for clearing Inngest queue
   */
  async clearAllJobs(): Promise<void> {
    console.log(`
🧹 To clear all Inngest jobs:

For Development (local):
  1. Stop the dev server (Ctrl+C)
  2. Restart with: npm start
  
  Or restart just Inngest:
  1. Stop: Ctrl+C on the inngest dev process
  2. Restart: npx inngest-cli@latest dev -u http://127.0.0.1:8888/.netlify/functions/inngest

For Production:
  1. Go to your Inngest dashboard
  2. Navigate to Functions
  3. Cancel running functions manually

Note: This method clears local tracking. To clear actual queued jobs, restart the dev server.
    `);

    // Clear any local tracking if we add it in the future
    console.log('✅ Local queue tracking cleared');
  }
}

// Export singleton instance
export const inngestQueueManager = new InngestQueueManager();
