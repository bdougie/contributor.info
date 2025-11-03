import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import {
  saveConfidenceToHistory,
  getConfidenceHistory,
  calculateConfidenceTrend,
  getLatestConfidenceFromHistory,
  type ConfidenceBreakdownData,
} from '../confidence-history.service';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://egcxzonpmmcirmgqdrla.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

// Skip integration tests in CI or when Supabase credentials are not available
const shouldRunIntegrationTests = !process.env.CI && SUPABASE_ANON_KEY.length > 0;

if (!shouldRunIntegrationTests) {
  console.log(
    '[Integration Tests] Skipping Confidence History integration tests - requires Supabase credentials and non-CI environment'
  );
}

const describeOrSkip = shouldRunIntegrationTests ? describe : describe.skip;

describeOrSkip('Confidence History Integration Tests', () => {
  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
  const testOwner = 'test-org';
  const testRepo = `test-repo-${Date.now()}`;

  beforeEach(async () => {
    // Clean up any existing test data
    await supabase
      .from('repository_confidence_history')
      .delete()
      .eq('repository_owner', testOwner)
      .eq('repository_name', testRepo);
  });

  afterAll(async () => {
    // Final cleanup
    await supabase
      .from('repository_confidence_history')
      .delete()
      .eq('repository_owner', testOwner)
      .eq('repository_name', testRepo);
  });

  describe('saveConfidenceToHistory', () => {
    it('should save confidence score to database', async () => {
      const breakdown: ConfidenceBreakdownData = {
        starForkConfidence: 75,
        engagementConfidence: 80,
        retentionConfidence: 65,
        qualityConfidence: 90,
        totalStargazers: 1000,
        totalForkers: 200,
        contributorCount: 50,
        conversionRate: 0.05,
      };

      await saveConfidenceToHistory(supabase, testOwner, testRepo, 30, 77, breakdown, 250);

      // Verify data was saved
      const { data, error } = await supabase
        .from('repository_confidence_history')
        .select('*')
        .eq('repository_owner', testOwner)
        .eq('repository_name', testRepo)
        .maybeSingle();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.confidence_score).toBe(77);
      expect(data?.time_range_days).toBe(30);
      expect(data?.calculation_time_ms).toBe(250);
      expect(data?.breakdown).toBeDefined();
    });

    it('should validate score range', async () => {
      await expect(
        saveConfidenceToHistory(supabase, testOwner, testRepo, 30, 101, undefined)
      ).rejects.toThrow('Score must be between 0-100');

      await expect(
        saveConfidenceToHistory(supabase, testOwner, testRepo, 30, -1, undefined)
      ).rejects.toThrow('Score must be between 0-100');
    });

    it('should validate time range', async () => {
      await expect(
        saveConfidenceToHistory(supabase, testOwner, testRepo, 0, 50, undefined)
      ).rejects.toThrow('Time range must be positive');

      await expect(
        saveConfidenceToHistory(supabase, testOwner, testRepo, -30, 50, undefined)
      ).rejects.toThrow('Time range must be positive');
    });

    it('should validate breakdown data structure', async () => {
      const invalidBreakdown = {
        starForkConfidence: 101, // Invalid: > 100
        engagementConfidence: 80,
        retentionConfidence: 65,
        qualityConfidence: 90,
      } as ConfidenceBreakdownData;

      await expect(
        saveConfidenceToHistory(supabase, testOwner, testRepo, 30, 50, invalidBreakdown)
      ).rejects.toThrow('Invalid breakdown data structure');
    });

    it('should validate required fields', async () => {
      await expect(
        saveConfidenceToHistory(supabase, '', testRepo, 30, 50, undefined)
      ).rejects.toThrow('Owner and repo are required');

      await expect(
        saveConfidenceToHistory(supabase, testOwner, '', 30, 50, undefined)
      ).rejects.toThrow('Owner and repo are required');
    });
  });

  describe('getConfidenceHistory', () => {
    beforeAll(async () => {
      // Insert test data for history retrieval
      const scores = [
        { days: 30, score: 70, timestamp: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        { days: 30, score: 75, timestamp: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
        { days: 30, score: 80, timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        { days: 30, score: 85, timestamp: new Date() },
      ];

      for (const { days, score, timestamp } of scores) {
        const periodStart = new Date(timestamp);
        periodStart.setDate(periodStart.getDate() - days);

        await supabase.from('repository_confidence_history').insert({
          repository_owner: testOwner,
          repository_name: testRepo,
          confidence_score: score,
          time_range_days: days,
          calculated_at: timestamp.toISOString(),
          period_start: periodStart.toISOString(),
          period_end: timestamp.toISOString(),
          data_version: 1,
        });
      }
    });

    it('should fetch historical scores in chronological order', async () => {
      const history = await getConfidenceHistory(supabase, testOwner, testRepo, 30, 4);

      expect(history.length).toBe(4);
      expect(history[0].confidenceScore).toBe(70);
      expect(history[1].confidenceScore).toBe(75);
      expect(history[2].confidenceScore).toBe(80);
      expect(history[3].confidenceScore).toBe(85);
    });

    it('should limit results by lookback periods', async () => {
      const history = await getConfidenceHistory(supabase, testOwner, testRepo, 30, 2);

      expect(history.length).toBeLessThanOrEqual(2);
    });

    it('should return empty array for non-existent repository', async () => {
      const history = await getConfidenceHistory(supabase, 'nonexistent', 'repo', 30, 4);

      expect(history).toEqual([]);
    });
  });

  describe('calculateConfidenceTrend', () => {
    it('should calculate improving trend', () => {
      const history = [
        {
          id: '1',
          repositoryOwner: testOwner,
          repositoryName: testRepo,
          confidenceScore: 70,
          timeRangeDays: 30,
          calculatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          periodStart: new Date(),
          periodEnd: new Date(),
          dataVersion: 1,
        },
        {
          id: '2',
          repositoryOwner: testOwner,
          repositoryName: testRepo,
          confidenceScore: 80,
          timeRangeDays: 30,
          calculatedAt: new Date(),
          periodStart: new Date(),
          periodEnd: new Date(),
          dataVersion: 1,
        },
      ];

      const trend = calculateConfidenceTrend(history);

      expect(trend).toBeDefined();
      expect(trend?.direction).toBe('improving');
      expect(trend?.currentScore).toBe(80);
      expect(trend?.previousScore).toBe(70);
      expect(trend?.changePercent).toBeCloseTo(14.29, 1);
    });

    it('should calculate declining trend', () => {
      const history = [
        {
          id: '1',
          repositoryOwner: testOwner,
          repositoryName: testRepo,
          confidenceScore: 80,
          timeRangeDays: 30,
          calculatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          periodStart: new Date(),
          periodEnd: new Date(),
          dataVersion: 1,
        },
        {
          id: '2',
          repositoryOwner: testOwner,
          repositoryName: testRepo,
          confidenceScore: 70,
          timeRangeDays: 30,
          calculatedAt: new Date(),
          periodStart: new Date(),
          periodEnd: new Date(),
          dataVersion: 1,
        },
      ];

      const trend = calculateConfidenceTrend(history);

      expect(trend).toBeDefined();
      expect(trend?.direction).toBe('declining');
      expect(trend?.currentScore).toBe(70);
      expect(trend?.previousScore).toBe(80);
    });

    it('should calculate stable trend for small changes', () => {
      const history = [
        {
          id: '1',
          repositoryOwner: testOwner,
          repositoryName: testRepo,
          confidenceScore: 75,
          timeRangeDays: 30,
          calculatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          periodStart: new Date(),
          periodEnd: new Date(),
          dataVersion: 1,
        },
        {
          id: '2',
          repositoryOwner: testOwner,
          repositoryName: testRepo,
          confidenceScore: 77,
          timeRangeDays: 30,
          calculatedAt: new Date(),
          periodStart: new Date(),
          periodEnd: new Date(),
          dataVersion: 1,
        },
      ];

      const trend = calculateConfidenceTrend(history);

      expect(trend).toBeDefined();
      expect(trend?.direction).toBe('stable');
      expect(Math.abs(trend?.changePercent || 0)).toBeLessThan(5);
    });

    it('should return null for insufficient data', () => {
      const history = [
        {
          id: '1',
          repositoryOwner: testOwner,
          repositoryName: testRepo,
          confidenceScore: 75,
          timeRangeDays: 30,
          calculatedAt: new Date(),
          periodStart: new Date(),
          periodEnd: new Date(),
          dataVersion: 1,
        },
      ];

      const trend = calculateConfidenceTrend(history);

      expect(trend).toBeNull();
    });
  });

  describe('getLatestConfidenceFromHistory', () => {
    beforeAll(async () => {
      await saveConfidenceToHistory(supabase, testOwner, testRepo, 30, 85);
    });

    it('should fetch the most recent score', async () => {
      const latest = await getLatestConfidenceFromHistory(supabase, testOwner, testRepo, 30);

      expect(latest).toBeDefined();
      expect(latest?.confidenceScore).toBe(85);
      expect(latest?.timeRangeDays).toBe(30);
    });

    it('should return null for non-existent repository', async () => {
      const latest = await getLatestConfidenceFromHistory(supabase, 'nonexistent', 'repo', 30);

      expect(latest).toBeNull();
    });
  });
});
