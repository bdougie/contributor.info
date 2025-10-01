import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventRouter } from '../event-router';
import type { WebhookEvent } from '../../types/github';

// Mock dependencies
vi.mock('../../services/webhook-metrics', () => ({
  webhookMetrics: {
    recordEvent: vi.fn(),
    recordProcessingTime: vi.fn(),
    recordPriority: vi.fn(),
  },
}));

vi.mock('../../services/event-priority', () => ({
  EventPriorityService: {
    getInstance: vi.fn(() => ({
      classifyPriority: vi.fn(() =>
        Promise.resolve({ priority: 'medium', score: 50, reasons: [] })
      ),
    })),
  },
}));

describe('EventRouter', () => {
  let router: EventRouter;

  beforeEach(() => {
    router = EventRouter.getInstance();
    router.clear(); // Clear state between tests
    vi.clearAllMocks();
    console.log = vi.fn();
    console.error = vi.fn();
  });

  afterEach(() => {
    router.clear();
  });

  describe('Event Debouncing', () => {
    it('should debounce rapid consecutive events', async () => {
      const event: Partial<WebhookEvent> = {
        action: 'edited',
        repository: {
          id: 123,
          name: 'test-repo',
          full_name: 'owner/test-repo',
          owner: { login: 'owner', id: 1, type: 'User' },
          private: false,
        },
        pull_request: {
          id: 456,
          number: 1,
          title: 'Test PR',
          state: 'open',
          user: { login: 'user', id: 2, type: 'User' },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };

      // Fire multiple events rapidly
      await router.routeEvent(event as WebhookEvent);
      await router.routeEvent(event as WebhookEvent);
      await router.routeEvent(event as WebhookEvent);

      const stats = router.getStats();
      expect(stats.debouncedEventsCount).toBe(1); // Should only have 1 debounced event
    });

    it('should not debounce "opened" events', async () => {
      const event: Partial<WebhookEvent> = {
        action: 'opened',
        repository: {
          id: 123,
          name: 'test-repo',
          full_name: 'owner/test-repo',
          owner: { login: 'owner', id: 1, type: 'User' },
          private: false,
        },
        pull_request: {
          id: 456,
          number: 1,
          title: 'Test PR',
          state: 'open',
          user: { login: 'user', id: 2, type: 'User' },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };

      await router.routeEvent(event as WebhookEvent);

      const stats = router.getStats();
      expect(stats.debouncedEventsCount).toBe(0); // Should not debounce opened events
    });

    it('should handle errors in debounced event processing', async () => {
      const event: Partial<WebhookEvent> = {
        action: 'edited',
        repository: {
          id: 123,
          name: 'test-repo',
          full_name: 'owner/test-repo',
          owner: { login: 'owner', id: 1, type: 'User' },
          private: false,
        },
        pull_request: {
          id: 456,
          number: 1,
          title: 'Test PR',
          state: 'open',
          user: { login: 'user', id: 2, type: 'User' },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };

      // Mock processEvent to throw an error
      const processEventSpy = vi
        .spyOn(router as unknown as { processEvent: CallableFunction }, 'processEvent')
        .mockRejectedValue(new Error('Test error'));

      await router.routeEvent(event as WebhookEvent);

      // Wait for debounce to process
      await new Promise((resolve) => setTimeout(resolve, 6000));

      // Verify cleanup happened even with error
      const stats = router.getStats();
      expect(stats.debouncedEventsCount).toBe(0); // Should be cleaned up

      processEventSpy.mockRestore();
    });
  });

  describe('Rate Limiting', () => {
    it('should detect rate limit errors', async () => {
      const event: Partial<WebhookEvent> = {
        action: 'opened',
        repository: {
          id: 123,
          name: 'test-repo',
          full_name: 'owner/test-repo',
          owner: { login: 'owner', id: 1, type: 'User' },
          private: false,
        },
        issue: {
          id: 789,
          number: 1,
          title: 'Test Issue',
          state: 'open',
          user: { login: 'user', id: 2, type: 'User' },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };

      // Mock processEvent to throw a rate limit error
      const rateLimitError = new Error('Rate limit exceeded');
      vi.spyOn(
        router as unknown as { processEvent: CallableFunction },
        'processEvent'
      ).mockRejectedValue(rateLimitError);

      // Should not throw, should queue for retry
      await expect(router.routeEvent(event as WebhookEvent)).resolves.not.toThrow();

      const stats = router.getStats();
      expect(stats.retryQueueLength).toBeGreaterThan(0);
    });
  });

  describe('Event Deduplication', () => {
    it('should track recent events to prevent duplicates', async () => {
      const event: Partial<WebhookEvent> = {
        action: 'opened',
        repository: {
          id: 123,
          name: 'test-repo',
          full_name: 'owner/test-repo',
          owner: { login: 'owner', id: 1, type: 'User' },
          private: false,
        },
        pull_request: {
          id: 456,
          number: 1,
          title: 'Test PR',
          state: 'open',
          user: { login: 'user', id: 2, type: 'User' },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };

      await router.routeEvent(event as WebhookEvent);

      const stats = router.getStats();
      expect(stats.recentEventsCount).toBeGreaterThan(0);
    });
  });

  describe('Stats Reporting', () => {
    it('should provide accurate statistics', () => {
      const stats = router.getStats();

      expect(stats).toHaveProperty('recentEventsCount');
      expect(stats).toHaveProperty('debouncedEventsCount');
      expect(stats).toHaveProperty('retryQueueLength');
      expect(stats).toHaveProperty('isRateLimited');

      expect(typeof stats.recentEventsCount).toBe('number');
      expect(typeof stats.debouncedEventsCount).toBe('number');
      expect(typeof stats.retryQueueLength).toBe('number');
      expect(typeof stats.isRateLimited).toBe('boolean');
    });
  });

  describe('Cleanup', () => {
    it('should clear all state when clear() is called', async () => {
      const event: Partial<WebhookEvent> = {
        action: 'edited',
        repository: {
          id: 123,
          name: 'test-repo',
          full_name: 'owner/test-repo',
          owner: { login: 'owner', id: 1, type: 'User' },
          private: false,
        },
        pull_request: {
          id: 456,
          number: 1,
          title: 'Test PR',
          state: 'open',
          user: { login: 'user', id: 2, type: 'User' },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };

      // Add some state
      await router.routeEvent(event as WebhookEvent);

      // Clear
      router.clear();

      // Verify all state is cleared
      const stats = router.getStats();
      expect(stats.recentEventsCount).toBe(0);
      expect(stats.debouncedEventsCount).toBe(0);
      expect(stats.retryQueueLength).toBe(0);
      expect(stats.isRateLimited).toBe(false);
    });

    it('should cancel all debounced timers on clear', async () => {
      const event: Partial<WebhookEvent> = {
        action: 'edited',
        repository: {
          id: 123,
          name: 'test-repo',
          full_name: 'owner/test-repo',
          owner: { login: 'owner', id: 1, type: 'User' },
          private: false,
        },
        pull_request: {
          id: 456,
          number: 1,
          title: 'Test PR',
          state: 'open',
          user: { login: 'user', id: 2, type: 'User' },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };

      // Create debounced events
      await router.routeEvent(event as WebhookEvent);
      await router.routeEvent(event as WebhookEvent);

      expect(router.getStats().debouncedEventsCount).toBeGreaterThan(0);

      // Clear should cancel timers
      router.clear();

      // Wait to ensure timers don't fire
      await new Promise((resolve) => setTimeout(resolve, 6000));

      // Stats should still show 0 after clear
      expect(router.getStats().debouncedEventsCount).toBe(0);
    });
  });
});
