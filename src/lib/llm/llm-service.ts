/**
 * LLM Service with caching and fallbacks
 * Manages multiple LLM providers and implements smart caching
 * Now supports PostHog LLM analytics for comprehensive observability
 */

import { openAIService, type LLMInsight } from './openai-service';
import { posthogOpenAIService, type LLMCallMetadata } from './posthog-openai-service';
import { cacheService } from './cache-service';

// Re-export types from posthog-openai-service
import type { HealthData, RecommendationData, PRData } from './posthog-openai-service';
import type {
  ContributorActivityData,
  ContributorSummaryMetadata,
} from './contributor-summary-types';

export interface LLMServiceOptions {
  enableCaching: boolean;
  cacheExpiryMinutes: number;
  enableFallbacks: boolean;
  enablePostHogTracking: boolean;
}

class LLMService {
  private options: LLMServiceOptions;

  constructor(options: Partial<LLMServiceOptions> = {}) {
    this.options = {
      enableCaching: true,
      cacheExpiryMinutes: 60, // 1 hour default
      enableFallbacks: true,
      enablePostHogTracking: true,
      ...options,
    };
  }

  /**
   * Check if any LLM service is available
   */
  isAvailable(): boolean {
    return this.options.enablePostHogTracking
      ? posthogOpenAIService.isAvailable()
      : openAIService.isAvailable();
  }

  /**
   * Check if PostHog tracking is enabled and available
   */
  isTrackingEnabled(): boolean {
    return this.options.enablePostHogTracking && posthogOpenAIService.isTrackingEnabled();
  }

  /**
   * Generate health insight with caching and optional PostHog tracking
   */
  async generateHealthInsight(
    healthData: HealthData,
    repoInfo: { owner: string; repo: string },
    metadata?: LLMCallMetadata
  ): Promise<LLMInsight | null> {
    const cacheKey = this.buildCacheKey('health', repoInfo, healthData.score);
    const dataHash = this.generateDataHash(healthData);

    // Check cache first
    if (this.options.enableCaching) {
      const cached = cacheService.get(cacheKey, dataHash);
      if (cached) {
        return cached;
      }
    }

    // Try OpenAI service (with or without PostHog tracking)
    try {
      // Ensure healthData has required fields for openAIService
      const normalizedHealthData = {
        ...healthData,
        trend: healthData.trend || 'stable',
        recommendations: healthData.recommendations || [],
      };

      const insight = this.options.enablePostHogTracking
        ? await posthogOpenAIService.generateHealthInsight(healthData, repoInfo, metadata)
        : await openAIService.generateHealthInsight(normalizedHealthData, repoInfo);

      if (insight && this.options.enableCaching) {
        cacheService.set(cacheKey, insight, dataHash);
      }

      // If OpenAI is unavailable (returns null), use fallback
      if (!insight && this.options.enableFallbacks) {
        return this.generateFallbackHealthInsight(healthData);
      }

      return insight;
    } catch (error) {
      console.error('LLM health insight failed:', error);

      if (this.options.enableFallbacks) {
        return this.generateFallbackHealthInsight(healthData);
      }

      return null;
    }
  }

  /**
   * Generate recommendations with caching and optional PostHog tracking
   */
  async generateRecommendations(
    data: RecommendationData,
    repoInfo: { owner: string; repo: string },
    metadata?: LLMCallMetadata
  ): Promise<LLMInsight | null> {
    const cacheKey = this.buildCacheKey('recommendations', repoInfo, data.health?.score || 0);
    const dataHash = this.generateDataHash(data);

    // Check cache first
    if (this.options.enableCaching) {
      const cached = cacheService.get(cacheKey, dataHash);
      if (cached) {
        return cached;
      }
    }

    // Try OpenAI service (with or without PostHog tracking)
    try {
      const insight = this.options.enablePostHogTracking
        ? await posthogOpenAIService.generateRecommendations(data, repoInfo, metadata)
        : await openAIService.generateRecommendations(data, repoInfo);

      if (insight && this.options.enableCaching) {
        cacheService.set(cacheKey, insight, dataHash);
      }

      // If OpenAI is unavailable (returns null), use fallback
      if (!insight && this.options.enableFallbacks) {
        return this.generateFallbackRecommendations(data);
      }

      return insight;
    } catch (error) {
      console.error('LLM recommendations failed:', error);

      if (this.options.enableFallbacks) {
        return this.generateFallbackRecommendations(data);
      }

      return null;
    }
  }

