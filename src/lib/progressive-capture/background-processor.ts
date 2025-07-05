import { queueManager } from './queue-manager';
import { ProgressiveCaptureNotifications } from './ui-notifications';
import { ProgressiveCaptureTrigger } from './manual-trigger';

/**
 * Background processor for automatically handling queued data capture jobs
 * Runs at intervals to process pending jobs without overwhelming the GitHub API
 */
export class BackgroundProcessor {
  private static instance: BackgroundProcessor | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private readonly PROCESS_INTERVAL = 30000; // Process every 30 seconds
  private readonly MAX_JOBS_PER_BATCH = 3; // Process max 3 jobs per batch

  /**
   * Get singleton instance
   */
  static getInstance(): BackgroundProcessor {
    if (!BackgroundProcessor.instance) {
      BackgroundProcessor.instance = new BackgroundProcessor();
    }
    return BackgroundProcessor.instance;
  }

  /**
   * Start the background processor
   */
  start(): void {
    if (this.intervalId) {
      console.log('[Background Processor] Already running');
      return;
    }

    console.log('[Background Processor] Starting automatic job processing');
    
    // Process immediately, then on interval
    this.processNextBatch();
    
    this.intervalId = setInterval(() => {
      this.processNextBatch();
    }, this.PROCESS_INTERVAL);
  }

  /**
   * Stop the background processor
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[Background Processor] Stopped');
    }
  }

  /**
   * Process the next batch of jobs
   */
  private async processNextBatch(): Promise<void> {
    if (this.isProcessing) {
      return; // Already processing
    }

    try {
      this.isProcessing = true;
      
      // Get queue statistics
      const stats = await queueManager.getQueueStats();
      
      if (stats.pending === 0) {
        return; // Nothing to process
      }

      console.log(`[Background Processor] Processing batch - ${stats.pending} pending jobs`);

      // Process up to MAX_JOBS_PER_BATCH jobs
      let processed = 0;
      let failures = 0;

      for (let i = 0; i < this.MAX_JOBS_PER_BATCH && processed + failures < this.MAX_JOBS_PER_BATCH; i++) {
        try {
          const job = await ProgressiveCaptureTrigger.processNext();
          
          if (job) {
            processed++;
            console.log(`[Background Processor] Processed job: ${job.type}`);
          } else {
            // No more jobs to process
            break;
          }
          
          // Small delay between jobs to be nice to GitHub API
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          failures++;
          console.error('[Background Processor] Error processing job:', error);
        }
      }

      // Show completion notification if we processed anything
      if (processed > 0) {
        const updatedStats = await queueManager.getQueueStats();
        
        if (updatedStats.pending === 0) {
          ProgressiveCaptureNotifications.showQueueStatus(updatedStats);
        }
      }

      console.log(`[Background Processor] Batch complete - processed: ${processed}, failed: ${failures}`);

    } catch (error) {
      console.error('[Background Processor] Error in batch processing:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Check if processor is running
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }

  /**
   * Get current processing status
   */
  getStatus(): { isRunning: boolean; isProcessing: boolean } {
    return {
      isRunning: this.isRunning(),
      isProcessing: this.isProcessing
    };
  }
}

/**
 * Initialize and start background processing when this module is imported
 */
export function startBackgroundProcessing(): void {
  if (typeof window !== 'undefined') {
    // Only run in browser environment
    const processor = BackgroundProcessor.getInstance();
    
    // Start after a short delay to let the app initialize
    setTimeout(() => {
      processor.start();
      console.log('🔄 Background job processor started - will automatically process queued data');
    }, 5000);

    // Stop processing when page is about to unload
    window.addEventListener('beforeunload', () => {
      processor.stop();
    });

    // Expose processor to global scope for debugging
    (window as any).BackgroundProcessor = BackgroundProcessor;
  }
}

// Auto-start when module is imported
startBackgroundProcessing();