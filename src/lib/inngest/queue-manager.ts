import { inngest } from './client';
import { supabase } from '../supabase';
import { ProgressiveCaptureNotifications } from '../progressive-capture/ui-notifications';

export class InngestQueueManager {
  // Send Inngest events with proper error handling
  private async safeSend(event: any): Promise<boolean> {
    console.log('📤 [Inngest] Sending event:', event.name, event.data);
    
    try {
      await inngest.send(event);
      console.log('✅ [Inngest] Event sent successfully:', event.name);
      return true;
    } catch (error) {
      console.warn('❌ [Inngest] Failed to send event:', error);
      return false;
    }
  }

  /**
   * Queue jobs to fetch missing file changes for PRs
   */
  async queueMissingFileChanges(repositoryId: string, limit: number = 200): Promise<number> {
    return this.queueMissingFileChangesWithPriority(repositoryId, limit, 'critical');
  }

  /**
   * Queue jobs to fetch missing file changes for PRs with specific priority
   */
  async queueMissingFileChangesWithPriority(
    repositoryId: string, 
    limit: number = 200, 
    priority: 'critical' | 'high' | 'medium' | 'low'
  ): Promise<number> {
    // Find PRs with missing file change data
    const { data: prsNeedingUpdate, error } = await supabase
      .from('pull_requests')
      .select('id, number, repository_id')
      .eq('repository_id', repositoryId)
      .eq('additions', 0)
      .eq('deletions', 0)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !prsNeedingUpdate || prsNeedingUpdate.length === 0) {
      return 0;
    }

    // Queue Inngest events for each PR
    let queuedCount = 0;
    for (const pr of prsNeedingUpdate) {
      try {
        await this.safeSend({
          name: "capture/pr.details",
          data: {
            repositoryId: pr.repository_id,
            prNumber: pr.number.toString(),
            prId: pr.id,
            priority,
          },
        });
        queuedCount++;
      } catch (err) {
        console.warn(`Failed to queue PR ${pr.number}:`, err);
      }
    }

    // Show UI notification
    if (queuedCount > 0) {
      ProgressiveCaptureNotifications.showJobsQueued(queuedCount, 'file changes');
    }
    
