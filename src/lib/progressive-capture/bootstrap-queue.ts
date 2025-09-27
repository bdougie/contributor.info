import { supabase } from '../supabase';
import { ProgressiveCaptureNotifications } from './ui-notifications';

// Lazy load Hybrid queue manager to avoid Buffer issues in browser
async function getHybridQueueManager() {
  const { hybridQueueManager } = await import('./hybrid-queue-manager');
  return hybridQueueManager;
}

/**
 * Bootstrap the queue with critical missing data for immediate improvements
 * This should be run once to queue the most important missing data
 */
export async function bootstrapDataCaptureQueue(): Promise<void> {
  try {
    const manager = await getHybridQueueManager();

    // 1. Find repositories with stale data (older than 3 days)
    const { data: staleRepos, error: staleError } = await supabase
      .from('repositories')
      .select('id, owner, name')
      .lt('last_updated_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())
      .order('last_updated_at', { ascending: true })
      .limit(10); // Start with top 10 most stale repositories

    if (staleError) {
      console.error('[Bootstrap] Error finding stale repositories:', staleError);
    } else if (staleRepos) {
      for (const repo of staleRepos) {
        // Queue recent data capture (routes to Inngest for real-time processing)
        await manager.queueRecentDataCapture(repo.id, `${repo.owner}/${repo.name}`);
      }
    }

    // 2. Find repositories with missing file change data that need historical processing
    const { data: activeRepos, error: activeError } = await supabase
      .from('repositories')
      .select(
        `
        id, 
        owner, 
        name,
        pull_requests!inner(id)
      `
      )
      .gte('last_updated_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .limit(5); // Start with 5 most active repositories

    if (activeError) {
      console.error('[Bootstrap] Error finding active repositories:', activeError);
    } else if (activeRepos) {
      for (const repo of activeRepos) {
        // Queue historical data capture (routes to GitHub Actions for bulk processing)
        await manager.queueHistoricalDataCapture(repo.id, `${repo.owner}/${repo.name}`, 30);
      }
    }

    // 3. Queue additional historical processing for repositories with commits
    const { data: reposWithCommits, error: commitsError } = await supabase
      .from('repositories')
      .select(
        `
        id,
        owner,
        name,
        commits!inner(id)
      `
      )
      .limit(3); // Start with 3 repositories for commit analysis

    if (commitsError) {
      console.error('[Bootstrap] Error finding repositories with commits:', commitsError);
    } else if (reposWithCommits) {
      for (const repo of reposWithCommits) {
        // Queue extended historical data capture for commit analysis
        await manager.queueHistoricalDataCapture(repo.id, `${repo.owner}/${repo.name}`, 90);
      }
    }

    // 4. Show queue statistics
    const stats = await manager.getHybridStats();

    // Show UI notification for bootstrap completion
    if (stats.total.pending > 0) {
      ProgressiveCaptureNotifications.showQueueStatus({
        pending: stats.total.pending,
        processing: stats.total.processing,
        completed: stats.total.completed,
        failed: stats.total.failed,
      });
    }

    console.log(
      '\n[Bootstrap] Hybrid Queue Bootstrap Summary:\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        '- Queued recent data jobs for %s stale repositories (→ Inngest)\n' +
        '- Queued historical data jobs for %s active repositories (→ GitHub Actions)\n' +
        '- Queued extended historical jobs for %s repositories with commits (→ GitHub Actions)\n' +
        '\n' +
        '📊 Queue Statistics:\n' +
        '- Total pending jobs: %s\n' +
        '- 🔄 Inngest: %s pending, %s processing\n' +
        '- 🏗️ GitHub Actions: %s pending, %s processing\n' +
        '\n' +
        '🎯 Smart Routing Active:\n' +
        '- Recent data (< 24 hours) → Inngest for real-time processing\n' +
        '- Historical data (> 24 hours) → GitHub Actions for cost-effective bulk processing\n' +
        '\n' +
        '📋 Next Steps:\n' +
        '1. Jobs will process automatically across both systems\n' +
        '2. Monitor progress with: ProgressiveCapture.status()\n' +
        '3. Check detailed monitoring with: ProgressiveCapture.monitoring()\n' +
        '4. View routing analysis with: ProgressiveCapture.routingAnalysis()',
      staleRepos?.length || 0,
      activeRepos?.length || 0,
      reposWithCommits?.length || 0,
      stats.total.pending,
      stats.inngest.pending,
      stats.inngest.processing,
      stats.github_actions.pending,
      stats.github_actions.processing
    );
  } catch (error) {
    console.error('[Bootstrap] Error during queue bootstrap:', error);
  }
}

/**
 * Get a summary of what data is missing and needs to be queued
 */
export async function analyzeDataGaps(): Promise<{
  repositoriesWithStaleData: number;
  prsWithoutFileChanges: number;
  emptyReviewsTable: boolean;
  emptyCommentsTable: boolean;
  emptyCommitsTable: boolean;
}> {
  try {
    // Count repositories with stale data
    const { count: staleRepoCount } = await supabase
      .from('repositories')
      .select('*', { count: 'exact', head: true })
      .lt('last_updated_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString());

    // Count PRs without file changes
    const { count: prsWithoutChanges } = await supabase
      .from('pull_requests')
      .select('*', { count: 'exact', head: true })
      .eq('additions', 0)
      .eq('deletions', 0);

    // Check if tables are empty
    const { count: reviewCount } = await supabase
      .from('reviews')
      .select('*', { count: 'exact', head: true });

    const { count: commentCount } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true });

    const { count: commitCount } = await supabase
      .from('commits')
      .select('*', { count: 'exact', head: true });

    const analysis = {
      repositoriesWithStaleData: staleRepoCount || 0,
      prsWithoutFileChanges: prsWithoutChanges || 0,
      emptyReviewsTable: (reviewCount || 0) === 0,
      emptyCommentsTable: (commentCount || 0) === 0,
      emptyCommitsTable: (commitCount || 0) === 0,
    };

    return analysis;
  } catch (error) {
    console.error('[Analysis] Error analyzing data gaps:', error);
    return {
      repositoriesWithStaleData: 0,
      prsWithoutFileChanges: 0,
      emptyReviewsTable: true,
      emptyCommentsTable: true,
      emptyCommitsTable: true,
    };
  }
}
