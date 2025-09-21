import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCachedAnalyticsData,
  getCachedWorkspaceRepositories,
  getCachedRepositories,
  getCachedWorkspaceMetrics,
  getCachedWorkspaceTrendData,
  clearDemoDataCache,
  getDemoCacheStats,
} from '../demo-data-cache';

// Mock the console.log to avoid cluttering test output
const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('Demo Data Cache', () => {
  beforeEach(() => {
    clearDemoDataCache();
    consoleSpy.mockClear();
  });

  describe('getCachedAnalyticsData', () => {
    it('should generate data on first call', () => {
      const data = getCachedAnalyticsData();

      expect(data).toHaveProperty('activities');
      expect(data).toHaveProperty('contributors');
      expect(data).toHaveProperty('repositories');
      expect(data).toHaveProperty('trends');

      expect(data.activities).toHaveLength(200);
      expect(data.contributors).toHaveLength(50);
      expect(data.repositories).toHaveLength(5);

      expect(consoleSpy).toHaveBeenCalledWith(
        '%s',
        '🔄 Generating fresh analytics data for demo workspace'
      );
    });

    it('should return cached data on subsequent calls', () => {
      const data1 = getCachedAnalyticsData();
      consoleSpy.mockClear();
      const data2 = getCachedAnalyticsData();

      expect(data1).toBe(data2); // Same object reference
      expect(consoleSpy).not.toHaveBeenCalled(); // No regeneration message
    });

    it('should regenerate data after cache expires', () => {
      // Mock Date.now to simulate cache expiration
      const originalNow = Date.now;
      let mockTime = 1000000;

      vi.spyOn(Date, 'now').mockImplementation(() => mockTime);

      const data1 = getCachedAnalyticsData();

      // Simulate 6 minutes passing (cache expires after 5 minutes)
      mockTime += 6 * 60 * 1000;
      consoleSpy.mockClear();

      const data2 = getCachedAnalyticsData();

      expect(data1).not.toBe(data2); // Different object reference
      expect(consoleSpy).toHaveBeenCalledWith(
        '%s',
        '🔄 Generating fresh analytics data for demo workspace'
      );

      // Restore Date.now
      Date.now = originalNow;
    });
  });

  describe('getCachedWorkspaceRepositories', () => {
    it('should generate data on first call', () => {
      const repos = getCachedWorkspaceRepositories();

      expect(repos).toHaveLength(4);
      repos.forEach((repo) => {
        expect(repo.workspace_id).toBe('demo');
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '%s',
        '🔄 Generating fresh workspace repositories for demo workspace'
      );
    });

    it('should use custom workspace ID', () => {
      const customId = 'custom-workspace';
      const repos = getCachedWorkspaceRepositories(customId);

      repos.forEach((repo) => {
        expect(repo.workspace_id).toBe(customId);
      });
    });

    it('should return cached data on subsequent calls', () => {
      const repos1 = getCachedWorkspaceRepositories();
      consoleSpy.mockClear();
      const repos2 = getCachedWorkspaceRepositories();

      expect(repos1).toBe(repos2); // Same object reference
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('getCachedRepositories', () => {
    it('should generate data on first call', () => {
      const repos = getCachedRepositories();

      expect(repos).toHaveLength(5);
      expect(consoleSpy).toHaveBeenCalledWith(
        '%s',
        '🔄 Generating fresh repositories list for demo workspace'
      );
    });

    it('should return cached data on subsequent calls', () => {
      const repos1 = getCachedRepositories();
      consoleSpy.mockClear();
      const repos2 = getCachedRepositories();

      expect(repos1).toBe(repos2);
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('getCachedWorkspaceMetrics', () => {
    const mockRepos = [
      { id: '1', stars: 100, contributors: 10 },
      { id: '2', stars: 200, contributors: 20 },
    ] as unknown[];

    it('should generate metrics on first call', () => {
      const metrics = getCachedWorkspaceMetrics(mockRepos, '30d');

      expect(metrics).toHaveProperty('totalStars');
      expect(metrics).toHaveProperty('totalPRs');
      expect(metrics).toHaveProperty('totalContributors');
      expect(metrics).toHaveProperty('totalCommits');

      expect(consoleSpy).toHaveBeenCalledWith(
        '%s',
        '🔄 Generating fresh metrics for demo workspace (30d)'
      );
    });

    it('should cache metrics per time range and repo selection', () => {
      const metrics1 = getCachedWorkspaceMetrics(mockRepos, '30d');
      consoleSpy.mockClear();
      const metrics2 = getCachedWorkspaceMetrics(mockRepos, '30d');

      expect(metrics1).toBe(metrics2);
      expect(consoleSpy).not.toHaveBeenCalled();

      // Different time range should generate new data
      const metrics3 = getCachedWorkspaceMetrics(mockRepos, '7d');
      expect(metrics3).not.toBe(metrics1);
      expect(consoleSpy).toHaveBeenCalledWith(
        '%s',
        '🔄 Generating fresh metrics for demo workspace (7d)'
      );
    });

    it('should cache metrics per selected repositories', () => {
      const metrics1 = getCachedWorkspaceMetrics(mockRepos, '30d');
      const metrics2 = getCachedWorkspaceMetrics(mockRepos, '30d', ['1']);

      expect(metrics1).not.toBe(metrics2);
      expect(metrics1.totalStars).toBe(300);
      expect(metrics2.totalStars).toBe(100); // Only first repo
    });
  });

  describe('getCachedWorkspaceTrendData', () => {
    const mockRepos = [{ id: '1' }, { id: '2' }] as unknown[];

    it('should generate trend data on first call', () => {
      const trendData = getCachedWorkspaceTrendData(30, mockRepos);

      expect(trendData).toHaveLength(30);
      expect(consoleSpy).toHaveBeenCalledWith(
        '%s',
        '🔄 Generating fresh trend data for demo workspace (30 days)'
      );
    });

    it('should cache trend data per days and repo selection', () => {
      const trend1 = getCachedWorkspaceTrendData(30, mockRepos);
      consoleSpy.mockClear();
      const trend2 = getCachedWorkspaceTrendData(30, mockRepos);

      expect(trend1).toBe(trend2);
      expect(consoleSpy).not.toHaveBeenCalled();

      // Different days should generate new data
      const trend3 = getCachedWorkspaceTrendData(7, mockRepos);
      expect(trend3).not.toBe(trend1);
      expect(trend3).toHaveLength(7);
    });

    it('should handle different repository selections', () => {
      const trend1 = getCachedWorkspaceTrendData(30, mockRepos);
      const trend2 = getCachedWorkspaceTrendData(30, mockRepos, ['1']);

      expect(trend1).not.toBe(trend2);
    });
  });

  describe('clearDemoDataCache', () => {
    it('should clear all cached data', () => {
      // Generate some cached data
      getCachedAnalyticsData();
      getCachedRepositories();
      getCachedWorkspaceMetrics([{ id: '1' }] as unknown[], '30d');

      const statsBefore = getDemoCacheStats();
      expect(statsBefore.hasAnalyticsData).toBe(true);
      expect(statsBefore.hasRepositories).toBe(true);
      expect(statsBefore.metricsCacheSize).toBe(1);

      clearDemoDataCache();

      const statsAfter = getDemoCacheStats();
      expect(statsAfter.hasAnalyticsData).toBe(false);
      expect(statsAfter.hasRepositories).toBe(false);
      expect(statsAfter.metricsCacheSize).toBe(0);
      expect(statsAfter.trendCacheSize).toBe(0);
    });

    it('should force regeneration after clearing', () => {
      getCachedAnalyticsData();
      consoleSpy.mockClear();

      clearDemoDataCache();
      getCachedAnalyticsData();

      expect(consoleSpy).toHaveBeenCalledWith(
        '%s',
        '🔄 Generating fresh analytics data for demo workspace'
      );
    });
  });

  describe('getDemoCacheStats', () => {
    it('should return cache statistics', () => {
      const statsEmpty = getDemoCacheStats();

      expect(statsEmpty).toHaveProperty('isValid');
      expect(statsEmpty).toHaveProperty('lastGenerated');
      expect(statsEmpty).toHaveProperty('age');
      expect(statsEmpty).toHaveProperty('hasAnalyticsData');
      expect(statsEmpty).toHaveProperty('hasWorkspaceRepositories');
      expect(statsEmpty).toHaveProperty('hasRepositories');
      expect(statsEmpty).toHaveProperty('metricsCacheSize');
      expect(statsEmpty).toHaveProperty('trendCacheSize');

      expect(statsEmpty.hasAnalyticsData).toBe(false);
      expect(statsEmpty.metricsCacheSize).toBe(0);
      expect(statsEmpty.trendCacheSize).toBe(0);

      // Generate some data and check stats again
      getCachedAnalyticsData();
      getCachedRepositories();
      getCachedWorkspaceMetrics([{ id: '1' }] as unknown[], '30d');
      getCachedWorkspaceTrendData(30);

      const statsWithData = getDemoCacheStats();
      expect(statsWithData.hasAnalyticsData).toBe(true);
      expect(statsWithData.hasRepositories).toBe(true);
      expect(statsWithData.metricsCacheSize).toBe(1);
      expect(statsWithData.trendCacheSize).toBe(1);
      expect(statsWithData.isValid).toBe(true);
    });
  });
});