  /**
   * Analyze PR patterns with caching and optional PostHog tracking
   */
  async analyzePRPatterns(
    prData: PRData[],
    repoInfo: { owner: string; repo: string },
    metadata?: LLMCallMetadata
  ): Promise<LLMInsight | null> {
    const cacheKey = this.buildCacheKey('patterns', repoInfo, prData.length);
    const dataHash = this.generateDataHash(prData);

    // Check cache first
    if (this.options.enableCaching) {
      const cached = cacheService.get(cacheKey, dataHash);
      if (cached) {
        return cached;
      }
    }

    // Try OpenAI service (with or without PostHog tracking)
    try {
      // Ensure prData has required fields for openAIService
      const normalizedPRData = prData.map((pr) => ({
        ...pr,
        additions: pr.additions || 0,
        deletions: pr.deletions || 0,
      }));

      const insight = this.options.enablePostHogTracking
        ? await posthogOpenAIService.analyzePRPatterns(prData, repoInfo, metadata)
        : await openAIService.analyzePRPatterns(normalizedPRData, repoInfo);

      if (insight && this.options.enableCaching) {
        cacheService.set(cacheKey, insight, dataHash);
      }

      // If OpenAI is unavailable (returns null), use fallback
      if (!insight && this.options.enableFallbacks) {
        return this.generateFallbackPatternInsight(prData);
      }

      return insight;
    } catch (error) {
      console.error('LLM pattern analysis failed:', error);

      if (this.options.enableFallbacks) {
        return this.generateFallbackPatternInsight(prData);
      }

      return null;
    }
  }

  /**
   * Generate contributor activity summary for hover cards
   * Uses gpt-4o-mini model with 200 token limit for cost efficiency
   */
  async generateContributorSummary(
    activityData: ContributorActivityData,
    contributorInfo: ContributorSummaryMetadata,
    metadata?: LLMCallMetadata
  ): Promise<LLMInsight | null> {
    const cacheKey = this.buildContributorCacheKey(contributorInfo.login, activityData);
    const dataHash = this.generateDataHash(activityData);

    // Check cache first (6 hour TTL for contributor summaries)
    if (this.options.enableCaching) {
      const cached = cacheService.get(cacheKey, dataHash);
      if (cached) {
        return cached;
      }
    }

    // Try generating summary with PostHog tracking
    try {
      const insight = this.options.enablePostHogTracking
        ? await this.generateContributorSummaryWithTracking(activityData, contributorInfo, metadata)
        : await this.generateContributorSummaryDirect(activityData, contributorInfo);

      if (insight && this.options.enableCaching) {
        // Cache for 6 hours (360 minutes) - contributor activity is relatively stable
        cacheService.set(cacheKey, insight, dataHash, 360);
      }

      // If LLM unavailable, use fallback or return null (hover card will hide summary)
      if (!insight && this.options.enableFallbacks) {
        return this.generateFallbackContributorSummary(activityData);
      }

      return insight;
    } catch (error) {
      console.error('LLM contributor summary failed:', error);

      if (this.options.enableFallbacks) {
        return this.generateFallbackContributorSummary(activityData);
      }

      return null;
    }
  }

