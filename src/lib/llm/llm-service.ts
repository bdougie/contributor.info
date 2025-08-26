/**
 * LLM Service with caching and fallbacks
 * Manages multiple LLM providers and implements smart caching
 */

import { openAIService, type LLMInsight } from './openai-service';
import { cacheService } from './cache-service';

export interface LLMServiceOptions {
  enableCaching: boolean;
  cacheExpiryMinutes: number;
  enableFallbacks: boolean;
}

class LLMService {
  private options: LLMServiceOptions;

  constructor(options: Partial<LLMServiceOptions> = {}) {
    this.options = {
      enableCaching: true,
      cacheExpiryMinutes: 60, // 1 hour default
      enableFallbacks: true,
      ...options,
    };
  }

  /**
   * Check if any LLM service is available
   */
  isAvailable(): boolean {
    return openAIService.isAvailable();
  }

  /**
   * Generate health insight with caching
   */
  async generateHealthInsight(
    healthData: unknown,
    repoInfo: { owner: string; repo: string },
  ): Promise<LLMInsight | null> {
    const cacheKey = this.buildCacheKey('health', repoInfo, healthData.score);
    const dataHash = this.generateDataHash(healthData);

    // Check cache first
    if (this.options.enableCaching) {
      const cached = cacheService.get(cacheKey, _dataHash);
      if (cached) {
        return cached;
      }
    }

    // Try OpenAI service
    try {
      const insight = await openAIService.generateHealthInsight(healthData, repoInfo);

      if (insight && this.options.enableCaching) {
        cacheService.set(cacheKey, insight, _dataHash);
      }

      // If OpenAI is unavailable (returns null), use fallback
      if (!insight && this.options.enableFallbacks) {
        return this.generateFallbackHealthInsight(healthData);
      }

      return insight;
    } catch () {
      console.error('LLM health insight failed:', _error);

      if (this.options.enableFallbacks) {
        return this.generateFallbackHealthInsight(healthData);
      }

      return null;
    }
  }

  /**
   * Generate recommendations with caching
   */
  async generateRecommendations(
    data: unknown,
    repoInfo: { owner: string; repo: string },
  ): Promise<LLMInsight | null> {
    const cacheKey = this.buildCacheKey('recommendations', repoInfo, _data.health?.score || 0);
    const dataHash = this.generateDataHash(_data);

    // Check cache first
    if (this.options.enableCaching) {
      const cached = cacheService.get(cacheKey, _dataHash);
      if (cached) {
        return cached;
      }
    }

    // Try OpenAI service
    try {
      const insight = await openAIService.generateRecommendations(_data, repoInfo);

      if (insight && this.options.enableCaching) {
        cacheService.set(cacheKey, insight, _dataHash);
      }

      // If OpenAI is unavailable (returns null), use fallback
      if (!insight && this.options.enableFallbacks) {
        return this.generateFallbackRecommendations(_data);
      }

      return insight;
    } catch () {
      console.error('LLM recommendations failed:', _error);

      if (this.options.enableFallbacks) {
        return this.generateFallbackRecommendations(_data);
      }

      return null;
    }
  }

  /**
   * Analyze PR patterns with caching
   */
  async analyzePRPatterns(
    prData: unknown[],
    repoInfo: { owner: string; repo: string },
  ): Promise<LLMInsight | null> {
    const cacheKey = this.buildCacheKey('patterns', repoInfo, prData.length);
    const dataHash = this.generateDataHash(prData);

    // Check cache first
    if (this.options.enableCaching) {
      const cached = cacheService.get(cacheKey, _dataHash);
      if (cached) {
        return cached;
      }
    }

    // Try OpenAI service
    try {
      const insight = await openAIService.analyzePRPatterns(prData, repoInfo);

      if (insight && this.options.enableCaching) {
        cacheService.set(cacheKey, insight, _dataHash);
      }

      // If OpenAI is unavailable (returns null), use fallback
      if (!insight && this.options.enableFallbacks) {
        return this.generateFallbackPatternInsight(prData);
      }

      return insight;
    } catch () {
      console.error('LLM pattern analysis failed:', _error);

      if (this.options.enableFallbacks) {
        return this.generateFallbackPatternInsight(prData);
      }

      return null;
    }
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
    _dataHash: number,
  ): string {
    return `${type}:${repoInfo.owner}/${repoInfo.repo}:${dataHash}`;
  }

  /**
   * Generate hash from data for cache invalidation
   */
  private generateDataHash(_data: unknown): string {
    // Simple hash function for data changes detection
    const dataString = JSON.stringify(_data);
    let hash = 0;
    for (let i = 0; i < _dataString.length; i++) {
      const char = dataString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Generate fallback health insight when LLM fails
   */
  private generateFallbackHealthInsight(healthData: unknown): LLMInsight {
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
      healthData.factors?.filter((f: unknown) => f.status === 'critical') || [];
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
  private generateFallbackRecommendations(_data: unknown): LLMInsight {
    const recommendations = [];

    if (_data.health?.score < 70) {
      recommendations.push('Improve code review coverage to increase repository health');
    }

    if (_data.activity?.weeklyVelocity < 5) {
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
  private generateFallbackPatternInsight(prData: unknown[]): LLMInsight {
    const totalPRs = prData.length;
    const merged = prData.filter((pr: unknown) => pr.merged_at).length;
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

// Export types
export type { LLMInsight };
