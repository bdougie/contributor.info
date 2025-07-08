import { supabase } from '../supabase';
import { ProgressiveCaptureNotifications } from './ui-notifications';

export interface DataCaptureJob {
  id: string;
  type: 'pr_details' | 'reviews' | 'comments' | 'commits' | 'recent_prs' | 'commit_pr_check' | 'ai_summary';
  priority: 'critical' | 'high' | 'medium' | 'low';
  repository_id: string;
  resource_id?: string; // PR number, commit SHA, etc.
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
   * Queue jobs to fetch missing file changes for PRs
   */
  async queueMissingFileChanges(repositoryId: string, limit: number = 50): Promise<number> {

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
      return 0;
    }

    // Queue jobs for each PR
    let queuedCount = 0;
    for (const pr of prsNeedingUpdate) {
      try {
        const { error: insertError } = await supabase
          .from('data_capture_queue')
          .insert({
            type: 'pr_details',
            priority: 'critical',
            repository_id: pr.repository_id,
            resource_id: pr.number.toString(),
            estimated_api_calls: 1,
            metadata: { pr_id: pr.id, reason: 'missing_file_changes' }
          });

        if (!insertError) {
          queuedCount++;
        } else if (insertError.code !== '23505') { // Ignore duplicate key errors
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
  async queueCommitPRAnalysis(repositoryId: string, commitShas: string[], priority: 'high' | 'medium' | 'low' = 'medium'): Promise<number> {

    if (!commitShas || commitShas.length === 0) {
      return 0;
    }

    // Queue individual commit PR checks (1 API call per commit)
    let queuedCount = 0;
    for (const sha of commitShas) {
      try {
        const { error } = await supabase
          .from('data_capture_queue')
          .insert({
            type: 'commit_pr_check',
            priority,
            repository_id: repositoryId,
            resource_id: sha,
            estimated_api_calls: 1, // 1 call per commit - much more efficient
            metadata: { 
              commit_sha: sha, 
              reason: 'direct_commit_analysis',
              batch_id: `batch_${Date.now()}`
            }
          });

        if (!error) {
          queuedCount++;
        } else if (error.code !== '23505') { // Ignore duplicate key errors
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

      const commitShas = commitsNeedingAnalysis.map(c => c.sha);
      return await this.queueCommitPRAnalysis(repositoryId, commitShas, 'medium');

    } catch (error) {
      console.error('[Queue] Error queuing recent commits analysis:', error);
      return 0;
    }
  }

  /**
   * Queue jobs to fetch recent PRs for repositories with stale data
   */
  async queueRecentPRs(repositoryId: string): Promise<boolean> {

    try {
      const { error } = await supabase
        .from('data_capture_queue')
        .insert({
          type: 'recent_prs',
          priority: 'critical',
          repository_id: repositoryId,
          estimated_api_calls: 10, // Estimate for fetching recent PRs
          metadata: { reason: 'stale_data', days: 7 }
        });

      if (error && error.code !== '23505') { // Ignore duplicate key errors
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
      .single();

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
        attempts: supabase.rpc('increment_attempts', { job_id: jobId })
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
        completed_at: new Date().toISOString()
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
      .single();

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
        next_retry_at: nextRetryAt?.toISOString()
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

    const stats = data.reduce((acc, job) => {
      const status = job.status as keyof typeof acc;
      if (status !== 'total' && status in acc) {
        acc[status]++;
      }
      acc.total++;
      return acc;
    }, { pending: 0, processing: 0, completed: 0, failed: 0, total: 0 });

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
        .single();

      if (error && error.code !== 'PGRST116') { // Not found is OK
        console.warn('[Queue] Error checking rate limits:', error);
        return false; // Conservative approach
      }

      const callsMade = data?.calls_made || 0;
      const callsRemaining = data?.calls_remaining || this.MAX_HOURLY_CALLS;

      // Check if we have enough calls remaining (with buffer)
      const safeToMake = callsRemaining >= (estimatedCalls + this.RATE_LIMIT_BUFFER);
      const withinHourlyLimit = (callsMade + estimatedCalls) <= this.MAX_HOURLY_CALLS;

      return safeToMake && withinHourlyLimit;
    } catch (err) {
      console.error('[Queue] Error checking rate limits:', err);
      return false; // Conservative approach
    }
  }

  /**
   * Update rate limit tracking
   */
  async updateRateLimitTracking(callsMade: number, callsRemaining: number): Promise<void> {
    const hourBucket = new Date();
    hourBucket.setMinutes(0, 0, 0);

    try {
      const { error } = await supabase
        .from('rate_limit_tracking')
        .upsert({
          hour_bucket: hourBucket.toISOString(),
          calls_made: callsMade,
          calls_remaining: callsRemaining,
          reset_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour from now
        }, {
          onConflict: 'hour_bucket'
        });

      if (error) {
        console.warn('[Queue] Error updating rate limit tracking:', error);
      }
    } catch (err) {
      console.error('[Queue] Error updating rate limit tracking:', err);
    }
  }

  /**
   * Queue jobs to fetch reviews for PRs that don't have them
   */
  async queueMissingReviews(repositoryId: string, limit: number = 50): Promise<number> {

    // Find PRs without reviews
    const { data: prsNeedingReviews, error } = await supabase
      .from('pull_requests')
      .select(`
        id,
        number,
        repository_id,
        github_id
      `)
      .eq('repository_id', repositoryId)
      .not('id', 'in', 
        supabase.from('reviews').select('pull_request_id')
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Queue] Error finding PRs needing reviews:', error);
      return 0;
    }

    if (!prsNeedingReviews || prsNeedingReviews.length === 0) {
      return 0;
    }

    // Queue jobs for each PR
    let queuedCount = 0;
    for (const pr of prsNeedingReviews) {
      try {
        const { error: insertError } = await supabase
          .from('data_capture_queue')
          .insert({
            type: 'reviews',
            priority: 'medium',
            repository_id: pr.repository_id,
            resource_id: pr.number.toString(),
            estimated_api_calls: 1,
            metadata: { pr_id: pr.id, pr_github_id: pr.github_id }
          });

        if (!insertError) {
          queuedCount++;
        } else if (insertError.code !== '23505') { // Ignore duplicate key errors
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
  async queueMissingComments(repositoryId: string, limit: number = 50): Promise<number> {

    // Find PRs without comments
    const { data: prsNeedingComments, error } = await supabase
      .from('pull_requests')
      .select(`
        id,
        number,
        repository_id,
        github_id
      `)
      .eq('repository_id', repositoryId)
      .not('id', 'in', 
        supabase.from('comments').select('pull_request_id')
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Queue] Error finding PRs needing comments:', error);
      return 0;
    }

    if (!prsNeedingComments || prsNeedingComments.length === 0) {
      return 0;
    }

    // Queue jobs for each PR
    let queuedCount = 0;
    for (const pr of prsNeedingComments) {
      try {
        const { error: insertError } = await supabase
          .from('data_capture_queue')
          .insert({
            type: 'comments',
            priority: 'medium',
            repository_id: pr.repository_id,
            resource_id: pr.number.toString(),
            estimated_api_calls: 2, // PR comments + issue comments
            metadata: { pr_id: pr.id, pr_github_id: pr.github_id }
          });

        if (!insertError) {
          queuedCount++;
        } else if (insertError.code !== '23505') { // Ignore duplicate key errors
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
}

// Export singleton instance
export const queueManager = new DataCaptureQueueManager();