  /**
   * Generate contributor summary using PostHog-tracked service
   */
  private async generateContributorSummaryWithTracking(
    activityData: ContributorActivityData,
    contributorInfo: ContributorSummaryMetadata,
    metadata?: LLMCallMetadata
  ): Promise<LLMInsight | null> {
    const prompt = this.buildContributorSummaryPrompt(activityData, contributorInfo);

    // Use gpt-4o-mini for simple summaries (cost-effective, 200 token limit)
    const model = 'gpt-4o-mini';

    try {
      // Note: PostHog service uses maxTokens from config (500), but prompt enforces 30 word limit
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (posthogOpenAIService as any).callOpenAI(prompt, model, {
        feature: 'contributor-summary',
        userId: metadata?.userId,
        traceId: metadata?.traceId,
        ...metadata,
      });

      return {
        type: 'contributor_summary',
        content: result.content,
        confidence: 0.8, // Good confidence for AI-generated summaries
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('PostHog-tracked summary generation failed:', error);
      return null;
    }
  }

  /**
   * Generate contributor summary directly (fallback when PostHog unavailable)
   */
  private async generateContributorSummaryDirect(
    activityData: ContributorActivityData,
    contributorInfo: ContributorSummaryMetadata
  ): Promise<LLMInsight | null> {
    if (!openAIService.isAvailable()) {
      return null;
    }

    const prompt = this.buildContributorSummaryPrompt(activityData, contributorInfo);

    try {
      // Call OpenAI directly with low token count
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (openAIService as any).callOpenAI(prompt, 'gpt-4o-mini');

      return {
        type: 'contributor_summary',
        content: response,
        confidence: 0.8,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Direct summary generation failed:', error);
      return null;
    }
  }

  /**
   * Build prompt for contributor summary (1-2 sentences, persona-focused)
   */
  private buildContributorSummaryPrompt(
    data: ContributorActivityData,
    contributor: ContributorSummaryMetadata
  ): string {
    // Get actual PR and issue titles for context
    const recentPRTitles = data.recentPRs.slice(0, 5).map((pr) => pr.title);
    const recentIssueTitles = data.recentIssues.slice(0, 5).map((issue) => issue.title);

    const prSummary = this.summarizePRActivity(data.recentPRs);
    const issueSummary = this.summarizeIssueActivity(data.recentIssues);

    // Calculate age of most recent activity to determine if contributions are old
    let ageContext = '';
    const allDates = [
      ...data.recentPRs.map((pr) => new Date(pr.created_at)),
      ...data.recentIssues.map((issue) => new Date(issue.created_at)),
    ].filter((date) => !isNaN(date.getTime()));

    if (allDates.length > 0) {
      const mostRecent = new Date(Math.max(...allDates.map((d) => d.getTime())));
      const daysAgo = Math.floor((Date.now() - mostRecent.getTime()) / (1000 * 60 * 60 * 24));

      if (daysAgo > 30) {
        const monthsAgo = Math.floor(daysAgo / 30);
        ageContext = `\n\nIMPORTANT: Most recent activity was ${monthsAgo} month${monthsAgo > 1 ? 's' : ''} ago. Mention this timeframe in the summary (e.g., "in recent months" or "${monthsAgo} months ago").`;
      } else if (daysAgo > 14) {
        ageContext = `\n\nIMPORTANT: Most recent activity was ${daysAgo} days ago. Mention this timeframe (e.g., "in recent weeks").`;
      }
    }

    return `Generate a specific, actionable 1-2 sentence summary for GitHub contributor ${contributor.login} based on their recent work:

Recent Pull Requests ${prSummary}:
${recentPRTitles.length > 0 ? recentPRTitles.map((title) => `- ${title}`).join('\n') : 'None'}

Recent Issues ${issueSummary}:
${recentIssueTitles.length > 0 ? recentIssueTitles.map((title) => `- ${title}`).join('\n') : 'None'}${ageContext}

Create a summary that:
1. MUST start with "${contributor.login} recently..." (use exact username)
2. Identifies SPECIFIC areas they worked on (e.g., "authentication flow", "API endpoints", "UI components")
3. Describes the TYPE of work (features, fixes, refactoring, docs, testing)
4. Mentions impact or patterns (e.g., "improving performance", "adding new features", "fixing critical bugs")

Requirements:
- Maximum 30 words
- MUST start with "${contributor.login} recently..."
- Be SPECIFIC - avoid generic phrases like "general contributions" or "various features"
- Use technical details from the PR/issue titles
- Third-person, professional tone

Good: "${contributor.login} recently implemented new authentication flow and API rate limiting, fixing critical bugs in payment processing."
Bad: "Made general contributions to the codebase with various improvements."`;
  }

  /**
   * Extract focus areas from contributor activity
   */
  private extractFocusAreas(data: ContributorActivityData): string {
    if (data.primaryFocus) {
      return data.primaryFocus;
    }

    // Infer from PR titles
    const titles = data.recentPRs.map((pr) => pr.title.toLowerCase()).join(' ');

    if (titles.includes('auth') || titles.includes('login') || titles.includes('security')) {
      return 'authentication/security';
    }
    if (titles.includes('ui') || titles.includes('component') || titles.includes('style')) {
      return 'frontend/UI';
    }
    if (titles.includes('api') || titles.includes('endpoint') || titles.includes('backend')) {
      return 'backend/API';
    }
    if (titles.includes('test') || titles.includes('spec')) {
      return 'testing/quality';
    }
    if (titles.includes('doc') || titles.includes('readme')) {
      return 'documentation';
    }

    return 'general development';
  }

  /**
   * Summarize PR activity in concise format
   */
  private summarizePRActivity(prs: ContributorActivityData['recentPRs']): string {
    if (prs.length === 0) return 'none';

    const merged = prs.filter((pr) => pr.merged_at).length;
    const open = prs.filter((pr) => pr.state === 'open' && !pr.merged_at).length;

    if (merged > 0 && open > 0) {
      return `(${merged} merged, ${open} open)`;
    } else if (merged > 0) {
      return `(${merged} merged)`;
    } else if (open > 0) {
      return `(${open} open)`;
    }

    return '';
  }

  /**
   * Summarize issue activity in concise format
   */
  private summarizeIssueActivity(issues: ContributorActivityData['recentIssues']): string {
    if (issues.length === 0) return 'none';

    const open = issues.filter((issue) => issue.state === 'open').length;
    const closed = issues.filter((issue) => issue.state === 'closed').length;

    if (open > 0 && closed > 0) {
      return `(${open} open, ${closed} closed)`;
    } else if (open > 0) {
      return `(${open} open)`;
    } else if (closed > 0) {
      return `(${closed} closed)`;
    }

    return '';
  }

  /**
   * Build cache key for contributor summaries
   */
  private buildContributorCacheKey(login: string, activityData: ContributorActivityData): string {
    const dataHash = this.generateDataHash(activityData);
    return `contributor_summary:${login}:${dataHash}`;
  }

  /**
   * Generate fallback summary when LLM fails
   */
  private generateFallbackContributorSummary(data: ContributorActivityData): LLMInsight {
    const merged = data.recentPRs.filter((pr) => pr.merged_at).length;
    const contributionType = merged > 3 ? 'Active contributor' : 'Contributor';
    const focus = data.primaryFocus || this.extractFocusAreas(data);

    const content = `${contributionType} focusing on ${focus}. ${merged} merged PRs recently.`;

    return {
      type: 'contributor_summary',
      content,
      confidence: 0.5, // Lower confidence for fallback
      timestamp: new Date(),
    };
  }

  /**
   * Clear all cached insights
   */
  clearCache(): void {
    cacheService.clear();
  }

  /**
   * Clear expired cache entries
   */
  cleanupCache(): void {
    cacheService.cleanup();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return cacheService.getStats();
  }

  /**
   * Invalidate cache for a specific repository
   */
  invalidateRepository(owner: string, repo: string): void {
    cacheService.invalidateRepository(owner, repo);
  }

  /**
   * Build cache key from parameters
   */
  private buildCacheKey(
    type: string,
    repoInfo: { owner: string; repo: string },
    dataHash: number
  ): string {
    return `${type}:${repoInfo.owner}/${repoInfo.repo}:${dataHash}`;
  }

  /**
   * Generate hash from data for cache invalidation
   */
  private generateDataHash(
    data: HealthData | RecommendationData | PRData[] | ContributorActivityData
  ): string {
    // Simple hash function for data changes detection
    const dataString = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Generate fallback health insight when LLM fails
   */
  private generateFallbackHealthInsight(healthData: HealthData): LLMInsight {
    let content = '';

    if (healthData.score >= 80) {
      content =
        'Repository health is excellent. Continue maintaining current development practices and code review standards.';
    } else if (healthData.score >= 60) {
      content =
        'Repository health is good with room for improvement. Focus on the areas marked as warnings to further optimize your workflow.';
    } else {
      content =
        'Repository health needs attention. Address critical issues first, particularly in areas with the lowest scores.';
    }

    // Add specific recommendations from the data
    const criticalFactors =
      healthData.factors?.filter(
        (f: { status: string; name: string }) => f.status === 'critical'
      ) || [];
    if (criticalFactors.length > 0) {
      content += ` Priority: ${criticalFactors[0].name.toLowerCase()}.`;
    }

    return {
      type: 'health',
      content,
      confidence: 0.6, // Lower confidence for fallback
      timestamp: new Date(),
    };
  }

  /**
   * Generate fallback recommendations when LLM fails
   */
  private generateFallbackRecommendations(data: RecommendationData): LLMInsight {
    const recommendations = [];

    if (data.health?.score < 70) {
      recommendations.push('Improve code review coverage to increase repository health');
    }

    if (data.activity?.weeklyVelocity && data.activity.weeklyVelocity < 5) {
      recommendations.push('Consider breaking down large PRs to increase development velocity');
    }

    recommendations.push('Monitor PR merge times and establish review SLAs');

    const content = recommendations
      .slice(0, 3)
      .map((rec, i) => `${i + 1}. ${rec}`)
      .join('\n');

    return {
      type: 'recommendation',
      content: content || 'Continue following development best practices.',
      confidence: 0.5,
      timestamp: new Date(),
    };
  }

  /**
   * Generate fallback pattern insight when LLM fails
   */
  private generateFallbackPatternInsight(prData: Array<{ merged_at: string | null }>): LLMInsight {
    const totalPRs = prData.length;
    const merged = prData.filter((pr) => pr.merged_at).length;
    const mergeRate = totalPRs > 0 ? Math.round((merged / totalPRs) * 100) : 0;

    let content = `Analyzed ${totalPRs} PRs with ${mergeRate}% merge rate. `;

    if (mergeRate >= 80) {
      content += 'Strong PR completion rate indicates healthy development workflow.';
    } else if (mergeRate >= 60) {
      content += 'Good PR workflow with opportunity to reduce abandoned PRs.';
    } else {
      content += 'Consider reviewing PR process to improve completion rates.';
    }

    return {
      type: 'pattern',
      content,
      confidence: 0.5,
      timestamp: new Date(),
    };
  }
}

// Export singleton instance
export const llmService = new LLMService();

/**
 * Ensure proper shutdown of PostHog tracking
 */
export const shutdownLLMService = async (): Promise<void> => {
  if (posthogOpenAIService) {
    await posthogOpenAIService.shutdown();
  }
};

// Export types
export type { LLMInsight, LLMCallMetadata };
