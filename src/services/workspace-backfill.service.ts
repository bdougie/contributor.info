import { supabase } from '@/lib/supabase';
import { HybridQueueManager } from '@/lib/progressive-capture/hybrid-queue-manager';

export interface BackfillJobStatus {
  id: string;
  workspaceId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'canceled';
  totalRepositories: number;
  completedRepositories: number;
  failedRepositories: number;
  retentionDays: number;
  startedAt?: string;
  completedAt?: string;
  estimatedCompletionAt?: string;
  errorMessage?: string;
}

export interface RepositoryBackfillProgress {
  repositoryId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  dataTypesCompleted: string[];
  dataTypesFailed: string[];
  counts: {
    pullRequests: number;
    issues: number;
    discussions: number;
    comments: number;
    reviews: number;
    events: number;
    embeddings: number;
  };
  errorMessage?: string;
}

/**
 * Service for orchestrating workspace-level historical data backfill
 * Triggered when users purchase the Extended Data Retention addon
 */
export class WorkspaceBackfillService {
  /**
   * Trigger workspace backfill for all repositories in a workspace
   * Called from Polar webhook when addon is purchased
   */
  static async triggerWorkspaceBackfill(
    workspaceId: string,
    retentionDays: number = 365,
    subscriptionAddonId?: string
  ): Promise<string> {
    // Input validation
    if (!workspaceId || typeof workspaceId !== 'string') {
      throw new Error('Valid workspaceId is required');
    }
    if (retentionDays < 1 || retentionDays > 3650) {
      throw new Error('retentionDays must be between 1 and 3650 days (10 years)');
    }

    try {
      console.log('Starting workspace backfill for workspace: %s', workspaceId);

      // Get all repositories in the workspace
      const { data: repositories, error: reposError } = await supabase
        .from('workspace_repositories')
        .select('repository_id')
        .eq('workspace_id', workspaceId);

      if (reposError) {
        console.error('Error fetching workspace repositories:', reposError);
        throw new Error(`Failed to fetch repositories: ${reposError.message}`);
      }

      if (!repositories || repositories.length === 0) {
        console.log('No repositories found in workspace: %s', workspaceId);
        throw new Error('No repositories found in workspace');
      }

      // Create backfill job record
      const jobId = await this.createBackfillJob(
        workspaceId,
        retentionDays,
        repositories.length,
        subscriptionAddonId
      );

      console.log('Created backfill job %s for %d repositories', jobId, repositories.length);

      // Queue backfill for each repository
      for (const repo of repositories) {
        await this.queueRepositoryBackfill(repo.repository_id, workspaceId, jobId, retentionDays);
      }

      // Update job status to in_progress
      await this.updateJobStatus(jobId, 'in_progress', {
        started_at: new Date().toISOString(),
      });

      console.log('Workspace backfill queued successfully for job: %s', jobId);
      return jobId;
    } catch (error) {
      console.error('Error triggering workspace backfill:', error);
      throw error;
    }
  }

  /**
   * Create a new backfill job record in the database
   */
  private static async createBackfillJob(
    workspaceId: string,
    retentionDays: number,
    totalRepositories: number,
    subscriptionAddonId?: string
  ): Promise<string> {
    const { data, error } = await supabase
      .from('workspace_backfill_jobs')
      .insert({
        workspace_id: workspaceId,
        subscription_addon_id: subscriptionAddonId,
        retention_days: retentionDays,
        total_repositories: totalRepositories,
        status: 'pending',
        metadata: {
          trigger_source: 'addon_purchase',
          created_by: 'WorkspaceBackfillService',
        },
      })
      .select('id')
      .maybeSingle();

    if (error || !data) {
      console.error('Error creating backfill job:', error);
      throw new Error(`Failed to create backfill job: ${error?.message || 'No data returned'}`);
    }

    return data.id;
  }

  /**
   * Queue a single repository for backfill processing
   */
  private static async queueRepositoryBackfill(
    repositoryId: string,
    workspaceId: string,
    jobId: string,
    retentionDays: number
  ): Promise<void> {
    try {
      // Create progress record for this repository
      await supabase.from('workspace_backfill_progress').insert({
        backfill_job_id: jobId,
        repository_id: repositoryId,
        status: 'pending',
        metadata: {
          workspace_id: workspaceId,
          retention_days: retentionDays,
        },
      });

      // Queue the actual backfill work through HybridQueueManager
      await HybridQueueManager.queueWorkspaceBackfill({
        workspaceId,
        repositoryId,
        jobId,
        retentionDays,
        dataTypes: [
          'pull_requests',
          'issues',
          'discussions',
          'comments',
          'reviews',
          'events',
          'embeddings',
        ],
      });

      console.log('Queued repository %s for backfill in job %s', repositoryId, jobId);
    } catch (error) {
      console.error('Error queuing repository %s:', repositoryId, error);

      // Mark repository as failed in progress table
      await this.updateRepositoryProgress(jobId, repositoryId, {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      });

      // Update job-level failed count
      await this.incrementFailedRepositories(jobId);
    }
  }

