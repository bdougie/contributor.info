import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useProgressiveRepoData } from '../use-progressive-repo-data';
import { supabase } from '@/lib/supabase';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Mock the smart fetch function
vi.mock('@/lib/supabase-pr-data-smart', () => ({
  fetchPRDataSmart: vi.fn().mockResolvedValue({
    data: [
      { id: 1, title: 'PR 1', author_id: 1 },
      { id: 2, title: 'PR 2', author_id: 2 },
    ],
    status: 'success',
  }),
}));

// Mock direct commits fetch
vi.mock('@/lib/supabase-direct-commits', () => ({
  fetchDirectCommitsWithDatabaseFallback: vi.fn().mockResolvedValue({
    commits: [{ sha: '123', message: 'test commit' }],
    uniqueAuthors: new Set(['author1']),
  }),
}));

describe('useProgressiveRepoData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock window.requestIdleCallback
    global.requestIdleCallback = vi.fn((cb) => setTimeout(cb, 0));
    global.cancelIdleCallback = vi.fn();
  });

  it.skip('should load data in stages', async () => {
    // Mock Supabase responses
    const mockFrom = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockGte = vi.fn().mockReturnThis();
    const mockNot = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({ 
      data: { id: 'repo-id' }, 
      error: null 
    });

    // Mock repository query
    mockFrom.mockImplementation((table) => {
      if (table === 'repositories') {
        return {
          select: mockSelect,
          eq: mockEq,
          single: mockSingle,
        };
      }
      if (table === 'pull_requests') {
        return {
          select: vi.fn().mockImplementation((fields) => {
            if (fields.includes('count')) {
              // PR count query
              return {
                eq: mockEq,
                gte: mockGte,
                then: () => Promise.resolve({ count: 10, error: null }),
              };
            }
            // Top contributors query
            return {
              eq: mockEq,
              gte: mockGte,
              not: mockNot,
              then: () => Promise.resolve({
                data: [
                  { author_id: 1, contributors: { id: 1, username: 'user1', avatar_url: 'avatar1' } },
                  { author_id: 1, contributors: { id: 1, username: 'user1', avatar_url: 'avatar1' } },
                  { author_id: 2, contributors: { id: 2, username: 'user2', avatar_url: 'avatar2' } },
                ],
                error: null,
              }),
            };
          }),
        };
      }
      return mockFrom;
    });

    (supabase.from as any).mockImplementation(mockFrom);

    const { result } = renderHook(() => 
      useProgressiveRepoData('owner', 'repo', '30', false)
    );

    // Initially, critical data should be loading
    expect(result.current.critical.loading).toBe(true);
    expect(result.current.critical.basicInfo).toBeNull();
    expect(result.current.full.loading).toBe(false);
    expect(result.current.enhancement.loading).toBe(false);

    // Wait for critical data to load
    await waitFor(() => {
      expect(result.current.critical.loading).toBe(false);
      expect(result.current.critical.basicInfo).toBeTruthy();
    });

    // Check critical data
    expect(result.current.critical.basicInfo?.prCount).toBe(10);
    expect(result.current.critical.basicInfo?.contributorCount).toBe(2);
    expect(result.current.critical.basicInfo?.topContributors).toHaveLength(2);

    // Full data should start loading after critical
    await waitFor(() => {
      expect(result.current.full.loading).toBe(true);
    });

    // Wait for full data to complete
    await waitFor(() => {
      expect(result.current.full.loading).toBe(false);
      expect(result.current.full.stats).toBeTruthy();
    });

    // Enhancement data should load in background
    await waitFor(() => {
      expect(result.current.enhancement.loading).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.enhancement.loading).toBe(false);
      expect(result.current.enhancement.directCommits).toBeTruthy();
    });
  });

  it('should handle errors in critical data loading', async () => {
    const mockFrom = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({ 
      data: null, 
      error: { message: 'Repository not found' }
    });

    mockFrom.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
    });

    (supabase.from as any).mockImplementation(mockFrom);

    const { result } = renderHook(() => 
      useProgressiveRepoData('owner', 'repo', '30', false)
    );

    await waitFor(() => {
      expect(result.current.critical.loading).toBe(false);
      expect(result.current.critical.error).toBe('Unable to load repository information. Please check the repository name and try again.');
      expect(result.current.critical.basicInfo).toBeNull();
    });

    // Subsequent stages should not load if critical fails
    expect(result.current.full.loading).toBe(false);
    expect(result.current.full.stats).toBeNull();
    expect(result.current.enhancement.loading).toBe(false);
  });

  it('should not load if owner or repo is missing', () => {
    const { result } = renderHook(() => 
      useProgressiveRepoData(undefined, 'repo', '30', false)
    );

    expect(result.current.critical.loading).toBe(true);
    expect(result.current.critical.basicInfo).toBeNull();
    
    // Should not make any API calls
    expect(supabase.from).not.toHaveBeenCalled();
  });
});