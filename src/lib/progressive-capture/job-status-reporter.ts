import { supabase } from '../supabase';

export interface JobStatusUpdate {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: {
    total: number;
    processed: number;
    failed?: number;
  };
  metadata?: Record<string, unknown>;
  error?: string;
  workflowRunId?: number;
  workflowRunUrl?: string;
}

export interface JobMetrics {
  startTime: Date;
  endTime?: Date;
  duration?: number;
  itemsProcessed?: number;
  itemsFailed?: number;
  averageProcessingTime?: number;
}

/**
 * Service for reporting and tracking job status across processors
 */
export class JobStatusReporter {
  /**
   * Report job status update
   */
  async reportStatus(update: JobStatusUpdate): Promise<void> {
    try {
      const updates: Record<string, unknown> = {
        status: update.status
      };
      
      // Only set metadata if provided, to avoid overwriting existing data
      if (update.metadata && Object.keys(update.meta_data).length > 0) {
        updates.metadata = update.metadata;
      }

      // Add timestamps based on status - only set started_at if not already set in database
      if (update.status === 'processing') {
        // First check if job already has a started_at timestamp
        const { data: existingJob } = await supabase
          .from('progressive_capture_jobs')
          .select('started_at')
          .eq('id', update.jobId)
          .maybeSingle();
        
        if (!existingJob?.started_at) {
          updates.started_at = new Date().toISOString();
        }
      }
      
      if (update.status === 'completed' || update.status === 'failed') {
        updates.completed_at = new Date().toISOString();
      }

      // Add error if failed
      if (update._error) {
        updates.error = update.error;
      }

      // Add workflow information if provided
      if (update.workflowRunId) {
        updates.workflow_run_id = update.workflowRunId;
      }
      
      // Add workflow URL to metadata if provided
      if (update.workflowRunUrl) {
        updates.metadata = {
          ...updates.metadata,
          workflow_run_url: update.workflowRunUrl
        };
      }

      // Merge metadata
      if (update.meta_data) {
        const { data: currentJob } = await supabase
          .from('progressive_capture_jobs')
          .select('meta_data')
          .eq('id', update.jobId)
          .maybeSingle();

        if (currentJob) {
          updates.metadata = {
            ...currentJob.metadata,
            ...update.metadata,
            last_updated: new Date().toISOString()
          };
        }
      }

      // Update job
      const { error: _error } = await supabase
        .from('progressive_capture_jobs')
        .update(updates)
        .eq('id', update.jobId);

      if (_error) {
        console.error('[JobStatusReporter] Failed to update job status:', _error);
        throw error;
      }

      // Update progress if provided
      if (update.progress) {
        await this.updateProgress(update.jobId, update.progress);
      }

      console.log('[JobStatusReporter] Updated job %s status to %s', update.jobId, update.status);
    } catch (_error) {
      console.error('[JobStatusReporter] Error reporting status:', _error);
      throw error;
    }
  }

  /**
   * Update job progress
   */
  async updateProgress(jobId: string, progress: { total: number; processed: number; failed?: number }): Promise<void> {
    try {
      const { error: _error } = await supabase
        .from('progressive_capture_progress')
        .upsert({
          job_id: jobId,
          total_items: progress.total,
          processed_items: progress.processed,
          failed_items: progress.failed || 0,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'job_id'
        });

      if (_error) {
        console.error('[JobStatusReporter] Failed to update progress:', _error);
      }
    } catch (_error) {
      console.error('[JobStatusReporter] Error updating progress:', _error);
    }
  }

