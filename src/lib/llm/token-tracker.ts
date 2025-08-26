/**
 * Token usage tracking for OpenAI free tier management
 * Tracks daily usage across different model tiers
 */

export interface DailyUsage {
  date: string; // YYYY-MM-DD format
  primaryTokens: number; // gpt-4o, gpt-4.1, etc (1M daily limit)
  miniTokens: number; // gpt-4o-mini, etc (10M daily limit)
}

interface ModelClassification {
  tier: 'primary' | 'mini' | 'paid';
  estimatedTokens: number;
}

class TokenTracker {
  private storageKey = 'llm_token_usage';
  private dailyLimits = {
    primary: 1000000, // 1M tokens/day
    mini: 10000000, // 10M tokens/day
  };

  /**
   * Track token usage for a specific model and insight type
   */
  trackUsage(model: string, insightType: 'health' | 'recommendation' | 'pattern'): void {
    const classification = this.classifyModel(model);
    const estimatedTokens = this.getEstimatedTokens(insightType);

    if (classification.tier !== 'paid') {
      this.recordUsage(classification.tier, estimatedTokens);
    }
  }

  /**
   * Check if we can make a request with the given model
   */
  canUseModel(model: string, insightType: 'health' | 'recommendation' | 'pattern'): boolean {
    const classification = this.classifyModel(model);
    const estimatedTokens = this.getEstimatedTokens(insightType);
    const currentUsage = this.getTodayUsage();

    if (classification.tier === 'paid') {
      return true; // No free tier limits
    }

    const currentTierUsage =
      classification.tier === 'primary' ? currentUsage.primaryTokens : currentUsage.miniTokens;

    const dailyLimit = this.dailyLimits[classification.tier];

    return currentTierUsage + estimatedTokens <= dailyLimit;
  }

  /**
   * Get recommended model based on current usage and limits
   */
  getRecommendedModel(insightType: 'health' | 'recommendation' | 'pattern'): string {
    const estimatedTokens = this.getEstimatedTokens(insightType);
    const currentUsage = this.getTodayUsage();

    // For simple health insights, prefer mini models if available
    if (insightType === 'health') {
      if (currentUsage.miniTokens + estimatedTokens <= this.dailyLimits.mini) {
        return 'gpt-4o-mini';
      }
      // Fallback to primary if mini is exhausted
      if (currentUsage.primaryTokens + estimatedTokens <= this.dailyLimits.primary) {
        return 'gpt-4o';
      }
    }

    // For complex insights, prefer primary models
    if (insightType === 'recommendation' || insightType === 'pattern') {
      if (currentUsage.primaryTokens + estimatedTokens <= this.dailyLimits.primary) {
        return 'gpt-4o';
      }
      // Fallback to mini if primary is exhausted
      if (currentUsage.miniTokens + estimatedTokens <= this.dailyLimits.mini) {
        return 'gpt-4o-mini';
      }
    }

    // If free tier exhausted, could fallback to paid model or return null
    return 'gpt-4o-mini'; // Default fallback
  }

  /**
   * Get current usage statistics
   */
  getUsageStats(): {
    today: DailyUsage;
    primaryRemaining: number;
    miniRemaining: number;
    primaryPercentUsed: number;
    miniPercentUsed: number;
    canUsePrimary: boolean;
    canUseMini: boolean;
  } {
    const today = this.getTodayUsage();

    return {
      today,
      primaryRemaining: Math.max(0, this.dailyLimits.primary - today.primaryTokens),
      miniRemaining: Math.max(0, this.dailyLimits.mini - today.miniTokens),
      primaryPercentUsed: (today.primaryTokens / this.dailyLimits.primary) * 100,
      miniPercentUsed: (today.miniTokens / this.dailyLimits.mini) * 100,
      canUsePrimary: today.primaryTokens < this.dailyLimits.primary,
      canUseMini: today.miniTokens < this.dailyLimits.mini,
    };
  }

  /**
   * Reset usage tracking (for testing or manual reset)
   */
  resetUsage(): void {
    localStorage.removeItem(this.storageKey);
  }

  /**
   * Classify model into tier and estimate token usage
   */
  private classifyModel(model: string): ModelClassification {
    const primaryModels = ['gpt-4o', 'gpt-4.5-preview', 'gpt-4.1', 'o1', 'o3'];
    const miniModels = [
      'gpt-4o-mini',
      'gpt-4.1-mini',
      'gpt-4.1-nano',
      'o1-mini',
      'o3-mini',
      'o4-mini',
      'codex-mini-latest',
    ];

    if (primaryModels.includes(model)) {
      return { tier: 'primary', estimatedTokens: 0 };
    } else if (miniModels.includes(model)) {
      return { tier: 'mini', estimatedTokens: 0 };
    } else {
      return { tier: 'paid', estimatedTokens: 0 };
    }
  }

  /**
   * Get estimated token usage for different insight types
   */
  private getEstimatedTokens(insightType: 'health' | 'recommendation' | 'pattern'): number {
    switch (insightType) {
      case 'health':
        return 150; // Simple health summary
      case 'recommendation':
        return 250; // Complex strategic advice
      case 'pattern':
        return 200; // Pattern analysis
      default:
        return 200;
    }
  }

  /**
   * Get today's usage from localStorage
   */
  private getTodayUsage(): DailyUsage {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const _ = JSON.parse(stored);
        if (_data.date === today) {
          return data;
        }
      }
    } catch () {
      console.warn('Failed to parse token usage _data:', _error);
    }

    // Return fresh daily usage
    return {
      date: today,
      primaryTokens: 0,
      miniTokens: 0,
    };
  }

  /**
   * Record token usage in localStorage
   */
  private recordUsage(tier: 'primary' | 'mini', tokens: number): void {
    const currentUsage = this.getTodayUsage();

    if (tier === 'primary') {
      currentUsage.primaryTokens += tokens;
    } else {
      currentUsage.miniTokens += tokens;
    }

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(currentUsage));
    } catch () {
      console.warn('Failed to save token usage _data:', _error);
    }
  }
}

// Export singleton instance
export const tokenTracker = new TokenTracker();
