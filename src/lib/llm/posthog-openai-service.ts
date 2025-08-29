/**
 * PostHog-wrapped OpenAI service for LLM analytics and observability
 * Tracks token usage, costs, latency, and errors automatically
 */

import type { LLMInsight, LLMServiceConfig } from './openai-service';

export interface PostHogConfig {
  apiKey?: string;
  host?: string;
  enableTracking: boolean;
  enablePrivacyMode?: boolean;
}

export interface LLMCallMetadata {
  userId?: string;
  traceId?: string;
  conversationId?: string;
  feature?: string;
  repository?: string;
  organizationId?: string;
}

export interface LLMCallResult {
  content: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  model?: string;
  latency?: number;
  cost?: number;
}

class PostHogOpenAIService {
  private apiKey: string | undefined;
  private baseUrl = 'https://api.openai.com/v1';
  private config: LLMServiceConfig;
  private posthogConfig: PostHogConfig;
  private posthogClient: unknown = null; // Will be dynamically imported

  constructor() {
    // Handle both Vite and Node.js environments
    this.apiKey = import.meta.env?.VITE_OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;

    this.config = {
      model: 'gpt-4o-mini',
      fallbackModel: 'gpt-4o',
      maxTokens: 500,
      temperature: 0.3,
      timeout: 10000,
    };

    this.posthogConfig = {
      apiKey: import.meta.env?.VITE_POSTHOG_API_KEY || process.env.POSTHOG_API_KEY,
      host:
        import.meta.env?.VITE_POSTHOG_HOST ||
        process.env.POSTHOG_HOST ||
        'https://us.i.posthog.com',
      enableTracking: !!(import.meta.env?.VITE_POSTHOG_API_KEY || process.env.POSTHOG_API_KEY),
      enablePrivacyMode: false, // Set to true to prevent capturing conversation content
    };

    this.initializePostHog();
  }

  /**
   * Initialize PostHog client for tracking
   */
  private async initializePostHog(): Promise<void> {
    if (!this.posthogConfig.enableTracking || !this.posthogConfig.apiKey) {
      console.log('PostHog tracking disabled - no API key provided');
      return;
    }

    // Only initialize PostHog in Node.js environments
    if (typeof window !== 'undefined') {
      console.log('PostHog LLM tracking not available in browser environment');
      this.posthogConfig.enableTracking = false;
      return;
    }

    try {
      // Use dynamic require for Node.js environments to avoid Vite bundling issues
      const posthogModule = await this.loadPostHogModule();
      if (!posthogModule) {
        throw new Error('posthog-node not available');
      }

      this.posthogClient = posthogModule;
      console.log('PostHog LLM analytics initialized');
    } catch (error) {
      console.warn('PostHog not available - install posthog-node for LLM tracking:', error);
      this.posthogConfig.enableTracking = false;
    }
  }

  /**
   * Load PostHog module dynamically
   */

  private async loadPostHogModule(): Promise<unknown> {
    try {
      // Dynamic import with explicit module name for security
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const posthogModule = await (globalThis as any).import('posthog-node');

      const PostHogClass = posthogModule.PostHog || posthogModule.default?.PostHog;
      if (!PostHogClass) {
        throw new Error('PostHog class not found in module');
      }

      return new PostHogClass(this.posthogConfig.apiKey, {
        host: this.posthogConfig.host,
      });
    } catch (error) {
      console.warn(
        'Failed to initialize PostHog client:',
        error instanceof Error ? error.message : 'Unknown error'
      );
      return null;
    }
  }

  /**
   * Check if OpenAI service is configured and available
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }

  /**
   * Check if PostHog tracking is enabled and available
   */
  isTrackingEnabled(): boolean {
    return this.posthogConfig.enableTracking && !!this.posthogClient;
  }

