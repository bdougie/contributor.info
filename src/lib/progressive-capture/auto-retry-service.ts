import { supabase } from '../supabase';
import { hybridQueueManager } from './hybrid-queue-manager';
import { jobStatusReporter } from './job-status-reporter';

export interface RetryConfig {
  maxRetries: number;
  retryDelayMs: number;
  backoffMultiplier: number;
}

export interface RetryableJob {
  id: string;
  job_type: string;
  repository_id: string;
  processor_type: 'inngest' | 'github_actions';
  metadata: Record<string, unknown>;
  error?: string;
  retry_count?: number;
  last_retry_at?: string;
}

/**
 * Service for automatically retrying failed capture jobs
 */
export class AutoRetryService {
  private readonly defaultConfig: RetryConfig = {
    maxRetries: 3,
    retryDelayMs: 60000, // 1 minute
    backoffMultiplier: 2,
  };

  // Simple in-memory cache for repository metadata
  // In production, consider using Redis or a similar caching solution
  private repositoryCache = new Map<string, { owner: string; name: string; cachedAt: number }>();
  private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache TTL

  /**
   * Check for failed jobs and retry them
   */
  async retryFailedJobs(): Promise<void> {
    try {
      console.log('[AutoRetry] Checking for failed jobs to retry...');

      // Get failed jobs that haven't exceeded max retries
      const { data: failedJobs } = await supabase
        .from('progressive_capture_jobs')
        .select('*')
        .eq('status', 'failed')
        .or(
          `metadata->retry_count.is.null,meta_data->retry_count.lt.${this.defaultConfig.maxRetries}`,
        )
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

      // Also check for jobs that have exceeded max retries and log them
      const { data: exhaustedJobs } = await supabase
        .from('progressive_capture_jobs')
        .select('*')
        .eq('status', 'failed')
        .gte('meta_data->retry_count', this.defaultConfig.maxRetries)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (exhaustedJobs && exhaustedJobs.length > 0) {
        console.error(
          `[AutoRetry] ❌ ${exhaustedJobs.length} jobs have exhausted all retry attempts:`,
          exhaustedJobs.map((job) => ({
            jobId: job.id,
            jobType: job.job_type,
            repositoryName: job.metadata?.repository_name,
            error: job.error,
            retryCount: job.metadata?.retry_count,
            processorType: job.processor_type,
            createdAt: job.created_at,
          })),
        );
      }

      if (!failedJobs || failedJobs.length === 0) {
        console.log('[AutoRetry] No failed jobs to retry');
        return;
      }

      console.log('[AutoRetry] Found %d failed jobs to process', failedJobs.length);

      for (const job of failedJobs) {
        await this.processFailedJob(job);
      }
    } catch (error) {
      console.error('[AutoRetry] ❌ Critical error checking failed jobs:', {
        error,
        timestamp: new Date().toISOString(),
        service: 'AutoRetryService',
      });
    }
  }

  /**
   * Process a single failed job for retry
   */
  private async processFailedJob(job: RetryableJob): Promise<void> {
    try {
      const retryCount = job.metadata?.retry_count || 0;
      const lastRetryAt = job.metadata?.last_retry_at;

      // Check if we should retry based on backoff timing
      if (lastRetryAt) {
        const timeSinceLastRetry = Date.now() - new Date(lastRetryAt).getTime();
        const requiredDelay = this.calculateBackoffDelay(retryCount);

        if (timeSinceLastRetry < requiredDelay) {
          console.log(
            '[AutoRetry] Job %s not ready for retry (%dms < %dms)',
            job.id,
            timeSinceLastRetry,
            requiredDelay,
          );
          return;
        }
      }

      // Check if job has permanent failures that shouldn't be retried
      if (this.isPermanentFailure(job.error)) {
        console.error(
          `[AutoRetry] ❌ Job ${job.id} has permanent failure, marking as permanently failed:`,
          {
            jobId: job.id,
            jobType: job.job_type,
            repositoryId: job.repository_id,
            error: job.error,
            retryCount,
            repositoryName: job.metadata?.repository_name,
          },
        );
        await this.markJobAsPermanentlyFailed(job.id);
        return;
      }

      // Validate job has repository_id (repository_name can be fetched if missing)
      if (!job.repository_id) {
        console.error(`[AutoRetry] ❌ Job ${job.id} missing repository_id, cannot retry:`, {
          jobId: job.id,
          jobType: job.job_type,
          metadata: job.metadata,
        });
        await this.markJobAsPermanentlyFailed(job.id);
        return;
      }

      console.log('[AutoRetry] Retrying job %s (attempt %d)', job.id, retryCount + 1);

      // Update job metadata with retry information
      await supabase
        .from('progressive_capture_jobs')
        .update({
          metadata: {
            ...job.metadata,
            retry_count: retryCount + 1,
            last_retry_at: new Date().toISOString(),
            retry_history: [
              ...(job.meta_data?.retry_history || []),
              {
                attempt: retryCount + 1,
                timestamp: new Date().toISOString(),
                previouserror: job.error,
              },
            ],
          },
        })
        .eq('id', job.id);

      // Create a new job with the same parameters
      const newJob = await this.createRetryJob(job);

      console.log('[AutoRetry] Created retry job %s for failed job %s', newJob.id, job.id);

      // Mark original job as retried
      await jobStatusReporter.reportStatus({
        jobId: job.id,
        status: 'failed',
        metadata: {
          retried: true,
          retry_job_id: newJob.id,
          final_retry_count: retryCount + 1,
        },
      });
    } catch (error) {
      console.error(`[AutoRetry] ❌ Error processing failed job ${job.id}:`, {
        jobId: job.id,
        jobType: job.job_type,
        repositoryId: job.repository_id,
        repositoryName: job.metadata?.repository_name,
        currentError: error,
        originalError: job.error,
        retryCount: job.metadata?.retry_count || 0,
        processorType: job.processor_type,
      });
    }
  }

