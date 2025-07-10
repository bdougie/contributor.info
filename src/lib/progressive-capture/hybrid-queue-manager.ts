import { supabase } from '../supabase';
import { inngest } from '../inngest/client';
import { GitHubActionsQueueManager } from './github-actions-queue-manager';
import { DataCaptureQueueManager } from './queue-manager';

export interface JobData {
  repositoryId: string;
  repositoryName: string;
  timeRange?: number; // days
  prNumbers?: number[];
  maxItems?: number;
  triggerSource?: 'manual' | 'scheduled' | 'automatic';
  metadata?: Record<string, any>;
}

export interface HybridJob {
  id: string;
  jobType: string;
  data: JobData;
  processor: 'inngest' | 'github_actions';
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export class HybridQueueManager {
  private inngestManager: DataCaptureQueueManager;
  private actionsManager: GitHubActionsQueueManager;
  
  // Configuration
  private readonly SMALL_BATCH_SIZE = 50;
  private readonly INNGEST_MAX_ITEMS = 50;
  private readonly ACTIONS_MAX_ITEMS = 1000;

  constructor() {
    this.inngestManager = new DataCaptureQueueManager();
    this.actionsManager = new GitHubActionsQueueManager();
  }

  /**
   * Queue a job using the hybrid routing logic
   */
  async queueJob(jobType: string, data: JobData): Promise<HybridJob> {
    const processor = this.determineProcessor(jobType, data);
    
    // Create job record in database
    const job = await this.createJobRecord(jobType, data, processor);
    
    // Route to appropriate processor
    if (processor === 'inngest') {
      await this.queueWithInngest(job.id, jobType, data);
    } else {
      await this.queueWithGitHubActions(job.id, jobType, data);
    }
    
    console.log(`[HybridQueue] Routed ${jobType} job to ${processor} (job_id: ${job.id})`);
    
    return job;
  }

  /**
   * Determine which processor to use based on job characteristics
   */
  private determineProcessor(_jobType: string, data: JobData): 'inngest' | 'github_actions' {
    // Rule 1: Recent data (< 24 hours) goes to Inngest
    if (data.timeRange && data.timeRange <= 1) {
      return 'inngest';
    }
    
    // Rule 2: Small specific PR batches go to Inngest
    if (data.prNumbers && data.prNumbers.length <= 10) {
      return 'inngest';
    }
    
    // Rule 3: Manual triggers typically expect immediate feedback
    if (data.triggerSource === 'manual' && (!data.maxItems || data.maxItems <= this.SMALL_BATCH_SIZE)) {
      return 'inngest';
    }
    
    // Rule 4: Large historical data processing goes to GitHub Actions
    if (data.timeRange && data.timeRange > 1) {
      return 'github_actions';
    }
    
    // Rule 5: Large batch sizes go to GitHub Actions
    if (data.maxItems && data.maxItems > this.SMALL_BATCH_SIZE) {
      return 'github_actions';
    }
    
    // Rule 6: Scheduled jobs typically process bulk data
    if (data.triggerSource === 'scheduled') {
      return 'github_actions';
    }
    
    // Default: Use Inngest for immediate response
    return 'inngest';
  }

  /**
   * Create a job record in the database
   */
  private async createJobRecord(jobType: string, data: JobData, processor: 'inngest' | 'github_actions'): Promise<HybridJob> {
    const { data: job, error } = await supabase
      .from('progressive_capture_jobs')
      .insert({
        job_type: jobType,
        repository_id: data.repositoryId,
        processor_type: processor,
        status: 'pending',
        time_range_days: data.timeRange,
        metadata: {
          ...data.metadata,
          repository_name: data.repositoryName,
          trigger_source: data.triggerSource,
          max_items: data.maxItems,
          pr_numbers: data.prNumbers
        }
      })
      .select()
      .single();

    if (error || !job) {
      throw new Error(`Failed to create job record: ${error?.message}`);
    }

    return {
      id: job.id,
      jobType,
      data,
      processor,
      status: job.status
    };
  }

  /**
   * Queue job with Inngest for real-time processing
   */
  private async queueWithInngest(jobId: string, jobType: string, data: JobData): Promise<void> {
    // Track job in database
    await this.updateJobStatus(jobId, 'processing');
    
    // Map job types to Inngest events (prefer GraphQL versions)
    const eventMapping: Record<string, string> = {
      'historical-pr-sync': 'capture/repository.sync.graphql',
      'pr-details': 'capture/pr.details.graphql',
      'reviews': 'capture/pr.reviews',
      'comments': 'capture/pr.comments',
      'recent-prs': 'capture/repository.sync.graphql'
    };

    const eventName = eventMapping[jobType];
    if (!eventName) {
      throw new Error(`Unknown job type for Inngest: ${jobType}`);
    }

    // Send event to Inngest with rate limiting
    await inngest.send({
      name: eventName,
      data: {
        jobId,
        repositoryId: data.repositoryId,
        repositoryName: data.repositoryName,
        maxItems: Math.min(data.maxItems || this.INNGEST_MAX_ITEMS, this.INNGEST_MAX_ITEMS),
        ...data.metadata
      }
    });
  }

  /**
   * Queue job with GitHub Actions for bulk processing
   */
  private async queueWithGitHubActions(jobId: string, jobType: string, data: JobData): Promise<void> {
    // Map job types to workflow files
    const workflowMapping: Record<string, string> = {
      'historical-pr-sync': 'historical-pr-sync.yml', // Uses GraphQL version
      'historical-reviews-sync': 'historical-reviews-sync.yml',
      'historical-comments-sync': 'historical-comments-sync.yml',
      'bulk-file-changes': 'bulk-file-changes.yml'
    };

    const workflow = workflowMapping[jobType];
    if (!workflow) {
      throw new Error(`Unknown job type for GitHub Actions: ${jobType}`);
    }

    // Dispatch workflow
    const result = await this.actionsManager.dispatchWorkflow({
      workflow,
      inputs: {
        repository_id: data.repositoryId,
        repository_name: data.repositoryName,
        time_range: data.timeRange?.toString() || '30',
        max_items: data.maxItems?.toString() || this.ACTIONS_MAX_ITEMS.toString(),
        job_id: jobId
      }
    });

    if (!result.success) {
      await this.updateJobStatus(jobId, 'failed', result.error);
      throw new Error(`Failed to dispatch GitHub Actions workflow: ${result.error}`);
    }
  }

  /**
   * Update job status in database
   */
  private async updateJobStatus(jobId: string, status: string, error?: string): Promise<void> {
    const updates: any = { status };
    
    if (status === 'processing' && !updates.started_at) {
      updates.started_at = new Date().toISOString();
    }
    
    if (status === 'completed' || status === 'failed') {
      updates.completed_at = new Date().toISOString();
    }
    
    if (error) {
      updates.error = error;
    }

    await supabase
      .from('progressive_capture_jobs')
      .update(updates)
      .eq('id', jobId);
  }

  /**
   * Get combined statistics from both systems
   */
  async getHybridStats(): Promise<{
    inngest: {
      pending: number;
      processing: number;
      completed: number;
      failed: number;
    };
    github_actions: {
      pending: number;
      processing: number;
      completed: number;
      failed: number;
    };
    total: {
      pending: number;
      processing: number;
      completed: number;
      failed: number;
    };
  }> {
    // Get Inngest stats
    const inngestStats = await this.inngestManager.getQueueStats();
    
    // Get GitHub Actions stats
    const actionsStats = await this.actionsManager.getStats();
    
    // Calculate totals
    const total = {
      pending: inngestStats.pending + actionsStats.pending,
      processing: inngestStats.processing + actionsStats.processing,
      completed: inngestStats.completed + actionsStats.completed,
      failed: inngestStats.failed + actionsStats.failed
    };

    return {
      inngest: {
        pending: inngestStats.pending,
        processing: inngestStats.processing,
        completed: inngestStats.completed,
        failed: inngestStats.failed
      },
      github_actions: actionsStats,
      total
    };
  }

  /**
   * Check and update status of all active jobs
   */
  async checkActiveJobs(): Promise<void> {
    // Check GitHub Actions jobs
    await this.actionsManager.checkJobStatuses();
    
    // Inngest jobs are tracked through their own system
    // We can query completed Inngest jobs and update our records
    await this.syncInngestJobStatuses();
  }

  /**
   * Sync Inngest job statuses with our tracking table
   */
  private async syncInngestJobStatuses(): Promise<void> {
    try {
      // Get processing Inngest jobs
      const { data: processingJobs } = await supabase
        .from('progressive_capture_jobs')
        .select('*')
        .eq('processor_type', 'inngest')
        .eq('status', 'processing')
        .gte('started_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()); // Within last 2 hours

      if (!processingJobs || processingJobs.length === 0) {
        return;
      }

      // Check data_capture_queue for completion status
      for (const job of processingJobs) {
        const { data: queueItems } = await supabase
          .from('data_capture_queue')
          .select('status')
          .eq('metadata->>jobId', job.id);

        if (queueItems && queueItems.length > 0) {
          const allCompleted = queueItems.every(item => item.status === 'completed');
          const anyFailed = queueItems.some(item => item.status === 'failed');
          
          if (allCompleted) {
            await this.updateJobStatus(job.id, 'completed');
          } else if (anyFailed) {
            await this.updateJobStatus(job.id, 'failed', 'One or more queue items failed');
          }
        }
      }
    } catch (error) {
      console.error('[HybridQueue] Error syncing Inngest job statuses:', error);
    }
  }

  /**
   * Queue recent data capture (routes to Inngest)
   */
  async queueRecentDataCapture(repositoryId: string, repositoryName: string): Promise<HybridJob> {
    return this.queueJob('recent-prs', {
      repositoryId,
      repositoryName,
      timeRange: 1, // Last 24 hours
      triggerSource: 'automatic',
      maxItems: 50
    });
  }

  /**
   * Queue historical data capture (routes to GitHub Actions)
   */
  async queueHistoricalDataCapture(repositoryId: string, repositoryName: string, days: number = 30): Promise<HybridJob> {
    return this.queueJob('historical-pr-sync', {
      repositoryId,
      repositoryName,
      timeRange: days,
      triggerSource: 'scheduled',
      maxItems: 1000
    });
  }
}

// Export singleton instance
export const hybridQueueManager = new HybridQueueManager();