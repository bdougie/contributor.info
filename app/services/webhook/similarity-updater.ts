import { PullRequest, Repository, Issue } from '../../types/github';
import { supabase } from '../../../src/lib/supabase';
import { findSimilarIssues, SimilarIssue } from '../similarity';
import { similarityCache } from '../similarity-cache';
import { embeddingService } from '../embedding-service';
import { githubAppAuth } from '../../lib/auth';

interface SimilarityUpdateOptions {
  forceRecalculate?: boolean;
  maxResults?: number;
  minScore?: number;
}

/**
 * WebhookSimilarityService - Real-time similarity recalculation for webhooks
 *
 * This service handles webhook-driven similarity updates:
 * - Recalculates similarities when new issues/PRs are created
 * - Uses cached embeddings for fast lookups
 * - Invalidates stale cache entries
 * - Updates Check Runs with new similarity data
 */
export class WebhookSimilarityService {
  private static instance: WebhookSimilarityService;

  private constructor() {}

  static getInstance(): WebhookSimilarityService {
    if (!WebhookSimilarityService.instance) {
      WebhookSimilarityService.instance = new WebhookSimilarityService();
    }
    return WebhookSimilarityService.instance;
  }

  /**
   * Recalculate similarities for all open PRs in a repository
   * Called when: new issue created, issue edited, new content added
   */
  async recalculateForRepository(
    repositoryId: string,
    options: SimilarityUpdateOptions = {}
  ): Promise<void> {
    const startTime = Date.now();
    console.log('🔄 Recalculating similarities for repository: %s', repositoryId);

    try {
      // Get repository details
      const { data: repository } = await supabase
        .from('repositories')
        .select('*')
        .eq('id', repositoryId)
        .maybeSingle();

      if (!repository) {
        console.warn('Repository not found: %s', repositoryId);
        return;
      }

      // Get all open PRs for this repository
      const { data: openPRs } = await supabase
        .from('pull_requests')
        .select('*')
        .eq('repository_id', repositoryId)
        .eq('state', 'open')
        .order('created_at', { ascending: false });

      if (!openPRs || openPRs.length === 0) {
        console.log('No open PRs to recalculate for repository: %s', repositoryId);
        return;
      }

      console.log('Found %d open PRs to recalculate', openPRs.length);

      // Recalculate similarities for each PR
      let updatedCount = 0;
      for (const pr of openPRs) {
        try {
          const similarities = await this.updatePRSimilarities(
            pr as PullRequest,
            repository as Repository,
            options
          );

          if (similarities.length > 0) {
            // Store updated similarities
            await this.storeSimilarities(pr.id, similarities);
            updatedCount++;
          }
        } catch (error) {
          console.error('Error recalculating PR %s:', pr.number, error);
        }
      }

      const processingTime = Date.now() - startTime;
      console.log('✅ Recalculated similarities for %d PRs in %dms', updatedCount, processingTime);
    } catch (error) {
      console.error('Error in recalculateForRepository:', error);
      throw error;
    }
  }

  /**
   * Update similarities for a specific PR with cache awareness
   * Returns fresh similarity results, using cache when appropriate
   */
  async updatePRSimilarities(
    pullRequest: PullRequest,
    repository: Repository,
    options: SimilarityUpdateOptions = {}
  ): Promise<SimilarIssue[]> {
    const { forceRecalculate = false, maxResults = 5, minScore = 0.5 } = options;

    try {
      // Check if we should use cached results
      if (!forceRecalculate) {
        const cached = await this.getCachedSimilarities(pullRequest.id.toString());
        if (cached && !this.isCacheStale(cached)) {
          console.log('Using cached similarities for PR #%d', pullRequest.number);
          return cached.similarities;
        }
      }

      // Recalculate with fresh embeddings
      console.log('Calculating fresh similarities for PR #%d', pullRequest.number);

      const similarities = await findSimilarIssues(pullRequest, repository, {
        useSemantic: true,
        useCache: true, // Use cached embeddings for issues
        maxResults,
        minScore,
        batchProcess: true,
      });

      // Cache the new results
      await this.cacheSimilarities(pullRequest.id.toString(), similarities);

      return similarities;
    } catch (error) {
      console.error('Error updating PR similarities:', error);
      return [];
    }
  }

  /**
   * Invalidate cached similarities for a PR
   * Called when: PR edited, issue edited, need forced recalculation
   */
  async invalidatePRCache(prId: string): Promise<void> {
    try {
      await supabase
        .from('similarity_cache')
        .delete()
        .eq('item_type', 'pull_request')
        .eq('item_id', prId);

      console.log('Invalidated cache for PR: %s', prId);
    } catch (error) {
      console.error('Error invalidating PR cache:', error);
    }
  }

