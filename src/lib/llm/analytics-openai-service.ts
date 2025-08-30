/**
 * Advanced Analytics OpenAI service for contributor classification and insights
 * Extends the base OpenAI service with AI-powered analytics capabilities
 */

import type { 
  ContributorClassification, 
  ContributorHealthMetrics,
  ContributionConsistencyMetrics,
  CommunityROIMetrics,
  ExecutiveSummaryMetrics 
} from '@/lib/types/advanced-analytics';

export interface AIContributorInsight {
  type: 'impact' | 'growth' | 'collaboration' | 'achievement' | 'success_story';
  narrative: string; // AI-generated natural language insight
  confidence: number; // 0-1 AI confidence score
  evidence: string[]; // Supporting data points
  recommendations: string[]; // AI-suggested actions
  aiModel: string; // GPT model used
  generated_at: Date;
}

export interface AIAnalyticsConfig {
  model: string;
  fallbackModel: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
  cacheTTL: number; // Cache time-to-live in hours
}

export interface ContributorData {
  login: string;
  avatar_url?: string;
  pullRequests: any[];
  issues: any[];
  reviews: any[];
  commits: any[];
  profile?: any;
}

export interface CommunityMetrics {
  totalContributors: number;
  activeContributors: number;
  newContributors: number;
  prVelocity: number;
  reviewTurnoverTime: number;
  communityGrowth: number;
}

class AnalyticsOpenAIService {
  private apiKey: string | undefined;
  private baseUrl = 'https://api.openai.com/v1';
  private config: AIAnalyticsConfig;
  private cache = new Map<string, { data: any; timestamp: number }>();

  constructor() {
    this.apiKey = import.meta.env?.VITE_OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
    
    this.config = {
      model: 'gpt-4o-mini', // High-quota model for basic operations
      fallbackModel: 'gpt-4o', // Premium model for complex analysis
      maxTokens: 800,
      temperature: 0.2, // Lower temperature for more consistent analytical insights
      timeout: 15000,
      cacheTTL: 24, // Cache AI insights for 24 hours
    };
  }

  /**
   * Check if OpenAI service is available
   */
  isAvailable(): boolean {
    return !!this.apiKey && this.apiKey !== 'test-key-for-ci';
  }

  /**
   * Generate AI-powered contributor impact analysis
   */
  async analyzeContributorImpact(
    contributorData: ContributorData,
    repoContext: { owner: string; repo: string; description?: string }
  ): Promise<AIContributorInsight | null> {
    if (!this.isAvailable()) return null;

    const cacheKey = `impact_${contributorData.login}_${repoContext.owner}_${repoContext.repo}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const prompt = this.buildContributorImpactPrompt(contributorData, repoContext);
    
    try {
      const response = await this.callOpenAI(prompt, 'gpt-4o-mini'); // Use efficient model for impact analysis
      const insight = this.parseContributorInsight(response, 'impact', contributorData.login);
      
      this.setCache(cacheKey, insight);
      return insight;
    } catch (error) {
      console.error(`Failed to analyze contributor impact for ${contributorData.login}:`, error);
      return null;
    }
  }

  /**
   * Identify rising star contributors using AI pattern recognition
   */
  async identifyRisingStars(
    contributors: ContributorData[],
    repoContext: { owner: string; repo: string },
    timeRange: '30d' | '60d' | '90d' = '60d'
  ): Promise<AIContributorInsight[]> {
    if (!this.isAvailable()) return [];

    const cacheKey = `rising_stars_${repoContext.owner}_${repoContext.repo}_${timeRange}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const prompt = this.buildRisingStarsPrompt(contributors, repoContext, timeRange);
    
    try {
      const response = await this.callOpenAI(prompt, 'gpt-4o'); // Use premium model for complex pattern analysis
      const insights = this.parseMultipleInsights(response, 'growth');
      
      this.setCache(cacheKey, insights);
      return insights;
    } catch (error) {
      console.error('Failed to identify rising stars:', error);
      return [];
    }
  }

