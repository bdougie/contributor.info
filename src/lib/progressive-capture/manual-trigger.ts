import { bootstrapDataCaptureQueue, analyzeDataGaps } from './bootstrap-queue';
import { queueManager } from './queue-manager';
import { ProgressiveCaptureNotifications } from './ui-notifications';
import { ReviewCommentProcessor } from './review-comment-processor';

/**
 * Manual trigger for progressive data capture
 * This can be called from browser console or integrated into admin UI
 */
export class ProgressiveCaptureTrigger {
  /**
   * Analyze current data gaps and provide recommendations
   */
  static async analyze() {
    const gaps = await analyzeDataGaps();
    const queueStats = await queueManager.getQueueStats();

    console.log(`
📊 Data Gap Analysis Results:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🕐 Stale Data:
  • ${gaps.repositoriesWithStaleData} repositories with data older than 3 days

📊 Missing Data:
  • ${gaps.prsWithoutFileChanges} PRs without file change data (additions/deletions)
  • Reviews table: ${gaps.emptyReviewsTable ? '❌ Empty' : '✅ Has data'}
  • Comments table: ${gaps.emptyCommentsTable ? '❌ Empty' : '✅ Has data'}  
  • Commits table: ${gaps.emptyCommitsTable ? '❌ Empty' : '✅ Has data'}

⚡ Current Queue Status:
  • ${queueStats.pending} jobs pending
  • ${queueStats.processing} jobs processing
  • ${queueStats.completed} jobs completed
  • ${queueStats.failed} jobs failed

💡 Recommendations:
${gaps.repositoriesWithStaleData > 0 ? '  • Run bootstrap to queue recent PRs for stale repositories' : '  • ✅ Repository data is fresh'}
${gaps.prsWithoutFileChanges > 0 ? '  • Run bootstrap to queue file change updates' : '  • ✅ File change data is complete'}
${gaps.emptyReviewsTable ? '  • Consider queuing review data (lower priority)' : '  • ✅ Review data available'}
    `);

    return gaps;
  }

  /**
   * Bootstrap the queue with critical missing data
   */
  static async bootstrap() {
    
    try {
      await bootstrapDataCaptureQueue();
      
      const queueStats = await queueManager.getQueueStats();
      console.log(`
✅ Bootstrap completed successfully!

📈 Queue Status:
  • ${queueStats.pending} jobs queued and ready to process
  • ${queueStats.total} total jobs in queue

🔄 Next Steps:
  1. The queue will automatically process jobs when the app is active
  2. Monitor progress with: ProgressiveCaptureTrigger.status()
  3. Check rate limits with: ProgressiveCaptureTrigger.rateLimits()
      `);
      
    } catch (error) {
      console.error('❌ Bootstrap failed:', error);
    }
  }

  /**
   * Check current queue status
   */
  static async status() {
    
    const stats = await queueManager.getQueueStats();
    const canMakeAPICalls = await queueManager.canMakeAPICalls(10);
    
    console.log(`
📊 Queue Status Report:
━━━━━━━━━━━━━━━━━━━━━

📋 Job Counts:
  • Pending: ${stats.pending}
  • Processing: ${stats.processing}  
  • Completed: ${stats.completed}
  • Failed: ${stats.failed}
  • Total: ${stats.total}

🔄 Processing Status:
  • Can make API calls: ${canMakeAPICalls ? '✅ Yes' : '❌ No (rate limited)'}
  • Queue health: ${stats.pending > 0 ? '🟡 Active' : stats.total > 0 ? '✅ Processed' : '⚪ Empty'}

💡 Actions:
  • To process manually: ProgressiveCaptureTrigger.processNext()
  • To check rate limits: ProgressiveCaptureTrigger.rateLimits()
    `);

    return stats;
  }

  /**
   * Process the next job in queue (for manual testing)
   */
  static async processNext() {
    
    const canMakeAPICalls = await queueManager.canMakeAPICalls(1);
    if (!canMakeAPICalls) {
      console.log('❌ Cannot process jobs - rate limit reached');
      return null;
    }

    const nextJob = await queueManager.getNextJob();
    if (!nextJob) {
      console.log('ℹ️ No jobs available to process');
      return null;
    }

    console.log(`
🔄 Processing Job:
  • Type: ${nextJob.type}
  • Priority: ${nextJob.priority}
  • Resource: ${nextJob.resource_id || 'N/A'}
  • Estimated API calls: ${nextJob.estimated_api_calls}
    `);

    // Mark as processing
    await queueManager.markJobProcessing(nextJob.id);
    
    // Process the job based on type
    let result: { success: boolean; error?: string } = { success: false };
    
    try {
      switch (nextJob.type) {
        case 'reviews':
          if (nextJob.repository_id && nextJob.resource_id) {
            result = await ReviewCommentProcessor.processReviewsJob(
              nextJob.repository_id,
              nextJob.resource_id,
              nextJob.metadata
            );
          } else {
            result = { success: false, error: 'Missing repository_id or resource_id' };
          }
          break;
          
        case 'comments':
          if (nextJob.repository_id && nextJob.resource_id) {
            result = await ReviewCommentProcessor.processCommentsJob(
              nextJob.repository_id,
              nextJob.resource_id,
              nextJob.metadata
            );
          } else {
            result = { success: false, error: 'Missing repository_id or resource_id' };
          }
          break;
          
        default:
          result = { success: true }; // Mark as successful to avoid retries
          break;
      }
      
      // Mark job as completed or failed
      if (result.success) {
        await queueManager.markJobCompleted(nextJob.id);
        console.log(`✅ Job ${nextJob.type} completed successfully`);
      } else {
        await queueManager.markJobFailed(nextJob.id, result.error || 'Unknown error');
        console.log(`❌ Job ${nextJob.type} failed: ${result.error}`);
      }
      
    } catch (error) {
      await queueManager.markJobFailed(nextJob.id, error instanceof Error ? error.message : 'Unknown error');
      console.log(`❌ Job ${nextJob.type} failed with exception:`, error);
    }

    return nextJob;
  }

