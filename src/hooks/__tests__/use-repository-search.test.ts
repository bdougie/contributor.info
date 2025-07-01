import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useRepositorySearch } from '../use-repository-search';
import * as githubModule from '@/lib/github';

// Mock the github module
vi.mock('@/lib/github', () => ({
  searchRepositories: vi.fn(),
}));

// Mock the debounce hook
vi.mock('../use-debounce', () => ({
  useDebounce: vi.fn((value) => value), // Return value immediately for testing
}));

const mockSearchRepositories = vi.mocked(githubModule.searchRepositories);

const mockSearchResponse = {
  total_count: 2,
  incomplete_results: false,
  items: [
    {
      id: 1,
      full_name: 'facebook/react',
      name: 'react',
      owner: {
        login: 'facebook',
        avatar_url: 'https://avatars.githubusercontent.com/u/69631?v=4',
      },
      description: 'A declarative, efficient, and flexible JavaScript library for building user interfaces.',
      stargazers_count: 220000,
      forks_count: 45000,
      language: 'JavaScript',
      updated_at: '2024-01-01T00:00:00Z',
      html_url: 'https://github.com/facebook/react',
    },
    {
      id: 2,
      full_name: 'vercel/next.js',
      name: 'next.js',
      owner: {
        login: 'vercel',
        avatar_url: 'https://avatars.githubusercontent.com/u/14985020?v=4',
      },
      description: 'The React Framework',
      stargazers_count: 120000,
      forks_count: 26000,
      language: 'JavaScript',
      updated_at: '2024-01-02T00:00:00Z',
      html_url: 'https://github.com/vercel/next.js',
    },
  ],
};

describe('useRepositorySearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useRepositorySearch());

    expect(result.current.query).toBe('');
    expect(result.current.results).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.hasResults).toBe(false);
  });

  it('should update query when setQuery is called', () => {
    const { result } = renderHook(() => useRepositorySearch());

    result.current.setQuery('react');

    expect(result.current.query).toBe('react');
  });

  it('should not search when query is too short', async () => {
    const { result } = renderHook(() => useRepositorySearch({ minQueryLength: 3 }));

    result.current.setQuery('re');

    await waitFor(() => {
      expect(mockSearchRepositories).not.toHaveBeenCalled();
      expect(result.current.results).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should search when query meets minimum length', async () => {
    mockSearchRepositories.mockResolvedValueOnce(mockSearchResponse);

    const { result } = renderHook(() => useRepositorySearch({ minQueryLength: 2 }));

    result.current.setQuery('react');

    await waitFor(() => {
      expect(mockSearchRepositories).toHaveBeenCalledWith('react', {
        sort: 'stars',
        order: 'desc',
        per_page: 10,
      });
    });

    await waitFor(() => {
      expect(result.current.results).toEqual(mockSearchResponse.items);
      expect(result.current.hasResults).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
    });
  });

  it('should handle search errors', async () => {
    const errorMessage = 'GitHub API rate limit exceeded';
    mockSearchRepositories.mockRejectedValueOnce(new Error(errorMessage));

    const { result } = renderHook(() => useRepositorySearch());

    result.current.setQuery('react');

    await waitFor(() => {
      expect(result.current.error).toBe(errorMessage);
      expect(result.current.results).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should show loading state during search', async () => {
    // Create a promise that we can control
    let resolveSearch: (value: any) => void;
    const searchPromise = new Promise((resolve) => {
      resolveSearch = resolve;
    });
    mockSearchRepositories.mockReturnValueOnce(searchPromise);

    const { result } = renderHook(() => useRepositorySearch());

    result.current.setQuery('react');

    // Should be loading initially
    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });

    // Resolve the promise
    resolveSearch!(mockSearchResponse);

    // Should no longer be loading
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.results).toEqual(mockSearchResponse.items);
    });
  });

  it('should use custom maxResults option', async () => {
    mockSearchRepositories.mockResolvedValueOnce(mockSearchResponse);

    const { result } = renderHook(() => useRepositorySearch({ maxResults: 5 }));

    result.current.setQuery('react');

    await waitFor(() => {
      expect(mockSearchRepositories).toHaveBeenCalledWith('react', {
        sort: 'stars',
        order: 'desc',
        per_page: 5,
      });
    });
  });

  it('should clear results and query', async () => {
    mockSearchRepositories.mockResolvedValueOnce(mockSearchResponse);

    const { result } = renderHook(() => useRepositorySearch());

    result.current.setQuery('react');

    await waitFor(() => {
      expect(result.current.hasResults).toBe(true);
    });

    result.current.clearResults();

    expect(result.current.query).toBe('');
    expect(result.current.results).toEqual([]);
    expect(result.current.error).toBe(null);
  });

  it('should handle empty query by clearing results', async () => {
    mockSearchRepositories.mockResolvedValueOnce(mockSearchResponse);

    const { result } = renderHook(() => useRepositorySearch());

    // First search
    result.current.setQuery('react');
    await waitFor(() => {
      expect(result.current.hasResults).toBe(true);
    });

    // Clear query
    result.current.setQuery('');

    await waitFor(() => {
      expect(result.current.results).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
    });
  });

  it('should handle whitespace-only queries', async () => {
    const { result } = renderHook(() => useRepositorySearch());

    result.current.setQuery('   ');

    await waitFor(() => {
      expect(mockSearchRepositories).not.toHaveBeenCalled();
      expect(result.current.results).toEqual([]);
    });
  });
});