import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createShortUrl, createChartShareUrl, getUrlAnalytics, getDubConfig } from '../dub';

// Mock dependencies
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({ error: null })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => ({ data: null, error: null })),
        })),
      })),
    })),
  },
}));

vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock fetch
global.fetch = vi.fn();

describe('dub.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createShortUrl', () => {
    it('should return mock data in development mode', async () => {
      // Tests run in development mode, so this tests actual behavior
      const result = await createShortUrl({
        url: 'https://contributor.info/facebook/react',
        key: 'facebook/react',
        title: 'Test Chart',
      });

      expect(result).not.toBeNull();
      expect(result?.id).toBe('dev-mock');
      expect(result?.shortLink).toBe('https://contributor.info/facebook/react');
      expect(result?.domain).toBe('localhost');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should include metadata in dev mode response', async () => {
      const result = await createShortUrl({
        url: 'https://contributor.info/facebook/react',
        key: 'facebook/react',
        title: 'Test Chart',
        description: 'Test description',
      });

      expect(result).not.toBeNull();
      expect(result?.title).toBe('Test Chart');
      expect(result?.description).toBe('Test description');
      expect(result?.key).toBe('facebook/react');
    });

    it('should return timestamp in dev mode', async () => {
      const beforeTime = new Date().getTime();
      const result = await createShortUrl({
        url: 'https://contributor.info/test',
      });
      const afterTime = new Date().getTime();

      expect(result).not.toBeNull();
      const createdTime = new Date(result!.createdAt).getTime();
      expect(createdTime).toBeGreaterThanOrEqual(beforeTime);
      expect(createdTime).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('createChartShareUrl', () => {
    it('should reject invalid URLs', async () => {
      const result = await createChartShareUrl(
        'https://evil.com/malicious',
        'treemap',
        'test/repo'
      );

      expect(result).toBe('https://evil.com/malicious'); // Returns original
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should allow contributor.info URLs', async () => {
      const result = await createChartShareUrl(
        'https://contributor.info/facebook/react',
        'treemap',
        'facebook/react'
      );

      expect(result).toBe('https://contributor.info/facebook/react');
    });

    it('should allow localhost URLs', async () => {
      const result = await createChartShareUrl(
        'http://localhost:3000/facebook/react',
        'treemap',
        'facebook/react'
      );

      expect(result).toBe('http://localhost:3000/facebook/react');
    });

    it('should allow Netlify preview URLs', async () => {
      const result = await createChartShareUrl(
        'https://deploy-preview-123--contributor-info.netlify.app/facebook/react',
        'treemap',
        'facebook/react'
      );

      expect(result).toBe(
        'https://deploy-preview-123--contributor-info.netlify.app/facebook/react'
      );
    });

    it('should generate appropriate metadata for repository charts', async () => {
      const result = await createShortUrl({
        url: 'https://contributor.info/facebook/react',
        key: 'facebook/react',
        title: 'treemap for facebook/react',
        description: 'Interactive treemap chart showing metrics for facebook/react repository',
      });

      expect(result).not.toBeNull();
      expect(result?.title).toContain('facebook/react');
      expect(result?.description).toContain('treemap');
    });
  });

  describe('getDubConfig', () => {
    it('should return current environment config', () => {
      const config = getDubConfig();

      // In test environment, this should return dev config
      expect(config.isDev).toBe(true);
      // Now uses serverless function for security (API key not exposed to client)
      expect(config.usesServerlessFunction).toBe(true);
    });
  });

  describe('getUrlAnalytics', () => {
    it('should return null in development mode', async () => {
      const result = await getUrlAnalytics('test-link-id');
      expect(result).toBeNull();
    });
  });
});
