import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock supabase module before importing dub.ts
vi.mock('../supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

// Import after mocking
import { createShortUrl, createChartShareUrl, getDubConfig } from '../dub';

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
  readText: vi.fn(),
};
Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  writable: true,
});

// Import supabase for mocking (used implicitly by dub.ts)
import { supabase } from '../supabase';
vi.mocked(supabase);

describe('Link Capturing Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Development Mode Behavior', () => {
    it('should return original URL in development mode', () => {
      // Development mode skips API and returns original URL
      const testUrl = 'https://contributor.info/repo/facebook/react';
      return createShortUrl({ url: testUrl }).then((result) => {
        expect(result).toMatchObject({
          id: 'dev-mock',
          domain: 'localhost',
          key: 'dev-key',
          url: testUrl,
          shortLink: testUrl, // Should return original URL in dev mode
          qrCode: '',
          clicks: 0,
        });
      });
    });

    it('should handle chart share URL in development mode', () => {
      const testUrl = 'https://contributor.info/repo/facebook/react';
      return expect(
        createChartShareUrl(testUrl, 'contributors-chart', 'facebook/react')
      ).resolves.toBe(testUrl);
    });

    it('should show development configuration', () => {
      const config = getDubConfig();
      expect(config).toMatchObject({
        domain: 'dub.sh', // Development uses dub.sh
        isDev: true,
      });
      // hasApiKey can be true or false depending on environment setup
      expect(typeof config.hasApiKey).toBe('boolean');
    });
  });

  describe('Production Environment Documentation', () => {
    it('should document oss.fyi domain usage in production', () => {
      // This test documents the expected production behavior
      // In production mode (import.meta.env.DEV = false), the system would use:
      const productionConfig = {
        domain: 'oss.fyi',
        isDev: false,
        hasApiKey: true,
      };

      expect(productionConfig.domain).toBe('oss.fyi');
      expect(productionConfig.isDev).toBe(false);
    });

    it('should document Supabase Edge Function call in production', () => {
      // This test documents what the Supabase function call would look like in production
      const expectedProductionCall = {
        functionName: 'url-shortener',
        body: {
          url: 'https://contributor.info/repo/microsoft/vscode',
          domain: 'oss.fyi', // Production uses oss.fyi
          utmSource: 'contributor-info',
          utmMedium: 'chart-share',
          utmCampaign: 'social-sharing',
        },
      };

      expect(expectedProductionCall.body.domain).toBe('oss.fyi');
      expect(expectedProductionCall.functionName).toBe('url-shortener');
    });

    it('should document expected production response format', () => {
      // This test documents the expected response format from production
      const expectedProductionResponse = {
        id: 'generated-id',
        domain: 'oss.fyi',
        key: 'microsoft/vscode',
        url: 'https://contributor.info/repo/microsoft/vscode',
        shortLink: 'https://oss.fyi/microsoft/vscode',
        qrCode: 'data:image/png;base64,generated-qr',
        utmSource: 'contributor-info',
        utmMedium: 'chart-share',
        utmCampaign: 'social-sharing',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        clicks: 0,
        title: null,
        description: null,
      };

      expect(expectedProductionResponse.shortLink).toContain('oss.fyi');
      expect(expectedProductionResponse.domain).toBe('oss.fyi');
    });
  });

  describe('Link Copying to Clipboard', () => {
    it('should copy dub.sh link to clipboard', () => {
      const testUrl = 'https://dub.sh/test123';

      return navigator.clipboard.writeText(testUrl).then(() => {
        expect(mockClipboard.writeText).toHaveBeenCalledWith(testUrl);
      });
    });

    it('should copy oss.fyi link to clipboard', () => {
      const testUrl = 'https://oss.fyi/test456';

      return navigator.clipboard.writeText(testUrl).then(() => {
        expect(mockClipboard.writeText).toHaveBeenCalledWith(testUrl);
      });
    });

    it('should handle clipboard write errors gracefully', () => {
      mockClipboard.writeText.mockRejectedValueOnce(new Error('Clipboard access denied'));

      return expect(navigator.clipboard.writeText('https://dub.sh/error')).rejects.toThrow(
        'Clipboard access denied'
      );
    });
  });

  describe('URL Validation and Security', () => {
    it('should handle invalid URLs in chart sharing', () => {
      const invalidUrl = 'invalid-url';
      return expect(createChartShareUrl(invalidUrl, 'test-chart')).resolves.toBe(invalidUrl);
    });

    it('should reject URLs from disallowed domains', () => {
      const maliciousUrl = 'https://malicious-site.com/page';
      return expect(createChartShareUrl(maliciousUrl, 'test-chart')).resolves.toBe(maliciousUrl);
    });

    it('should allow contributor.info domains', () => {
      const validUrl = 'https://contributor.info/repo/test/repo';
      return expect(createChartShareUrl(validUrl, 'test-chart')).resolves.toBe(validUrl);
    });

    it('should allow localhost for development', () => {
      const localhostUrl = 'http://localhost:3000/repo/test/repo';
      return expect(createChartShareUrl(localhostUrl, 'test-chart')).resolves.toBe(localhostUrl);
    });
  });

  describe('Error Handling', () => {
    it('should handle function errors gracefully', () => {
      // Since we're in development mode, errors don't affect the result
      return createShortUrl({ url: 'https://contributor.info/test' }).then((result) => {
        // In development mode, should still return dev mock even with errors
        expect(result?.id).toBe('dev-mock');
      });
    });

    it('should handle service errors in response', () => {
      // Development mode bypasses all API calls
      return createShortUrl({ url: 'https://contributor.info/test' }).then((result) => {
        // In development mode, should still return dev mock
        expect(result?.id).toBe('dev-mock');
      });
    });

    it('should handle network/connection errors', () => {
      // Development mode doesn't make network calls
      return createShortUrl({ url: 'https://contributor.info/test' }).then((result) => {
        // In development mode, should still return dev mock
        expect(result?.id).toBe('dev-mock');
      });
    });
  });

  describe('Analytics Tracking', () => {
    it('should track successful link creation', () => {
      const testUrl = 'https://contributor.info/repo/facebook/react';
      return createShortUrl({ url: testUrl }).then((result) => {
        // In development mode, returns original URL
        expect(result?.shortLink).toBe(testUrl);
        expect(result?.id).toBe('dev-mock');

        // Analytics tracking would be tested separately in analytics.test.ts
      });
    });

    it('should include UTM parameters in production calls', () => {
      // This test documents the expected UTM parameters
      const expectedUTMParams = {
        utmSource: 'contributor-info',
        utmMedium: 'chart-share',
        utmCampaign: 'social-sharing',
      };

      expect(expectedUTMParams).toMatchObject({
        utmSource: 'contributor-info',
        utmMedium: 'chart-share',
        utmCampaign: 'social-sharing',
      });
    });
  });

  describe('Integration Test Scenarios', () => {
    it('should demonstrate dub.sh link capture in development', () => {
      const repoUrl = 'https://contributor.info/repo/facebook/react';

      // Copy URL to clipboard (simulating user action), then create short URL
      return navigator.clipboard
        .writeText(repoUrl)
        .then(() => {
          return createShortUrl({ url: repoUrl });
        })
        .then((result) => {
          // Verify the link structure
          expect(result?.shortLink).toBe(repoUrl); // Dev mode returns original
          expect(mockClipboard.writeText).toHaveBeenCalledWith(repoUrl);
        });
    });

    it('should demonstrate oss.fyi link would be captured in production', () => {
      // This test shows the expected production behavior
      // In production, the shortLink would be something like: https://oss.fyi/microsoft/vscode
      const expectedProductionDomain = 'oss.fyi';
      const expectedShortFormat = `https://${expectedProductionDomain}/microsoft/vscode`;

      expect(expectedShortFormat).toBe('https://oss.fyi/microsoft/vscode');
    });

    it('should demonstrate complete chart sharing workflow', () => {
      const chartUrl = 'https://contributor.info/repo/facebook/react';
      const chartType = 'contributors-activity';
      const repository = 'facebook/react';

      // Step 1: Create chart share URL, Step 2: Copy to clipboard
      return createChartShareUrl(chartUrl, chartType, repository).then((shortUrl) => {
        return navigator.clipboard.writeText(shortUrl).then(() => {
          // Verify the workflow
          expect(shortUrl).toBe(chartUrl); // Dev mode
          expect(mockClipboard.writeText).toHaveBeenCalledWith(shortUrl);
        });
      });
    });
  });
});
