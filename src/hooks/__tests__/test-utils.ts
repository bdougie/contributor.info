import { vi } from 'vitest';

// Shared test data
export const mockPRData = [
  {
    id: 1,
    title: 'Test PR 1',
    user: { login: 'user1', avatar_url: 'avatar1.jpg' },
    state: 'merged',
    created_at: '2023-01-01T00:00:00Z',
  },
  {
    id: 2,
    title: 'Test PR 2',
    user: { login: 'user2', avatar_url: 'avatar2.jpg' },
    state: 'open',
    created_at: '2023-01-02T00:00:00Z',
  },
  {
    id: 3,
    title: 'Test PR 3',
    user: { login: 'user1', avatar_url: 'avatar1.jpg' },
    state: 'closed',
    created_at: '2023-01-03T00:00:00Z',
  },
];

export const mockDirectCommitsData = {
  commits: [{ sha: 'abc123', message: 'Test commit', author: 'user1' }],
  totalCommits: 1,
};

export const mockLotteryFactor = {
  factor: 0.75,
  description: 'High lottery factor',
  category: 'balanced' as const,
};

// Simple mock setup - no complex dependencies
export const setupBasicMocks = () => {
  // Mock requestIdleCallback with immediate execution
  if (!window.requestIdleCallback) {
    window.requestIdleCallback = vi.fn((callback: IdleRequestCallback) => {
      callback({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline);
      return 1;
    });
  }

  // Mock IntersectionObserver if needed
  if (!window.IntersectionObserver) {
    window.IntersectionObserver = vi.fn(() => ({
      disconnect: vi.fn(),
      observe: vi.fn(),
      unobserve: vi.fn(),
      takeRecords: vi.fn(() => []),
    })) as any;
  }
};

// Clean up function
export const cleanupMocks = () => {
  vi.clearAllMocks();
  vi.clearAllTimers();
};
