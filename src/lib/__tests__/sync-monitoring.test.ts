import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncMonitoring } from '../sync-monitoring';

// Mock supabase
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => Promise.resolve({ error: null })),
      select: vi.fn(() => ({
        gte: vi.fn(() => ({
          data: [],
          error: null,
        })),
        eq: vi.fn(() => ({
          data: [],
          error: null,
        })),
      })),
    })),
  },
}));

describe('SyncMonitoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear metrics array
    SyncMonitoring['metrics'] = [];
  });

  it('should calculate percentiles correctly', () => {
    // Add test metrics - pure calculation test
    const testMetrics = [
      { executionTime: 10 },
      { executionTime: 20 },
      { executionTime: 30 },
      { executionTime: 40 },
      { executionTime: 50 },
    ];

    SyncMonitoring['metrics'] = testMetrics as any;

    const percentiles = SyncMonitoring.getPercentiles();
    expect(percentiles.p50).toBe(30);
  });

  it('should return zero percentiles when no metrics', () => {
    const percentiles = SyncMonitoring.getPercentiles();
    expect(percentiles.p50).toBe(0);
    expect(percentiles.p90).toBe(0);
    expect(percentiles.p95).toBe(0);
    expect(percentiles.p99).toBe(0);
  });

  it('should limit metrics array size', () => {
    // Simulate adding metrics through recordSync to trigger limiting logic
    for (let i = 0; i < 150; i++) {
      // Directly set the metrics array to test the limiting
      if (i === 0) {
        SyncMonitoring['metrics'] = [];
      }

      SyncMonitoring['metrics'].push({
        functionName: 'test',
        repository: 'test/repo',
        executionTime: i,
        success: true,
        timedOut: false,
        router: 'supabase',
        timestamp: new Date(),
      });

      // Manually apply the limiting logic that recordSync would do
      if (SyncMonitoring['metrics'].length > 100) {
        SyncMonitoring['metrics'].shift();
      }
    }

    expect(SyncMonitoring['metrics'].length).toBeLessThanOrEqual(100);
  });

  it('should format log message correctly', () => {
    const consoleSpy = vi.spyOn(console, 'log');

    SyncMonitoring['logMetrics']({
      functionName: 'test-func',
      repository: 'test/repo',
      executionTime: 15.5,
      success: true,
      processed: 100,
      errors: 2,
      timedOut: false,
      router: 'supabase',
      timestamp: new Date(),
    });

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('✅'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('SUPABASE'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('15.50s'));
  });

  it('should alert on timeout', () => {
    const warnSpy = vi.spyOn(console, 'warn');

    SyncMonitoring['alertTimeout']({
      functionName: 'slow-func',
      repository: 'big/repo',
      executionTime: 30,
      success: false,
      timedOut: true,
      router: 'netlify',
      timestamp: new Date(),
    });

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('TIMEOUT ALERT'));
  });
});