  /**
   * Generate community success metrics with AI insights
   */
  async analyzeCommunitySuccess(
    metrics: CommunityMetrics,
    contributorData: ContributorData[],
    repoContext: { owner: string; repo: string }
  ): Promise<AIContributorInsight | null> {
    if (!this.isAvailable()) return null;

    const cacheKey = `community_success_${repoContext.owner}_${repoContext.repo}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const prompt = this.buildCommunitySuccessPrompt(metrics, contributorData, repoContext);
    
    try {
      const response = await this.callOpenAI(prompt, 'gpt-4o-mini');
      const insight = this.parseContributorInsight(response, 'success_story', 'community');
      
      this.setCache(cacheKey, insight);
      return insight;
    } catch (error) {
      console.error('Failed to analyze community success:', error);
      return null;
    }
  }

  /**
   * Generate achievement-focused contributor narratives
   */
  async generateAchievementNarrative(
    contributor: ContributorData,
    achievements: Array<{
      type: string;
      value: number;
      milestone: string;
      date: Date;
    }>,
    repoContext: { owner: string; repo: string }
  ): Promise<AIContributorInsight | null> {
    if (!this.isAvailable()) return null;

    const cacheKey = `achievement_${contributor.login}_${achievements.length}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const prompt = this.buildAchievementPrompt(contributor, achievements, repoContext);
    
    try {
      const response = await this.callOpenAI(prompt, 'gpt-4o-mini');
      const insight = this.parseContributorInsight(response, 'achievement', contributor.login);
      
      this.setCache(cacheKey, insight);
      return insight;
    } catch (error) {
      console.error(`Failed to generate achievement narrative for ${contributor.login}:`, error);
      return null;
    }
  }