  /**
   * Generate health assessment insight with PostHog tracking
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
    repoInfo: { owner: string; repo: string },
    metadata?: LLMCallMetadata
  ): Promise<LLMInsight | null> {
    if (!this.isAvailable()) {
      return null;
    }

    const prompt = this.buildHealthPrompt(healthData, repoInfo);
    const model = this.selectModel('health');

    try {
      const result = await this.callOpenAI(prompt, model, {
        feature: 'health-insight',
        repository: `${repoInfo.owner}/${repoInfo.repo}`,
        ...metadata,
      });

      return {
        type: 'health',
        content: result.content,
        confidence: this.calculateConfidence(healthData.score),
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Failed to generate health insight:', error);
      return null;
    }
  }

  /**
   * Generate actionable recommendations with PostHog tracking
   */
  async generateRecommendations(
    data: {
      health: { score: number; trend?: string };
      trends: Array<{ metric: string; change: number; period?: string }>;
      activity: { weeklyVelocity?: number; contributors?: number };
    },
    repoInfo: { owner: string; repo: string },
    metadata?: LLMCallMetadata
  ): Promise<LLMInsight | null> {
    if (!this.isAvailable()) {
      return null;
    }

    const prompt = this.buildRecommendationPrompt(data, repoInfo);
    const model = this.selectModel('recommendation');

    try {
      const result = await this.callOpenAI(prompt, model, {
        feature: 'recommendations',
        repository: `${repoInfo.owner}/${repoInfo.repo}`,
        ...metadata,
      });

      return {
        type: 'recommendation',
        content: result.content,
        confidence: 0.8,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Failed to generate recommendations:', error);
      return null;
    }
  }

  /**
   * Analyze PR patterns with PostHog tracking
   */
  async analyzePRPatterns(
    prData: Array<{
      merged_at: string | null;
      additions: number;
      deletions: number;
      created_at?: string;
      closed_at?: string | null;
      review_comments?: number;
    }>,
    repoInfo: { owner: string; repo: string },
    metadata?: LLMCallMetadata
  ): Promise<LLMInsight | null> {
    if (!this.isAvailable()) {
      return null;
    }

    const prompt = this.buildPatternPrompt(prData, repoInfo);
    const model = this.selectModel('pattern');

    try {
      const result = await this.callOpenAI(prompt, model, {
        feature: 'pr-pattern-analysis',
        repository: `${repoInfo.owner}/${repoInfo.repo}`,
        ...metadata,
      });

      return {
        type: 'pattern',
        content: result.content,
        confidence: 0.7,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Failed to analyze PR patterns:', error);
      return null;
    }
  }

  /**
   * Make tracked API call to OpenAI with PostHog analytics
   */
  private async callOpenAI(
    prompt: string,
    model?: string,
    metadata?: LLMCallMetadata
  ): Promise<LLMCallResult> {
    // Input validation
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      throw new Error('Invalid prompt: must be a non-empty string');
    }

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

    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      // Try to use PostHog-wrapped OpenAI client if available
      if (this.isTrackingEnabled()) {
        return await this.callOpenAIWithPostHog(prompt, model, metadata);
      }

      // Fallback to direct OpenAI API call
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

      const latency = Date.now() - startTime;
      const result: LLMCallResult = {
        content: data.choices[0].message.content.trim(),
        usage: data.usage,
        model: data.model,
        latency,
        cost: this.calculateCost(data.usage, data.model),
      };

      // Manually track the call if PostHog is not available
      if (!this.isTrackingEnabled() && metadata) {
        this.trackLLMCall(result, metadata, prompt);
      }

      return result;
    } catch (error) {
      clearTimeout(timeoutId);

      // Track the error
      if (this.isTrackingEnabled() && metadata) {
        this.trackLLMError(error, metadata, prompt);
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('OpenAI request timeout');
      }

      throw error;
    }
  }

  /**
   * Call OpenAI using PostHog-wrapped client (when @posthog/ai is available)
   */
  private async callOpenAIWithPostHog(
    prompt: string,
    model: string | undefined,
    metadata: LLMCallMetadata | undefined
  ): Promise<LLMCallResult> {
    try {
      // Load PostHog OpenAI wrapper dynamically
      const client = await this.loadPostHogOpenAIClient();
      if (!client) {
        throw new Error('@posthog/ai not available');
      }

      const startTime = Date.now();

      const completion = await client.chat.completions.create({
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

        // PostHog tracking metadata
        posthogDistinctId: metadata?.userId || 'anonymous',
        posthogTraceId: metadata?.traceId || `trace-${Date.now()}`,
        posthogProperties: {
          conversation_id: metadata?.conversationId,
          feature: metadata?.feature,
          repository: metadata?.repository,
          privacy_mode: this.posthogConfig.enablePrivacyMode,
        },
        posthogGroups: metadata?.organizationId
          ? { organization: metadata.organizationId }
          : undefined,
      });

      const latency = Date.now() - startTime;

      return {
        content: completion.choices[0].message.content?.trim() || '',
        usage: completion.usage,
        model: completion.model,
        latency,
        cost: this.calculateCost(completion.usage, completion.model),
      };
    } catch (error) {
      console.warn(
        'PostHog OpenAI wrapper not available - install @posthog/ai for automatic tracking. Falling back to manual tracking:',
        error
      );
      throw error;
    }
  }

  /**
   * Load PostHog OpenAI client dynamically
   */
  private async loadPostHogOpenAIClient(): Promise<unknown> {
    try {
      // Dynamic import with explicit module name for security
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const posthogAiModule = await (globalThis as any).import('@posthog/ai');

      const OpenAIClass = posthogAiModule.OpenAI || posthogAiModule.default?.OpenAI;
      if (!OpenAIClass) {
        throw new Error('PostHog OpenAI wrapper not found');
      }

      return new OpenAIClass({
        apiKey: this.apiKey,
        posthog: this.posthogClient,
      });
    } catch {
      return null;
    }
  }

