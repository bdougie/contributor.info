import { supabase } from '../../src/lib/supabase';
import type { Repository, Issue, PullRequest } from '../types/github';

export type EventPriority = 'critical' | 'high' | 'medium' | 'low';

export interface PriorityScore {
  priority: EventPriority;
  score: number;
  reasons: string[];
}

/**
 * EventPriorityService - Classify webhook events by priority
 *
 * Determines processing priority based on:
 * - Repository activity level
 * - Event type and action
 * - Item age and state
 * - User type (maintainer vs contributor)
 */
export class EventPriorityService {
  private static instance: EventPriorityService;

  // Cache for repository activity scores
  private repoActivityCache = new Map<string, { score: number; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  static getInstance(): EventPriorityService {
    if (!EventPriorityService.instance) {
      EventPriorityService.instance = new EventPriorityService();
    }
    return EventPriorityService.instance;
  }

  /**
   * Classify event priority for processing
   */
  async classifyEvent(
    eventType: 'issues' | 'pull_request',
    action: string,
    item: Issue | PullRequest,
    repository: Repository
  ): Promise<PriorityScore> {
    const scores: number[] = [];
    const reasons: string[] = [];

    // 1. Event action priority (0-40 points)
    const actionScore = this.scoreAction(eventType, action);
    scores.push(actionScore.score);
    if (actionScore.reason) reasons.push(actionScore.reason);

    // 2. Repository activity level (0-30 points)
    const repoScore = await this.scoreRepository(repository);
    scores.push(repoScore.score);
    if (repoScore.reason) reasons.push(repoScore.reason);

    // 3. Item freshness (0-20 points)
    const freshnessScore = this.scoreFreshness(item);
    scores.push(freshnessScore.score);
    if (freshnessScore.reason) reasons.push(freshnessScore.reason);

    // 4. User type (0-10 points)
    const userScore = await this.scoreUser(item.user.login, repository.id);
    scores.push(userScore.score);
    if (userScore.reason) reasons.push(userScore.reason);

    // Calculate total score (0-100)
    const totalScore = scores.reduce((sum, score) => sum + score, 0);

    // Determine priority level
    let priority: EventPriority;
    if (totalScore >= 80) {
      priority = 'critical';
    } else if (totalScore >= 60) {
      priority = 'high';
    } else if (totalScore >= 40) {
      priority = 'medium';
    } else {
      priority = 'low';
    }

    return {
      priority,
      score: totalScore,
      reasons,
    };
  }

  /**
   * Score event action importance (0-40 points)
   */
  private scoreAction(
    eventType: 'issues' | 'pull_request',
    action: string
  ): { score: number; reason?: string } {
    // Critical actions (40 points)
    if (action === 'opened') {
      return { score: 40, reason: 'New item created' };
    }

    // High priority actions (30 points)
    if (['reopened', 'ready_for_review'].includes(action)) {
      return { score: 30, reason: `Item ${action}` };
    }

    // Medium priority actions (20 points)
    if (['edited', 'synchronize', 'closed'].includes(action)) {
      return { score: 20, reason: `Content ${action}` };
    }

    // Low priority actions (10 points)
    if (['labeled', 'unlabeled', 'assigned', 'unassigned'].includes(action)) {
      return { score: 10, reason: `Metadata ${action}` };
    }

    // Very low priority (5 points)
    return { score: 5 };
  }

  /**
   * Score repository activity level (0-30 points)
   */
  private async scoreRepository(
    repository: Repository
  ): Promise<{ score: number; reason?: string }> {
    try {
      // Check cache first
      const cached = this.repoActivityCache.get(repository.id.toString());
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return { score: cached.score };
      }

      // Get recent activity count (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: recentActivity } = await supabase
        .from('issues')
        .select('id', { count: 'exact', head: true })
        .eq('repository_id', repository.id)
        .gte('created_at', sevenDaysAgo);

      const activityCount = recentActivity?.length || 0;

      // Score based on activity level
      let score = 0;
      let reason = '';

      if (activityCount >= 50) {
        score = 30;
        reason = 'Very active repository';
      } else if (activityCount >= 20) {
        score = 25;
        reason = 'Active repository';
      } else if (activityCount >= 10) {
        score = 20;
        reason = 'Moderate activity';
      } else if (activityCount >= 5) {
        score = 15;
        reason = 'Low activity';
      } else {
        score = 10;
        reason = 'Minimal activity';
      }

      // Cache the result
      this.repoActivityCache.set(repository.id.toString(), {
        score,
        timestamp: Date.now(),
      });

      return { score, reason };
    } catch (error) {
      console.error('Error scoring repository activity:', error);
      return { score: 15 }; // Default to medium-low
    }
  }

  /**
   * Score item freshness (0-20 points)
   */
  private scoreFreshness(item: Issue | PullRequest): { score: number; reason?: string } {
    const createdAt = new Date(item.created_at).getTime();
    const ageInHours = (Date.now() - createdAt) / (1000 * 60 * 60);

    if (ageInHours < 1) {
      return { score: 20, reason: 'Very fresh (<1 hour)' };
    } else if (ageInHours < 24) {
      return { score: 15, reason: 'Fresh (<1 day)' };
    } else if (ageInHours < 168) {
      return { score: 10, reason: 'Recent (<1 week)' };
    } else {
      return { score: 5, reason: 'Older (>1 week)' };
    }
  }

  /**
   * Score user type (0-10 points)
   */
  private async scoreUser(
    username: string,
    repositoryId: string | number
  ): Promise<{ score: number; reason?: string }> {
    try {
      // Check if user is a maintainer/frequent contributor
      const { data: contributor } = await supabase
        .from('contributors')
        .select('contributions_count, is_maintainer')
        .eq('github_login', username)
        .eq('repository_id', repositoryId)
        .maybeSingle();

      if (contributor?.is_maintainer) {
        return { score: 10, reason: 'Maintainer' };
      }

      if (contributor && contributor.contributions_count > 10) {
        return { score: 8, reason: 'Frequent contributor' };
      }

      if (contributor && contributor.contributions_count > 0) {
        return { score: 5, reason: 'Known contributor' };
      }

      return { score: 3, reason: 'New contributor' };
    } catch (error) {
      console.error('Error scoring user:', error);
      return { score: 5 }; // Default to medium
    }
  }

  /**
   * Check if repository is "active" (for quick checks)
   */
  async isActiveRepository(repositoryId: string | number): Promise<boolean> {
    try {
      const cached = this.repoActivityCache.get(repositoryId.toString());
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.score >= 20; // Active if score >= 20
      }

      // Fetch fresh data
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { count } = await supabase
        .from('issues')
        .select('*', { count: 'exact', head: true })
        .eq('repository_id', repositoryId)
        .gte('created_at', sevenDaysAgo);

      return (count || 0) >= 10; // Active if 10+ items in last 7 days
    } catch (error) {
      console.error('Error checking repository activity:', error);
      return false;
    }
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.repoActivityCache.clear();
  }
}

// Export singleton instance
export const eventPriorityService = EventPriorityService.getInstance();
