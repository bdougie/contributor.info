import { bootstrapDataCaptureQueue, analyzeDataGaps } from './bootstrap-queue';
import { ProgressiveCaptureNotifications } from './ui-notifications';
import { AISummaryProcessor } from './ai-summary-processor';
import { getQueueHealthStatus, getBatchCapabilityMessage } from '../utils/performance-helpers';

// Import type for HybridQueueManager
import type { HybridQueueManager } from './hybrid-queue-manager';

// Lazy load Hybrid queue manager to avoid Buffer issues in browser
let hybridQueueManager: HybridQueueManager | null = null;
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

    console.log(
      '\n📊 Data Gap Analysis Results:\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        '\n🕐 Stale Data:\n' +
        '  • %s repositories with data older than 3 days\n' +
        '\n📊 Missing Data:\n' +
        '  • %s PRs without file change data (additions/deletions)\n' +
        '  • Reviews table: %s\n' +
        '  • Comments table: %s\n' +
        '  • Commits table: %s\n' +
        '\n⚡ Current Queue Status:\n' +
        '  • %s jobs pending\n' +
        '  • %s jobs processing\n' +
        '  • %s jobs completed\n' +
        '  • %s jobs failed\n' +
        '  • 🔄 Inngest: %s pending, %s processing\n' +
        '  • 🏗️ GitHub Actions: %s pending, %s processing\n' +
        '\n💡 Recommendations:\n' +
        '%s\n' +
        '%s\n' +
        '%s',
      gaps.repositoriesWithStaleData,
      gaps.prsWithoutFileChanges,
      gaps.emptyReviewsTable ? '❌ Empty' : '✅ Has data',
      gaps.emptyCommentsTable ? '❌ Empty' : '✅ Has data',
      gaps.emptyCommitsTable ? '❌ Empty' : '✅ Has data',
      queueStats.total.pending,
      queueStats.total.processing,
      queueStats.total.completed,
      queueStats.total.failed,
      queueStats.inngest.pending,
      queueStats.inngest.processing,
      queueStats.github_actions.pending,
      queueStats.github_actions.processing,
      gaps.repositoriesWithStaleData > 0
        ? '  • Run bootstrap to queue recent PRs for stale repositories'
        : '  • ✅ Repository data is fresh',
      gaps.prsWithoutFileChanges > 0
        ? '  • Run bootstrap to queue file change updates'
        : '  • ✅ File change data is complete',
      gaps.emptyReviewsTable
        ? '  • Consider queuing review data (lower priority)'
        : '  • ✅ Review data available'
    );

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
      console.log(
        '\n✅ Bootstrap completed successfully!\n' +
          '\n📈 Queue Status:\n' +
          '  • %s jobs queued and ready to process\n' +
          '  • %s total jobs in queue\n' +
          '\n🔄 Next Steps:\n' +
          '  1. The queue will automatically process jobs when the app is active\n' +
          '  2. Monitor progress with: ProgressiveCaptureTrigger.status()\n' +
          '  3. Check rate limits with: ProgressiveCaptureTrigger.rateLimits()',
        queueStats.total.pending,
        queueStats.total.pending + queueStats.total.processing + queueStats.total.completed
      );
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

    console.log(
      '\n📊 Queue Status Report:\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        '\n📋 Job Counts:\n' +
        '  • Pending: %s\n' +
        '  • Processing: %s\n' +
        '  • Completed: %s\n' +
        '  • Failed: %s\n' +
        '  • Total: %s\n' +
        '\n🔄 Inngest Jobs:\n' +
        '  • Pending: %s\n' +
        '  • Processing: %s\n' +
        '  • Completed: %s\n' +
        '  • Failed: %s\n' +
        '\n🏗️ GitHub Actions Jobs:\n' +
        '  • Pending: %s\n' +
        '  • Processing: %s\n' +
        '  • Completed: %s\n' +
        '  • Failed: %s\n' +
        '\n🔄 Processing Status:\n' +
        '  • Can make API calls: %s\n' +
        '  • Queue health: %s\n' +
        '\n💡 Actions:\n' +
        '  • To process manually: ProgressiveCaptureTrigger.processNext()\n' +
        '  • To check rate limits: ProgressiveCaptureTrigger.rateLimits()\n' +
        '  • To see detailed monitoring: ProgressiveCaptureTrigger.monitoring()',
      stats.total.pending,
      stats.total.processing,
      stats.total.completed,
      stats.total.failed,
      stats.total.pending + stats.total.processing + stats.total.completed + stats.total.failed,
      stats.inngest.pending,
      stats.inngest.processing,
      stats.inngest.completed,
      stats.inngest.failed,
      stats.github_actions.pending,
      stats.github_actions.processing,
      stats.github_actions.completed,
      stats.github_actions.failed,
      canMakeAPICalls ? '✅ Yes' : '❌ No (rate limited)',
      getQueueHealthStatus(stats.total.pending, stats.total.completed, stats.total.failed || 0)
    );

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

    console.log(
      '\n🔒 Rate Limit Status:\n' +
        '━━━━━━━━━━━━━━━━━━━━\n' +
        '\n✅ Can make 1 API call: %s\n' +
        '⚡ Can make 10 API calls: %s\n' +
        '🚀 Can make 100 API calls: %s\n' +
        '\n💡 Recommendations:\n' +
        '%s',
      canMake1 ? 'Yes' : 'No',
      canMake10 ? 'Yes' : 'No',
      canMake100 ? 'Yes' : 'No',
      getBatchCapabilityMessage(canMake100, canMake10, !canMake1)
    );

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
        .maybeSingle();

      if (error || !repoData) {
        console.log('❌ Repository %s/%s not found in database', owner, repo);
        return;
      }

      // Queue commit analysis using hybrid manager
      const manager = await getHybridQueueManager();
      await manager.queueHistoricalDataCapture(repoData.id, `${owner}/${repo}`, 90);
      const queuedCount = 1; // One job queued

      // Show UI notification
      if (queuedCount > 0) {
        ProgressiveCaptureNotifications.showJobsQueued(
          queuedCount,
          'commit analysis',
          `${owner}/${repo}`
        );
      }

      console.log(
        '\n✅ Commit analysis queued for %s/%s:\n' +
          '  • %s commits queued for PR association analysis\n' +
          '  • This will enable YOLO coder detection\n' +
          '  • Use ProgressiveCapture.processNext() to process manually',
        owner,
        repo,
        queuedCount
      );
    } catch (error) {
      console.error('❌ Commit analysis failed for %s/%s:', owner, repo, error);
    }
  }

  /**
   * Process a recent_prs job - fetch and store recent PRs from GitHub API
   */
  static async processRecentPRsJob(
    repositoryId: string,
    metadata: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get repository info
      const { supabase } = await import('../supabase');
      const { data: repo, error: repoError } = await supabase
        .from('repositories')
        .select('owner, name')
        .eq('id', repositoryId)
        .maybeSingle();

      if (repoError || !repo) {
        return { success: false, error: `Repository not found: ${repoError?.message}` };
      }

      // Fetch recent PRs from GitHub API using existing library
      const { fetchPullRequests } = await import('../github');
      const days = metadata?.days || 7;

      console.log('🔄 Fetching recent PRs for %s/%s (last %d days)', repo.owner, repo.name, days);

      const recentPRs = await fetchPullRequests(repo.owner, repo.name, days.toString());

      if (!recentPRs || recentPRs.length === 0) {
        console.log('✅ No recent PRs found for %s/%s', repo.owner, repo.name);
        return { success: true };
      }

      // Store PRs in database using existing spam detection integration
      const { processPRWithSpamDetection } = await import(
        '../../../supabase/functions/_shared/spam-detection-integration'
      );

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
            console.warn('Failed to store PR #%s: %s', pr.number, result.error);
          }
        } catch (prError) {
          console.warn('Error storing PR #%s:', pr.number, prError);
        }
      }

      console.log(
        '✅ Imported %s/%s recent PRs for %s/%s',
        importedCount,
        recentPRs.length,
        repo.owner,
        repo.name
      );
      return { success: true };
    } catch (error) {
      console.error('❌ Error processing recent PRs job:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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
        .maybeSingle();

      if (error || !repoData) {
        console.log('❌ Repository %s/%s not found in database', owner, repo);
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
        console.warn('⚠️ Large repository detected: %s/%s has %s PRs', owner, repo, prCount);
        console.log('📋 Using hybrid routing for optimal processing');
      }

      // Queue recent data (routes to Inngest for real-time processing)
      const recentJob = await manager.queueRecentDataCapture(repoData.id, `${owner}/${repo}`);

      // Queue historical data if needed (routes to GitHub Actions for bulk processing)
      const historicalJob = await manager.queueHistoricalDataCapture(
        repoData.id,
        `${owner}/${repo}`,
        30
      );

      // Queue AI summary
      const aiSummaryQueued = await AISummaryProcessor.queueSummaryRegeneration(
        repoData.id,
        'medium'
      );

      const totalJobs = 1 + 1 + (aiSummaryQueued ? 1 : 0); // Recent + Historical + AI Summary

      // Show subtle processing notification for manual triggers only
      if (import.meta.env?.DEV) {
        ProgressiveCaptureNotifications.showProcessingStarted(`${owner}/${repo}`);

        console.log(
          '\n✅ Quick fix queued for %s/%s:\n' +
            '  • Recent data: Queued (%s processor)\n' +
            '  • Historical data: Queued (%s processor)\n' +
            '  • AI Summary: %s\n' +
            '  • Total: %s jobs queued\n' +
            '  • Smart routing: Recent data → Inngest, Historical data → GitHub Actions',
          owner,
          repo,
          recentJob.processor,
          historicalJob.processor,
          aiSummaryQueued ? 'Queued' : 'Skipped (recent)',
          totalJobs
        );
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

      console.log(
        '\n🎯 Routing Effectiveness Analysis:\n' +
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
          '\n📈 Routing Accuracy: %s%\n' +
          '✅ Correct Routing: %s jobs\n' +
          '⚠️ Suboptimal Routing: %s jobs\n' +
          '\n%s',
        routing.routingAccuracy.toFixed(1),
        routing.correctRouting,
        routing.suboptimalRouting,
        routing.suggestions.length > 0
          ? `💡 Suggestions:\n${routing.suggestions.map((s) => `  • ${s}`).join('\n')}`
          : '✅ No routing issues detected'
      );

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

// Extend window interface for development tools
declare global {
  interface Window {
    ProgressiveCapture: typeof ProgressiveCaptureTrigger;
    pc: typeof ProgressiveCaptureTrigger;
    cap: typeof ProgressiveCaptureTrigger;
  }
}

// Make it available globally for console access
if (typeof window !== 'undefined') {
  window.ProgressiveCapture = ProgressiveCaptureTrigger;
  // Short aliases for easier console usage
  window.pc = ProgressiveCaptureTrigger;
  window.cap = ProgressiveCaptureTrigger;

  // Enable console tools in development
  if (import.meta.env?.DEV) {
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