    return queuedCount;
  }

  /**
   * Queue jobs to fetch recent PRs for repositories with stale data
   */
  async queueRecentPRs(repositoryId: string, userGitHubToken?: string | null): Promise<boolean> {
    return this.queueRecentPRsWithPriority(repositoryId, 'critical', userGitHubToken);
  }

  /**
   * Queue jobs to fetch recent PRs with specific priority
   */
  async queueRecentPRsWithPriority(
    repositoryId: string, 
    priority: 'critical' | 'high' | 'medium' | 'low',
    userGitHubToken?: string | null
  ): Promise<boolean> {
    try {
      await this.safeSend({
        name: "capture/repository.sync",
        data: {
          repositoryId,
          days: 7,
          priority,
          reason: 'stale_data',
          userGitHubToken: userGitHubToken || undefined
        },
      });

      // Show UI notification
      ProgressiveCaptureNotifications.showJobsQueued(1, 'recent PRs');
      
      return true;
    } catch (err) {
      console.error('[Queue] Error queuing recent PRs:', err);
      return false;
    }
  }

  /**
   * Queue jobs to fetch reviews for PRs that don't have them
   */
  async queueMissingReviews(repositoryId: string, limit: number = 200, userGitHubToken?: string | null): Promise<number> {
    return this.queueMissingReviewsWithPriority(repositoryId, limit, 'high', userGitHubToken);
  }

  /**
   * Queue jobs to fetch reviews for PRs with specific priority
   */
  async queueMissingReviewsWithPriority(
    repositoryId: string, 
    limit: number = 200, 
    priority: 'critical' | 'high' | 'medium' | 'low'
  ): Promise<number> {
    // First, get PRs that already have reviews
    const { data: prsWithReviews } = await supabase
      .from('reviews')
      .select('pull_request_id');

    const existingPrIds = prsWithReviews?.map(r => r.pull_request_id) || [];

    // Find PRs without reviews
    let query = supabase
      .from('pull_requests')
      .select(`
        id,
        number,
        repository_id,
        github_id
      `)
      .eq('repository_id', repositoryId)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Only add the not.in filter if we have existing IDs
    if (existingPrIds.length > 0) {
      query = query.not('id', 'in', `(${existingPrIds.map(id => `'${id}'`).join(',')})`);
    }

    const { data: prsNeedingReviews, error } = await query;

    if (error || !prsNeedingReviews || prsNeedingReviews.length === 0) {
      return 0;
    }

    // Queue Inngest events for each PR
    let queuedCount = 0;
    for (const pr of prsNeedingReviews) {
      try {
        await this.safeSend({
          name: "capture/pr.reviews",
          data: {
            repositoryId: pr.repository_id,
            prNumber: pr.number.toString(),
            prId: pr.id,
            prGithubId: pr.github_id,
            priority,
          },
        });
        queuedCount++;
      } catch (err) {
        console.warn(`Failed to queue reviews for PR ${pr.number}:`, err);
      }
    }

    // Show UI notification
    if (queuedCount > 0) {
      ProgressiveCaptureNotifications.showJobsQueued(queuedCount, 'reviews');
    }
    
    return queuedCount;
  }

  /**
   * Queue jobs to fetch comments for PRs that don't have them
   */
  async queueMissingComments(repositoryId: string, limit: number = 200): Promise<number> {
    // First, get PRs that already have comments
    const { data: prsWithComments } = await supabase
      .from('comments')
      .select('pull_request_id');

    const existingPrIds = prsWithComments?.map(c => c.pull_request_id) || [];

    // Find PRs without comments
    let query = supabase
      .from('pull_requests')
      .select(`
        id,
        number,
        repository_id,
        github_id
      `)
      .eq('repository_id', repositoryId)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Only add the not.in filter if we have existing IDs
    if (existingPrIds.length > 0) {
      query = query.not('id', 'in', `(${existingPrIds.map(id => `'${id}'`).join(',')})`);
    }

    const { data: prsNeedingComments, error } = await query;

    if (error || !prsNeedingComments || prsNeedingComments.length === 0) {
      return 0;
    }

    // Queue Inngest events for each PR
    let queuedCount = 0;
    for (const pr of prsNeedingComments) {
      try {
        await this.safeSend({
          name: "capture/pr.comments",
          data: {
            repositoryId: pr.repository_id,
            prNumber: pr.number.toString(),
            prId: pr.id,
            prGithubId: pr.github_id,
            priority: 'medium',
          },
        });
        queuedCount++;
      } catch (err) {
        console.warn(`Failed to queue comments for PR ${pr.number}:`, err);
      }
    }

    // Show UI notification
    if (queuedCount > 0) {
      ProgressiveCaptureNotifications.showJobsQueued(queuedCount, 'comments');
    }
    
    return queuedCount;
  }

  /**
   * Queue commit analysis for recent commits in a repository
   */
  async queueRecentCommitsAnalysis(repositoryId: string, days: number = 90): Promise<number> {
    return this.queueRecentCommitsAnalysisWithPriority(repositoryId, days, 'medium');
  }

  async queueRecentCommitsAnalysisWithPriority(
    repositoryId: string, 
    days: number = 90, 
    priority: 'critical' | 'high' | 'medium' | 'low'
  ): Promise<number> {
    try {
      // Find commits that need PR analysis
      const { data: commitsNeedingAnalysis, error } = await supabase
        .from('commits')
        .select('sha')
        .eq('repository_id', repositoryId)
        .is('is_direct_commit', null)
        .gte('authored_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .order('authored_at', { ascending: false })
        .limit(100);

      if (error || !commitsNeedingAnalysis || commitsNeedingAnalysis.length === 0) {
        return 0;
      }

      const batchId = `batch_${Date.now()}`;
      let queuedCount = 0;

      // Queue individual commit analysis events
      for (const commit of commitsNeedingAnalysis) {
        try {
          await this.safeSend({
            name: "capture/commits.analyze",
            data: {
              repositoryId,
              commitSha: commit.sha,
              priority: priority === 'critical' ? 'high' : priority as 'high' | 'medium' | 'low',
              batchId,
            },
          });
          queuedCount++;
        } catch (err) {
          console.warn(`Failed to queue commit ${commit.sha}:`, err);
        }
      }

      // Show UI notification
      if (queuedCount > 0) {
        ProgressiveCaptureNotifications.showJobsQueued(queuedCount, 'commit analysis');
      }
      
      return queuedCount;
    } catch (error) {
      console.error('[Queue] Error queuing recent commits analysis:', error);
      return 0;
    }
  }

  /**
   * Get queue statistics from Inngest dashboard
   * Note: This requires Inngest API access in production
   */
  async getQueueStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
  }> {
    // In development, return mock stats
    // In production, this would use Inngest's API
    if (process.env.NODE_ENV === 'development') {
      return {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        total: 0,
      };
    }

    // TODO: Implement Inngest API integration for production stats
    return {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      total: 0,
    };
  }
}

// Export singleton instance
export const inngestQueueManager = new InngestQueueManager();