  /**
   * Generate executive summary with AI-powered insights
   */
  async generateExecutiveSummary(
    metrics: ExecutiveSummaryMetrics,
    topContributors: ContributorData[],
    trends: Array<{ metric: string; change: number; direction: string }>
  ): Promise<AIContributorInsight | null> {
    if (!this.isAvailable()) return null;

    const cacheKey = `executive_${metrics.repository.full_name}_${metrics.timestamp}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const prompt = this.buildExecutiveSummaryPrompt(metrics, topContributors, trends);
    
    try {
      const response = await this.callOpenAI(prompt, 'gpt-4o'); // Use premium model for executive insights
      const insight = this.parseContributorInsight(response, 'success_story', 'executive');
      
      this.setCache(cacheKey, insight);
      return insight;
    } catch (error) {
      console.error('Failed to generate executive summary:', error);
      return null;
    }
  }

  /**
   * Build prompt for contributor impact analysis
   */
  private buildContributorImpactPrompt(
    contributor: ContributorData,
    repoContext: { owner: string; repo: string; description?: string }
  ): string {
    const prCount = contributor.pullRequests.length;
    const mergedPRs = contributor.pullRequests.filter(pr => pr.merged_at).length;
    const reviewCount = contributor.reviews.length;
    const issueCount = contributor.issues.length;

    return `Analyze the positive impact of contributor @${contributor.login} in repository ${repoContext.owner}/${repoContext.repo}:

CONTRIBUTION METRICS:
- Pull Requests: ${prCount} total, ${mergedPRs} merged (${Math.round((mergedPRs/prCount) * 100)}% success rate)
- Code Reviews: ${reviewCount} reviews provided
- Issues: ${issueCount} issues engaged with
- Repository: ${repoContext.description || 'Open source project'}

Generate a celebratory impact narrative that highlights:
1. Most significant contributions and achievements
2. Unique value they bring to the project
3. Collaboration patterns and community engagement
4. Growth trajectory and potential
5. Specific examples of high-impact work

Focus on positive language, specific achievements, and community value. Identify 2-3 key evidence points that demonstrate their impact. Suggest 1-2 ways to further recognize or engage this contributor.

Format: Celebratory narrative (100-150 words) followed by Evidence: [bullet points] and Recommendations: [bullet points]`;
  }

  /**
   * Build prompt for rising stars identification
   */
  private buildRisingStarsPrompt(
    contributors: ContributorData[],
    repoContext: { owner: string; repo: string },
    timeRange: string
  ): string {
    const contributorSummaries = contributors.slice(0, 10).map(c => {
      const recentPRs = c.pullRequests.length;
      const reviews = c.reviews.length;
      return `- @${c.login}: ${recentPRs} PRs, ${reviews} reviews`;
    }).join('\n');

    return `Identify 3-5 rising star contributors in ${repoContext.owner}/${repoContext.repo} over the last ${timeRange}:

CONTRIBUTOR ACTIVITY:
${contributorSummaries}

Identify rising stars based on:
1. Growth patterns and increasing engagement
2. Quality of contributions and collaboration
3. Innovation and problem-solving approach
4. Community building and mentoring potential
5. Consistency and reliability trends

For each rising star, provide:
- Name and key growth indicators
- Specific examples of promising contributions
- Potential for future leadership
- Recommended recognition or development opportunities

Focus on contributors showing upward trajectory, learning agility, and community engagement. Format as individual profiles with growth evidence.`;
  }

  /**
   * Build prompt for community success analysis
   */
  private buildCommunitySuccessPrompt(
    metrics: CommunityMetrics,
    contributors: ContributorData[],
    repoContext: { owner: string; repo: string }
  ): string {
    const topContributors = contributors.slice(0, 5).map(c => `@${c.login}`).join(', ');

    return `Analyze the community success story for ${repoContext.owner}/${repoContext.repo}:

COMMUNITY METRICS:
- Total Contributors: ${metrics.totalContributors}
- Active Contributors: ${metrics.activeContributors}
- New Contributors: ${metrics.newContributors}
- PR Velocity: ${metrics.prVelocity} PRs/week
- Review Turnaround: ${metrics.reviewTurnoverTime} hours avg
- Community Growth: ${metrics.communityGrowth}% month-over-month

Top Contributors: ${topContributors}

Generate a success narrative highlighting:
1. Community growth and engagement wins
2. Collaboration success stories
3. Innovation and quality improvements
4. Positive trends and momentum
5. Community health and sustainability

Focus on celebrating achievements, growth patterns, and positive outcomes. Identify key success factors and provide insights for continued community success.

Format: Success story narrative (120-180 words) with specific metrics and achievements highlighted.`;
  }

  /**
   * Build prompt for achievement narratives
   */
  private buildAchievementPrompt(
    contributor: ContributorData,
    achievements: Array<{ type: string; value: number; milestone: string; date: Date }>,
    repoContext: { owner: string; repo: string }
  ): string {
    const achievementList = achievements.map(a => 
      `- ${a.milestone}: ${a.value} (${a.date.toLocaleDateString()})`
    ).join('\n');

    return `Create a celebration narrative for @${contributor.login}'s achievements in ${repoContext.owner}/${repoContext.repo}:

ACHIEVEMENTS:
${achievementList}

Generate an inspiring achievement story that:
1. Celebrates specific milestones and accomplishments
2. Highlights progression and growth over time
3. Recognizes unique contributions and skills
4. Shows positive impact on the project and community
5. Suggests future potential and opportunities

Focus on positive language, specific achievements, and community recognition. Format as a congratulatory narrative that could be shared publicly to celebrate this contributor.

Keep tone celebratory and specific, 80-120 words.`;
  }

  /**
   * Build prompt for executive summaries
   */
  private buildExecutiveSummaryPrompt(
    metrics: ExecutiveSummaryMetrics,
    topContributors: ContributorData[],
    trends: Array<{ metric: string; change: number; direction: string }>
  ): string {
    const contributorNames = topContributors.slice(0, 5).map(c => `@${c.login}`).join(', ');
    const trendSummary = trends.map(t => 
      `${t.metric}: ${t.change > 0 ? '+' : ''}${t.change}% (${t.direction})`
    ).join(', ');

    return `Generate an executive summary for ${metrics.repository.full_name} analytics:

KEY METRICS:
- Contributors: ${metrics.totalContributors.total} total (${Object.values(metrics.totalContributors.byTrustLevel).join('/')})
- PR Velocity: ${metrics.prVelocity.totalPRsThisMonth} PRs this month, ${Math.round(metrics.prVelocity.averageTimeToMerge)}h avg merge time
- Community Health Score: ${metrics.communityHealthScore}/100
- Top Contributors: ${contributorNames}

TRENDS:
${trendSummary}

Create an executive summary that:
1. Highlights key successes and positive trends
2. Celebrates top contributors and community growth
3. Identifies opportunities for continued success
4. Provides actionable insights for leadership
5. Maintains focus on achievements and wins

Format as a professional executive brief, 150-200 words, with clear success metrics and forward-looking opportunities.`;
  }

  /**
   * Parse AI response into structured contributor insight
   */
  private parseContributorInsight(
    response: string,
    type: AIContributorInsight['type'],
    contributor: string
  ): AIContributorInsight {
    // Extract evidence and recommendations if present in structured format
    const evidenceMatch = response.match(/Evidence:\s*\n((?:[-•]\s*.+\n?)*)/);
    const recommendationsMatch = response.match(/Recommendations:\s*\n((?:[-•]\s*.+\n?)*)/);
    
    const evidence = evidenceMatch 
      ? evidenceMatch[1].split('\n').filter(line => line.trim()).map(line => line.replace(/^[-•]\s*/, '').trim())
      : [];
      
    const recommendations = recommendationsMatch
      ? recommendationsMatch[1].split('\n').filter(line => line.trim()).map(line => line.replace(/^[-•]\s*/, '').trim())
      : [];

    // Clean the main narrative by removing the structured sections
    let narrative = response
      .replace(/Evidence:\s*\n((?:[-•]\s*.+\n?)*)/g, '')
      .replace(/Recommendations:\s*\n((?:[-•]\s*.+\n?)*)/g, '')
      .trim();

    return {
      type,
      narrative,
      confidence: this.calculateAIConfidence(response.length, evidence.length),
      evidence,
      recommendations,
      aiModel: this.config.model,
      generated_at: new Date()
    };
  }

  /**
   * Parse multiple insights from AI response
   */
  private parseMultipleInsights(response: string, type: AIContributorInsight['type']): AIContributorInsight[] {
    // Split response by contributor profiles (looking for @username patterns)
    const profiles = response.split(/(?=@\w+:)/);
    
    return profiles
      .filter(profile => profile.trim().length > 50) // Filter out very short segments
      .map(profile => {
        const contributorMatch = profile.match(/@(\w+):/);
        const contributor = contributorMatch ? contributorMatch[1] : 'unknown';
        
        return this.parseContributorInsight(profile, type, contributor);
      });
  }

  /**
   * Calculate AI confidence based on response quality indicators
   */
  private calculateAIConfidence(responseLength: number, evidenceCount: number): number {
    let confidence = 0.6; // Base confidence

    // Longer, more detailed responses get higher confidence
    if (responseLength > 500) confidence += 0.2;
    else if (responseLength > 300) confidence += 0.1;

    // More evidence points increase confidence
    if (evidenceCount >= 3) confidence += 0.2;
    else if (evidenceCount >= 2) confidence += 0.1;

    return Math.min(0.95, confidence); // Cap at 95%
  }

  /**
   * Make API call to OpenAI with error handling
   */
  private async callOpenAI(prompt: string, model?: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Prevent real API calls in test environment
    if (
      process.env.NODE_ENV === 'test' ||
      this.apiKey === 'test-openai-key' ||
      this.apiKey === 'test-key-for-ci'
    ) {
      throw new Error('OpenAI API calls blocked in test environment');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: model || this.config.model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert community analyst specializing in celebrating contributor achievements and identifying growth opportunities. Focus on positive language, specific accomplishments, and community success stories. Always highlight strengths and potential rather than weaknesses.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('OpenAI API rate limit exceeded');
        } else if (response.status === 401) {
          throw new Error('Invalid OpenAI API key');
        } else {
          throw new Error(`OpenAI API error: ${response.status}`);
        }
      }

      const data = await response.json();

      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from OpenAI');
      }

      return data.choices[0].message.content.trim();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('OpenAI request timeout');
      }

      throw error;
    }
  }

  /**
   * Cache management
   */
  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.config.cacheTTL * 60 * 60 * 1000) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    const ttlMs = this.config.cacheTTL * 60 * 60 * 1000;
    
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > ttlMs) {
        this.cache.delete(key);
      }
    }
  }
}

// Export singleton instance
export const analyticsOpenAIService = new AnalyticsOpenAIService();