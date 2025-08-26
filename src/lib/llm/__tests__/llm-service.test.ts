import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import type { LLMInsight } from '../openai-service';

// Mock the OpenAI service module before importing the LLM service
const mockOpenAIService = {
  isAvailable: vi.fn() as MockedFunction<() => boolean>,
  generateHealthInsight: vi.fn() as MockedFunction<(healthData: unknown, repoInfo: { owner: string; repo: string }) => Promise<LLMInsight | null>>,
  generateRecommendations: vi.fn() as MockedFunction<(_data: unknown, repoInfo: { owner: string; repo: string }) => Promise<LLMInsight | null>>,
  analyzePRPatterns: vi.fn() as MockedFunction<(prData: unknown[], repoInfo: { owner: string; repo: string }) => Promise<LLMInsight | null>>
};

vi.mock('../openai-service', () => ({
  openAIService: mockOpenAIService
}));

// Import the LLM service after mocking
const { llmService } = await import('../llm-service');

describe('LLM Service', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    
    // Set up default mock implementations
    mockOpenAIService.isAvailable.mockReturnValue(true);
    mockOpenAIService.generateHealthInsight.mockResolvedValue({
      type: 'health',
      content: 'Mock health insight from OpenAI',
      confidence: 0.85,
      timestamp: new Date()
    });
    mockOpenAIService.generateRecommendations.mockResolvedValue({
      type: 'recommendation',
      content: '1. Mock recommendation from OpenAI\n2. Another suggestion\n3. Third recommendation',
      confidence: 0.8,
      timestamp: new Date()
    });
    mockOpenAIService.analyzePRPatterns.mockResolvedValue({
      type: 'pattern',
      content: 'Mock PR pattern analysis from OpenAI',
      confidence: 0.7,
      timestamp: new Date()
    });
    
    // Clear the LLM service cache
    llmService.clearCache();
  });

  describe('Service Availability', () => {
    it('should return true when OpenAI service is available', () => {
      mockOpenAIService.isAvailable.mockReturnValue(true);
      
      const isAvailable = llmService.isAvailable();
      
      expect(isAvailable).toBe(true);
      expect(mockOpenAIService.isAvailable).toHaveBeenCalledOnce();
    });

    it('should return false when OpenAI service is unavailable', () => {
      mockOpenAIService.isAvailable.mockReturnValue(false);
      
      const isAvailable = llmService.isAvailable();
      
      expect(isAvailable).toBe(false);
      expect(mockOpenAIService.isAvailable).toHaveBeenCalledOnce();
    });
  });

  describe('Health Insights', () => {
    const sampleHealthData = {
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
    const sampleRepoInfo = { owner: 'test', repo: 'repo' };

    it('should generate health insight using OpenAI when available', async () => {
      const insight = await llmService.generateHealthInsight(sampleHealthData, sampleRepoInfo);
      
      expect(insight).toBeTruthy();
      expect(insight?.type).toBe('health');
      expect(insight?.content).toBe('Mock health insight from OpenAI');
      expect(insight?.confidence).toBe(0.85);
      expect(insight?.timestamp).toBeInstanceOf(Date);
      expect(mockOpenAIService.generateHealthInsight).toHaveBeenCalledWith(sampleHealthData, sampleRepoInfo);
    });

    it('should use fallback when OpenAI fails', async () => {
      mockOpenAIService.generateHealthInsight.mockRejectedValue(new Error('API Error'));
      
      const insight = await llmService.generateHealthInsight(sampleHealthData, sampleRepoInfo);
      
      expect(insight).toBeTruthy();
      expect(insight?.type).toBe('health');
      expect(insight?.content).toContain('needs attention'); // score 45 < 60
      expect(insight?.content).toContain('Priority: pr merge time'); // critical factor
      expect(insight?.confidence).toBe(0.6); // Lower confidence for fallback
      expect(mockOpenAIService.generateHealthInsight).toHaveBeenCalledWith(sampleHealthData, sampleRepoInfo);
    });

    it('should use fallback when OpenAI returns null', async () => {
      mockOpenAIService.generateHealthInsight.mockResolvedValue(null);
      
      const insight = await llmService.generateHealthInsight(sampleHealthData, sampleRepoInfo);
      
      expect(insight).toBeTruthy();
      expect(insight?.type).toBe('health');
      expect(insight?.content).toContain('needs attention'); // score 45 < 60
      expect(insight?.content).toContain('Priority: pr merge time'); // critical factor
      expect(insight?.confidence).toBe(0.6);
    });

    it('should generate appropriate fallback for excellent health score', async () => {
      mockOpenAIService.generateHealthInsight.mockResolvedValue(null);
      const excellentHealthData = { ...sampleHealthData, score: 85 };
      
      const insight = await llmService.generateHealthInsight(excellentHealthData, sampleRepoInfo);
      
      expect(insight?.content).toContain('excellent');
    });
  });

  describe('Recommendations', () => {
    const sampleData = {
      health: { score: 55 },
      activity: { weeklyVelocity: 3 },
      trends: [{ metric: 'PR Velocity', change: -10 }]
    };
    const sampleRepoInfo = { owner: 'test', repo: 'repo' };

    it('should generate recommendations using OpenAI when available', async () => {
      const insight = await llmService.generateRecommendations(sampleData, sampleRepoInfo);
      
      expect(insight).toBeTruthy();
      expect(insight?.type).toBe('recommendation');
      expect(insight?.content).toBe('1. Mock recommendation from OpenAI\n2. Another suggestion\n3. Third recommendation');
      expect(insight?.confidence).toBe(0.8);
      expect(mockOpenAIService.generateRecommendations).toHaveBeenCalledWith(sampleData, sampleRepoInfo);
    });

    it('should use fallback when OpenAI fails', async () => {
      mockOpenAIService.generateRecommendations.mockRejectedValue(new Error('API Error'));
      
      const insight = await llmService.generateRecommendations(sampleData, sampleRepoInfo);
      
      expect(insight).toBeTruthy();
      expect(insight?.type).toBe('recommendation');
      expect(insight?.content).toContain('1.');
      expect(insight?.content).toContain('breaking down large PRs'); // velocity < 5
      expect(insight?.confidence).toBe(0.5); // Lower confidence for fallback
    });

    it('should include specific recommendations for low health score', async () => {
      mockOpenAIService.generateRecommendations.mockResolvedValue(null);
      const lowHealthData = { ...sampleData, health: { score: 65 } };
      
      const insight = await llmService.generateRecommendations(lowHealthData, sampleRepoInfo);
      
      expect(insight?.content).toContain('code review coverage');
    });

    it('should include velocity recommendations for low activity', async () => {
      mockOpenAIService.generateRecommendations.mockResolvedValue(null);
      const lowVelocityData = { ...sampleData, activity: { weeklyVelocity: 2 } };
      
      const insight = await llmService.generateRecommendations(lowVelocityData, sampleRepoInfo);
      
      expect(insight?.content).toContain('breaking down large PRs');
    });
  });

  describe('Caching', () => {
    const sampleHealthData = {
      score: 80,
      trend: 'improving',
      factors: [],
      recommendations: []
    };
    const sampleRepoInfo = { owner: 'test', repo: 'repo' };

    it('should cache health insights correctly', async () => {
      // First call should hit OpenAI
      const insight1 = await llmService.generateHealthInsight(sampleHealthData, sampleRepoInfo);
      
      // Second call with same data should return cached result
      const insight2 = await llmService.generateHealthInsight(sampleHealthData, sampleRepoInfo);
      
      expect(insight1?.content).toBe(insight2?.content);
      expect(insight1?.timestamp).toBe(insight2?.timestamp); // Same object reference from cache
      expect(mockOpenAIService.generateHealthInsight).toHaveBeenCalledOnce(); // Only called once due to caching
    });

    it('should not use cache for different _data', async () => {
      const healthData1 = { ...sampleHealthData, score: 70 };
      const healthData2 = { ...sampleHealthData, score: 80 };
      
      // Clear mocks to ensure clean count
      mockOpenAIService.generateHealthInsight.mockClear();
      
      await llmService.generateHealthInsight(healthData1, sampleRepoInfo);
      await llmService.generateHealthInsight(healthData2, sampleRepoInfo);
      
      expect(mockOpenAIService.generateHealthInsight).toHaveBeenCalledTimes(2);
    });

    it('should clear cache when requested', async () => {
      // Clear mocks to ensure clean count
      mockOpenAIService.generateHealthInsight.mockClear();
      
      await llmService.generateHealthInsight(sampleHealthData, sampleRepoInfo);
      expect(mockOpenAIService.generateHealthInsight).toHaveBeenCalledTimes(1);
      
      llmService.clearCache();
      
      await llmService.generateHealthInsight(sampleHealthData, sampleRepoInfo);
      expect(mockOpenAIService.generateHealthInsight).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cache Management', () => {
    it('should provide cache statistics with correct structure', () => {
      const stats = llmService.getCacheStats();
      
      expect(stats).toHaveProperty('memorySize');
      expect(stats).toHaveProperty('persistentSize');
      expect(stats).toHaveProperty('hitRate');
      expect(typeof stats.memorySize).toBe('number');
      expect(typeof stats.persistentSize).toBe('number');
      expect(typeof stats.hitRate).toBe('number');
      expect(stats.memorySize).toBeGreaterThanOrEqual(0);
      expect(stats.persistentSize).toBeGreaterThanOrEqual(0);
      expect(stats.hitRate).toBeGreaterThanOrEqual(0);
      expect(stats.hitRate).toBeLessThanOrEqual(1);
    });

    it('should clean up expired cache entries without _errors', () => {
      expect(() => {
        llmService.cleanupCache();
      }).not.toThrow();
    });

    it('should invalidate repository-specific cache', () => {
      expect(() => {
        llmService.invalidateRepository('test-owner', 'test-repo');
      }).not.toThrow();
    });
  });

  describe('PR Pattern Analysis', () => {
    const samplePRData = [
      { merged_at: '2023-01-01', additions: 100, deletions: 50 },
      { merged_at: null, additions: 200, deletions: 100 },
      { merged_at: '2023-01-02', additions: 50, deletions: 25 }
    ];
    const sampleRepoInfo = { owner: 'test', repo: 'repo' };

    it('should analyze PR patterns using OpenAI when available', async () => {
      const insight = await llmService.analyzePRPatterns(samplePRData, sampleRepoInfo);
      
      expect(insight).toBeTruthy();
      expect(insight?.type).toBe('pattern');
      expect(insight?.content).toBe('Mock PR pattern analysis from OpenAI');
      expect(insight?.confidence).toBe(0.7);
      expect(mockOpenAIService.analyzePRPatterns).toHaveBeenCalledWith(samplePRData, sampleRepoInfo);
    });

    it('should use fallback when OpenAI fails', async () => {
      mockOpenAIService.analyzePRPatterns.mockRejectedValue(new Error('API Error'));
      
      const insight = await llmService.analyzePRPatterns(samplePRData, sampleRepoInfo);
      
      expect(insight).toBeTruthy();
      expect(insight?.type).toBe('pattern');
      expect(insight?.content).toContain('Analyzed 3 PRs with 67% merge rate'); // 2 merged out of 3
      expect(insight?.content).toContain('Good PR workflow'); // 67% is between 60-80%
      expect(insight?.confidence).toBe(0.5);
    });
  });
});