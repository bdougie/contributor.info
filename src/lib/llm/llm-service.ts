/**
 * LLM Service with caching and fallbacks
 * Manages multiple LLM providers and implements smart caching
 */

import { openAIService, type LLMInsight } from './openai-service';

export interface CachedInsight extends LLMInsight {
  cacheKey: string;
  expiresAt: Date;
}

export interface LLMServiceOptions {
  enableCaching: boolean;
  cacheExpiryMinutes: number;
  enableFallbacks: boolean;
}

class LLMService {
  private cache = new Map<string, CachedInsight>();
  private options: LLMServiceOptions;

  constructor(options: Partial<LLMServiceOptions> = {}) {
    this.options = {
      enableCaching: true,
      cacheExpiryMinutes: 60, // 1 hour default
      enableFallbacks: true,
      ...options
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
    healthData: any,
    repoInfo: { owner: string; repo: string }
  ): Promise<LLMInsight | null> {
    const cacheKey = this.buildCacheKey('health', repoInfo, healthData.score);
    
    // Check cache first
    if (this.options.enableCaching) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Try OpenAI service
    try {
      const insight = await openAIService.generateHealthInsight(healthData, repoInfo);
      
      if (insight && this.options.enableCaching) {
        this.saveToCache(cacheKey, insight);
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
   * Generate recommendations with caching
   */
  async generateRecommendations(
    data: any,
    repoInfo: { owner: string; repo: string }
  ): Promise<LLMInsight | null> {
    const cacheKey = this.buildCacheKey('recommendations', repoInfo, data.health?.score || 0);
    
    // Check cache first
    if (this.options.enableCaching) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Try OpenAI service
    try {
      const insight = await openAIService.generateRecommendations(data, repoInfo);
      
      if (insight && this.options.enableCaching) {
        this.saveToCache(cacheKey, insight);
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
   * Analyze PR patterns with caching
   */
  async analyzePRPatterns(
    prData: any[],
    repoInfo: { owner: string; repo: string }
  ): Promise<LLMInsight | null> {
    const cacheKey = this.buildCacheKey('patterns', repoInfo, prData.length);
    
    // Check cache first
    if (this.options.enableCaching) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Try OpenAI service
    try {
      const insight = await openAIService.analyzePRPatterns(prData, repoInfo);
      
      if (insight && this.options.enableCaching) {
        this.saveToCache(cacheKey, insight);
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
   * Clear all cached insights
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear expired cache entries
   */
  cleanupCache(): void {
    const now = new Date();
    for (const [key, insight] of this.cache.entries()) {
      if (now > insight.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    // Simple implementation - in production would track hit/miss rates
    return {
      size: this.cache.size,
      hitRate: 0 // Would need to implement hit tracking
    };
  }

  /**
   * Build cache key from parameters
   */
  private buildCacheKey(type: string, repoInfo: { owner: string; repo: string }, dataHash: number): string {
    return `${type}:${repoInfo.owner}/${repoInfo.repo}:${dataHash}`;
  }

  /**
   * Get insight from cache if not expired
   */
  private getFromCache(cacheKey: string): LLMInsight | null {
    const cached = this.cache.get(cacheKey);
    
    if (cached && new Date() <= cached.expiresAt) {
      return {
        type: cached.type,
        content: cached.content,
        confidence: cached.confidence,
        timestamp: cached.timestamp
      };
    }
    
    // Remove expired entry
    if (cached) {
      this.cache.delete(cacheKey);
    }
    
    return null;
  }

  /**
   * Save insight to cache with expiry
   */
  private saveToCache(cacheKey: string, insight: LLMInsight): void {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.options.cacheExpiryMinutes);
    
    const cachedInsight: CachedInsight = {
      ...insight,
      cacheKey,
      expiresAt
    };
    
    this.cache.set(cacheKey, cachedInsight);
  }

  /**
   * Generate fallback health insight when LLM fails
   */
  private generateFallbackHealthInsight(healthData: any): LLMInsight {
    let content = '';
    
    if (healthData.score >= 80) {
      content = 'Repository health is excellent. Continue maintaining current development practices and code review standards.';
    } else if (healthData.score >= 60) {
      content = 'Repository health is good with room for improvement. Focus on the areas marked as warnings to further optimize your workflow.';
    } else {
      content = 'Repository health needs attention. Address critical issues first, particularly in areas with the lowest scores.';
    }
    
    // Add specific recommendations from the data
    const criticalFactors = healthData.factors?.filter((f: any) => f.status === 'critical') || [];
    if (criticalFactors.length > 0) {
      content += ` Priority: ${criticalFactors[0].name.toLowerCase()}.`;
    }
    
    return {
      type: 'health',
      content,
      confidence: 0.6, // Lower confidence for fallback
      timestamp: new Date()
    };
  }

  /**
   * Generate fallback recommendations when LLM fails
   */
  private generateFallbackRecommendations(data: any): LLMInsight {
    const recommendations = [];
    
    if (data.health?.score < 70) {
      recommendations.push('Improve code review coverage to increase repository health');
    }
    
    if (data.activity?.weeklyVelocity < 5) {
      recommendations.push('Consider breaking down large PRs to increase development velocity');
    }
    
    recommendations.push('Monitor PR merge times and establish review SLAs');
    
    const content = recommendations.slice(0, 3).map((rec, i) => `${i + 1}. ${rec}`).join('\n');
    
    return {
      type: 'recommendation',
      content: content || 'Continue following development best practices.',
      confidence: 0.5,
      timestamp: new Date()
    };
  }

  /**
   * Generate fallback pattern insight when LLM fails
   */
  private generateFallbackPatternInsight(prData: any[]): LLMInsight {
    const totalPRs = prData.length;
    const merged = prData.filter((pr: any) => pr.merged_at).length;
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
      timestamp: new Date()
    };
  }
}

// Export singleton instance
export const llmService = new LLMService();

// Export types
export type { LLMInsight };