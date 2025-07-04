import { queueManager } from './queue-manager';
import { supabase } from '../supabase';

/**
 * Bootstrap the queue with critical missing data for immediate improvements
 * This should be run once to queue the most important missing data
 */
export async function bootstrapDataCaptureQueue(): Promise<void> {
  console.log('[Bootstrap] Starting queue bootstrap for critical missing data');

  try {
    // 1. Find repositories with stale data (older than 3 days)
    console.log('[Bootstrap] Queuing recent PRs for stale repositories...');
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
        await queueManager.queueRecentPRs(repo.id);
        console.log(`[Bootstrap] Queued recent PRs for ${repo.owner}/${repo.name}`);
      }
    }

    // 2. Find repositories with missing file change data
    console.log('[Bootstrap] Queuing file changes for active repositories...');
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
        const queuedCount = await queueManager.queueMissingFileChanges(repo.id, 25); // 25 PRs per repo
        console.log(`[Bootstrap] Queued ${queuedCount} file change jobs for ${repo.owner}/${repo.name}`);
      }
    }

    // 3. Show queue statistics
    const stats = await queueManager.getQueueStats();
    console.log('[Bootstrap] Queue bootstrap completed. Stats:', stats);

    console.log(`
[Bootstrap] Queue Bootstrap Summary:
- Queued recent PR jobs for ${staleRepos?.length || 0} stale repositories
- Queued file change jobs for ${activeRepos?.length || 0} active repositories
- Total pending jobs: ${stats.pending}
- 
Next steps:
1. Run the queue processor to start filling missing data
2. Monitor rate limits to ensure compliance
3. Check data quality improvements in the UI
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
  console.log('[Analysis] Analyzing data gaps...');

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

    console.log('[Analysis] Data gap analysis:', analysis);
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