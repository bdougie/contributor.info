import { describe, it, expect, vi, beforeEach } from 'vitest';

// Type definitions for test mocks
interface MockEnv {
  DEPLOY_PRIME_URL?: string;
  URL?: string;
  CONTEXT?: string;
}

interface MockWindow {
  location: {
    origin?: string;
    hostname?: string;
    pathname?: string;
    search?: string;
  };
}

interface GlobalWithMocks extends NodeJS.Global {
  __mockEnv?: MockEnv;
  window?: MockWindow;
}

// Mock the env module first (hoisted)
vi.mock('@/lib/env', () => ({
  env: {
    get DEPLOY_PRIME_URL() {
      return (global as GlobalWithMocks).__mockEnv?.DEPLOY_PRIME_URL || '';
    },
    get URL() {
      return (global as GlobalWithMocks).__mockEnv?.URL || '';
    },
    get CONTEXT() {
      return (global as GlobalWithMocks).__mockEnv?.CONTEXT || '';
    },
  },
}));

import {
  getSiteURL,
  getAuthRedirectURL,
  getDeploymentContext,
  isDeployPreview,
  isLocalDevelopment,
  isProduction,
  isValidRedirectURL,
} from '../auth-utils';

describe('Auth Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const g = global as GlobalWithMocks;
    // Reset window.location
    delete g.window;
    // Reset mock env values
    g.__mockEnv = {
      DEPLOY_PRIME_URL: '',
      URL: '',
      CONTEXT: '',
    };
  });

  describe('getSiteURL', () => {
    it('should return localhost URL in local development', () => {
      const g = global as GlobalWithMocks;
      g.window = {
        location: {
          origin: 'http://localhost:5174',
          hostname: 'localhost',
        },
      };

      expect(getSiteURL()).toBe('http://localhost:5174');
    });

    it('should return deploy preview URL when DEPLOY_PRIME_URL is set', () => {
      const g = global as GlobalWithMocks;
      g.__mockEnv = g.__mockEnv || {};
      g.__mockEnv.DEPLOY_PRIME_URL = 'deploy-preview-123--contributor-info.netlify.app';

      g.window = {
        location: {
          origin: 'https://deploy-preview-123--contributor-info.netlify.app',
        },
      };

      expect(getSiteURL()).toBe('https://deploy-preview-123--contributor-info.netlify.app');
    });

    it('should return production URL as fallback', () => {
      const g = global as GlobalWithMocks;
      g.window = {
        location: {
          origin: 'https://contributor.info',
        },
      };

      expect(getSiteURL()).toBe('https://contributor.info');
    });
  });

  describe('getDeploymentContext', () => {
    it('should detect local development', () => {
      const g = global as GlobalWithMocks;
      g.window = {
        location: {
          hostname: 'localhost',
        },
      };

      expect(getDeploymentContext()).toBe('local');
    });

    it('should detect deploy preview', () => {
      const g = global as GlobalWithMocks;
      g.window = {
        location: {
          hostname: 'deploy-preview-123--contributor-info.netlify.app',
        },
      };

      g.__mockEnv = g.__mockEnv || {};
      g.__mockEnv.CONTEXT = 'deploy-preview';

      expect(getDeploymentContext()).toBe('deploy-preview');
    });

    it('should detect production', () => {
      const g = global as GlobalWithMocks;
      g.window = {
        location: {
          hostname: 'contributor.info',
        },
      };

      g.__mockEnv = g.__mockEnv || {};
      g.__mockEnv.CONTEXT = 'production';

      expect(getDeploymentContext()).toBe('production');
    });
  });

  describe('isValidRedirectURL', () => {
    it('should accept localhost URLs', () => {
      expect(isValidRedirectURL('http://localhost:5174/dashboard')).toBe(true);
      expect(isValidRedirectURL('http://127.0.0.1:3000')).toBe(true);
    });

    it('should accept Netlify preview URLs', () => {
      expect(isValidRedirectURL('https://deploy-preview-123--contributor-info.netlify.app')).toBe(
        true
      );
      expect(isValidRedirectURL('https://feature-branch--contributor-info.netlify.app')).toBe(true);
    });

    it('should accept production URLs', () => {
      expect(isValidRedirectURL('https://contributor.info')).toBe(true);
      expect(isValidRedirectURL('https://www.contributor.info')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidRedirectURL('https://malicious-site.com')).toBe(false);
      expect(isValidRedirectURL('https://fake-contributor.info')).toBe(false);
      expect(isValidRedirectURL('invalid-url')).toBe(false);
    });
  });

  describe('helper functions', () => {
    it('isLocalDevelopment should work correctly', () => {
      const g = global as GlobalWithMocks;
      g.window = {
        location: {
          hostname: 'localhost',
        },
      };

      expect(isLocalDevelopment()).toBe(true);
    });

    it('isDeployPreview should work correctly', () => {
      const g = global as GlobalWithMocks;
      g.window = {
        location: {
          hostname: 'deploy-preview-123--contributor-info.netlify.app',
        },
      };

      g.__mockEnv = g.__mockEnv || {};
      g.__mockEnv.CONTEXT = 'deploy-preview';

      expect(isDeployPreview()).toBe(true);
    });

    it('isProduction should work correctly', () => {
      const g = global as GlobalWithMocks;
      g.window = {
        location: {
          hostname: 'contributor.info',
        },
      };

      g.__mockEnv = g.__mockEnv || {};
      g.__mockEnv.CONTEXT = 'production';

      expect(isProduction()).toBe(true);
    });
  });

  describe('getAuthRedirectURL', () => {
    it('should preserve path when requested', () => {
      const g = global as GlobalWithMocks;
      g.window = {
        location: {
          origin: 'http://localhost:5174',
          pathname: '/dashboard',
          search: '?tab=activity',
        },
      };

      expect(getAuthRedirectURL(true)).toBe('http://localhost:5174/dashboard?tab=activity');
    });

    it('should return base URL when path preservation is disabled', () => {
      const g = global as GlobalWithMocks;
      g.window = {
        location: {
          origin: 'http://localhost:5174',
          pathname: '/dashboard',
          search: '?tab=activity',
        },
      };

      expect(getAuthRedirectURL(false)).toBe('http://localhost:5174');
    });
  });
});
