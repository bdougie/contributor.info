import { bootstrapDataCaptureQueue, analyzeDataGaps } from './bootstrap-queue';
import { queueManager } from './queue-manager';
import { ProgressiveCaptureNotifications } from './ui-notifications';
import { ReviewCommentProcessor } from './review-comment-processor';
import { AISummaryProcessor } from './ai-summary-processor';

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
          
        case 'ai_summary':
          if (nextJob.repository_id) {
            const success = await AISummaryProcessor.processAISummaryJob(nextJob);
            result = { success };
          } else {
            result = { success: false, error: 'Missing repository_id' };
          }
          break;
          
        case 'recent_prs':
          if (nextJob.repository_id) {
            result = await ProgressiveCaptureTrigger.processRecentPRsJob(
              nextJob.repository_id,
              nextJob.metadata
            );
          } else {
            result = { success: false, error: 'Missing repository_id' };
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
   * Process a recent_prs job - fetch and store recent PRs from GitHub API
   */
  static async processRecentPRsJob(repositoryId: string, metadata: any): Promise<{ success: boolean; error?: string }> {
    try {
      // Get repository info
      const { supabase } = await import('../supabase');
      const { data: repo, error: repoError } = await supabase
        .from('repositories')
        .select('owner, name')
        .eq('id', repositoryId)
        .single();

      if (repoError || !repo) {
        return { success: false, error: `Repository not found: ${repoError?.message}` };
      }

      // Fetch recent PRs from GitHub API using existing library
      const { fetchPullRequests } = await import('../github');
      const days = metadata?.days || 7;
      
      console.log(`🔄 Fetching recent PRs for ${repo.owner}/${repo.name} (last ${days} days)`);
      
      const recentPRs = await fetchPullRequests(repo.owner, repo.name, days.toString());
      
      if (!recentPRs || recentPRs.length === 0) {
        console.log(`✅ No recent PRs found for ${repo.owner}/${repo.name}`);
        return { success: true };
      }

      // Store PRs in database using existing spam detection integration
      const { processPRWithSpamDetection } = await import('../../../supabase/functions/_shared/spam-detection-integration');
      
      let importedCount = 0;
      for (const pr of recentPRs) {
        try {
          const result = await processPRWithSpamDetection(
            (await import('../supabase')).supabase,
            pr,
            repositoryId
          );
          
          if (result.success) {
            importedCount++;
          } else {
            console.warn(`Failed to store PR #${pr.number}: ${result.error}`);
          }
        } catch (prError) {
          console.warn(`Error storing PR #${pr.number}:`, prError);
        }
      }
      
      console.log(`✅ Imported ${importedCount}/${recentPRs.length} recent PRs for ${repo.owner}/${repo.name}`);
      return { success: true };

    } catch (error) {
      console.error(`❌ Error processing recent PRs job:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
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

      // Queue recent PRs, file changes, reviews, comments, commit analysis, and AI summary
      await queueManager.queueRecentPRs(repoData.id);
      const fileChangeCount = await queueManager.queueMissingFileChanges(repoData.id, 10);
      const reviewCount = await queueManager.queueMissingReviews(repoData.id, 20);
      const commentCount = await queueManager.queueMissingComments(repoData.id, 20);
      const commitAnalysisCount = await queueManager.queueRecentCommitsAnalysis(repoData.id, 90);
      const aiSummaryQueued = await AISummaryProcessor.queueSummaryRegeneration(repoData.id, 'medium');
      
      const totalJobs = 1 + fileChangeCount + reviewCount + commentCount + commitAnalysisCount + (aiSummaryQueued ? 1 : 0);
      
      // Show subtle processing notification for manual triggers only
      if (process.env.NODE_ENV === 'development') {
        ProgressiveCaptureNotifications.showProcessingStarted(`${owner}/${repo}`);
        
        console.log(`
✅ Quick fix queued for ${owner}/${repo}:
  • Recent PRs: Queued
  • File changes: ${fileChangeCount} PRs queued
  • Reviews: ${reviewCount} PRs queued
  • Comments: ${commentCount} PRs queued
  • Commit analysis: ${commitAnalysisCount} commits queued
  • AI Summary: ${aiSummaryQueued ? 'Queued' : 'Skipped (recent)'}
  • Total: ${totalJobs} jobs queued
        `);
      }
      
    } catch (error) {
      console.error('❌ Quick fix failed for %s/%s:', owner, repo, error);
    }
  }
}

// Make it available globally for console access
if (typeof window !== 'undefined') {
  (window as any).ProgressiveCapture = ProgressiveCaptureTrigger;
  // Enable console tools in development
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 Progressive Data Capture tools available in console (ProgressiveCapture.*)');
  }
}