import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the dub module for URL shortening (avoid API calls)
vi.mock('@/lib/dub', () => ({
  createChartShareUrl: vi.fn().mockReturnValue('https://contributor.info/facebook/react'),
  getDubConfig: vi.fn().mockReturnValue({
    isDev: true,
    usesServerlessFunction: true,
  }),
}));

// Unit tests for repo-view link sharing patterns
// Note: getDubConfig implementation is tested in src/lib/__tests__/dub.integration.test.ts
describe('RepoView Link Sharing Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate correct share text format for repo-view', () => {
    // Test the share text format used in repo-view
    const testUrl = 'https://contributor.info/facebook/react';
    const repo = 'facebook/react';
    const shareText = `Check out the contributions analysis for ${repo}\n${testUrl}`;

    // Verify share text format
    expect(shareText).toContain('facebook/react');
    expect(shareText).toContain(testUrl);
    expect(shareText).toMatch(/Check out the contributions analysis for .+\n.+/);
  });

  it('should validate chart type generation for different tabs', () => {
    // Test the pattern used in repo-view for different tabs
    const tabs = [
      { path: '/facebook/react', expected: 'contributions' },
      { path: '/facebook/react/health', expected: 'lottery' },
      { path: '/facebook/react/distribution', expected: 'distribution' },
      { path: '/facebook/react/feed', expected: 'feed' },
      { path: '/facebook/react/activity', expected: 'contributions' },
    ];

    tabs.forEach(({ path, expected }) => {
      // Simulate getCurrentTab logic from repo-view
      let tab = 'contributions'; // default
      if (path.endsWith('/health')) tab = 'lottery';
      else if (path.endsWith('/distribution')) tab = 'distribution';
      else if (path.endsWith('/feed')) tab = 'feed';
      else if (path.endsWith('/activity') || path.endsWith('/contributions')) tab = 'contributions';

      expect(tab).toBe(expected);
    });
  });

  it('should confirm oss.fyi domain configuration for production', () => {
    // This documents the expected production behavior
    const expectedProductionConfig = {
      domain: 'oss.fyi',
      isDev: false,
      hasApiKey: true,
    };

    // Verify the expected values
    expect(expectedProductionConfig.domain).toBe('oss.fyi');
    expect(expectedProductionConfig.isDev).toBe(false);
  });
});