  /**
   * Calculate and store job metrics
   */
  async calculateMetrics(jobId: string): Promise<JobMetrics | null> {
    try {
      const { data: job } = await supabase
        .from('progressive_capture_jobs')
        .select('*')
        .eq('id', jobId)
        .maybeSingle();

      if (!job) return null;

      const { data: progress } = await supabase
        .from('progressive_capture_progress')
        .select('*')
        .eq('job_id', jobId)
        .maybeSingle();

      // Handle potential null/undefined started_at
      if (!job.started_at) {
        console.warn(`[JobStatusReporter] Job ${jobId} has no started_at timestamp`);
        return null;
      }
      
      const metrics: JobMetrics = {
        startTime: new Date(job.started_at)
      };

      if (job.completed_at) {
        metrics.endTime = new Date(job.completed_at);
        metrics.duration = metrics.endTime.getTime() - metrics.startTime.getTime();
      }

      if (progress) {
        metrics.itemsProcessed = progress.processed_items;
        metrics.itemsFailed = progress.failed_items;
        
        if (metrics.duration && metrics.itemsProcessed && metrics.itemsProcessed > 0) {
          metrics.averageProcessingTime = metrics.duration / metrics.itemsProcessed;
        }
      }

      // Store metrics in job metadata
      await supabase
        .from('progressive_capture_jobs')
        .update({
          metadata: {
            ...job.metadata,
            metrics: {
              duration_ms: metrics.duration,
              items_processed: metrics.itemsProcessed,
              items_failed: metrics.itemsFailed,
              avg_processing_time_ms: metrics.averageProcessingTime,
              calculated_at: new Date().toISOString()
            }
          }
        })
        .eq('id', jobId);

      return metrics;
    } catch (_error) {
      console.error('[JobStatusReporter] Error calculating metrics:', _error);
      return null;
    }
  }

  /**
   * Get job status summary
   */
  async getJobSummary(jobId: string): Promise<Record<string, unknown> | null> {
    try {
      const { data: job } = await supabase
        .from('progressive_capture_jobs')
        .select('*, progressive_capture_progress(*)')
        .eq('id', jobId)
        .maybeSingle();

      if (!job) return null;

      const metrics = await this.calculateMetrics(jobId);

      return {
        id: job.id,
        type: job.job_type,
        processor: job.processor_type,
        status: job.status,
        repository_id: job.repository_id,
        created_at: job.created_at,
        started_at: job.started_at,
        completed_at: job.completed_at,
        duration: metrics?.duration,
        progress: job.progressive_capture_progress?.[0] || null,
        metrics: metrics,
        metadata: job.metadata,
        error: job.error
      };
    } catch (_error) {
      console.error('[JobStatusReporter] Error getting job summary:', _error);
      return null;
    }
  }

  /**
   * Stream job status updates (for real-time monitoring)
   */
  subscribeToJobUpdates(jobId: string, callback: (job: Record<string, unknown>) => void): () => void {
    const subscription = supabase
      .channel(`job-status-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'progressive_capture_jobs',
          filter: `id=eq.${jobId}`
        },
        (payload) => {
          callback(payload.new);
        }
      )
      .subscribe();

    // Return unsubscribe function
    return () => {
      subscription.unsubscribe();
    };
  }

  /**
   * Get recent job history for a repository
   */
  async getRepositoryJobHistory(repositoryId: string, limit: number = 10): Promise<Record<string, unknown>[]> {
    try {
      const { data: jobs } = await supabase
        .from('progressive_capture_jobs')
        .select('*, progressive_capture_progress(*)')
        .eq('repository_id', repositoryId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!jobs) return [];

      // Calculate metrics for each job
      return Promise.all(
        jobs.map(async (job) => {
          const metrics = await this.calculateMetrics(job.id);
          return {
            ...job,
            metrics
          };
        })
      );
    } catch (_error) {
      console.error('[JobStatusReporter] Error getting job history:', _error);
      return [];
    }
  }

  /**
   * Bulk update job statuses (for batch operations)
   */
  async bulkUpdateStatuses(updates: JobStatusUpdate[]): Promise<void> {
    try {
      // Process updates in batches of 10
      const batchSize = 10;
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        await Promise.all(batch.map(update => this.reportStatus(update)));
      }
      
      console.log('[JobStatusReporter] Bulk updated %s job statuses', updates.length);
    } catch (_error) {
      console.error('[JobStatusReporter] Error in bulk update:', _error);
      throw error;
    }
  }
}

// Export singleton instance
export const jobStatusReporter = new JobStatusReporter();