import type { Handler } from "@netlify/functions";
import { hybridQueueManager } from "../../src/lib/progressive-capture/hybrid-queue-manager";
import { autoRetryService } from "../../src/lib/progressive-capture/auto-retry-service";

/**
 * Scheduled function to check queue health and manage jobs
 * This runs every 5 minutes to:
 * - Check job statuses
 * - Retry failed jobs
 * - Rebalance queues
 * - Monitor overall health
 */
export const handler: Handler = async () => {
  console.log('[QueueHealthCheck] Starting health check...');
  
  try {
    // Check active jobs and update statuses
    await hybridQueueManager.checkActiveJobs();
    
    // Get current stats
    const stats = await hybridQueueManager.getHybridStats();
    const retryStats = await autoRetryService.getRetryStats();
    
    console.log('[QueueHealthCheck] Queue stats:', {
      inngest: stats.inngest,
      github_actions: stats.github_actions,
      total: stats.total,
      retries: retryStats
    });
    
    // Check if we have too many failures
    const totalJobs = stats.total.completed + stats.total.failed;
    const failureRate = totalJobs > 0 ? stats.total.failed / totalJobs : 0;
    if (failureRate > 0.3) {
      console.warn('[QueueHealthCheck] High failure rate detected:', failureRate);
      // Could trigger alerts or notifications here
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        stats: {
          ...stats,
          retries: retryStats,
          failureRate
        },
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('[QueueHealthCheck] Error during health check:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    };
  }
};