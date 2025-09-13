import { describe, it, expect } from 'vitest';
import { isValidRedirectURL } from '../auth-utils';

/**
 * Bulletproof Testing Compliant Test
 * - Pure function tests only
 * - No async/await
 * - No complex mocking
 * - Under 100 lines
 * - No external dependencies
 */
describe('Auth Utils - Pure Functions', () => {
  describe('isValidRedirectURL', () => {
    it('should validate contributor.info URLs', () => {
      expect(isValidRedirectURL('https://contributor.info/workspace')).toBe(true);
      expect(isValidRedirectURL('https://contributor.info/')).toBe(true);
      expect(isValidRedirectURL('https://www.contributor.info/login')).toBe(true);
    });

    it('should validate localhost URLs', () => {
      expect(isValidRedirectURL('http://localhost:5174/workspace')).toBe(true);
      expect(isValidRedirectURL('http://localhost:3000/')).toBe(true);
      expect(isValidRedirectURL('http://127.0.0.1:8080/test')).toBe(true);
    });

    it('should validate Netlify preview URLs', () => {
      expect(
        isValidRedirectURL('https://deploy-preview-123--contributor-info.netlify.app/workspace')
      ).toBe(true);
      expect(isValidRedirectURL('https://branch-name--contributor-info.netlify.app/')).toBe(true);
      expect(isValidRedirectURL('https://main--contributor-info.netlify.app/login')).toBe(true);
    });

    it('should reject external URLs', () => {
      expect(isValidRedirectURL('https://evil.com/phishing')).toBe(false);
      expect(isValidRedirectURL('https://google.com')).toBe(false);
      expect(isValidRedirectURL('https://github.com/login')).toBe(false);
    });

    it('should reject invalid URLs', () => {
      expect(isValidRedirectURL('not-a-url')).toBe(false);
      expect(isValidRedirectURL('javascript:alert(1)')).toBe(false);
      expect(isValidRedirectURL('file:///etc/passwd')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(isValidRedirectURL('')).toBe(false);
      expect(isValidRedirectURL(' ')).toBe(false);
      expect(isValidRedirectURL('null')).toBe(false);
    });
  });
});