  /**
   * Manually track LLM call when PostHog wrapper is not available
   */
  private trackLLMCall(result: LLMCallResult, metadata: LLMCallMetadata, prompt: string): void {
    if (!this.posthogClient) return;

    try {
      this.posthogClient.capture({
        distinctId: metadata.userId || 'anonymous',
        event: '$ai_generation',
        properties: {
          $ai_model: result.model,
          $ai_input_tokens: result.usage?.prompt_tokens,
          $ai_output_tokens: result.usage?.completion_tokens,
          $ai_total_tokens: result.usage?.total_tokens,
          $ai_cost_dollars: result.cost,
          $ai_latency_ms: result.latency,
          $ai_provider: 'openai',
          $ai_input: this.posthogConfig.enablePrivacyMode ? '[REDACTED]' : prompt,
          $ai_output: this.posthogConfig.enablePrivacyMode ? '[REDACTED]' : result.content,

          // Custom properties
          feature: metadata.feature,
          repository: metadata.repository,
          conversation_id: metadata.conversationId,
          trace_id: metadata.traceId,
        },
        groups: metadata.organizationId ? { organization: metadata.organizationId } : undefined,
      });
    } catch (error) {
      console.warn('Failed to track LLM call:', error);
    }
  }

  /**
   * Track LLM errors
   */
  private trackLLMError(error: unknown, metadata: LLMCallMetadata, prompt: string): void {
    if (!this.posthogClient) return;

    try {
      this.posthogClient.capture({
        distinctId: metadata.userId || 'anonymous',
        event: '$ai_generation_error',
        properties: {
          error_message: error.message,
          error_type: error.constructor.name,
          feature: metadata.feature,
          repository: metadata.repository,
          conversation_id: metadata.conversationId,
          trace_id: metadata.traceId,
          $ai_input: this.posthogConfig.enablePrivacyMode ? '[REDACTED]' : prompt,
        },
        groups: metadata.organizationId ? { organization: metadata.organizationId } : undefined,
      });
    } catch (trackError) {
      console.warn('Failed to track LLM error:', trackError);
    }
  }

  /**
   * Calculate estimated cost based on usage and model
   */
  private calculateCost(
    usage: { prompt_tokens?: number; completion_tokens?: number } | null | undefined,
    model: string
  ): number {
    if (!usage) return 0;

    // OpenAI pricing per 1M tokens (as of 2025)
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 2.5, output: 10.0 },
      'gpt-4o-mini': { input: 0.15, output: 0.6 },
      'gpt-4-turbo': { input: 10.0, output: 30.0 },
      'gpt-4': { input: 30.0, output: 60.0 },
      'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
    };

    const modelPricing = pricing[model] || pricing['gpt-4o-mini']; // fallback
    const inputCost = (usage.prompt_tokens / 1000000) * modelPricing.input;
    const outputCost = (usage.completion_tokens / 1000000) * modelPricing.output;

    return parseFloat((inputCost + outputCost).toFixed(6));
  }

  /**
   * Select optimal model based on insight type and complexity
   */
  private selectModel(insightType: 'health' | 'recommendation' | 'pattern'): string {
    if (insightType === 'health') {
      return 'gpt-4o-mini';
    }

    if (insightType === 'recommendation' || insightType === 'pattern') {
      return 'gpt-4o';
    }

    return this.config.model;
  }

  /**
   * Build prompt for health assessment
   */
  private buildHealthPrompt(
    healthData: HealthData,
    repoInfo: { owner: string; repo: string }
  ): string {
    return `Analyze the health of repository ${repoInfo.owner}/${repoInfo.repo}:

Health Score: ${healthData.score}/100 (${healthData.trend})

Factors:
${healthData.factors.map((f: { name: string; score: number; status: string; description: string }) => `- ${f.name}: ${f.score}/100 (${f.status}) - ${f.description}`).join('\n')}

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
  private buildRecommendationPrompt(
    data: RecommendationData,
    repoInfo: { owner: string; repo: string }
  ): string {
    return `Based on ${repoInfo.owner}/${repoInfo.repo} repository data, provide 3 specific, actionable recommendations:

Health: ${data.health.score}/100
Trends: ${data.trends.map((t: { metric: string; change: number }) => `${t.metric}: ${t.change > 0 ? '+' : ''}${t.change}%`).join(', ')}
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
  private buildPatternPrompt(prData: PRData[], repoInfo: { owner: string; repo: string }): string {
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
    if (healthScore >= 80 || healthScore <= 30) {
      return 0.9;
    } else if (healthScore >= 70 || healthScore <= 40) {
      return 0.8;
    } else {
      return 0.7;
    }
  }

  /**
   * Ensure all events are flushed before shutdown
   */
  async shutdown(): Promise<void> {
    if (this.posthogClient && typeof this.posthogClient.shutdown === 'function') {
      await this.posthogClient.shutdown();
    }
  }
}

// Export singleton instance
export const posthogOpenAIService = new PostHogOpenAIService();

// Export types
export type { LLMInsight };
