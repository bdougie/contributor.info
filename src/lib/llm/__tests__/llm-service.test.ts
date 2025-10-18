import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import type { LLMInsight } from '../openai-service';
import type { LLMCallMetadata } from '../posthog-openai-service';

// Define types for test data
interface HealthData {
  score: number;
  trend: string;
  factors: Array<{
    name: string;
    score: number;
    status: string;
    description: string;
  }>;
  recommendations: string[];
}

interface RepoInfo {
  owner: string;
  repo: string;
}

interface PRData {
  merged_at: string | null;
  additions: number;
  deletions: number;
}

interface RecommendationData {
  health?: { score: number };
  activity?: { weeklyVelocity: number };
  trends?: Array<{ metric: string; change: number }>;
}

// Mock the OpenAI service module before importing the LLM service
const mockOpenAIService = {
  isAvailable: vi.fn() as MockedFunction<() => boolean>,
  generateHealthInsight: vi.fn() as MockedFunction<
    (healthData: HealthData, repoInfo: RepoInfo) => Promise<LLMInsight | null>
  >,
  generateRecommendations: vi.fn() as MockedFunction<
    (data: RecommendationData, repoInfo: RepoInfo) => Promise<LLMInsight | null>
  >,
  analyzePRPatterns: vi.fn() as MockedFunction<
    (prData: PRData[], repoInfo: RepoInfo) => Promise<LLMInsight | null>
  >,
};

// Mock the PostHog OpenAI service module
const mockPostHogOpenAIService = {
  isAvailable: vi.fn() as MockedFunction<() => boolean>,
  isTrackingEnabled: vi.fn() as MockedFunction<() => boolean>,
  generateHealthInsight: vi.fn() as MockedFunction<
    (
      healthData: HealthData,
      repoInfo: RepoInfo,
      metadata?: LLMCallMetadata
    ) => Promise<LLMInsight | null>
  >,
  generateRecommendations: vi.fn() as MockedFunction<
    (
      data: RecommendationData,
      repoInfo: RepoInfo,
      metadata?: LLMCallMetadata
    ) => Promise<LLMInsight | null>
  >,
  analyzePRPatterns: vi.fn() as MockedFunction<
    (prData: PRData[], repoInfo: RepoInfo, metadata?: LLMCallMetadata) => Promise<LLMInsight | null>
  >,
};

vi.mock('../openai-service', () => ({
  openAIService: mockOpenAIService,
}));

vi.mock('../posthog-openai-service', () => ({
  posthogOpenAIService: mockPostHogOpenAIService,
}));

// Import the LLM service after mocking
const { llmService } = await import('../llm-service');

