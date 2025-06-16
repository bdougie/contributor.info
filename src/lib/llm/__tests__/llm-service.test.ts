import { describe, it, expect, beforeEach } from 'vitest';
import { llmService } from '../llm-service';

describe('LLM Service', () => {
  beforeEach(() => {
    llmService.clearCache();
  });

  it('should indicate availability based on OpenAI configuration', () => {
    // This will be false in test environment without API key
    const isAvailable = llmService.isAvailable();
    expect(typeof isAvailable).toBe('boolean');
  });

  it('should generate health insight (LLM or fallback)', async () => {
    const healthData = {
      score: 45,
      trend: 'declining',
      factors: [
        {
          name: 'PR Merge Time',
          score: 30,
          status: 'critical',
          description: 'Average merge time is 120 hours'
        }
      ],
      recommendations: ['Implement review SLAs']
    };

    const repoInfo = { owner: 'test', repo: 'repo' };
    
    const insight = await llmService.generateHealthInsight(healthData, repoInfo);
    
    // Should return either LLM or fallback insight
    expect(insight).toBeTruthy();
    expect(insight?.type).toBe('health');
    expect(insight?.content).toBeTruthy();
    expect(typeof insight?.confidence).toBe('number');
  });

  it('should generate fallback recommendations', async () => {
    const data = {
      health: { score: 55 },
      activity: { weeklyVelocity: 3 },
      trends: []
    };

    const repoInfo = { owner: 'test', repo: 'repo' };
    
    const insight = await llmService.generateRecommendations(data, repoInfo);
    
    expect(insight).toBeTruthy();
    expect(insight?.type).toBe('recommendation');
    expect(insight?.content).toContain('1.');
  });

  it('should cache insights correctly', async () => {
    const healthData = {
      score: 80,
      trend: 'improving',
      factors: [],
      recommendations: []
    };

    const repoInfo = { owner: 'test', repo: 'repo' };
    
    // First call
    const insight1 = await llmService.generateHealthInsight(healthData, repoInfo);
    
    // Second call should return same cached result
    const insight2 = await llmService.generateHealthInsight(healthData, repoInfo);
    
    expect(insight1?.content).toBe(insight2?.content);
  });

  it('should provide cache statistics', () => {
    const stats = llmService.getCacheStats();
    expect(stats).toHaveProperty('memorySize');
    expect(stats).toHaveProperty('persistentSize');
    expect(stats).toHaveProperty('hitRate');
    expect(typeof stats.memorySize).toBe('number');
    expect(typeof stats.persistentSize).toBe('number');
    expect(typeof stats.hitRate).toBe('number');
  });

  it('should clean up expired cache entries', () => {
    llmService.cleanupCache();
    // Should not throw
    expect(true).toBe(true);
  });
});