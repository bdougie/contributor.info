import { supabase } from '../supabase';
import { ProgressiveCaptureNotifications } from './ui-notifications';
import { env } from '../env';
import { getPriorityLevel } from '../utils/priority-classification';

export interface DataCaptureJob {
  id: string;
  type:
    | 'pr_details'
    | 'reviews'
    | 'comments'
    | 'commits'
    | 'recent_prs'
    | 'commit_pr_check'
    | 'ai_summary'
    | 'issues'
    | 'workspace_issues';
  priority: 'critical' | 'high' | 'medium' | 'low';
  repository_id: string;
  resource_id?: string; // PR number, commit SHA, issue number, etc.
  estimated_api_calls: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  attempts: number;
  max_attempts: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  next_retry_at?: string;
  last_error?: string;
  metadata: Record<string, any>;
}

export class DataCaptureQueueManager {
  private readonly RATE_LIMIT_BUFFER = 1000; // Keep 1000 calls as buffer
  private readonly MAX_HOURLY_CALLS = 4000; // Conservative limit

  /**
   * Get human-readable reason for priority level
   */
  private getPriorityReason(priority: 'critical' | 'high' | 'medium' | 'low'): string {
    switch (priority) {
      case 'critical':
        return 'popular_repo_stale_data';
      case 'high':
        return 'regular_repo_stale_data';
      case 'medium':
        return 'regular_repo_recent_data';
      case 'low':
        return 'popular_repo_recent_data';
      default:
        return 'unknown';
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
    priority: 'critical' | 'high' | 'medium' | 'low'
  ): Promise<number> {
    // Find PRs with missing file change data
    const { data: prsNeedingUpdate, error } = await supabase
      .from('pull_requests')
      .select('id, number, repository_id')
      .eq('repository_id', repositoryId)
      .eq('additions', 0)
      .eq('deletions', 0)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Queue] Error finding PRs needing file changes:', error);
      return 0;
    }

    if (!prsNeedingUpdate || prsNeedingUpdate.length === 0) {
      if (env.DEV) {
        console.log('[Queue] No PRs needing file changes found for repository %s', repositoryId);
      }
      return 0;
    }

    if (env.DEV) {
      console.log(
        '[Queue] Found %s PRs needing file changes (limit: %s, priority: %s)',
        prsNeedingUpdate.length,
        limit,
        priority
      );
    }

    // Queue jobs for each PR
    let queuedCount = 0;
    for (const pr of prsNeedingUpdate) {
      try {
        const { error: insertError } = await supabase.from('data_capture_queue').insert({
          type: 'pr_details',
          priority,
          repository_id: pr.repository_id,
          resource_id: pr.number.toString(),
          estimated_api_calls: 1,
          metadata: { pr_id: pr.id, reason: 'missing_file_changes' },
        });

        if (!insertError) {
          queuedCount++;
        } else if (insertError.code !== '23505') {
          // Ignore duplicate key errors
          console.warn(`[Queue] Failed to queue PR ${pr.number}:`, insertError);
        }
      } catch (err) {
        console.warn(`[Queue] Error queuing PR ${pr.number}:`, err);
      }
    }

    // Show UI notification
    if (queuedCount > 0) {
      ProgressiveCaptureNotifications.showJobsQueued(queuedCount, 'file changes');
    }