describe('LLM Service', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Clear localStorage to prevent test pollution from cache service
    localStorage.clear();

    // Set up default mock implementations for OpenAI service
    mockOpenAIService.isAvailable.mockReturnValue(true);
    mockOpenAIService.generateHealthInsight.mockResolvedValue({
      type: 'health',
      content: 'Mock health insight from OpenAI',
      confidence: 0.85,
      timestamp: new Date(),
    });
    mockOpenAIService.generateRecommendations.mockResolvedValue({
      type: 'recommendation',
      content: '1. Mock recommendation from OpenAI\n2. Another suggestion\n3. Third recommendation',
      confidence: 0.8,
      timestamp: new Date(),
    });
    mockOpenAIService.analyzePRPatterns.mockResolvedValue({
      type: 'pattern',
      content: 'Mock PR pattern analysis from OpenAI',
      confidence: 0.7,
      timestamp: new Date(),
    });

    // Set up default mock implementations for PostHog OpenAI service
    mockPostHogOpenAIService.isAvailable.mockReturnValue(true);
    mockPostHogOpenAIService.isTrackingEnabled.mockReturnValue(true);
    mockPostHogOpenAIService.generateHealthInsight.mockResolvedValue({
      type: 'health',
      content: 'Mock health insight from OpenAI',
      confidence: 0.85,
      timestamp: new Date(),
    });
    mockPostHogOpenAIService.generateRecommendations.mockResolvedValue({
      type: 'recommendation',
      content: '1. Mock recommendation from OpenAI\n2. Another suggestion\n3. Third recommendation',
      confidence: 0.8,
      timestamp: new Date(),
    });
    mockPostHogOpenAIService.analyzePRPatterns.mockResolvedValue({
      type: 'pattern',
      content: 'Mock PR pattern analysis from OpenAI',
      confidence: 0.7,
      timestamp: new Date(),
    });

    // Clear the LLM service cache
    llmService.clearCache();
  });

  describe('Service Availability', () => {
    it('should return true when PostHog OpenAI service is available', () => {
      mockPostHogOpenAIService.isAvailable.mockReturnValue(true);

      const isAvailable = llmService.isAvailable();

      expect(isAvailable).toBe(true);
      expect(mockPostHogOpenAIService.isAvailable).toHaveBeenCalledOnce();
    });

    it('should return false when both PostHog and OpenAI services are unavailable', () => {
      mockPostHogOpenAIService.isAvailable.mockReturnValue(false);
      mockOpenAIService.isAvailable.mockReturnValue(false);

      const isAvailable = llmService.isAvailable();

      expect(isAvailable).toBe(false);
      expect(mockPostHogOpenAIService.isAvailable).toHaveBeenCalledOnce();
      expect(mockOpenAIService.isAvailable).toHaveBeenCalledOnce();
    });

    it('should return true when PostHog is unavailable but OpenAI is available', () => {
      mockPostHogOpenAIService.isAvailable.mockReturnValue(false);
      mockOpenAIService.isAvailable.mockReturnValue(true);

      const isAvailable = llmService.isAvailable();

      expect(isAvailable).toBe(true);
      expect(mockPostHogOpenAIService.isAvailable).toHaveBeenCalledOnce();
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
          description: 'Average merge time is 120 hours',
        },
      ],
      recommendations: ['Implement review SLAs'],
    };
    const sampleRepoInfo = { owner: 'test', repo: 'repo' };

    it('should generate health insight using PostHog OpenAI when available', async () => {
      const insight = await llmService.generateHealthInsight(sampleHealthData, sampleRepoInfo);

      expect(insight).toBeTruthy();
      expect(insight?.type).toBe('health');
      expect(insight?.content).toBe('Mock health insight from OpenAI');
      expect(insight?.confidence).toBe(0.85);
      expect(insight?.timestamp).toBeInstanceOf(Date);
      expect(mockPostHogOpenAIService.generateHealthInsight).toHaveBeenCalledWith(
        sampleHealthData,
        sampleRepoInfo,
        undefined // metadata parameter
      );
    });

    it('should use fallback when PostHog OpenAI fails', async () => {
      // Use slightly different data to avoid cache collision
      const testHealthData = {
        score: 46, // different from 45
        trend: 'declining',
        factors: [
          {
            name: 'PR Merge Time',
            score: 30,
            status: 'critical',
            description: 'Average merge time is 120 hours',
          },
        ],
        recommendations: ['Implement review SLAs'],
      };

      // Clear cache and reset all mocks to ensure clean test state
      llmService.clearCache();
      vi.clearAllMocks();

      // Set up PostHog to fail
      mockPostHogOpenAIService.isAvailable.mockReturnValue(true);
      mockPostHogOpenAIService.isTrackingEnabled.mockReturnValue(true);
      mockPostHogOpenAIService.generateHealthInsight.mockRejectedValueOnce(new Error('API Error'));

      const insight = await llmService.generateHealthInsight(testHealthData, sampleRepoInfo);

      expect(insight).toBeTruthy();
      expect(insight?.type).toBe('health');
      expect(insight?.content).toContain('needs attention'); // score 46 < 60
      expect(insight?.content).toContain('Priority: pr merge time'); // critical factor
      expect(insight?.confidence).toBe(0.6); // Lower confidence for fallback
      expect(mockPostHogOpenAIService.generateHealthInsight).toHaveBeenCalledWith(
        testHealthData,
        sampleRepoInfo,
        undefined
      );
    });

    it('should use fallback when PostHog OpenAI returns null', async () => {
      // Use different data to avoid cache collision
      const testHealthData = {
        score: 47, // different score
        trend: 'declining',
        factors: [
          {
            name: 'PR Merge Time',
            score: 30,
            status: 'critical',
            description: 'Average merge time is 120 hours',
          },
        ],
        recommendations: ['Implement review SLAs'],
      };

      // Clear cache and reset all mocks to ensure clean test state
      llmService.clearCache();
      vi.clearAllMocks();

      // Set up PostHog to return null
      mockPostHogOpenAIService.isAvailable.mockReturnValue(true);
      mockPostHogOpenAIService.isTrackingEnabled.mockReturnValue(true);
      mockPostHogOpenAIService.generateHealthInsight.mockResolvedValueOnce(null);

      const insight = await llmService.generateHealthInsight(testHealthData, sampleRepoInfo);

      expect(insight).toBeTruthy();
      expect(insight?.type).toBe('health');
      expect(insight?.content).toContain('needs attention'); // score 47 < 60
      expect(insight?.content).toContain('Priority: pr merge time'); // critical factor
      expect(insight?.confidence).toBe(0.6);
    });

    it('should generate appropriate fallback for excellent health score', async () => {
      mockPostHogOpenAIService.generateHealthInsight.mockResolvedValue(null);
      const excellentHealthData = { ...sampleHealthData, score: 85 };

      const insight = await llmService.generateHealthInsight(excellentHealthData, sampleRepoInfo);

      expect(insight?.content).toContain('excellent');
    });
  });

  describe('Recommendations', () => {
    const sampleData = {
      health: { score: 55 },
      activity: { weeklyVelocity: 3 },
      trends: [{ metric: 'PR Velocity', change: -10 }],
    };
    const sampleRepoInfo = { owner: 'test', repo: 'repo' };

    it('should generate recommendations using PostHog OpenAI when available', async () => {
      const insight = await llmService.generateRecommendations(sampleData, sampleRepoInfo);

      expect(insight).toBeTruthy();
      expect(insight?.type).toBe('recommendation');
      expect(insight?.content).toBe(
        '1. Mock recommendation from OpenAI\n2. Another suggestion\n3. Third recommendation'
      );
      expect(insight?.confidence).toBe(0.8);
      expect(mockPostHogOpenAIService.generateRecommendations).toHaveBeenCalledWith(
        sampleData,
        sampleRepoInfo,
        undefined
      );
    });

    it('should use fallback when PostHog OpenAI fails', async () => {
      // Use different data to avoid cache collision
      const testData = {
        health: { score: 56 }, // different from 55
        activity: { weeklyVelocity: 3 },
        trends: [{ metric: 'PR Velocity', change: -10 }],
      };

      // Clear cache and reset all mocks to ensure clean test state
      llmService.clearCache();
      vi.clearAllMocks();

      // Set up PostHog to fail
      mockPostHogOpenAIService.isAvailable.mockReturnValue(true);
      mockPostHogOpenAIService.isTrackingEnabled.mockReturnValue(true);
      mockPostHogOpenAIService.generateRecommendations.mockRejectedValueOnce(
        new Error('API Error')
      );

      const insight = await llmService.generateRecommendations(testData, sampleRepoInfo);

      expect(insight).toBeTruthy();
      expect(insight?.type).toBe('recommendation');
      expect(insight?.content).toContain('1.');
      expect(insight?.content).toContain('breaking down large PRs'); // velocity < 5
      expect(insight?.confidence).toBe(0.5); // Lower confidence for fallback
    });

    it('should include specific recommendations for low health score', async () => {
      mockPostHogOpenAIService.generateRecommendations.mockResolvedValue(null);
      const lowHealthData = { ...sampleData, health: { score: 65 } };

      const insight = await llmService.generateRecommendations(lowHealthData, sampleRepoInfo);

      expect(insight?.content).toContain('code review coverage');
    });

    it('should include velocity recommendations for low activity', async () => {
      mockPostHogOpenAIService.generateRecommendations.mockResolvedValue(null);
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
      recommendations: [],
    };
    const sampleRepoInfo = { owner: 'test', repo: 'repo' };

    it('should cache health insights correctly', async () => {
      // First call should hit PostHog OpenAI
      const insight1 = await llmService.generateHealthInsight(sampleHealthData, sampleRepoInfo);

      // Second call with same data should return cached result
      const insight2 = await llmService.generateHealthInsight(sampleHealthData, sampleRepoInfo);

      expect(insight1?.content).toBe(insight2?.content);
      expect(insight1?.timestamp).toBe(insight2?.timestamp); // Same object reference from cache
      expect(mockPostHogOpenAIService.generateHealthInsight).toHaveBeenCalledOnce(); // Only called once due to caching
    });

    it('should not use cache for different data', async () => {
      // Clear cache and reset all mocks to ensure clean state
      llmService.clearCache();
      localStorage.clear();
      vi.clearAllMocks();

      // Set up PostHog to work properly
      mockPostHogOpenAIService.isAvailable.mockReturnValue(true);
      mockPostHogOpenAIService.isTrackingEnabled.mockReturnValue(true);
      mockPostHogOpenAIService.generateHealthInsight.mockResolvedValue({
        type: 'health',
        content: 'Mock health insight from OpenAI',
        confidence: 0.85,
        timestamp: new Date(),
      });

      const healthData1 = { ...sampleHealthData, score: 71 }; // unique scores
      const healthData2 = { ...sampleHealthData, score: 82 };

      await llmService.generateHealthInsight(healthData1, sampleRepoInfo);
      await llmService.generateHealthInsight(healthData2, sampleRepoInfo);

      expect(mockPostHogOpenAIService.generateHealthInsight).toHaveBeenCalledTimes(2);
    });

    it('should clear cache when requested', async () => {
      // Use unique data for this test
      const testData = { ...sampleHealthData, score: 83 };

      // Clear cache and reset all mocks to ensure clean state
      llmService.clearCache();
      localStorage.clear();
      vi.clearAllMocks();

      // Set up PostHog to work properly
      mockPostHogOpenAIService.isAvailable.mockReturnValue(true);
      mockPostHogOpenAIService.isTrackingEnabled.mockReturnValue(true);
      mockPostHogOpenAIService.generateHealthInsight.mockResolvedValue({
        type: 'health',
        content: 'Mock health insight from OpenAI',
        confidence: 0.85,
        timestamp: new Date(),
      });

      await llmService.generateHealthInsight(testData, sampleRepoInfo);
      expect(mockPostHogOpenAIService.generateHealthInsight).toHaveBeenCalledTimes(1);

      llmService.clearCache();
      localStorage.clear(); // Also clear localStorage to ensure persistent cache is cleared

      await llmService.generateHealthInsight(testData, sampleRepoInfo);
      expect(mockPostHogOpenAIService.generateHealthInsight).toHaveBeenCalledTimes(2);
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

    it('should clean up expired cache entries without errors', () => {
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
      { merged_at: '2023-01-02', additions: 50, deletions: 25 },
    ];
    const sampleRepoInfo = { owner: 'test', repo: 'repo' };

    it('should analyze PR patterns using PostHog OpenAI when available', async () => {
      const insight = await llmService.analyzePRPatterns(samplePRData, sampleRepoInfo);

      expect(insight).toBeTruthy();
      expect(insight?.type).toBe('pattern');
      expect(insight?.content).toBe('Mock PR pattern analysis from OpenAI');
      expect(insight?.confidence).toBe(0.7);
      expect(mockPostHogOpenAIService.analyzePRPatterns).toHaveBeenCalledWith(
        samplePRData,
        sampleRepoInfo,
        undefined
      );
    });

    it('should use fallback when PostHog OpenAI fails', async () => {
      // Use slightly different data to avoid cache collision with previous test
      const testPRData = [
        { merged_at: '2023-01-01', additions: 101, deletions: 51 }, // slightly different
        { merged_at: null, additions: 201, deletions: 101 },
        { merged_at: '2023-01-02', additions: 51, deletions: 26 },
      ];

      // Clear cache and reset all mocks to ensure clean test state
      llmService.clearCache();
      vi.clearAllMocks();

      // Set up PostHog to fail
      mockPostHogOpenAIService.isAvailable.mockReturnValue(true);
      mockPostHogOpenAIService.isTrackingEnabled.mockReturnValue(true);
      mockPostHogOpenAIService.analyzePRPatterns.mockRejectedValueOnce(new Error('API Error'));

      const insight = await llmService.analyzePRPatterns(testPRData, sampleRepoInfo);

      expect(insight).toBeTruthy();
      expect(insight?.type).toBe('pattern');
      expect(insight?.content).toContain('Analyzed 3 PRs with 67% merge rate'); // 2 merged out of 3
      expect(insight?.content).toContain('Good PR workflow'); // 67% is between 60-80%
      expect(insight?.confidence).toBe(0.5);
    });
  });

  describe('Contributor Summary Fallback Logic', () => {
    const sampleRepoInfo = { owner: 'test', repo: 'repo' };

    beforeEach(() => {
      llmService.clearCache();
      vi.clearAllMocks();
      mockPostHogOpenAIService.isAvailable.mockReturnValue(false);
      mockOpenAIService.isAvailable.mockReturnValue(false);
    });

    it('should generate specific summary with merged PRs and focus areas', async () => {
      const contributorData = {
        recentPRs: [
          {
            id: '1',
            title: 'fix: authentication token validation',
            merged_at: '2023-01-01',
            state: 'merged' as const,
          },
          {
            id: '2',
            title: 'feat: add login flow',
            merged_at: '2023-01-02',
            state: 'merged' as const,
          },
        ],
        recentIssues: [],
        recentReviews: [],
        recentDiscussions: [],
      };

      const insight = await llmService.generateContributorSummary(contributorData, sampleRepoInfo);

      expect(insight).toBeTruthy();
      expect(insight?.type).toBe('contributor_summary');
      expect(insight?.content).toContain('Fixed');
      expect(insight?.content).toContain('authentication');
      expect(insight?.confidence).toBe(0.6);
    });

    it('should detect UI focus area from PR titles', async () => {
      const contributorData = {
        recentPRs: [
          {
            id: '1',
            title: 'Update button component styles',
            merged_at: '2023-01-01',
            state: 'merged' as const,
          },
          {
            id: '2',
            title: 'Improve responsive layout',
            merged_at: '2023-01-02',
            state: 'merged' as const,
          },
        ],
        recentIssues: [],
        recentReviews: [],
        recentDiscussions: [],
      };

      const insight = await llmService.generateContributorSummary(contributorData, sampleRepoInfo);

      expect(insight?.content).toMatch(/UI|interface/i);
    });

    it('should handle multiple focus areas correctly', async () => {
      const contributorData = {
        recentPRs: [
          {
            id: '1',
            title: 'fix: API authentication endpoint',
            merged_at: '2023-01-01',
            state: 'merged' as const,
          },
        ],
        recentIssues: [{ id: '1', title: 'Add tests for login flow', state: 'open' as const }],
        recentReviews: [],
        recentDiscussions: [],
      };

      const insight = await llmService.generateContributorSummary(contributorData, sampleRepoInfo);

      expect(insight?.content).toMatch(/authentication.*testing|testing.*authentication/i);
    });

    it('should truncate long PR titles to 80 characters', async () => {
      const longTitle =
        'This is a very long pull request title that should be truncated to exactly eighty characters maximum length';
      const contributorData = {
        recentPRs: [
          {
            id: '1',
            title: longTitle,
            merged_at: '2023-01-01',
            state: 'merged' as const,
          },
        ],
        recentIssues: [],
        recentReviews: [],
        recentDiscussions: [],
      };

      const insight = await llmService.generateContributorSummary(contributorData, sampleRepoInfo);

      // Content should not contain the full long title
      expect(insight?.content.length).toBeLessThan(longTitle.length + 50);
      // Should contain ellipsis if truncated
      if (longTitle.length > 80) {
        expect(insight?.content).toContain('...');
      }
    });

    it('should handle conventional commit prefixes correctly', async () => {
      const contributorData = {
        recentPRs: [
          {
            id: '1',
            title: 'feat: implement user authentication',
            merged_at: '2023-01-01',
            state: 'merged' as const,
          },
        ],
        recentIssues: [],
        recentReviews: [],
        recentDiscussions: [],
      };

      const insight = await llmService.generateContributorSummary(contributorData, sampleRepoInfo);

      // Should not duplicate verbs
      expect(insight?.content).not.toContain('Added implement');
      expect(insight?.content).not.toContain('Fixed implement');
      // Should use proper verb
      expect(insight?.content).toMatch(/Added|Implemented/i);
    });

    it('should include discussion activity when present', async () => {
      const contributorData = {
        recentPRs: [
          {
            id: '1',
            title: 'Update documentation',
            merged_at: '2023-01-01',
            state: 'merged' as const,
          },
        ],
        recentIssues: [],
        recentReviews: [],
        recentDiscussions: [
          { id: '1', title: 'How to implement feature X' },
          { id: '2', title: 'Best practices for Y' },
          { id: '3', title: 'Discussion about Z' },
        ],
      };

      const insight = await llmService.generateContributorSummary(contributorData, sampleRepoInfo);

      expect(insight?.content).toContain('active in discussions');
    });

    it('should generate appropriate summary for issue-focused contributors', async () => {
      const contributorData = {
        recentPRs: [],
        recentIssues: [
          { id: '1', title: 'Bug in login flow', state: 'open' as const },
          { id: '2', title: 'Performance issue in dashboard', state: 'closed' as const },
          { id: '3', title: 'Feature request for dark mode', state: 'open' as const },
        ],
        recentReviews: [],
        recentDiscussions: [],
      };

      const insight = await llmService.generateContributorSummary(contributorData, sampleRepoInfo);

      expect(insight?.content).toContain('3 issues');
      expect(insight?.content).toMatch(/bug|feature|performance/i);
    });

    it('should handle review-focused contributors', async () => {
      const contributorData = {
        recentPRs: [],
        recentIssues: [],
        recentReviews: [
          { id: '1', state: 'APPROVED' },
          { id: '2', state: 'APPROVED' },
          { id: '3', state: 'CHANGES_REQUESTED' },
          { id: '4', state: 'APPROVED' },
          { id: '5', state: 'COMMENTED' },
        ],
        recentDiscussions: [],
      };

      const insight = await llmService.generateContributorSummary(contributorData, sampleRepoInfo);

      expect(insight?.content).toContain('5 reviews');
      expect(insight?.content).toContain('Active reviewer');
    });

    it('should provide minimal summary when no activity data', async () => {
      const contributorData = {
        recentPRs: [],
        recentIssues: [],
        recentReviews: [],
        recentDiscussions: [],
      };

      const insight = await llmService.generateContributorSummary(contributorData, sampleRepoInfo);

      expect(insight?.content).toBe('Active contributor');
      expect(insight?.confidence).toBe(0.4);
    });

    it('should detect API focus from keywords', async () => {
      const contributorData = {
        recentPRs: [
          {
            id: '1',
            title: 'Add REST endpoint for user management',
            merged_at: '2023-01-01',
            state: 'merged' as const,
          },
        ],
        recentIssues: [],
        recentReviews: [],
        recentDiscussions: [],
      };

      const insight = await llmService.generateContributorSummary(contributorData, sampleRepoInfo);

      expect(insight?.content).toMatch(/API/i);
    });

    it('should detect performance focus from keywords', async () => {
      const contributorData = {
        recentPRs: [],
        recentIssues: [
          { id: '1', title: 'Optimize database queries', state: 'open' as const },
          { id: '2', title: 'Improve page load performance', state: 'open' as const },
        ],
        recentReviews: [],
        recentDiscussions: [],
      };

      const insight = await llmService.generateContributorSummary(contributorData, sampleRepoInfo);

      expect(insight?.content).toMatch(/performance/i);
    });

    it('should limit focus areas to maximum of 2', async () => {
      const contributorData = {
        recentPRs: [
          {
            id: '1',
            title: 'fix: authentication bug in API endpoint with performance optimization',
            merged_at: '2023-01-01',
            state: 'merged' as const,
          },
        ],
        recentIssues: [
          { id: '1', title: 'Add tests for UI components', state: 'open' as const },
          { id: '2', title: 'Update documentation', state: 'open' as const },
        ],
        recentReviews: [],
        recentDiscussions: [],
      };

      const insight = await llmService.generateContributorSummary(contributorData, sampleRepoInfo);

      // Count number of focus areas in parentheses
      const focusMatch = insight?.content.match(/\(([^)]+)\)/);
      if (focusMatch) {
        const focusAreas = focusMatch[1].split(' and ');
        expect(focusAreas.length).toBeLessThanOrEqual(2);
      }
    });
  });
});
