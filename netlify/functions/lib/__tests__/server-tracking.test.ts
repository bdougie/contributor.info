import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Helper to safely check if a URL matches expected host
// Prevents URL substring sanitization vulnerabilities
function isUrlForHost(url: string, expectedHost: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname === expectedHost || urlObj.hostname.endsWith(`.${expectedHost}`);
  } catch {
    return false;
  }
}

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock process.env
const originalEnv = process.env;

beforeEach(() => {
  vi.resetAllMocks();
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = originalEnv;
});

describe('server-tracking utilities', () => {
  describe('error categorization (via trackInngestFailure)', () => {
    it('should categorize network errors correctly', async () => {
      process.env.SENTRY_DSN = 'https://key@sentry.io/123';
      process.env.POSTHOG_API_KEY = 'phc_test';

      mockFetch.mockResolvedValue({ ok: true });

      const { trackInngestFailure } = await import('../server-tracking.mts');

      await trackInngestFailure('test.event', new Error('network error occurred'), {
        owner: 'test',
        repo: 'repo',
      });

      // Check PostHog was called with correct error category (secure URL validation)
      const posthogCall = mockFetch.mock.calls.find((call) =>
        isUrlForHost(call[0], 'posthog.com')
      );
      expect(posthogCall).toBeDefined();
      const posthogBody = JSON.parse(posthogCall[1].body);
      expect(posthogBody.properties.error_category).toBe('NETWORK_ERROR');
    });

    it('should categorize timeout errors correctly', async () => {
      process.env.SENTRY_DSN = 'https://key@sentry.io/123';
      process.env.POSTHOG_API_KEY = 'phc_test';

      mockFetch.mockResolvedValue({ ok: true });

      const { trackInngestFailure } = await import('../server-tracking.mts');

      await trackInngestFailure('test.event', new Error('request timed out'), {
        owner: 'test',
        repo: 'repo',
      });

      const posthogCall = mockFetch.mock.calls.find((call) =>
        isUrlForHost(call[0], 'posthog.com')
      );
      expect(posthogCall).toBeDefined();
      const posthogBody = JSON.parse(posthogCall[1].body);
      expect(posthogBody.properties.error_category).toBe('TIMEOUT_ERROR');
    });

    it('should categorize rate limit errors correctly', async () => {
      process.env.SENTRY_DSN = 'https://key@sentry.io/123';
      process.env.POSTHOG_API_KEY = 'phc_test';

      mockFetch.mockResolvedValue({ ok: true });

      const { trackInngestFailure } = await import('../server-tracking.mts');

      await trackInngestFailure('test.event', new Error('rate limit exceeded'), {
        owner: 'test',
        repo: 'repo',
      });

      const posthogCall = mockFetch.mock.calls.find((call) =>
        isUrlForHost(call[0], 'posthog.com')
      );
      expect(posthogCall).toBeDefined();
      const posthogBody = JSON.parse(posthogCall[1].body);
      expect(posthogBody.properties.error_category).toBe('RATE_LIMIT_ERROR');
    });

    it('should categorize auth errors correctly', async () => {
      process.env.SENTRY_DSN = 'https://key@sentry.io/123';
      process.env.POSTHOG_API_KEY = 'phc_test';

      mockFetch.mockResolvedValue({ ok: true });

      const { trackInngestFailure } = await import('../server-tracking.mts');

      await trackInngestFailure('test.event', new Error('unauthorized access'), {
        owner: 'test',
        repo: 'repo',
      });

      const posthogCall = mockFetch.mock.calls.find((call) =>
        isUrlForHost(call[0], 'posthog.com')
      );
      expect(posthogCall).toBeDefined();
      const posthogBody = JSON.parse(posthogCall[1].body);
      expect(posthogBody.properties.error_category).toBe('AUTH_ERROR');
    });

    it('should categorize inngest errors correctly', async () => {
      process.env.SENTRY_DSN = 'https://key@sentry.io/123';
      process.env.POSTHOG_API_KEY = 'phc_test';

      mockFetch.mockResolvedValue({ ok: true });

      const { trackInngestFailure } = await import('../server-tracking.mts');

      await trackInngestFailure('test.event', new Error('inngest client failed'), {
        owner: 'test',
        repo: 'repo',
      });

      const posthogCall = mockFetch.mock.calls.find((call) =>
        isUrlForHost(call[0], 'posthog.com')
      );
      expect(posthogCall).toBeDefined();
      const posthogBody = JSON.parse(posthogCall[1].body);
      expect(posthogBody.properties.error_category).toBe('INNGEST_ERROR');
    });

    it('should categorize errors containing "event" as inngest error', async () => {
      process.env.SENTRY_DSN = 'https://key@sentry.io/123';
      process.env.POSTHOG_API_KEY = 'phc_test';

      mockFetch.mockResolvedValue({ ok: true });

      const { trackInngestFailure } = await import('../server-tracking.mts');

      // Note: The categorizeError function treats any message containing "event"
      // as INNGEST_ERROR. This is intentional for broad error capture.
      await trackInngestFailure('test.event', new Error('some event happened'), {
        owner: 'test',
        repo: 'repo',
      });

      const posthogCall = mockFetch.mock.calls.find((call) =>
        isUrlForHost(call[0], 'posthog.com')
      );
      expect(posthogCall).toBeDefined();
      const posthogBody = JSON.parse(posthogCall[1].body);
      // Current implementation categorizes any "event" as INNGEST_ERROR
      expect(posthogBody.properties.error_category).toBe('INNGEST_ERROR');
    });

    it('should categorize unknown errors correctly', async () => {
      process.env.SENTRY_DSN = 'https://key@sentry.io/123';
      process.env.POSTHOG_API_KEY = 'phc_test';

      mockFetch.mockResolvedValue({ ok: true });

      const { trackInngestFailure } = await import('../server-tracking.mts');

      await trackInngestFailure('test.event', new Error('something went wrong'), {
        owner: 'test',
        repo: 'repo',
      });

      const posthogCall = mockFetch.mock.calls.find((call) =>
        isUrlForHost(call[0], 'posthog.com')
      );
      expect(posthogCall).toBeDefined();
      const posthogBody = JSON.parse(posthogCall[1].body);
      expect(posthogBody.properties.error_category).toBe('UNKNOWN_ERROR');
    });
  });

  describe('captureServerException', () => {
    it('should skip when SENTRY_DSN is not configured', async () => {
      delete process.env.SENTRY_DSN;
      delete process.env.VITE_SENTRY_DSN;

      const { captureServerException } = await import('../server-tracking.mts');

      await captureServerException(new Error('test error'));

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should send error to Sentry when configured', async () => {
      process.env.SENTRY_DSN = 'https://publickey@sentry.io/123456';

      mockFetch.mockResolvedValue({ ok: true });

      const { captureServerException } = await import('../server-tracking.mts');

      await captureServerException(new Error('test error'), {
        level: 'error',
        tags: { component: 'test' },
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://sentry.io/api/123456/store/');
      expect(options.method).toBe('POST');

      const body = JSON.parse(options.body);
      expect(body.exception.values[0].value).toBe('test error');
      expect(body.level).toBe('error');
      expect(body.tags.component).toBe('test');
    });

    it('should handle invalid DSN format gracefully', async () => {
      process.env.SENTRY_DSN = 'invalid-dsn-format';

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { captureServerException } = await import('../server-tracking.mts');

      await captureServerException(new Error('test error'));

      expect(mockFetch).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('[Server Tracking] Invalid Sentry DSN format');

      consoleSpy.mockRestore();
    });
  });

  describe('trackServerEvent', () => {
    it('should skip when POSTHOG_API_KEY is not configured', async () => {
      delete process.env.POSTHOG_API_KEY;
      delete process.env.VITE_POSTHOG_KEY;

      const { trackServerEvent } = await import('../server-tracking.mts');

      await trackServerEvent('test_event', { foo: 'bar' });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should send event to PostHog when configured', async () => {
      process.env.POSTHOG_API_KEY = 'phc_testkey';

      mockFetch.mockResolvedValue({ ok: true });

      const { trackServerEvent } = await import('../server-tracking.mts');

      await trackServerEvent('test_event', { foo: 'bar' }, 'user-123');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://us.i.posthog.com/capture/');
      expect(options.method).toBe('POST');

      const body = JSON.parse(options.body);
      expect(body.event).toBe('test_event');
      expect(body.properties.foo).toBe('bar');
      expect(body.distinct_id).toBe('user-123');
      expect(body.api_key).toBe('phc_testkey');
    });

    it('should use custom PostHog host when configured', async () => {
      process.env.POSTHOG_API_KEY = 'phc_testkey';
      process.env.POSTHOG_HOST = 'https://custom.posthog.com';

      mockFetch.mockResolvedValue({ ok: true });

      const { trackServerEvent } = await import('../server-tracking.mts');

      await trackServerEvent('test_event');

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe('https://custom.posthog.com/capture/');
    });
  });

  describe('trackInngestFailure', () => {
    it('should send to both Sentry and PostHog', async () => {
      process.env.SENTRY_DSN = 'https://key@sentry.io/123';
      process.env.POSTHOG_API_KEY = 'phc_test';

      mockFetch.mockResolvedValue({ ok: true });

      const { trackInngestFailure } = await import('../server-tracking.mts');

      await trackInngestFailure('capture/repository.sync', new Error('test failure'), {
        owner: 'testowner',
        repo: 'testrepo',
        repositoryId: 'repo-123',
        eventType: 'initial-sync',
        isLocal: false,
      });

      // Should have called fetch twice (Sentry + PostHog)
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Verify Sentry call (secure URL validation)
      const sentryCall = mockFetch.mock.calls.find((call) => isUrlForHost(call[0], 'sentry.io'));
      expect(sentryCall).toBeDefined();
      const sentryBody = JSON.parse(sentryCall[1].body);
      expect(sentryBody.tags.event_name).toBe('capture/repository.sync');
      expect(sentryBody.tags.repository).toBe('testowner/testrepo');

      // Verify PostHog call (secure URL validation)
      const posthogCall = mockFetch.mock.calls.find((call) => isUrlForHost(call[0], 'posthog.com'));
      expect(posthogCall).toBeDefined();
      const posthogBody = JSON.parse(posthogCall[1].body);
      expect(posthogBody.event).toBe('inngest_event_failed');
      expect(posthogBody.properties.event_name).toBe('capture/repository.sync');
      expect(posthogBody.properties.repository).toBe('testowner/testrepo');
    });

    it('should handle non-Error objects', async () => {
      process.env.SENTRY_DSN = 'https://key@sentry.io/123';
      process.env.POSTHOG_API_KEY = 'phc_test';

      mockFetch.mockResolvedValue({ ok: true });

      const { trackInngestFailure } = await import('../server-tracking.mts');

      await trackInngestFailure('test.event', 'string error message', {
        owner: 'test',
        repo: 'repo',
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);

      const posthogCall = mockFetch.mock.calls.find((call) => isUrlForHost(call[0], 'posthog.com'));
      const posthogBody = JSON.parse(posthogCall[1].body);
      expect(posthogBody.properties.error_type).toBe('InngestError');
    });
  });
});
