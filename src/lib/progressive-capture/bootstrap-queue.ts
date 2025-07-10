import { supabase } from '../supabase';
import { ProgressiveCaptureNotifications } from './ui-notifications';

// Lazy load Inngest queue manager to avoid Buffer issues in browser
async function getInngestQueueManager() {
  const { inngestQueueManager } = await import('../inngest/queue-manager');
  return inngestQueueManager;
}

/**
 * Bootstrap the queue with critical missing data for immediate improvements
 * This should be run once to queue the most important missing data
 */
export async function bootstrapDataCaptureQueue(): Promise<void> {

  try {
    const manager = await getInngestQueueManager();
    
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
        await manager.queueRecentPRs(repo.id);
      }
    }

    // 2. Find repositories with missing file change data
    const { data: activeRepos, error: activeError } = await supabase
      .from('repositories')
      .select(`
        id, 
        owner, 
        name,
        pull_requests!inner(id)
      `)
      .gte('last_updated_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .limit(5); // Start with 5 most active repositories

    if (activeError) {
      console.error('[Bootstrap] Error finding active repositories:', activeError);
    } else if (activeRepos) {
      for (const repo of activeRepos) {
        await manager.queueMissingFileChanges(repo.id, 25); // 25 PRs per repo
      }
    }

    // 3. Queue smart commit analysis for repositories with commits
    const { data: reposWithCommits, error: commitsError } = await supabase
      .from('repositories')
      .select(`
        id,
        owner,
        name,
        commits!inner(id)
      `)
      .limit(3); // Start with 3 repositories for commit analysis

    if (commitsError) {
      console.error('[Bootstrap] Error finding repositories with commits:', commitsError);
    } else if (reposWithCommits) {
      for (const repo of reposWithCommits) {
        await manager.queueRecentCommitsAnalysis(repo.id, 90); // Last 90 days
      }
    }

    // 4. Show queue statistics
    const stats = await manager.getQueueStats();

    // Show UI notification for bootstrap completion
    if (stats.pending > 0) {
      ProgressiveCaptureNotifications.showQueueStatus(stats);
    }

    console.log(`
[Bootstrap] Queue Bootstrap Summary:
- Queued recent PR jobs for ${staleRepos?.length || 0} stale repositories
- Queued file change jobs for ${activeRepos?.length || 0} active repositories
- Queued commit analysis jobs for ${reposWithCommits?.length || 0} repositories with commits
- Total pending jobs: ${stats.pending}
- 
Next steps:
1. Jobs will process automatically in the background
2. Use ProgressiveCapture.processNext() to manually process jobs
3. Monitor rate limits with ProgressiveCapture.rateLimits()
4. Check YOLO coder analysis once commits are analyzed
    `);

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
      emptyCommitsTable: (commitCount || 0) === 0
    };

    return analysis;

  } catch (error) {
    console.error('[Analysis] Error analyzing data gaps:', error);
    return {
      repositoriesWithStaleData: 0,
      prsWithoutFileChanges: 0,
      emptyReviewsTable: true,
      emptyCommentsTable: true,
      emptyCommitsTable: true
    };
  }
}