  /**
   * Calculate backoff delay based on retry count
   */
  private calculateBackoffDelay(retryCount: number): number {
    return (
      this.defaultConfig.retryDelayMs * Math.pow(this.defaultConfig.backoffMultiplier, retryCount)
    );
  }

  /**
   * Check if an error is permanent and shouldn't be retried
   */
  private isPermanentFailure(error?: string): boolean {
    if (!error) return false;

    const permanentErrors = [
      'Repository not found',
      'Invalid repository format',
      'Unauthorized',
      'Rate limit exceeded',
      'Repository is private',
      'Repository is archived',
    ];

    return permanentErrors.some((permError) =>
      error.toLowerCase().includes(permError.toLowerCase()),
    );
  }

  /**
   * Mark a job as permanently failed (no more retries)
   */
  private async markJobAsPermanentlyFailed(jobId: string): Promise<void> {
    await jobStatusReporter.reportStatus({
      jobId,
      status: 'failed',
      metadata: {
        permanent_failure: true,
        no_retry_reason: 'Permanent error detected',
      },
    });
  }

  /**
   * Create a new job for retry
   */
  private async createRetryJob(
    originalJob: RetryableJob,
  ): Promise<RetryableJob | { success: boolean; jobId?: string; error?: string }> {
    // Validate required fields before retry
    if (!originalJob.repository_id) {
      console.error('[AutoRetry] Cannot retry job without repository_id:', {
        jobId: originalJob.id,
        jobType: originalJob.job_type,
        metadata: originalJob.metadata,
      });
      throw new Error(`Cannot retry job ${originalJob.id}: missing repository_id`);
    }

    // If repository_name is missing, check cache first, then fetch from database
    let repositoryName = originalJob.metadata?.repository_name;
    if (!repositoryName) {
      // Check cache first
      const cached = this.getCachedRepository(originalJob.repository_id);
      if (cached) {
        repositoryName = `${cached.owner}/${cached.name}`;
        console.log('[AutoRetry] Repository name found in cache: %s', repositoryName);
      } else {
        console.log(
          '[AutoRetry] Repository name missing, fetching from _database for job:',
          originalJob.id,
        );

        const { data: repo, error } = await supabase
          .from('repositories')
          .select('owner, name')
          .eq('id', originalJob.repository_id)
          .maybeSingle();

        if (error || !repo) {
          console.error('[AutoRetry] Failed to fetch repository details:', {
            jobId: originalJob.id,
            repositoryId: originalJob.repository_id,
            error: error?.message,
          });
          throw new Error(`Cannot retry job ${originalJob.id}: repository not found`);
        }

        // Cache the repository metadata
        this.cacheRepository(originalJob.repository_id, repo.owner, repo.name);

        repositoryName = `${repo.owner}/${repo.name}`;
        console.log('[AutoRetry] Found repository name: %s', repositoryName);
      }
    }

    // Extract job data from original
    const jobData = {
      repositoryId: originalJob.repository_id,
      repositoryName: repositoryName,
      timeRange: originalJob.metadata?.time_range_days,
      maxItems: originalJob.metadata?.max_items,
      triggerSource: 'automatic' as const,
      metadata: {
        retry_of: originalJob.id,
        retry_attempt: (originalJob.meta_data?.retry_count || 0) + 1,
        originalerror: originalJob.error,
        repository_name_fetched: !originalJob.metadata?.repository_name, // Track if we had to fetch it
      },
    };

    // Queue the retry job
    return await hybridQueueManager.queueJob(originalJob.job_type, jobData);
  }