  /**
   * Invalidate cached embeddings for an issue
   * Called when: issue edited, issue closed/reopened
   */
  async invalidateIssueCache(issueId: string): Promise<void> {
    try {
      await supabase
        .from('similarity_cache')
        .delete()
        .eq('item_type', 'issue')
        .eq('item_id', issueId);

      console.log('Invalidated cache for issue: %s', issueId);
    } catch (error) {
      console.error('Error invalidating issue cache:', error);
    }
  }

  /**
   * Store similarity results for a PR
   */
  private async storeSimilarities(prId: string, similarities: SimilarIssue[]): Promise<void> {
    try {
      // Store in pr_similarities table (if it exists)
      const { error } = await supabase.from('pr_similarities').upsert({
        pull_request_id: prId,
        similar_issues: similarities.map((s) => ({
          issue_number: s.issue.number,
          issue_id: s.issue.id,
          similarity_score: s.similarityScore,
          reasons: s.reasons,
          relationship: s.relationship,
        })),
        calculated_at: new Date().toISOString(),
      });

      if (error && error.code !== '42P01') {
        // Ignore "table doesn't exist" error
        console.error('Error storing similarities:', error);
      }
    } catch (error) {
      // Non-critical error, just log it
      console.error('Error storing similarities:', error);
    }
  }

  /**
   * Get cached similarities for a PR
   */
  private async getCachedSimilarities(
    prId: string
  ): Promise<{ similarities: SimilarIssue[]; cached_at: Date } | null> {
    try {
      const { data } = await supabase
        .from('pr_similarities')
        .select('*')
        .eq('pull_request_id', prId)
        .maybeSingle();

      if (!data) return null;

      return {
        similarities: data.similar_issues as SimilarIssue[],
        cached_at: new Date(data.calculated_at),
      };
    } catch (error) {
      console.error('Error getting cached similarities:', error);
      return null;
    }
  }

  /**
   * Check if cached similarities are stale (older than 1 hour)
   */
  private isCacheStale(cached: { cached_at: Date }): boolean {
    const ONE_HOUR = 60 * 60 * 1000;
    const age = Date.now() - cached.cached_at.getTime();
    return age > ONE_HOUR;
  }

  /**
   * Cache similarity results
   */
  private async cacheSimilarities(prId: string, similarities: SimilarIssue[]): Promise<void> {
    await this.storeSimilarities(prId, similarities);
  }

  /**
   * Trigger similarity recalculation for a specific issue event
   * Called from webhook handlers
   */
  async handleIssueEvent(
    event: 'opened' | 'edited' | 'closed' | 'reopened',
    issue: Issue,
    repositoryId: string
  ): Promise<void> {
    console.log('Handling issue %s event for issue #%d', event, issue.number);

    switch (event) {
      case 'opened':
        // New issue: recalculate all PRs in repository
        await this.recalculateForRepository(repositoryId, {
          forceRecalculate: false, // Use cache where possible
        });
        break;

      case 'edited':
        // Issue edited: invalidate issue cache and recalculate
        await this.invalidateIssueCache(issue.id.toString());
        await this.recalculateForRepository(repositoryId, {
          forceRecalculate: true, // Force fresh calculation
        });
        break;

      case 'closed':
      case 'reopened':
        // State change: recalculate to update status
        await this.recalculateForRepository(repositoryId, {
          forceRecalculate: false,
        });
        break;
    }
  }

  /**
   * Trigger similarity calculation for a new PR
   * Called from webhook handlers
   */
  async handlePREvent(
    event: 'opened' | 'edited' | 'synchronize',
    pullRequest: PullRequest,
    repository: Repository
  ): Promise<SimilarIssue[]> {
    console.log('Handling PR %s event for PR #%d', event, pullRequest.number);

    switch (event) {
      case 'opened':
        // New PR: immediate similarity calculation
        return await this.updatePRSimilarities(pullRequest, repository, {
          forceRecalculate: true,
          maxResults: 5,
          minScore: 0.5,
        });

      case 'edited':
        // PR edited: invalidate cache and recalculate
        await this.invalidatePRCache(pullRequest.id.toString());
        return await this.updatePRSimilarities(pullRequest, repository, {
          forceRecalculate: true,
        });

      case 'synchronize':
        // PR synchronized (new commits): recalculate if stale
        return await this.updatePRSimilarities(pullRequest, repository, {
          forceRecalculate: false, // Use cache if recent
        });

      default:
        return [];
    }
  }
}

// Export singleton instance
export const webhookSimilarityService = WebhookSimilarityService.getInstance();