    return queuedCount;
  }

  /**
   * Queue jobs to analyze commits for PR associations (smart YOLO analysis)
   */
  async queueCommitPRAnalysis(
    repositoryId: string,
    commitShas: string[],
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<number> {
    if (!commitShas || commitShas.length === 0) {
      return 0;
    }

    // Queue individual commit PR checks (1 API call per commit)
    let queuedCount = 0;
    for (const sha of commitShas) {
      try {
        const { error } = await supabase.from('data_capture_queue').insert({
          type: 'commit_pr_check',
          priority,
          repository_id: repositoryId,
          resource_id: sha,
          estimated_api_calls: 1, // 1 call per commit - much more efficient
          metadata: {
            commit_sha: sha,
            reason: 'direct_commit_analysis',
            batch_id: `batch_${Date.now()}`,
          },
        });

        if (!error) {
          queuedCount++;
        } else if (error.code !== '23505') {
          // Ignore duplicate key errors
          console.warn(`[Queue] Failed to queue commit ${sha}:`, error);
        }
      } catch (err) {
        console.warn(`[Queue] Error queuing commit ${sha}:`, err);
      }
    }

    // Show UI notification
    if (queuedCount > 0) {
      ProgressiveCaptureNotifications.showJobsQueued(queuedCount, 'commit analysis');
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
    priority: 'critical' | 'high' | 'medium' | 'low'
  ): Promise<number> {
    try {
      // Find commits that need PR analysis (don't have is_direct_commit set)
      const { data: commitsNeedingAnalysis, error } = await supabase
        .from('commits')
        .select('sha')
        .eq('repository_id', repositoryId)
        .is('is_direct_commit', null)
        .gte('authored_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .order('authored_at', { ascending: false })
        .limit(100); // Analyze up to 100 recent commits

      if (error) {
        console.error('[Queue] Error finding commits needing analysis:', error);
        return 0;
      }

      if (!commitsNeedingAnalysis || commitsNeedingAnalysis.length === 0) {
        return 0;
      }

      const commitShas = commitsNeedingAnalysis.map((c) => c.sha);
      // Map critical to high for commit analysis (which only supports high/medium/low)
      const commitPriority =
        priority === 'critical' ? 'high' : (priority as 'high' | 'medium' | 'low');
      return await this.queueCommitPRAnalysis(repositoryId, commitShas, commitPriority);
    } catch (error) {
      console.error('[Queue] Error queuing recent commits analysis:', error);
      return 0;
    }
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
    priority: 'critical' | 'high' | 'medium' | 'low'
  ): Promise<boolean> {
    try {
      const { error } = await supabase.from('data_capture_queue').insert({
        type: 'recent_prs',
        priority,
        repository_id: repositoryId,
        estimated_api_calls: 10, // Estimate for fetching recent PRs
        metadata: {
          reason: 'stale_data',
          days: 7,
          priority_reason: this.getPriorityReason(priority),
        },
      });

      if (error && error.code !== '23505') {
        // Ignore duplicate key errors
        console.error('[Queue] Error queuing recent PRs:', error);
        return false;
      }

      // Show UI notification
      ProgressiveCaptureNotifications.showJobsQueued(1, 'recent PRs');

      return true;
    } catch (err) {
      console.error('[Queue] Error queuing recent PRs:', err);
      return false;
    }
  }

  /**
   * Get the next job to process based on priority
   */
  async getNextJob(): Promise<DataCaptureJob | null> {
    const { data, error } = await supabase
      .from('data_capture_queue')
      .select('*')
      .eq('status', 'pending')
      .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`)
      .order('priority', { ascending: true }) // critical, high, medium, low
      .order('created_at', { ascending: true }) // FIFO within same priority
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data as DataCaptureJob;
  }

  /**
   * Mark a job as processing
   */
  async markJobProcessing(jobId: string): Promise<boolean> {
    const { error } = await supabase
      .from('data_capture_queue')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
        attempts: supabase.rpc('increment_attempts', { job_id: jobId }),
      })
      .eq('id', jobId);

    return !error;
  }

  /**
   * Mark a job as completed
   */
  async markJobCompleted(jobId: string): Promise<boolean> {
    const { error } = await supabase
      .from('data_capture_queue')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    return !error;
  }

  /**
   * Mark a job as failed and schedule retry if attempts remaining
   */
  async markJobFailed(jobId: string, errorMessage: string): Promise<boolean> {
    // Get current job data
    const { data: job, error: fetchError } = await supabase
      .from('data_capture_queue')
      .select('attempts, max_attempts')
      .eq('id', jobId)
      .maybeSingle();

    if (fetchError || !job) {
      return false;
    }

    const shouldRetry = job.attempts < job.max_attempts;
    const nextRetryAt = shouldRetry
      ? new Date(Date.now() + Math.pow(2, job.attempts) * 60 * 1000) // Exponential backoff
      : null;

    const { error } = await supabase
      .from('data_capture_queue')
      .update({
        status: shouldRetry ? 'pending' : 'failed',
        last_error: errorMessage,
        next_retry_at: nextRetryAt?.toISOString(),
      })
      .eq('id', jobId);

    return !error;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
  }> {
    const { data, error } = await supabase
      .from('data_capture_queue')
      .select('status')
      .order('created_at', { ascending: false });

    if (error || !data) {
      return { pending: 0, processing: 0, completed: 0, failed: 0, total: 0 };
    }

    const stats = data.reduce(
      (acc, job) => {
        const status = job.status as keyof typeof acc;
        if (status !== 'total' && status in acc) {
          acc[status]++;
        }
        acc.total++;
        return acc;
      },
      { pending: 0, processing: 0, completed: 0, failed: 0, total: 0 }
    );

    return stats;
  }

  /**
   * Check if we can make API calls within rate limits
   */
  async canMakeAPICalls(estimatedCalls: number = 1): Promise<boolean> {
    try {
      // Get current hour's usage
      const hourBucket = new Date();
      hourBucket.setMinutes(0, 0, 0);

      const { data, error } = await supabase
        .from('rate_limit_tracking')
        .select('calls_made, calls_remaining')
        .eq('hour_bucket', hourBucket.toISOString())
        .maybeSingle();

      if (error) {
        // If rate limit tracking fails (permissions, etc), allow operations
        // This prevents blocking the queue when rate limit tracking has issues
        if (env.DEV) {
          console.warn('[Queue] Rate limit tracking unavailable, allowing operations:', error.code);
        }
        return true; // Permissive approach when tracking is unavailable
      }

      const callsMade = data?.calls_made || 0;
      const callsRemaining = data?.calls_remaining || this.MAX_HOURLY_CALLS;

      // Check if we have enough calls remaining (with buffer)
      const safeToMake = callsRemaining >= estimatedCalls + this.RATE_LIMIT_BUFFER;
      const withinHourlyLimit = callsMade + estimatedCalls <= this.MAX_HOURLY_CALLS;

      return safeToMake && withinHourlyLimit;
    } catch (err) {
      // If any error occurs, allow operations to continue
      if (env.DEV) {
        console.warn('[Queue] Rate limit check failed, allowing operations:', err);
      }
      return true; // Permissive approach on errors
    }
  }

  /**
   * Update rate limit tracking
   */
  async updateRateLimitTracking(callsMade: number, callsRemaining: number): Promise<void> {
    const hourBucket = new Date();
    hourBucket.setMinutes(0, 0, 0);

    try {
      const { error } = await supabase.from('rate_limit_tracking').upsert(
        {
          hour_bucket: hourBucket.toISOString(),
          calls_made: callsMade,
          calls_remaining: callsRemaining,
          reset_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
        },
        {
          onConflict: 'hour_bucket',
        }
      );

      if (error) {
        // Silently fail rate limit tracking updates - they're not critical for functionality
        if (env.DEV) {
          console.warn('[Queue] Rate limit tracking update failed:', error.code);
        }
      }
    } catch (err) {
      // Silently fail - rate limit tracking is nice-to-have, not critical
      if (env.DEV) {
        console.warn('[Queue] Rate limit tracking update error:', err);
      }
    }
  }

  /**
   * Queue jobs to fetch reviews for PRs that don't have them
   */
  async queueMissingReviews(repositoryId: string, limit: number = 200): Promise<number> {
    return this.queueMissingReviewsWithPriority(repositoryId, limit, 'high');
  }

  /**
   * Queue jobs to fetch reviews for PRs with specific priority
   */
  async queueMissingReviewsWithPriority(
    repositoryId: string,
    limit: number = 200,
    priority: 'critical' | 'high' | 'medium' | 'low'
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
      `
      )
      .eq('repository_id', repositoryId)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Only add the not.in filter if we have existing IDs
    if (existingPrIds.length > 0) {
      query = query.not('id', 'in', `(${existingPrIds.map((id) => `'${id}'`).join(',')})`);
    }

    const { data: prsNeedingReviews, error } = await query;

    if (error) {
      console.error('[Queue] Error finding PRs needing reviews:', error);
      return 0;
    }

    if (!prsNeedingReviews || prsNeedingReviews.length === 0) {
      if (env.DEV) {
        console.log('[Queue] No PRs needing reviews found for repository %s', repositoryId);
      }
      return 0;
    }

    if (env.DEV) {
      console.log(
        '[Queue] Found %s PRs needing reviews (limit: %s, priority: %s)',
        prsNeedingReviews.length,
        limit,
        priority
      );
    }

    // Queue jobs for each PR
    let queuedCount = 0;
    for (const pr of prsNeedingReviews) {
      try {
        const { error: insertError } = await supabase.from('data_capture_queue').insert({
          type: 'reviews',
          priority,
          repository_id: pr.repository_id,
          resource_id: pr.number.toString(),
          estimated_api_calls: 1,
          metadata: { pr_id: pr.id, pr_github_id: pr.github_id },
        });

        if (!insertError) {
          queuedCount++;
        } else if (insertError.code !== '23505') {
          // Ignore duplicate key errors
          console.warn(`[Queue] Failed to queue reviews for PR ${pr.number}:`, insertError);
        }
      } catch (err) {
        console.warn(`[Queue] Error queuing reviews for PR ${pr.number}:`, err);
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
      `
      )
      .eq('repository_id', repositoryId)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Only add the not.in filter if we have existing IDs
    if (existingPrIds.length > 0) {
      query = query.not('id', 'in', `(${existingPrIds.map((id) => `'${id}'`).join(',')})`);
    }

    const { data: prsNeedingComments, error } = await query;

    if (error) {
      console.error('[Queue] Error finding PRs needing comments:', error);
      return 0;
    }

    if (!prsNeedingComments || prsNeedingComments.length === 0) {
      if (env.DEV) {
        console.log('[Queue] No PRs needing comments found for repository %s', repositoryId);
      }
      return 0;
    }

    if (env.DEV) {
      console.log(
        '[Queue] Found %s PRs needing comments (limit: %s)',
        prsNeedingComments.length,
        limit
      );
    }

    // Queue jobs for each PR
    let queuedCount = 0;
    for (const pr of prsNeedingComments) {
      try {
        const { error: insertError } = await supabase.from('data_capture_queue').insert({
          type: 'comments',
          priority: 'medium',
          repository_id: pr.repository_id,
          resource_id: pr.number.toString(),
          estimated_api_calls: 2, // PR comments + issue comments
          metadata: { pr_id: pr.id, pr_github_id: pr.github_id },
        });

        if (!insertError) {
          queuedCount++;
        } else if (insertError.code !== '23505') {
          // Ignore duplicate key errors
          console.warn(`[Queue] Failed to queue comments for PR ${pr.number}:`, insertError);
        }
      } catch (err) {
        console.warn(`[Queue] Error queuing comments for PR ${pr.number}:`, err);
      }
    }

    // Show UI notification
    if (queuedCount > 0) {
      ProgressiveCaptureNotifications.showJobsQueued(queuedCount, 'comments');
    }

    return queuedCount;
  }

  /**
   * Queue jobs to fetch issues for workspace repositories
   * Only fetches issues for repositories that belong to workspaces
   */
  async queueWorkspaceIssues(workspaceId?: string, hoursBack: number = 24): Promise<number> {
    // Get workspace repositories that need issue syncing
    const query = workspaceId
      ? supabase
          .from('workspace_tracked_repositories')
          .select(
            `
            workspace_id,
            tracked_repository_id,
            priority_score,
            tracked_repositories!inner(
              repository_id,
              repositories!inner(
                id,
                full_name,
                owner,
                name
              )
            )
          `
          )
          .eq('workspace_id', workspaceId)
          .eq('is_active', true)
          .eq('fetch_issues', true)
          .lte('next_sync_at', new Date().toISOString())
      : supabase
          .from('workspace_tracked_repositories')
          .select(
            `
            workspace_id,
            tracked_repository_id,
            priority_score,
            tracked_repositories!inner(
              repository_id,
              repositories!inner(
                id,
                full_name,
                owner,
                name
              )
            )
          `
          )
          .eq('is_active', true)
          .eq('fetch_issues', true)
          .lte('next_sync_at', new Date().toISOString())
          .order('priority_score', { ascending: false })
          .limit(10);

    const { data: workspaceRepos, error } = await query;

    if (error) {
      console.error('[Queue] Error finding workspace repos needing issues:', error);
      return 0;
    }

    if (!workspaceRepos || workspaceRepos.length === 0) {
      if (env.DEV) {
        console.log('[Queue] No workspace repos needing issues sync');
      }
      return 0;
    }

    if (env.DEV) {
      console.log('[Queue] Found %s workspace repos needing issues sync', workspaceRepos.length);
    }

    // Queue jobs for each repository
    let queuedCount = 0;
    for (const repo of workspaceRepos) {
      try {
        // Access nested data - handle both object and array cases
        const trackedRepo = (repo as Record<string, unknown>).tracked_repositories;
        if (!trackedRepo) continue;

        // Get the repositories data (handle both array and object)
        const repositories = Array.isArray(trackedRepo)
          ? trackedRepo[0]?.repositories
          : (trackedRepo as Record<string, unknown>).repositories;

        const repoData = Array.isArray(repositories) ? repositories[0] : repositories;

        if (!repoData || typeof repoData !== 'object') continue;

        // Extract repository fields
        const repoInfo = repoData as Record<string, unknown>;
        const repositoryId = repoInfo.id as string;
        const fullName = repoInfo.full_name as string;

        if (!repositoryId || !fullName) continue;

        const { error: insertError } = await supabase.from('data_capture_queue').insert({
          type: 'workspace_issues',
          priority: getPriorityLevel(repo.priority_score),
          repository_id: repositoryId,
          resource_id: `${hoursBack}h`,
          estimated_api_calls: 5, // Estimate for issues in time window
          metadata: {
            workspace_id: repo.workspace_id,
            tracked_repository_id: repo.tracked_repository_id,
            repository_name: fullName,
            hours_back: hoursBack,
            reason: 'workspace_sync',
          },
        });

        if (!insertError) {
          queuedCount++;
        } else if (insertError.code !== '23505') {
          // Ignore duplicate key errors
          console.warn(`[Queue] Failed to queue issues for ${fullName}:`, insertError);
        }
      } catch (err) {
        console.warn('[Queue] Error queuing workspace issues:', err);
      }
    }

    // Show UI notification
    if (queuedCount > 0) {
      ProgressiveCaptureNotifications.showJobsQueued(queuedCount, 'workspace issues');
    }

    return queuedCount;
  }
}

// Export singleton instance
export const queueManager = new DataCaptureQueueManager();
