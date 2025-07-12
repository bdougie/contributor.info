import { supabase } from '../supabase';
import { queueManager } from './queue-manager';
import { trackDatabaseOperation, trackCacheOperation } from '../simple-logging';
// Removed Sentry import - using simple logging instead

// No-op replacement for trackDataSync
const trackDataSync = (..._args: any[]) => {
  // No-op: Data sync tracking removed
};

/**
 * Progressive capture processor for AI repository summaries
 * Integrates with the existing queue system to handle summary generation
 */
export class AISummaryProcessor {
  /**
   * Queue AI summary regeneration for repositories
   */
  static async queueSummaryRegeneration(repositoryId: string, priority: 'high' | 'medium' | 'low' = 'medium'): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('data_capture_queue')
        .insert({
          type: 'ai_summary' as any, // Type extension for AI summaries
          priority,
          repository_id: repositoryId,
          estimated_api_calls: 2, // 1 for summary, 1 for embedding
          metadata: { 
            reason: 'scheduled_regeneration',
            requested_at: new Date().toISOString()
          }
        });

      if (error && error.code !== '23505') { // Ignore duplicate key errors
        console.error('[AI Summary] Error queuing summary regeneration:', error);
        return false;
      }

      // Simple breadcrumb logging without analytics
      console.log('AI Summary breadcrumb:', {
        category: 'ai_summary',
        message: 'AI summary regeneration queued',
        level: 'info',
        data: { repositoryId, priority }
      });

      return true;
    } catch (err) {
      // Simple error logging without analytics
      console.error('AI Summary error:', err, {
        tags: { component: 'ai-summary-processor' },
        contexts: { ai_summary: { repositoryId, priority } }
      });
      return false;
    }
  }

  /**
   * Process AI summary generation job
   */
  static async processAISummaryJob(job: any): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      // Get repository data
      const repositoryData = await trackDatabaseOperation(
        'fetchRepositoryForSummary',
        async () => {
          const { data, error } = await supabase
            .from('repositories')
            .select('*, pull_requests(*)')
            .eq('id', job.repository_id)
            .single();

          if (error) throw error;
          return data;
        },
        {
          operation: 'fetch',
          table: 'repositories',
          repository: job.repository_id
        }
      );

      if (!repositoryData) {
        throw new Error('Repository not found');
      }

      // Call edge function to generate summary
      const result = await trackCacheOperation(
        'generateAISummary',
        async () => {
          const { data, error } = await supabase.functions.invoke(
            'repository-summary',
            {
              body: {
                repository: repositoryData,
                pullRequests: repositoryData.pull_requests || [],
                forceRegeneration: true
              }
            }
          );

          if (error) throw error;
          return data;
        },
        {
          operation: 'set',
          cacheType: 'api',
          key: `ai-summary:${repositoryData.id}`,
          ttl: 14 * 24 * 60 * 60 * 1000 // 14 days
        }
      );

      // Track successful generation
      await trackDataSync('progressive', repositoryData.full_name || repositoryData.id, {
        processed: 1,
        inserted: 0,
        updated: 1,
        failed: 0,
        duration: Date.now() - startTime
      });

      // Mark job as completed
      await queueManager.markJobCompleted(job.id);

      // Simple breadcrumb logging without analytics
      console.log('AI Summary breadcrumb:', {
        category: 'ai_summary',
        message: 'AI summary generated successfully',
        level: 'info',
        data: {
          repositoryId: job.repository_id,
          duration: Date.now() - startTime,
          summaryLength: result.summary?.length || 0
        }
      });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Track failed generation
      await trackDataSync('progressive', job.repository_id, {
        processed: 1,
        inserted: 0,
        updated: 0,
        failed: 1,
        duration: Date.now() - startTime
      });

      // Mark job as failed
      await queueManager.markJobFailed(job.id, errorMessage);

      // Simple error logging without analytics
      console.error('AI Summary processor error:', {
        jobId: job.id,
        repositoryId: job.repository_id,
        attempts: job.attempts,
        error: errorMessage
      });

      return false;
    }
  }

  /**
   * Queue bulk AI summary regeneration for stale summaries
   */
  static async queueStaleSummaries(days: number = 14): Promise<number> {
    try {
      const staleDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const { data: staleRepos, error } = await supabase
        .from('repositories')
        .select('id, full_name')
        .or(`summary_generated_at.is.null,summary_generated_at.lt.${staleDate.toISOString()}`)
        .limit(50); // Process in batches

      if (error) {
        throw error;
      }

      if (!staleRepos || staleRepos.length === 0) {
        return 0;
      }

      let queuedCount = 0;
      for (const repo of staleRepos) {
        const queued = await this.queueSummaryRegeneration(repo.id, 'low');
        if (queued) queuedCount++;
      }

      // Simple breadcrumb logging without analytics
      console.log('AI Summary breadcrumb:', {
        category: 'ai_summary',
        message: `Queued ${queuedCount} stale summaries for regeneration`,
        level: 'info',
        data: { totalStale: staleRepos.length, queuedCount, days }
      });

      return queuedCount;
    } catch (error) {
      // Simple error logging without analytics
      console.error('AI Summary error:', error, {
        tags: { component: 'ai-summary-processor' },
        contexts: { ai_summary: { operation: 'queue_stale_summaries', days } }
      });
      return 0;
    }
  }

  /**
   * Analyze AI summary coverage and quality
   */
  static async analyzeSummaryCoverage(): Promise<{
    totalRepositories: number;
    withSummaries: number;
    staleSummaries: number;
    missingSummaries: number;
    averageAge: number;
  }> {
    try {
      const { data: stats, error } = await supabase
        .rpc('analyze_ai_summary_coverage');

      if (error) throw error;

      return stats || {
        totalRepositories: 0,
        withSummaries: 0,
        staleSummaries: 0,
        missingSummaries: 0,
        averageAge: 0
      };
    } catch (error) {
      // Simple error logging without analytics
      console.error('AI Summary error:', error, {
        tags: { component: 'ai-summary-processor' },
        contexts: { ai_summary: { operation: 'analyze_coverage' } }
      });
      
      return {
        totalRepositories: 0,
        withSummaries: 0,
        staleSummaries: 0,
        missingSummaries: 0,
        averageAge: 0
      };
    }
  }

  /**
   * Check if a repository needs AI summary regeneration
   */
  static async needsSummaryRegeneration(repositoryId: string): Promise<boolean> {
    try {
      const { data: repo, error } = await supabase
        .from('repositories')
        .select('summary_generated_at, recent_activity_hash')
        .eq('id', repositoryId)
        .single();

      if (error || !repo) return true;

      // Check if summary is older than 14 days
      if (!repo.summary_generated_at) return true;
      
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const generatedAt = new Date(repo.summary_generated_at);
      
      return generatedAt < fourteenDaysAgo;
    } catch (error) {
      console.error('[AI Summary] Error checking regeneration need:', error);
      return false; // Conservative approach
    }
  }
}

// Export for browser console access
if (typeof window !== 'undefined') {
  (window as any).AISummaryProcessor = AISummaryProcessor;
}