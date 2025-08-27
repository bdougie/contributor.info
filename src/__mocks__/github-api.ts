// Mock GitHub API responses for testing
import { vi } from 'vitest';

export const mockGitHubApiResponses = {
  // Mock repository info
  repository: {
    id: 123456,
    name: 'test-repo',
    full_name: 'owner/test-repo',
    owner: { login: 'owner' },
    stargazers_count: 100,
    fork: false,
    language: 'TypeScript',
  },

  // Mock pull requests
  pullRequests: [
    {
      id: 1,
      number: 1,
      title: 'Test PR',
      user: { login: 'contributor1' },
      created_at: '2024-01-01T00:00:00Z',
      merged_at: '2024-01-02T00:00:00Z',
      state: 'closed',
    },
  ],

  // Mock issues
  issues: [
    {
      id: 1,
      number: 1,
      title: 'Test Issue',
      user: { login: 'contributor1' },
      created_at: '2024-01-01T00:00:00Z',
      state: 'open',
    },
  ],

  // Mock contributors
  contributors: [
    {
      login: 'contributor1',
      id: 1,
      contributions: 50,
      avatar_url: 'https://github.com/contributor1.png',
    },
  ],
};

// Setup global fetch mock with GitHub API responses
export function setupGitHubApiMock() {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    // Mock different endpoints
    if (url.includes('/repos/')) {
      if (url.includes('/pulls')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockGitHubApiResponses.pullRequests),
        });
      }
      if (url.includes('/issues')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockGitHubApiResponses.issues),
        });
      }
      if (url.includes('/contributors')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockGitHubApiResponses.contributors),
        });
      }
      // Default repository info
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockGitHubApiResponses.repository),
      });
    }

    // Default successful response for other endpoints
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });
}
