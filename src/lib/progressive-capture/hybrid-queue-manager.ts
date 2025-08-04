import { supabase } from '../supabase';
import { inngest } from '../inngest/client';
import { GitHubActionsQueueManager } from './github-actions-queue-manager';
import { DataCaptureQueueManager } from './queue-manager';
import { hybridRolloutManager } from './rollout-manager';
import { queuePrioritizationService } from './queue-prioritization';
import { autoRetryService } from './auto-retry-service';
import { mapQueueDataToEventData } from '../inngest/types/event-data';

// Import rollout console for global availability
import './rollout-console';

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

export interface ProcessorRouting {
  inngestJobs: number;
  actionsJobs: number;
  processor: 'inngest' | 'github_actions' | 'hybrid';
  reason: string;
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
   * Queue a job using the hybrid routing logic with rollout controls
   */
  async queueJob(jobType: string, data: JobData): Promise<HybridJob> {
    // Validate required fields
    if (!data.repositoryId) {
      throw new Error('repositoryId is required for queueing jobs');
    }
    if (!data.repositoryName) {
      throw new Error('repositoryName is required for queueing jobs');
    }

    // Check if repository is eligible for hybrid rollout
    const isEligible = await hybridRolloutManager.isRepositoryEligible(data.repositoryId);
    
    let processor: 'inngest' | 'github_actions';
    let rolloutApplied = false;

    // Get repository metadata for prioritization
    const repoMetadata = await queuePrioritizationService.getRepositoryMetadata(data.repositoryId);
    
    if (isEligible && repoMetadata) {
      // Use prioritization service to determine routing
      const priority = queuePrioritizationService.calculatePriorityScore(
        repoMetadata,
        data.triggerSource || 'automatic'
      );
      
      processor = priority.processor;
      rolloutApplied = true;
      
      // Override data with priority-based values
      data.timeRange = data.timeRange || priority.timeRange;
      data.maxItems = data.maxItems || priority.maxItems;
      
      console.log(`[HybridQueue] Repository ${data.repositoryName} eligible for hybrid routing → ${processor} (score: ${priority.score})`);
    } else if (isEligible) {
      // Use original hybrid routing logic if no metadata
      processor = this.determineProcessor(jobType, data);
      rolloutApplied = true;
      console.log(`[HybridQueue] Repository ${data.repositoryName} eligible for hybrid routing → ${processor}`);
    } else {
      // Fallback to Inngest-only for non-eligible repositories
      processor = 'inngest';
      console.log(`[HybridQueue] Repository ${data.repositoryName} not eligible for hybrid routing → fallback to inngest`);
    }
    
    // Create job record in database
    const job = await this.createJobRecord(jobType, data, processor, rolloutApplied);
    
    try {
      // Route to appropriate processor
      if (processor === 'inngest') {
        await this.queueWithInngest(job.id, jobType, data);
      } else {
        await this.queueWithGitHubActions(job.id, jobType, data);
      }
      
      // Record metrics for rollout monitoring
      await hybridRolloutManager.recordMetrics(
        data.repositoryId,
        processor,
        true, // success
        0 // processing time not available yet
      );
      
      console.log(`[HybridQueue] Successfully queued ${jobType} job to ${processor} (job_id: ${job.id}, rollout: ${rolloutApplied})`);
      
      return job;
    } catch (error) {
      // Record error metrics for rollout monitoring
      await hybridRolloutManager.recordMetrics(
        data.repositoryId,
        processor,
        false, // failed
        0,
        error instanceof Error ? error.message : 'Unknown error'
      );
      
      // Update job status to failed
      await this.updateJobStatus(job.id, 'failed', error instanceof Error ? error.message : 'Unknown error');
      
      throw error;
    }
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
  private async createJobRecord(jobType: string, data: JobData, processor: 'inngest' | 'github_actions', rolloutApplied: boolean = false): Promise<HybridJob> {
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
          pr_numbers: data.prNumbers,
          rollout_applied: rolloutApplied,
          created_by: 'hybrid_queue_manager'
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

    // Map queue data to properly typed event data
    const eventData = mapQueueDataToEventData(jobType, {
      ...data,
      jobId
    });

    // If we're in the browser, use the API endpoint
    if (typeof window !== 'undefined') {
      const response = await fetch('/api/queue-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventName,
          data: eventData
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to queue event: ${response.statusText}`);
      }
      
      return;
    }
    
    // Server-side: send directly to Inngest
    await inngest.send({
      name: eventName,
      data: eventData
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
    
    // Rebalance queue if needed
    await queuePrioritizationService.rebalanceQueue();
    
    // Check for failed jobs and retry them
    await autoRetryService.retryFailedJobs();
    
    // Check rollout health and trigger auto-rollback if needed
    await this.checkRolloutHealth();
  }

  /**
   * Check rollout health and trigger auto-rollback if needed
   */
  async checkRolloutHealth(): Promise<void> {
    try {
      const rollbackTriggered = await hybridRolloutManager.checkAndTriggerAutoRollback();
      
      if (rollbackTriggered) {
        console.log(`[HybridQueue] Auto-rollback triggered due to high error rate`);
        
        // Optionally notify monitoring systems or send alerts
        // This could integrate with Sentry, PostHog, or other monitoring tools
      }
    } catch (error) {
      console.error('[HybridQueue] Error checking rollout health:', error);
    }
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

  /**
   * Analyze routing for a repository without queueing jobs
   * Used by UI components to show routing information
   */
  async analyzeRouting(owner: string, repo: string): Promise<ProcessorRouting> {
    const repositoryName = `${owner}/${repo}`;
    
    // Simulate analysis of what would be done
    const analysisData: JobData = {
      repositoryId: `${owner}/${repo}`, // Simplified for demo
      repositoryName,
      timeRange: 7, // Analyze last week
      triggerSource: 'manual',
      maxItems: 100
    };

    // Determine routing for common job types
    const jobTypes = ['pr-details', 'reviews', 'comments', 'recent-prs'];
    let inngestJobs = 0;
    let actionsJobs = 0;
    let primaryProcessor: 'inngest' | 'github_actions' = 'inngest';
    let reason = '';

    for (const jobType of jobTypes) {
      const processor = this.determineProcessor(jobType, analysisData);
      if (processor === 'inngest') {
        inngestJobs++;
      } else {
        actionsJobs++;
      }
    }

    // Determine primary processor and reason
    if (inngestJobs > 0 && actionsJobs > 0) {
      primaryProcessor = 'inngest'; // Mixed routing still shows as hybrid
      reason = `Recent data via real-time, historical via bulk processing`;
    } else if (inngestJobs > 0) {
      primaryProcessor = 'inngest';
      reason = analysisData.triggerSource === 'manual' 
        ? 'Manual trigger for recent data'
        : `Small batch (${analysisData.maxItems || 0} items) for real-time processing`;
    } else {
      primaryProcessor = 'github_actions';
      reason = analysisData.timeRange && analysisData.timeRange > 1 
        ? `Historical data (${analysisData.timeRange} days) requires bulk processing`
        : `Large batch (${analysisData.maxItems || 0} items) for bulk processing`;
    }

    return {
      inngestJobs,
      actionsJobs,
      processor: inngestJobs > 0 && actionsJobs > 0 ? 'hybrid' : primaryProcessor,
      reason
    };
  }
}

// Export singleton instance
export const hybridQueueManager = new HybridQueueManager();