/**
 * OpenAI GPT-4 service for generating natural language insights
 * Uses VITE_OPENAI_API_KEY environment variable
 */

export interface LLMInsight {
  type: 'health' | 'recommendation' | 'pattern' | 'trend';
  content: string;
  confidence: number; // 0-1
  timestamp: Date;
}

export interface LLMServiceConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  timeout: number; // milliseconds
  fallbackModel?: string;
}

class OpenAIService {
  private apiKey: string | undefined;
  private baseUrl = 'https://api.openai.com/v1';
  private config: LLMServiceConfig;

  constructor() {
    // Handle both Vite and Node.js environments
    this.apiKey = import.meta.env?.VITE_OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;

    this.config = {
      model: 'gpt-4o-mini', // Start with high-quota free model
      fallbackModel: 'gpt-4o', // Fallback to primary free model
      maxTokens: 500,
      temperature: 0.3,
      timeout: 10000,
    };
  }

  /**
   * Check if OpenAI service is configured and available
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }

  /**
   * Select optimal model based on insight type and complexity
   */
  private selectModel(insightType: 'health' | 'recommendation' | 'pattern'): string {
    // For simple health summaries, use mini models (10M free tokens/day)
    if (insightType === 'health') {
      return 'gpt-4o-mini';
    }

    // For complex recommendations and patterns, use primary models (1M free tokens/day)
    if (insightType === 'recommendation' || insightType === 'pattern') {
      return 'gpt-4o';
    }

    return this.config.model;
  }

  /**
   * Generate health assessment insight from repository metrics
   */
  async generateHealthInsight(
    healthData: {
      score: number;
      trend: string;
      factors: Array<{
        name: string;
        score: number;
        status: string;
        description: string;
      }>;
      recommendations: string[];
    },
    repoInfo: { owner: string; repo: string }
  ): Promise<LLMInsight | null> {
    if (!this.isAvailable()) {
      return null;
    }

    const prompt = this.buildHealthPrompt(healthData, repoInfo);
    const model = this.selectModel('health');

    try {
      const response = await this.callOpenAI(prompt, model);

      return {
        type: 'health',
        content: response,
        confidence: this.calculateConfidence(healthData.score),
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Failed to generate health insight:', error);
      return null;
    }
  }

  /**
   * Generate actionable recommendations based on repository data
   */
  async generateRecommendations(
    data: {
      health: any;
      trends: any[];
      activity: any;
    },
    repoInfo: { owner: string; repo: string }
  ): Promise<LLMInsight | null> {
    if (!this.isAvailable()) {
      return null;
    }

    const prompt = this.buildRecommendationPrompt(data, repoInfo);
    const model = this.selectModel('recommendation');

    try {
      const response = await this.callOpenAI(prompt, model);

      return {
        type: 'recommendation',
        content: response,
        confidence: 0.8, // Default confidence for recommendations
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Failed to generate recommendations:', error);
      return null;
    }
  }

  /**
   * Analyze PR patterns and contributor behavior
   */
  async analyzePRPatterns(
    prData: any[],
    repoInfo: { owner: string; repo: string }
  ): Promise<LLMInsight | null> {
    if (!this.isAvailable()) {
      return null;
    }

    const prompt = this.buildPatternPrompt(prData, repoInfo);
    const model = this.selectModel('pattern');

    try {
      const response = await this.callOpenAI(prompt, model);

      return {
        type: 'pattern',
        content: response,
        confidence: 0.7, // Patterns can be more subjective
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Failed to analyze PR patterns:', error);
      return null;
    }
  }

  /**
   * Make API call to OpenAI with rate limiting and error handling
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
              content:
                'You are a helpful assistant that provides concise, actionable insights about GitHub repository health and development patterns. Keep responses under 150 words and focus on practical advice.',
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
   * Build prompt for health assessment
   */
  private buildHealthPrompt(healthData: any, repoInfo: { owner: string; repo: string }): string {
    return `Analyze the health of repository ${repoInfo.owner}/${repoInfo.repo}:

Health Score: ${healthData.score}/100 (${healthData.trend})

Factors:
${healthData.factors.map((f: any) => `- ${f.name}: ${f.score}/100 (${f.status}) - ${f.description}`).join('\n')}

Current Recommendations:
${healthData.recommendations.map((r: string) => `- ${r}`).join('\n')}

Provide a concise assessment focusing on:
1. Overall health interpretation with workflow patterns observed
2. Most critical areas needing attention
3. Team collaboration and development patterns
4. One specific actionable next step

Include insights about development workflow effectiveness, review patterns, and team dynamics where relevant. Keep response under 150 words and avoid repeating the raw numbers.`;
  }

  /**
   * Build prompt for recommendations
   */
  private buildRecommendationPrompt(data: any, repoInfo: { owner: string; repo: string }): string {
    return `Based on ${repoInfo.owner}/${repoInfo.repo} repository data, provide 3 specific, actionable recommendations:

Health: ${data.health.score}/100
Trends: ${data.trends.map((t: any) => `${t.metric}: ${t.change > 0 ? '+' : ''}${t.change}%`).join(', ')}
Activity: ${data.activity.weeklyVelocity} PRs/week

Analyze workflow patterns and provide recommendations for:
1. Process improvements based on development patterns
2. Team collaboration enhancements
3. Workflow bottleneck resolution

Focus on specific, measurable steps that address both metrics and development workflow effectiveness. Format as numbered list, max 120 words total.`;
  }

  /**
   * Build prompt for pattern analysis
   */
  private buildPatternPrompt(prData: any[], repoInfo: { owner: string; repo: string }): string {
    const totalPRs = prData.length;
    const merged = prData.filter((pr) => pr.merged_at).length;
    const avgSize = prData.reduce((sum, pr) => sum + (pr.additions + pr.deletions), 0) / totalPRs;

    return `Analyze PR patterns for ${repoInfo.owner}/${repoInfo.repo}:

PRs: ${totalPRs} total, ${merged} merged (${Math.round((merged / totalPRs) * 100)}%)
Avg size: ${Math.round(avgSize)} lines changed

Identify:
1. Development workflow patterns
2. Potential bottlenecks or inefficiencies
3. Team collaboration insights
4. One specific improvement suggestion

Keep under 140 words, focus on actionable observations.`;
  }

  /**
   * Calculate confidence score based on data quality
   */
  private calculateConfidence(healthScore: number): number {
    // Higher confidence for extreme scores (very good or very bad)
    // Lower confidence for middle-range scores
    if (healthScore >= 80 || healthScore <= 30) {
      return 0.9;
    } else if (healthScore >= 70 || healthScore <= 40) {
      return 0.8;
    } else {
      return 0.7;
    }
  }
}

// Export singleton instance
export const openAIService = new OpenAIService();