  /**
   * Check rate limit status
   */
  static async rateLimits() {
    
    const canMake1 = await queueManager.canMakeAPICalls(1);
    const canMake10 = await queueManager.canMakeAPICalls(10);
    const canMake100 = await queueManager.canMakeAPICalls(100);

    console.log(`
🔒 Rate Limit Status:
━━━━━━━━━━━━━━━━━━━━

✅ Can make 1 API call: ${canMake1 ? 'Yes' : 'No'}
⚡ Can make 10 API calls: ${canMake10 ? 'Yes' : 'No'}  
🚀 Can make 100 API calls: ${canMake100 ? 'Yes' : 'No'}

💡 Recommendations:
${canMake100 ? '  • ✅ Good to process large batches' : canMake10 ? '  • ⚡ Process small batches' : canMake1 ? '  • 🐌 Process one at a time' : '  • ❌ Wait for rate limit reset'}
    `);

    return { canMake1, canMake10, canMake100 };
  }

  /**
   * Analyze commits for a specific repository (YOLO coder detection)
   */
  static async analyzeCommits(owner: string, repo: string) {
    
    try {
      // Find repository ID
      const { supabase } = await import('../supabase');
      const { data: repoData, error } = await supabase
        .from('repositories')
        .select('id')
        .eq('owner', owner)
        .eq('name', repo)
        .single();

      if (error || !repoData) {
        console.log(`❌ Repository ${owner}/${repo} not found in database`);
        return;
      }

      // Queue commit analysis
      const queuedCount = await queueManager.queueRecentCommitsAnalysis(repoData.id, 90);
      
      // Show UI notification
      if (queuedCount > 0) {
        ProgressiveCaptureNotifications.showJobsQueued(queuedCount, 'commit analysis', `${owner}/${repo}`);
      }
      
      console.log(`
✅ Commit analysis queued for ${owner}/${repo}:
  • ${queuedCount} commits queued for PR association analysis
  • This will enable YOLO coder detection
  • Use ProgressiveCapture.processNext() to process manually
      `);
      
    } catch (error) {
      console.error(`❌ Commit analysis failed for ${owner}/${repo}:`, error);
    }
  }

  /**
   * Quick fix for specific repository
   */
  static async quickFix(owner: string, repo: string) {
    
    try {
      // Find repository ID
      const { supabase } = await import('../supabase');
      const { data: repoData, error } = await supabase
        .from('repositories')
        .select('id')
        .eq('owner', owner)
        .eq('name', repo)
        .single();

      if (error || !repoData) {
        console.log(`❌ Repository ${owner}/${repo} not found in database`);
        return;
      }

      // Queue recent PRs, file changes, reviews, comments, and commit analysis
      await queueManager.queueRecentPRs(repoData.id);
      const fileChangeCount = await queueManager.queueMissingFileChanges(repoData.id, 10);
      const reviewCount = await queueManager.queueMissingReviews(repoData.id, 20);
      const commentCount = await queueManager.queueMissingComments(repoData.id, 20);
      const commitAnalysisCount = await queueManager.queueRecentCommitsAnalysis(repoData.id, 90);
      
      // Show comprehensive UI notification
      const totalJobs = 1 + fileChangeCount + reviewCount + commentCount + commitAnalysisCount;
      ProgressiveCaptureNotifications.showProcessingStarted(`${owner}/${repo}`);
      
      console.log(`
✅ Quick fix queued for ${owner}/${repo}:
  • Recent PRs: Queued
  • File changes: ${fileChangeCount} PRs queued
  • Reviews: ${reviewCount} PRs queued
  • Comments: ${commentCount} PRs queued
  • Commit analysis: ${commitAnalysisCount} commits queued
  • Total: ${totalJobs} jobs queued
  • Review and comment data will be populated for better insights
  • YOLO coder detection will be available once commits are analyzed
      `);
      
    } catch (error) {
      console.error(`❌ Quick fix failed for ${owner}/${repo}:`, error);
    }
  }
}

// Make it available globally for console access
if (typeof window !== 'undefined') {
  (window as any).ProgressiveCapture = ProgressiveCaptureTrigger;
  console.log(`
🔧 Progressive Data Capture Tools Available!

Use in browser console:
  • ProgressiveCapture.analyze()    - Analyze data gaps
  • ProgressiveCapture.bootstrap()  - Start filling missing data
  • ProgressiveCapture.status()     - Check queue status
  • ProgressiveCapture.rateLimits() - Check API rate limits
  • ProgressiveCapture.quickFix('owner', 'repo') - Fix specific repository
  • ProgressiveCapture.analyzeCommits('owner', 'repo') - Queue YOLO coder analysis

Examples:
  ProgressiveCapture.quickFix('continuedev', 'continue')
  ProgressiveCapture.analyzeCommits('continuedev', 'continue')
  `);
}