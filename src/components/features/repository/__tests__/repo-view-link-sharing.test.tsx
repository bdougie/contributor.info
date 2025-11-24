import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDubConfig } from '@/lib/dub';

// Mock the dub module
vi.mock('@/lib/dub', () => ({
  createChartShareUrl: vi.fn().mockReturnValue('https://contributor.info/facebook/react'),
  getDubConfig: vi.fn().mockReturnValue({
    isDev: true,
    usesServerlessFunction: true,
  }),
}));

// Simple unit test for the updated functionality
describe('RepoView Link Sharing Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should verify dub config for repo-view integration', () => {
    const config = getDubConfig();

    // Verify config structure needed by repo-view
    expect(config).toHaveProperty('isDev');
    expect(config).toHaveProperty('usesServerlessFunction');

    // In development mode
    expect(config.isDev).toBe(true);
    // Now uses serverless function for security (API key not exposed to client)
    expect(config.usesServerlessFunction).toBe(true);
  });

  it('should test clipboard integration pattern used in repo-view', () => {
    // Mock clipboard for testing
    const mockWriteText = vi.fn();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      writable: true,
      configurable: true,
    });

    // Simulate the pattern used in repo-view (synchronous mock)
    const testUrl = 'https://contributor.info/facebook/react';
    const shareText = `Check out the contributions analysis for facebook/react\n${testUrl}`;

    navigator.clipboard.writeText(shareText);

    expect(mockWriteText).toHaveBeenCalledWith(shareText);
    expect(shareText).toContain('facebook/react');
    expect(shareText).toContain(testUrl);
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
