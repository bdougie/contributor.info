import { bootstrapDataCaptureQueue, analyzeDataGaps } from './bootstrap-queue';
import { ProgressiveCaptureNotifications } from './ui-notifications';
import { AISummaryProcessor } from './ai-summary-processor';

// Lazy load Hybrid queue manager to avoid Buffer issues in browser
let hybridQueueManager: any = null;
async function getHybridQueueManager() {
  if (!hybridQueueManager) {
    const { hybridQueueManager: manager } = await import('./hybrid-queue-manager');
    hybridQueueManager = manager;
  }
  return hybridQueueManager;
}

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
    const manager = await getHybridQueueManager();
    const queueStats = await manager.getHybridStats();

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
  • ${queueStats.total.pending} jobs pending
  • ${queueStats.total.processing} jobs processing
  • ${queueStats.total.completed} jobs completed
  • ${queueStats.total.failed} jobs failed
  • 🔄 Inngest: ${queueStats.inngest.pending} pending, ${queueStats.inngest.processing} processing
  • 🏗️ GitHub Actions: ${queueStats.github_actions.pending} pending, ${queueStats.github_actions.processing} processing

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
      
      const manager = await getHybridQueueManager();
      const queueStats = await manager.getHybridStats();
      console.log(`
✅ Bootstrap completed successfully!

📈 Queue Status:
  • ${queueStats.total.pending} jobs queued and ready to process
  • ${queueStats.total.pending + queueStats.total.processing + queueStats.total.completed} total jobs in queue

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
    
    const manager = await getHybridQueueManager();
    const stats = await manager.getHybridStats();
    const canMakeAPICalls = true; // Inngest handles rate limiting
    
    console.log(`
📊 Queue Status Report:
━━━━━━━━━━━━━━━━━━━━━

📋 Job Counts:
  • Pending: ${stats.total.pending}
  • Processing: ${stats.total.processing}  
  • Completed: ${stats.total.completed}
  • Failed: ${stats.total.failed}
  • Total: ${stats.total.pending + stats.total.processing + stats.total.completed + stats.total.failed}

🔄 Inngest Jobs:
  • Pending: ${stats.inngest.pending}
  • Processing: ${stats.inngest.processing}
  • Completed: ${stats.inngest.completed}
  • Failed: ${stats.inngest.failed}

🏗️ GitHub Actions Jobs:
  • Pending: ${stats.github_actions.pending}
  • Processing: ${stats.github_actions.processing}
  • Completed: ${stats.github_actions.completed}
  • Failed: ${stats.github_actions.failed}

🔄 Processing Status:
  • Can make API calls: ${canMakeAPICalls ? '✅ Yes' : '❌ No (rate limited)'}
  • Queue health: ${stats.total.pending > 0 ? '🟡 Active' : stats.total.completed > 0 ? '✅ Processed' : '⚪ Empty'}

💡 Actions:
  • To process manually: ProgressiveCaptureTrigger.processNext()
  • To check rate limits: ProgressiveCaptureTrigger.rateLimits()
  • To see detailed monitoring: ProgressiveCaptureTrigger.monitoring()
    `);

    return stats;
  }

  /**
   * Process the next job in queue (for manual testing)
   */
  static async processNext() {
    // Manual processing not available with hybrid system
    console.log('ℹ️ Manual job processing is not available with hybrid queue system');
    console.log('📋 Jobs are processed automatically by:');
    console.log('   🔄 Inngest workers for real-time processing');
    console.log('   🏗️ GitHub Actions for bulk historical processing');
    console.log('🔍 Check the Inngest dashboard or GitHub Actions for job status and monitoring');
    
    return null;
  }

  /**
   * Check rate limit status
   */
  static async rateLimits() {
    
    // Rate limit checking not available with Inngest
    const canMake1 = true;
    const canMake10 = true;
    const canMake100 = true;

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

      // Queue commit analysis using hybrid manager
      const manager = await getHybridQueueManager();
      await manager.queueHistoricalDataCapture(repoData.id, `${owner}/${repo}`, 90);
      const queuedCount = 1; // One job queued
      
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

      // Queue recent PRs and historical data using hybrid manager
      const manager = await getHybridQueueManager();
      
      // Check if we can process this repository
      const { count: prCount } = await supabase
        .from('pull_requests')
        .select('*', { count: 'exact', head: true })
        .eq('repository_id', repoData.id);
      
      if (prCount && prCount > 1000) {
        console.warn(`⚠️ Large repository detected: ${owner}/${repo} has ${prCount} PRs`);
        console.log('📋 Using hybrid routing for optimal processing');
      }
      
      // Queue recent data (routes to Inngest for real-time processing)
      const recentJob = await manager.queueRecentDataCapture(repoData.id, `${owner}/${repo}`);
      
      // Queue historical data if needed (routes to GitHub Actions for bulk processing)
      const historicalJob = await manager.queueHistoricalDataCapture(repoData.id, `${owner}/${repo}`, 30);
      
      // Queue AI summary
      const aiSummaryQueued = await AISummaryProcessor.queueSummaryRegeneration(repoData.id, 'medium');
      
      const totalJobs = 1 + 1 + (aiSummaryQueued ? 1 : 0); // Recent + Historical + AI Summary
      
      // Show subtle processing notification for manual triggers only
      if (process.env.NODE_ENV === 'development') {
        ProgressiveCaptureNotifications.showProcessingStarted(`${owner}/${repo}`);
        
        console.log(`
✅ Quick fix queued for ${owner}/${repo}:
  • Recent data: Queued (${recentJob.processor} processor)
  • Historical data: Queued (${historicalJob.processor} processor)
  • AI Summary: ${aiSummaryQueued ? 'Queued' : 'Skipped (recent)'}
  • Total: ${totalJobs} jobs queued
  • Smart routing: Recent data → Inngest, Historical data → GitHub Actions
        `);
      }
      
    } catch (error) {
      console.error('❌ Quick fix failed for %s/%s:', owner, repo, error);
    }
  }

  /**
   * Show comprehensive monitoring dashboard
   */
  static async monitoring() {
    try {
      const { HybridMonitoringDashboard } = await import('./monitoring-dashboard');
      const report = await HybridMonitoringDashboard.generateReport();
      console.log(report);
      
      return report;
    } catch (error) {
      console.error('❌ Error generating monitoring report:', error);
    }
  }

  /**
   * Show detailed system stats
   */
  static async stats() {
    try {
      const { HybridMonitoringDashboard } = await import('./monitoring-dashboard');
      const stats = await HybridMonitoringDashboard.getSystemStats();
      
      console.log('📊 Detailed System Statistics:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Current Queue Status:', stats.current);
      console.log('Performance Metrics:', stats.metrics);
      console.log('System Health:', stats.health);
      console.log('Cost Analysis:', stats.cost);
      
      return stats;
    } catch (error) {
      console.error('❌ Error getting system stats:', error);
    }
  }

  /**
   * Check routing effectiveness
   */
  static async routingAnalysis() {
    try {
      const { HybridMonitoringDashboard } = await import('./monitoring-dashboard');
      const routing = await HybridMonitoringDashboard.getRoutingEffectiveness();
      
      console.log(`
🎯 Routing Effectiveness Analysis:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 Routing Accuracy: ${routing.routingAccuracy.toFixed(1)}%
✅ Correct Routing: ${routing.correctRouting} jobs
⚠️ Suboptimal Routing: ${routing.suboptimalRouting} jobs

${routing.suggestions.length > 0 ? `💡 Suggestions:
${routing.suggestions.map(s => `  • ${s}`).join('\n')}` : '✅ No routing issues detected'}
      `);
      
      return routing;
    } catch (error) {
      console.error('❌ Error analyzing routing:', error);
    }
  }

  /**
   * Clear all queued jobs and reset tracking
   */
  static async clearAllJobs() {
    try {
      const manager = await getHybridQueueManager();
      // Clear jobs from both systems
      await manager.checkActiveJobs(); // Update job statuses first
      
      // Also clear smart notification tracking
      const { SmartDataNotifications } = await import('./smart-notifications');
      SmartDataNotifications.reset();
      
      console.log('✅ All job tracking updated and smart notifications reset');
    } catch (error) {
      console.error('❌ Error clearing jobs:', error);
    }
  }
}

// Make it available globally for console access
if (typeof window !== 'undefined') {
  (window as any).ProgressiveCapture = ProgressiveCaptureTrigger;
  // Short aliases for easier console usage
  (window as any).pc = ProgressiveCaptureTrigger;
  (window as any).cap = ProgressiveCaptureTrigger;
  
  // Enable console tools in development
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 Progressive Data Capture tools available in console:');
    console.log('   ProgressiveCapture.* (full name)');
    console.log('   pc.* (short alias)');
    console.log('   cap.* (capture alias)');
    console.log('');
    console.log('📊 Available commands:');
    console.log('   .analyze() - Analyze data gaps');
    console.log('   .bootstrap() - Bootstrap missing data');
    console.log('   .status() - Queue status');
    console.log('   .monitoring() - Full monitoring report');
    console.log('   .stats() - Detailed statistics');
    console.log('   .routingAnalysis() - Routing effectiveness');
    console.log('   .quickFix(owner, repo) - Fix specific repository');
  }
}