  /**
   * Get retry statistics including cache metrics
   */
  async getRetryStats(): Promise<{
    totalRetries: number;
    successfulRetries: number;
    failedRetries: number;
    averageRetryCount: number;
    permanentFailures: number;
    cacheMetrics: {
      cacheSize: number;
      cacheHitRate: number;
      repositoriesCached: number;
    };
    dataQualityMetrics: {
      jobsWithMissingRepoName: number;
      jobsRecoveredViaFetch: number;
    };
  }> {
    try {
      const { data: jobs } = await supabase
        .from('progressive_capture_jobs')
        .select('meta_data')
        .not('meta_data->retry_count', 'is', null)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()); // Last 7 days

      if (!jobs) {
        return {
          totalRetries: 0,
          successfulRetries: 0,
          failedRetries: 0,
          averageRetryCount: 0,
          permanentFailures: 0,
          cacheMetrics: {
            cacheSize: this.repositoryCache.size,
            cacheHitRate: 0,
            repositoriesCached: this.repositoryCache.size,
          },
          dataQualityMetrics: {
            jobsWithMissingRepoName: 0,
            jobsRecoveredViaFetch: 0,
          },
        };
      }

      const stats = jobs.reduce(
        (acc, job) => {
          const retryCount = job.metadata?.retry_count || 0;
          acc.totalRetries += retryCount;

          if (job.meta_data?.permanent_failure) {
            acc.permanentFailures++;
          }

          return acc;
        },
        {
          totalRetries: 0,
          permanentFailures: 0,
        },
      );

      // Get successful retry jobs
      const { data: successfulJobs } = await supabase
        .from('progressive_capture_jobs')
        .select('id')
        .eq('status', 'completed')
        .not('meta_data->retry_of', 'is', null);

      const successfulRetries = successfulJobs?.length || 0;
      const failedRetries = stats.totalRetries - successfulRetries;
      const averageRetryCount = jobs.length > 0 ? stats.totalRetries / jobs.length : 0;

      // Get data quality metrics
      const { data: jobsWithMissingData } = await supabase
        .from('progressive_capture_jobs')
        .select('id, meta_data')
        .is('meta_data->repository_name', null)
        .not('repository_id', 'is', null);

      const jobsWithMissingRepoName = jobsWithMissingData?.length || 0;
      const jobsRecoveredViaFetch = jobs.filter(
        (job) => job.metadata?.repository_name_fetched === true,
      ).length;

      // Calculate cache hit rate (this would need to be tracked over time for accuracy)
      // For now, we'll estimate based on cache size
      const cacheHitRate =
        this.repositoryCache.size > 0 ? Math.min(this.repositoryCache.size / 100, 1) : 0; // Simple estimate

      return {
        totalRetries: stats.totalRetries,
        successfulRetries,
        failedRetries,
        averageRetryCount,
        permanentFailures: stats.permanentFailures,
        cacheMetrics: {
          cacheSize: this.repositoryCache.size,
          cacheHitRate,
          repositoriesCached: this.repositoryCache.size,
        },
        dataQualityMetrics: {
          jobsWithMissingRepoName,
          jobsRecoveredViaFetch,
        },
      };
    } catch (error) {
      console.error("Error:", error);
      return {
        totalRetries: 0,
        successfulRetries: 0,
        failedRetries: 0,
        averageRetryCount: 0,
        permanentFailures: 0,
        cacheMetrics: {
          cacheSize: 0,
          cacheHitRate: 0,
          repositoriesCached: 0,
        },
        dataQualityMetrics: {
          jobsWithMissingRepoName: 0,
          jobsRecoveredViaFetch: 0,
        },
      };
    }
  }

  /**
   * Configure retry settings for specific job types
   */
  async configureRetryPolicy(jobType: string, config: Partial<RetryConfig>): Promise<void> {
    // This could be stored in a database table for persistence
    console.log('[AutoRetry] Configuring retry policy for %s:', jobType, config);

    // For now, we'll use the default config
    // In a production system, this would update a retry_policies table
  }

  /**
   * Get cached repository metadata
   */
  private getCachedRepository(repositoryId: string): { owner: string; name: string } | null {
    const cached = this.repositoryCache.get(repositoryId);

    if (!cached) {
      return null;
    }

    // Check if cache entry is expired
    if (Date.now() - cached.cachedAt > this.CACHE_TTL_MS) {
      this.repositoryCache.delete(repositoryId);
      return null;
    }

    return { owner: cached.owner, name: cached.name };
  }

  /**
   * Cache repository metadata
   */
  private cacheRepository(repositoryId: string, owner: string, name: string): void {
    this.repositoryCache.set(repositoryId, {
      owner,
      name,
      cachedAt: Date.now(),
    });

    // Implement simple cache size limit (LRU-style)
    if (this.repositoryCache.size > 1000) {
      // Remove oldest entries when cache gets too large
      const entriesToRemove = this.repositoryCache.size - 900;
      const iterator = this.repositoryCache.keys();
      for (let i = 0; i < entriesToRemove; i++) {
        const key = iterator.next().value;
        if (key) {
          this.repositoryCache.delete(key);
        }
      }
    }
  }

  /**
   * Clear repository cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.repositoryCache.clear();
    console.log('[AutoRetry] Repository cache cleared');
  }

  /**
   * Start the auto-retry service (should be called periodically)
   */
  async start(intervalMs: number = 300000): Promise<NodeJS.Timeout> {
    console.log('[AutoRetry] Starting auto-retry service');

    // Run immediately
    this.retryFailedJobs();

    // Then run periodically
    return setInterval(() => {
      this.retryFailedJobs();
    }, intervalMs);
  }
}

// Export singleton instance
export const autoRetryService = new AutoRetryService();
