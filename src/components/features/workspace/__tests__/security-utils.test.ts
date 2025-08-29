import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isValidUrl,
  isValidGitHubUrl,
  sanitizeUrl,
  openUrlSafely,
  WorkspacePermission,
  hasPermission,
  validateExportRequest,
  exportRateLimiter,
} from '../utils/security-utils';

describe('Security Utils', () => {
  describe('isValidUrl', () => {
    it('should validate correct URLs', () => {
      expect(isValidUrl('https://github.com/user/repo')).toBe(true);
      expect(isValidUrl('http://example.com')).toBe(true);
      expect(isValidUrl('https://api.github.com/repos')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidUrl('')).toBe(false);
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('javascript:alert(1)')).toBe(false);
      expect(isValidUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
      expect(isValidUrl('vbscript:msgbox')).toBe(false);
      expect(isValidUrl('file:///etc/passwd')).toBe(false);
    });

    it('should reject non-string inputs', () => {
      expect(isValidUrl(null as unknown as string)).toBe(false);
      expect(isValidUrl(undefined as unknown as string)).toBe(false);
      expect(isValidUrl(123 as unknown as string)).toBe(false);
    });
  });

  describe('isValidGitHubUrl', () => {
    it('should validate correct GitHub URLs', () => {
      expect(isValidGitHubUrl('https://github.com/facebook/react')).toBe(true);
      expect(isValidGitHubUrl('https://api.github.com/repos/vercel/next.js')).toBe(true);
      expect(isValidGitHubUrl('https://www.github.com/user/repo')).toBe(true);
    });

    it('should reject non-GitHub URLs', () => {
      expect(isValidGitHubUrl('https://gitlab.com/user/repo')).toBe(false);
      expect(isValidGitHubUrl('http://github.com/user/repo')).toBe(false); // Not HTTPS
      expect(isValidGitHubUrl('https://fake-github.com/user/repo')).toBe(false);
    });
  });

  describe('sanitizeUrl', () => {
    it('should sanitize valid URLs', () => {
      expect(sanitizeUrl('https://github.com/user/repo#section')).toBe(
        'https://github.com/user/repo'
      );
      expect(sanitizeUrl('https://example.com/path?query=value')).toBe(
        'https://example.com/path?query=value'
      );
    });

    it('should return empty string for invalid URLs', () => {
      expect(sanitizeUrl('javascript:alert(1)')).toBe('');
      expect(sanitizeUrl('not-a-url')).toBe('');
      expect(sanitizeUrl('')).toBe('');
    });
  });

  describe('openUrlSafely', () => {
    beforeEach(() => {
      // Mock window.open
      global.window = {
        open: vi.fn(),
      } as unknown as Window & typeof globalThis;
    });

    it('should open valid URLs', () => {
      const result = openUrlSafely('https://github.com/user/repo');
      expect(result).toBe(true);
      expect(window.open).toHaveBeenCalledWith(
        'https://github.com/user/repo',
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('should block invalid URLs', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = openUrlSafely('javascript:alert(1)');
      expect(result).toBe(false);
      expect(window.open).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Blocked attempt to open invalid URL:',
        'javascript:alert(1)'
      );
      consoleSpy.mockRestore();
    });
  });

  describe('hasPermission', () => {
    it('should check permission hierarchy correctly', () => {
      expect(hasPermission('owner', WorkspacePermission.VIEW)).toBe(true);
      expect(hasPermission('owner', WorkspacePermission.EDIT)).toBe(true);
      expect(hasPermission('owner', WorkspacePermission.ADMIN)).toBe(true);
      expect(hasPermission('owner', WorkspacePermission.OWNER)).toBe(true);

      expect(hasPermission('admin', WorkspacePermission.VIEW)).toBe(true);
      expect(hasPermission('admin', WorkspacePermission.EDIT)).toBe(true);
      expect(hasPermission('admin', WorkspacePermission.ADMIN)).toBe(true);
      expect(hasPermission('admin', WorkspacePermission.OWNER)).toBe(false);

      expect(hasPermission('edit', WorkspacePermission.VIEW)).toBe(true);
      expect(hasPermission('edit', WorkspacePermission.EDIT)).toBe(true);
      expect(hasPermission('edit', WorkspacePermission.ADMIN)).toBe(false);

      expect(hasPermission('view', WorkspacePermission.VIEW)).toBe(true);
      expect(hasPermission('view', WorkspacePermission.EDIT)).toBe(false);
    });

    it('should handle undefined roles', () => {
      expect(hasPermission(undefined, WorkspacePermission.VIEW)).toBe(false);
      expect(hasPermission('', WorkspacePermission.VIEW)).toBe(false);
    });
  });

  describe('validateExportRequest', () => {
    beforeEach(() => {
      // Reset rate limiter state
      (exportRateLimiter as any).requests = new Map();
    });

    it('should validate tier permissions for export formats', () => {
      const result = validateExportRequest('user1', 'free', 'csv');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not available in free tier');

      const result2 = validateExportRequest('user1', 'pro', 'csv');
      expect(result2.allowed).toBe(true);

      const result3 = validateExportRequest('user1', 'enterprise', 'pdf');
      expect(result3.allowed).toBe(true);
    });

    it('should enforce rate limits', () => {
      // Exhaust free tier rate limit (5 requests)
      for (let i = 0; i < 5; i++) {
        const result = validateExportRequest('user2', 'pro', 'csv');
        expect(result.allowed).toBe(true);
      }

      // Next request should be blocked
      const result = validateExportRequest('user2', 'pro', 'csv');
      expect(result.allowed).toBe(true); // Pro tier has 20 requests

      // Test with different user
      const result2 = validateExportRequest('user3', 'pro', 'csv');
      expect(result2.allowed).toBe(true);
    });

    it('should return remaining requests', () => {
      const result1 = validateExportRequest('user4', 'pro', 'csv');
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(19); // 20 - 1

      const result2 = validateExportRequest('user4', 'pro', 'json');
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(18); // 20 - 2
    });
  });
});