  /**
   * Update backfill job status
   */
  static async updateJobStatus(
    jobId: string,
    status: BackfillJobStatus['status'],
    updates: Record<string, unknown> = {}
  ): Promise<void> {
    const { error } = await supabase
      .from('workspace_backfill_jobs')
      .update({
        status,
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (error) {
      console.error('Error updating job status:', error);
      throw new Error(`Failed to update job status: ${error.message}`);
    }
  }

  /**
   * Update repository-level backfill progress
   */
  static async updateRepositoryProgress(
    jobId: string,
    repositoryId: string,
    updates: Record<string, unknown>
  ): Promise<void> {
    const { error } = await supabase
      .from('workspace_backfill_progress')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('backfill_job_id', jobId)
      .eq('repository_id', repositoryId);

    if (error) {
      console.error('Error updating repository progress:', error);
      throw new Error(`Failed to update repository progress: ${error.message}`);
    }
  }

  /**
   * Mark a repository as completed in the backfill job
   */
  static async completeRepositoryBackfill(
    jobId: string,
    repositoryId: string,
    counts: RepositoryBackfillProgress['counts']
  ): Promise<void> {
    try {
      // Update repository progress
      await this.updateRepositoryProgress(jobId, repositoryId, {
        status: 'completed',
        completed_at: new Date().toISOString(),
        pull_requests_count: counts.pullRequests,
        issues_count: counts.issues,
        discussions_count: counts.discussions,
        comments_count: counts.comments,
        reviews_count: counts.reviews,
        events_count: counts.events,
        embeddings_count: counts.embeddings,
        data_types_completed: [
          'pull_requests',
          'issues',
          'discussions',
          'comments',
          'reviews',
          'events',
          'embeddings',
        ],
      });

      // Increment completed count and check if job is done
      await this.incrementCompletedRepositories(jobId);

      console.log('Repository %s completed in job %s', repositoryId, jobId);
    } catch (error) {
      console.error('Error completing repository backfill:', error);
      throw error;
    }
  }

  /**
   * Increment the completed repositories count and check if job is complete
   * Uses atomic SQL increment to prevent race conditions
   */
  private static async incrementCompletedRepositories(jobId: string): Promise<void> {
    // Atomically increment completed_repositories and fetch the updated state
    const { data: job, error: updateError } = await supabase.rpc(
      'increment_completed_repositories',
      {
        p_job_id: jobId,
      }
    );

    if (updateError) {
      console.error('Error incrementing completed repositories:', updateError);
      // Fallback to manual increment if RPC doesn't exist yet
      await this.manualIncrementCompleted(jobId);
      return;
    }

    // Check if job is complete based on returned state
    if (job && job.completed_repositories + job.failed_repositories >= job.total_repositories) {
      await this.updateJobStatus(jobId, 'completed', {
        completed_at: new Date().toISOString(),
      });
      console.log('Backfill job %s completed successfully', jobId);
    }
  }

  /**
   * Fallback manual increment (non-atomic, for backwards compatibility)
   */
  private static async manualIncrementCompleted(jobId: string): Promise<void> {
    const { data: job, error: fetchError } = await supabase
      .from('workspace_backfill_jobs')
      .select('completed_repositories, failed_repositories, total_repositories')
      .eq('id', jobId)
      .maybeSingle();

    if (fetchError || !job) {
      console.error('Error fetching job for increment:', fetchError);
      return;
    }

    const newCompleted = job.completed_repositories + 1;
    const totalProcessed = newCompleted + job.failed_repositories;

    const updates: Record<string, unknown> = {
      completed_repositories: newCompleted,
    };

    if (totalProcessed >= job.total_repositories) {
      updates.status = 'completed';
      updates.completed_at = new Date().toISOString();
    }

    await this.updateJobStatus(jobId, updates.status as BackfillJobStatus['status'], updates);
  }

  /**
   * Increment the failed repositories count
   * Uses atomic SQL increment to prevent race conditions
   */
  private static async incrementFailedRepositories(jobId: string): Promise<void> {
    // Atomically increment failed_repositories and fetch the updated state
    const { data: job, error: updateError } = await supabase.rpc('increment_failed_repositories', {
      p_job_id: jobId,
    });

    if (updateError) {
      console.error('Error incrementing failed repositories:', updateError);
      // Fallback to manual increment if RPC doesn't exist yet
      await this.manualIncrementFailed(jobId);
      return;
    }

    // Check if job is complete based on returned state
    if (job && job.completed_repositories + job.failed_repositories >= job.total_repositories) {
      const status = job.failed_repositories === job.total_repositories ? 'failed' : 'completed';
      await this.updateJobStatus(jobId, status, {
        completed_at: new Date().toISOString(),
      });
      console.log('Backfill job %s completed with %d failures', jobId, job.failed_repositories);
    }
  }

  /**
   * Fallback manual increment for failed count (non-atomic, for backwards compatibility)
   */
  private static async manualIncrementFailed(jobId: string): Promise<void> {
    const { data: job, error: fetchError } = await supabase
      .from('workspace_backfill_jobs')
      .select('completed_repositories, failed_repositories, total_repositories')
      .eq('id', jobId)
      .maybeSingle();

    if (fetchError || !job) {
      console.error('Error fetching job for increment:', fetchError);
      return;
    }

    const newFailed = job.failed_repositories + 1;
    const totalProcessed = job.completed_repositories + newFailed;

    const updates: Record<string, unknown> = {
      failed_repositories: newFailed,
    };

    if (totalProcessed >= job.total_repositories) {
      updates.status = newFailed === job.total_repositories ? 'failed' : 'completed';
      updates.completed_at = new Date().toISOString();
    }

    await this.updateJobStatus(jobId, updates.status as BackfillJobStatus['status'], updates);
  }

  /**
   * Handle backfill errors for a repository
   */
  static async handleBackfillError(
    jobId: string,
    repositoryId: string,
    error: Error,
    dataType?: string
  ): Promise<void> {
    try {
      console.error('Backfill error for repository %s:', repositoryId, error);

      // Get current progress
      const { data: progress } = await supabase
        .from('workspace_backfill_progress')
        .select('data_types_failed, retry_count')
        .eq('backfill_job_id', jobId)
        .eq('repository_id', repositoryId)
        .maybeSingle();

      const failedTypes = progress?.data_types_failed || [];
      if (dataType && !failedTypes.includes(dataType)) {
        failedTypes.push(dataType);
      }

      const retryCount = (progress?.retry_count || 0) + 1;

      // Update progress with error
      await this.updateRepositoryProgress(jobId, repositoryId, {
        status: retryCount < 3 ? 'pending' : 'failed', // Allow 3 retries
        error_message: error.message,
        data_types_failed: failedTypes,
        retry_count: retryCount,
        last_retry_at: new Date().toISOString(),
      });

      // If max retries reached, increment failed count
      if (retryCount >= 3) {
        await this.incrementFailedRepositories(jobId);
      }
    } catch (updateError) {
      console.error('Error handling backfill error:', updateError);
    }
  }

  /**
   * Retry a failed repository backfill
   */
  static async retryFailedRepository(jobId: string, repositoryId: string): Promise<void> {
    try {
      // Get job details
      const { data: job } = await supabase
        .from('workspace_backfill_jobs')
        .select('workspace_id, retention_days')
        .eq('id', jobId)
        .maybeSingle();

      if (!job) {
        throw new Error('Backfill job not found');
      }

      // Reset progress status
      await this.updateRepositoryProgress(jobId, repositoryId, {
        status: 'pending',
        error_message: null,
        retry_count: 0,
      });

      // Re-queue the repository
      await this.queueRepositoryBackfill(repositoryId, job.workspace_id, jobId, job.retention_days);

      console.log('Retry queued for repository %s in job %s', repositoryId, jobId);
    } catch (error) {
      console.error('Error retrying failed repository:', error);
      throw error;
    }
  }

  /**
   * Get backfill job status with progress details
   */
  static async getJobStatus(jobId: string): Promise<BackfillJobStatus | null> {
    const { data, error } = await supabase
      .from('workspace_backfill_jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();

    if (error || !data) {
      console.error('Error fetching job status:', error);
      return null;
    }

    return {
      id: data.id,
      workspaceId: data.workspace_id,
      status: data.status,
      totalRepositories: data.total_repositories,
      completedRepositories: data.completed_repositories,
      failedRepositories: data.failed_repositories,
      retentionDays: data.retention_days,
      startedAt: data.started_at,
      completedAt: data.completed_at,
      estimatedCompletionAt: data.estimated_completion_at,
      errorMessage: data.error_message,
    };
  }

  /**
   * Get all repository progress details for a job
   */
  static async getRepositoryProgress(jobId: string): Promise<RepositoryBackfillProgress[]> {
    const { data, error } = await supabase
      .from('workspace_backfill_progress')
      .select('*')
      .eq('backfill_job_id', jobId)
      .order('created_at', { ascending: true });

    if (error || !data) {
      console.error('Error fetching repository progress:', error);
      return [];
    }

    return data.map((progress) => ({
      repositoryId: progress.repository_id,
      status: progress.status,
      dataTypesCompleted: progress.data_types_completed || [],
      dataTypesFailed: progress.data_types_failed || [],
      counts: {
        pullRequests: progress.pull_requests_count || 0,
        issues: progress.issues_count || 0,
        discussions: progress.discussions_count || 0,
        comments: progress.comments_count || 0,
        reviews: progress.reviews_count || 0,
        events: progress.events_count || 0,
        embeddings: progress.embeddings_count || 0,
      },
      errorMessage: progress.error_message,
    }));
  }

  /**
   * Cancel an in-progress backfill job
   */
  static async cancelJob(jobId: string): Promise<void> {
    await this.updateJobStatus(jobId, 'canceled', {
      completed_at: new Date().toISOString(),
    });

    console.log('Backfill job %s canceled', jobId);
  }
}
