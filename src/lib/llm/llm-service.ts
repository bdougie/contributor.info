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
import type { DiscussionData, DiscussionSummaryMetadata } from './discussion-summary-types';
import type {
  ContributorPersona,
  PersonaType,
  QualityScoreBreakdown,
} from './contributor-enrichment-types';

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
    // Try PostHog first if enabled, but fall back to regular OpenAI if PostHog unavailable
    const posthogAvailable =
      this.options.enablePostHogTracking && posthogOpenAIService.isAvailable();
    const openAIAvailable = openAIService.isAvailable();
    return posthogAvailable || openAIAvailable;
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

    // Try generating summary with PostHog tracking, fall back to direct OpenAI if PostHog unavailable
    try {
      let insight: LLMInsight | null = null;

      if (this.options.enablePostHogTracking && posthogOpenAIService.isAvailable()) {
        insight = await this.generateContributorSummaryWithTracking(
          activityData,
          contributorInfo,
          metadata
        );
      }

      // If PostHog failed or unavailable, try direct OpenAI
      if (!insight && openAIService.isAvailable()) {
        console.log('[LLM Service] PostHog unavailable, using direct OpenAI');
        insight = await this.generateContributorSummaryDirect(activityData, contributorInfo);
      }

      if (insight && this.options.enableCaching) {
        // Cache for 24 hours (1440 minutes) - contributor activity is relatively stable
        cacheService.set(cacheKey, insight, dataHash, 1440);
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
      const result = await posthogOpenAIService.callOpenAI(prompt, model, {
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
      const response = await openAIService.callOpenAI(prompt, 'gpt-4o-mini');

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
    // Get actual PR and issue titles for context with null safety
    const recentPRTitles = (data.recentPRs || [])
      .slice(0, 5)
      .map((pr) => pr?.title)
      .filter((title): title is string => Boolean(title));

    const recentIssueTitles = (data.recentIssues || [])
      .slice(0, 5)
      .map((issue) => issue?.title)
      .filter((title): title is string => Boolean(title));

    // Get discussion participation context
    const recentDiscussions = (data.recentDiscussions || [])
      .slice(0, 5)
      .map((d) => `${d.title} (${d.category || 'Discussion'})${d.isAnswered ? ' [Answered]' : ''}`)
      .filter(Boolean);

    const prSummary = this.summarizePRActivity(data.recentPRs || []);
    const issueSummary = this.summarizeIssueActivity(data.recentIssues || []);
    const discussionSummary = this.summarizeDiscussionActivity(data.recentDiscussions || []);

    // Calculate age of most recent activity to determine if contributions are old
    let ageContext = '';
    const allDates = [
      ...(data.recentPRs || [])
        .map((pr) => pr.created_at)
        .filter((date): date is string => Boolean(date))
        .map((date) => new Date(date)),
      ...(data.recentIssues || [])
        .map((issue) => issue.created_at)
        .filter((date): date is string => Boolean(date))
        .map((date) => new Date(date)),
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
${recentIssueTitles.length > 0 ? recentIssueTitles.map((title) => `- ${title}`).join('\n') : 'None'}

${recentDiscussions.length > 0 ? `Recent Discussion Participation ${discussionSummary}:\n${recentDiscussions.map((d) => `- ${d}`).join('\n')}` : ''}${ageContext}

Create a summary that:
1. MUST start with "${contributor.login} recently..." (use exact username)
2. Identifies SPECIFIC areas they worked on (e.g., "authentication flow", "API endpoints", "UI components")
3. Describes the TYPE of work (features, fixes, refactoring, docs, testing)
4. Mentions impact or patterns (e.g., "improving performance", "adding new features", "fixing critical bugs")
5. If discussions are present, note their ENGAGEMENT STYLE:
   - Q&A participation (asking questions, providing answers)
   - Community help (answering others' questions)
   - Feature proposals or idea discussions
   - Active community engagement across multiple topics

Requirements:
- Maximum 30 words
- MUST start with "${contributor.login} recently..."
- Be SPECIFIC - avoid generic phrases like "general contributions" or "various features"
- Use technical details from the PR/issue/discussion titles
- If contributor is active in discussions, mention their community engagement pattern
- Third-person, professional tone

Good examples:
- "${contributor.login} recently implemented new authentication flow and API rate limiting, while actively helping users with setup questions in discussions."
- "${contributor.login} recently fixed critical payment bugs and proposed new caching architecture in community discussions."
- "${contributor.login} recently contributed UI improvements and answered multiple deployment-related questions in Q&A."
Bad: "Made general contributions to the codebase with various improvements."`;
  }

  /**
   * Extract focus areas from contributor activity with better detection
   */
  private extractFocusAreas(data: ContributorActivityData): string[] {
    if (data.primaryFocus) {
      return [data.primaryFocus];
    }

    // Combine all contribution titles for analysis
    const allTitles = [
      ...data.recentPRs.map((pr) => pr.title.toLowerCase()),
      ...data.recentIssues.map((issue) => issue.title.toLowerCase()),
    ].join(' ');

    const areas: string[] = [];

    // Authentication/Security
    if (allTitles.match(/\b(auth|login|security|permission|access|jwt|oauth|token|credential)\b/)) {
      areas.push('authentication');
    }

    // Frontend/UI
    if (allTitles.match(/\b(ui|component|style|css|design|layout|button|modal|form|page)\b/)) {
      areas.push('UI');
    }

    // Backend/API
    if (allTitles.match(/\b(api|endpoint|backend|server|database|query|migration)\b/)) {
      areas.push('API');
    }

    // Testing
    if (allTitles.match(/\b(test|spec|e2e|unit|integration|coverage)\b/)) {
      areas.push('testing');
    }

    // Documentation
    if (allTitles.match(/\b(doc|readme|guide|tutorial|comment)\b/)) {
      areas.push('documentation');
    }

    // Performance
    if (allTitles.match(/\b(performance|optimize|cache|speed|slow|fast|load)\b/)) {
      areas.push('performance');
    }

    // Bug fixes
    if (allTitles.match(/\b(fix|bug|issue|error|crash|broken)\b/)) {
      areas.push('bug fixes');
    }

    // Features
    if (allTitles.match(/\b(feature|add|implement|new|create)\b/)) {
      areas.push('features');
    }

    // Return up to 2 most relevant areas, or default
    return areas.length > 0 ? areas.slice(0, 2) : ['general development'];
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
   * Summarize discussion activity in concise format
   */
  private summarizeDiscussionActivity(
    discussions: ContributorActivityData['recentDiscussions']
  ): string {
    if (!discussions || discussions.length === 0) return '';

    const created = discussions.filter((d) => d.isAuthor).length;
    const participated = discussions.filter((d) => !d.isAuthor && d.commentCount > 0).length;
    const answered = discussions.filter((d) => d.isAnswered).length;

    const parts = [];
    if (created > 0) parts.push(`${created} created`);
    if (participated > 0) parts.push(`${participated} participated`);
    if (answered > 0) parts.push(`${answered} answered`);

    return parts.length > 0 ? `(${parts.join(', ')})` : '';
  }

  /**
   * Generate discussion summary for preview cards
   * Uses gpt-4o-mini model with 150 token limit for cost efficiency
   */
  async generateDiscussionSummary(
    discussionData: DiscussionData,
    metadata?: DiscussionSummaryMetadata & LLMCallMetadata
  ): Promise<LLMInsight | null> {
    const cacheKey = this.buildDiscussionCacheKey(
      metadata?.discussionId || 'unknown',
      discussionData
    );
    const dataHash = this.generateDataHash(discussionData);

    // Check cache first (24 hour TTL for discussion summaries)
    if (this.options.enableCaching) {
      const cached = cacheService.get(cacheKey, dataHash);
      if (cached) {
        return cached;
      }
    }

    // Try generating summary with PostHog tracking, fall back to direct OpenAI if PostHog unavailable
    try {
      let insight: LLMInsight | null = null;

      if (this.options.enablePostHogTracking && posthogOpenAIService.isAvailable()) {
        insight = await this.generateDiscussionSummaryWithTracking(discussionData, metadata);
      }

      // If PostHog failed or unavailable, try direct OpenAI
      if (!insight && openAIService.isAvailable()) {
        console.log('[LLM Service] PostHog unavailable, using direct OpenAI for discussion');
        insight = await this.generateDiscussionSummaryDirect(discussionData);
      }

      if (insight && this.options.enableCaching) {
        // Cache for 24 hours (1440 minutes) - discussions are relatively stable
        cacheService.set(cacheKey, insight, dataHash, 1440);
      }

      // If LLM unavailable, use fallback or return null
      if (!insight && this.options.enableFallbacks) {
        return this.generateFallbackDiscussionSummary(discussionData);
      }

      return insight;
    } catch (error) {
      console.error('LLM discussion summary failed:', error);

      if (this.options.enableFallbacks) {
        return this.generateFallbackDiscussionSummary(discussionData);
      }

      return null;
    }
  }

  /**
   * Generate discussion summary using PostHog-tracked service
   */
  private async generateDiscussionSummaryWithTracking(
    discussionData: DiscussionData,
    metadata?: LLMCallMetadata
  ): Promise<LLMInsight | null> {
    const prompt = this.buildDiscussionSummaryPrompt(discussionData);

    // Use gpt-4o-mini for simple summaries (cost-effective, 150 token limit)
    const model = 'gpt-4o-mini';

    try {
      const result = await posthogOpenAIService.callOpenAI(prompt, model, {
        feature: 'discussion-summary',
        userId: metadata?.userId,
        traceId: metadata?.traceId,
        ...metadata,
      });

      return {
        type: 'discussion_summary',
        content: result.content,
        confidence: 0.8,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('PostHog-tracked discussion summary generation failed:', error);
      return null;
    }
  }

  /**
   * Generate discussion summary directly (fallback when PostHog unavailable)
   */
  private async generateDiscussionSummaryDirect(
    discussionData: DiscussionData
  ): Promise<LLMInsight | null> {
    if (!openAIService.isAvailable()) {
      return null;
    }

    const prompt = this.buildDiscussionSummaryPrompt(discussionData);

    try {
      const response = await openAIService.callOpenAI(prompt, 'gpt-4o-mini');

      return {
        type: 'discussion_summary',
        content: response,
        confidence: 0.8,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Direct discussion summary generation failed:', error);
      return null;
    }
  }

  /**
   * Build prompt for discussion summary (1-2 sentences, focused on the question/topic)
   */
  private buildDiscussionSummaryPrompt(data: DiscussionData): string {
    // Truncate body if too long (first 500 chars for context)
    const bodyPreview = data.body ? data.body.substring(0, 500) : '';
    const categoryContext = data.category?.name ? ` in ${data.category.name}` : '';

    return `Generate a concise 1-2 sentence summary for this GitHub Discussion${categoryContext}:

Title: ${data.title}

Content: ${bodyPreview}${data.body && data.body.length > 500 ? '...' : ''}

Create a summary that:
1. Captures the MAIN QUESTION or TOPIC being discussed
2. Highlights KEY POINTS or ISSUES raised
3. Uses PLAIN TEXT (no markdown formatting)
4. Focuses on WHAT is being discussed, not who or when

Requirements:
- Maximum 150 characters
- Plain text only (no markdown, no asterisks, no formatting)
- Professional, clear language
- Start with the topic/question directly (no "This discussion is about...")

Good: "How to implement authentication with OAuth2 and handle token refresh for API requests"
Bad: "This discussion asks about implementing OAuth2 authentication and various token-related issues"`;
  }

  /**
   * Build cache key for discussion summaries
   */
  private buildDiscussionCacheKey(discussionId: string, discussionData: DiscussionData): string {
    const dataHash = this.generateDataHash(discussionData);
    return `discussion_summary:${discussionId}:${dataHash}`;
  }

  /**
   * Generate fallback summary when LLM fails
   */
  private generateFallbackDiscussionSummary(data: DiscussionData): LLMInsight {
    // Truncate title to reasonable length
    const title = data.title.length > 100 ? `${data.title.substring(0, 97)}...` : data.title;

    return {
      type: 'discussion_summary',
      content: title,
      confidence: 0.3, // Low confidence for fallback
      timestamp: new Date(),
    };
  }

  /**
   * Generate contributor persona detection using AI
   * Identifies contributor type, expertise, and engagement patterns
   */
  async generateContributorPersona(
    activityData: ContributorActivityData,
    topicClusters: string[],
    qualityMetrics: QualityScoreBreakdown,
    metadata?: LLMCallMetadata
  ): Promise<ContributorPersona | null> {
    const contributorLogin = metadata?.userId || 'unknown';
    const cacheKey = `contributor_persona:${contributorLogin}:${this.generateDataHash({ activityData, topicClusters, qualityMetrics })}`;

    // Check cache first (24 hour TTL for personas)
    if (this.options.enableCaching) {
      const cached = cacheService.get(cacheKey, '');
      if (cached) {
        return cached as unknown as ContributorPersona;
      }
    }

    try {
      const prompt = this.buildPersonaDetectionPrompt(activityData, topicClusters, qualityMetrics);

      let personaResult: string | null = null;

      // Try PostHog-tracked LLM first
      if (this.options.enablePostHogTracking && posthogOpenAIService.isAvailable()) {
        const result = await posthogOpenAIService.callOpenAI(prompt, 'gpt-4o-mini', {
          feature: 'persona-detection',
          userId: contributorLogin,
          traceId: metadata?.traceId,
          ...metadata,
        });
        personaResult = result.content;
      }

      // Fallback to direct OpenAI
      if (!personaResult && openAIService.isAvailable()) {
        personaResult = await openAIService.callOpenAI(prompt, 'gpt-4o-mini');
      }

      if (!personaResult) {
        console.warn('[Persona Detection] LLM unavailable, using heuristic fallback');
        return this.generateFallbackPersona(activityData, topicClusters, qualityMetrics);
      }

      // Parse JSON response
      const persona = this.parsePersonaResponse(personaResult, activityData, topicClusters);

      if (persona && this.options.enableCaching) {
        cacheService.set(cacheKey, persona as unknown as LLMInsight, '', 1440); // 24h cache
      }

      return persona;
    } catch (error) {
      console.error('[Persona Detection] Error generating persona:', error);
      return this.generateFallbackPersona(activityData, topicClusters, qualityMetrics);
    }
  }

  /**
   * Build prompt for persona detection
   */
  private buildPersonaDetectionPrompt(
    data: ContributorActivityData,
    topics: string[],
    quality: QualityScoreBreakdown
  ): string {
    // Analyze contribution titles for keywords
    const allTitles = [
      ...data.recentPRs.map((pr) => pr.title),
      ...data.recentIssues.map((issue) => issue.title),
      ...(data.recentDiscussions || []).map((d) => d.title),
    ].join('\n');

    // Analyze discussion participation
    const discussionEngagement = data.recentDiscussions || [];
    const answeredQuestions = discussionEngagement.filter(
      (d) => !d.isAuthor && d.isAnswered
    ).length;
    const askedQuestions = discussionEngagement.filter((d) => d.isAuthor).length;
    const participated = discussionEngagement.filter(
      (d) => !d.isAuthor && d.commentCount > 0
    ).length;

    return `Analyze this GitHub contributor's activity and identify their persona:

**Contribution Summary:**
- Total: ${data.totalContributions} contributions
- PRs: ${data.recentPRs.length} (${data.recentPRs.filter((pr) => pr.merged_at).length} merged)
- Issues: ${data.recentIssues.length}
- Discussions: ${discussionEngagement.length}
  - Answered others' questions: ${answeredQuestions}
  - Asked questions: ${askedQuestions}
  - Participated in discussions: ${participated}

**Primary Topics:** ${topics.length > 0 ? topics.join(', ') : 'General development'}

**Quality Metrics (0-100):**
- Discussion Impact: ${quality.discussionImpact}
- Code Review Depth: ${quality.codeReviewDepth}
- Issue Quality: ${quality.issueQuality}
- Mentor Score: ${quality.mentorScore}

**Recent Activity Titles:**
${allTitles.substring(0, 1000)}${allTitles.length > 1000 ? '...' : ''}

**Persona Types Available:**
1. "enterprise" - Asks about SSO, corporate proxies, compliance, enterprise features
2. "security" - Reports vulnerabilities, discusses authentication, security reviews
3. "performance" - Optimization PRs, benchmarks, performance discussions
4. "documentation" - README updates, doc improvements, guides
5. "bug_hunter" - Primarily reports bugs, finds edge cases
6. "feature_requester" - Requests new features, proposes enhancements
7. "community_helper" - Answers questions, mentors, helps others

Identify:
1. **Primary Persona** (1-2 types from list above based on activity patterns)
2. **Expertise Areas** (3-5 specific technical topics they focus on)
3. **Contribution Style**: "code" (mainly PRs), "discussion" (mainly issues/discussions), or "mixed"
4. **Engagement Pattern**:
   - "mentor" (helps others, high mentor score)
   - "learner" (asks questions, low mentor score)
   - "reporter" (mainly reports issues/bugs)
   - "builder" (mainly builds features via PRs)

Return ONLY valid JSON (no markdown):
{
  "type": ["persona1", "persona2"],
  "confidence": 0.85,
  "expertise": ["topic1", "topic2", "topic3"],
  "contributionStyle": "mixed",
  "engagementPattern": "mentor",
  "reasoning": "Brief explanation of why this persona was assigned"
}`;
  }

  /**
   * Parse LLM persona response
   */
  private parsePersonaResponse(
    response: string,
    _data: ContributorActivityData,
    topics: string[]
  ): ContributorPersona | null {
    try {
      // Extract JSON from response (may have markdown formatting)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('[Persona] No JSON found in response, using fallback');
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        type: Array.isArray(parsed.type) ? parsed.type : [parsed.type],
        confidence: parsed.confidence || 0.7,
        expertise: Array.isArray(parsed.expertise) ? parsed.expertise : topics.slice(0, 3),
        contributionStyle: parsed.contributionStyle || 'mixed',
        engagementPattern: parsed.engagementPattern || 'builder',
        reasoning: parsed.reasoning,
      };
    } catch (error) {
      console.error('[Persona] Failed to parse response:', error);
      return null;
    }
  }

  /**
   * Generate fallback persona using heuristics when LLM unavailable
   */
  private generateFallbackPersona(
    data: ContributorActivityData,
    topics: string[],
    quality: QualityScoreBreakdown
  ): ContributorPersona {
    const allTitles = [
      ...data.recentPRs.map((pr) => pr.title),
      ...data.recentIssues.map((issue) => issue.title),
    ]
      .join(' ')
      .toLowerCase();

    const personas: Array<{ type: string; score: number }> = [];

    // Enterprise detection
    if (allTitles.match(/\b(sso|saml|proxy|corporate|enterprise|compliance|ldap)\b/)) {
      personas.push({ type: 'enterprise', score: 0.8 });
    }

    // Security detection
    if (allTitles.match(/\b(security|vulnerability|xss|csrf|auth|authentication|encryption)\b/)) {
      personas.push({ type: 'security', score: 0.9 });
    }

    // Performance detection
    if (allTitles.match(/\b(performance|optimize|slow|fast|cache|benchmark|latency)\b/)) {
      personas.push({ type: 'performance', score: 0.85 });
    }

    // Documentation detection
    if (allTitles.match(/\b(doc|readme|guide|tutorial|documentation)\b/)) {
      personas.push({ type: 'documentation', score: 0.7 });
    }

    // Bug hunter detection
    const bugKeywords = allTitles.match(/\b(bug|fix|error|crash|issue|broken)\b/g);
    if (bugKeywords && bugKeywords.length > data.totalContributions * 0.5) {
      personas.push({ type: 'bug_hunter', score: 0.8 });
    }

    // Feature requester detection
    const featureKeywords = allTitles.match(/\b(feature|add|implement|new|request|proposal)\b/g);
    if (featureKeywords && featureKeywords.length > data.totalContributions * 0.4) {
      personas.push({ type: 'feature_requester', score: 0.75 });
    }

    // Community helper detection (based on mentor score)
    if (quality.mentorScore > 60) {
      personas.push({ type: 'community_helper', score: quality.mentorScore / 100 });
    }

    // Sort by score and take top 2
    personas.sort((a, b) => b.score - a.score);
    const topPersonas = personas.slice(0, 2).map((p) => p.type);

    // Determine contribution style
    const prCount = data.recentPRs.length;
    const discussionCount = (data.recentDiscussions || []).length + data.recentIssues.length;
    let style: 'code' | 'discussion' | 'mixed' = 'mixed';

    if (prCount > discussionCount * 2) {
      style = 'code';
    } else if (discussionCount > prCount * 2) {
      style = 'discussion';
    }

    // Determine engagement pattern
    let pattern: 'mentor' | 'learner' | 'reporter' | 'builder' = 'builder';

    if (quality.mentorScore > 70) {
      pattern = 'mentor';
    } else if (quality.issueQuality > quality.codeReviewDepth && data.recentPRs.length < 3) {
      pattern = 'reporter';
    } else if (data.recentIssues.length > data.recentPRs.length && quality.discussionImpact < 50) {
      pattern = 'learner';
    }

    return {
      type: (topPersonas.length > 0 ? topPersonas : ['builder']) as PersonaType[],
      confidence: personas[0]?.score || 0.6,
      expertise: topics.slice(0, 3),
      contributionStyle: style,
      engagementPattern: pattern,
      reasoning: 'Generated using heuristic analysis (LLM unavailable)',
    };
  }

  /**
   * Build cache key for contributor summaries
   */
  private buildContributorCacheKey(login: string, activityData: ContributorActivityData): string {
    const dataHash = this.generateDataHash(activityData);
    return `contributor_summary:${login}:${dataHash}`;
  }

  /**
   * Generate fallback summary when LLM fails - using actual contribution data for specificity
   */
  private generateFallbackContributorSummary(data: ContributorActivityData): LLMInsight {
    const merged = data.recentPRs.filter((pr) => pr.merged_at).length;
    const open = data.recentPRs.filter((pr) => pr.state === 'open' && !pr.merged_at).length;
    const issues = data.recentIssues.length;
    const discussions = data.recentDiscussions?.length || 0;

    // Extract focus areas (now returns array)
    const focusAreas = this.extractFocusAreas(data);

    // Get a specific example from recent work
    const recentWork = this.extractRecentWorkExample(data);

    // Build summary based on contribution pattern
    let content = '';

    if (merged > 0 && recentWork) {
      // Most specific: mention actual work
      const focus = focusAreas.slice(0, 2).join(' and ');
      content = `${recentWork}${focus ? ` (${focus})` : ''}`;

      // Add discussion engagement if present
      if (discussions > 2) {
        content += `, active in discussions`;
      } else if (discussions > 0) {
        content += `, participates in discussions`;
      }
    } else if (merged > 0) {
      // Fallback to focus areas
      const focus = focusAreas.slice(0, 2).join(' and ');
      content = `Contributed ${merged} merged PR${merged > 1 ? 's' : ''} in ${focus}`;

      if (discussions > 0) {
        content += ` and ${discussions} discussion${discussions > 1 ? 's' : ''}`;
      }
    } else if (open > 0) {
      // Open PRs only
      const focus = focusAreas.slice(0, 2).join(' and ');
      content = `${open} open PR${open > 1 ? 's' : ''} in ${focus}`;
    } else if (issues > 0) {
      // Issues only
      const focus = focusAreas.slice(0, 2).join(' and ');
      content = `Reported ${issues} issue${issues > 1 ? 's' : ''} in ${focus}`;
    } else if (discussions > 0) {
      // Discussions only
      content = `Active in ${discussions} discussion${discussions > 1 ? 's' : ''}`;
    } else {
      // Ultimate fallback
      content = 'Recent contributor to this repository';
    }

    return {
      type: 'contributor_summary',
      content,
      confidence: 0.6, // Higher confidence now that we use real data
      timestamp: new Date(),
    };
  }

  /**
   * Extract a specific example of recent work from contributions
   */
  private extractRecentWorkExample(data: ContributorActivityData): string | null {
    // Try to get the most recent merged PR title
    const mergedPRs = data.recentPRs.filter((pr) => pr.merged_at);
    if (mergedPRs.length > 0) {
      const mostRecent = mergedPRs[0];

      // Clean up the title first (remove conventional commit prefixes)
      let cleanTitle = mostRecent.title.replace(
        /^(fix|feat|chore|docs|style|refactor|test|perf):\s*/i,
        ''
      );

      // Extract key verb/action
      const verbs = {
        fix: 'Fixed',
        add: 'Added',
        update: 'Updated',
        improve: 'Improved',
        refactor: 'Refactored',
        remove: 'Removed',
        implement: 'Implemented',
        create: 'Created',
      };

      const titleLower = cleanTitle.toLowerCase();
      let prefix = '';

      for (const [keyword, verb] of Object.entries(verbs)) {
        if (titleLower.startsWith(keyword) || titleLower.includes(` ${keyword} `)) {
          prefix = verb;
          // Remove the verb from the title since we'll use it as prefix
          cleanTitle = cleanTitle.replace(new RegExp(`^${keyword}\\s+`, 'i'), '');
          cleanTitle = cleanTitle.replace(new RegExp(`\\s+${keyword}\\s+`, 'i'), ' ');
          break;
        }
      }

      // Truncate to ~80 chars max (leaves room for focus areas in parentheses)
      // Only add ellipsis if we actually truncated
      let finalTitle = cleanTitle;
      if (cleanTitle.length > 80) {
        finalTitle = cleanTitle.substring(0, 77) + '...';
      }

      // Build the final string
      if (prefix) {
        return `${prefix} ${finalTitle.charAt(0).toLowerCase()}${finalTitle.slice(1)}`;
      } else {
        return `Contributed: ${finalTitle.charAt(0).toLowerCase()}${finalTitle.slice(1)}`;
      }
    }

    // Try recent issues
    if (data.recentIssues.length > 0) {
      const issue = data.recentIssues[0];
      let cleanTitle = issue.title.replace(
        /^(fix|feat|chore|docs|style|refactor|test|perf):\s*/i,
        ''
      );

      // Truncate to ~80 chars
      if (cleanTitle.length > 80) {
        cleanTitle = cleanTitle.substring(0, 77) + '...';
      }

      return `Reported: ${cleanTitle.charAt(0).toLowerCase()}${cleanTitle.slice(1)}`;
    }

    return null;
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
    data:
      | HealthData
      | RecommendationData
      | PRData[]
      | ContributorActivityData
      | DiscussionData
      | {
          activityData: ContributorActivityData;
          topicClusters: string[];
          qualityMetrics: QualityScoreBreakdown;
        }
      | Record<string, unknown>
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
