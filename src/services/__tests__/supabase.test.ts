import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import nock from 'nock';
import { getCachedGitHubActivity, cacheGitHubActivity } from '../supabase';
import { PullRequestActivity } from '@/types/github';
import { PostgrestQueryBuilder } from '@supabase/postgrest-js';
import type { Database } from '../../lib/types';

interface UpsertOptions {
  onConflict?: string;
  ignoreDuplicates?: boolean;
}

// Mock the supabase client
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn()
  }
}));

describe('Supabase Service', () => {
  const mockRepo = 'owner/repo';
  const mockActivity: PullRequestActivity[] = [{
    id: 123,
    title: 'Test PR',
    number: 1,
    html_url: 'https://github.com/owner/repo/pull/1',
    user: {
      login: 'testuser',
      avatar_url: 'https://github.com/testuser.png',
      html_url: 'https://github.com/testuser'
    },
    created_at: '2025-04-24T00:00:00Z',
    updated_at: '2025-04-24T00:00:00Z',
    state: 'open',
    body: 'Test PR description'
  }];

  beforeEach(() => {
    nock.disableNetConnect();
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
    vi.clearAllMocks();
  });

  // Match the table structure in Database type
  type UpsertData = Database['public']['Tables']['github_activity_cache'];
  type QueryBuilder = PostgrestQueryBuilder<{ Tables: Database['public']['Tables']; Views: Database['public']['Views']; Functions: Database['public']['Functions'] }, UpsertData, string>;

  it('should return null when no cached data is found', async () => {
    const { supabase } = await import('../../lib/supabase');
    
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({
            data: null,
            error: { message: 'No data found' }
          })
        })
      })
    } as unknown as QueryBuilder);

    const result = await getCachedGitHubActivity(mockRepo);
    expect(result).toBeNull();
  });

  it('should return null when cache is stale', async () => {
    const { supabase } = await import('../../lib/supabase');
    
    const staleDate = new Date();
    staleDate.setMinutes(staleDate.getMinutes() - 31);
    
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({
            data: {
              repo: mockRepo,
              activity_data: mockActivity,
              updated_at: staleDate.toISOString()
            },
            error: null
          })
        })
      })
    } as unknown as QueryBuilder);

    const result = await getCachedGitHubActivity(mockRepo);
    expect(result).toBeNull();
  });

  it('should cache GitHub activity data successfully', async () => {
    const { supabase } = await import('../../lib/supabase');
    
    const upsertMock = vi.fn().mockResolvedValue({
      data: { repo: mockRepo },
      error: null
    });
    
    vi.mocked(supabase.from).mockReturnValueOnce({
      upsert: (data: UpsertData, options: UpsertOptions) => upsertMock(data, options)
    } as unknown as QueryBuilder);

    await cacheGitHubActivity(mockRepo, mockActivity);
    
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        repo: mockRepo,
        activity_data: mockActivity
      }),
      expect.objectContaining({
        onConflict: 'repo',
        ignoreDuplicates: false
      })
    );
  });

  it('should handle errors when caching data', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const { supabase } = await import('../../lib/supabase');
    
    vi.mocked(supabase.from).mockReturnValueOnce({
      upsert: () => Promise.resolve({
        data: null,
        error: { message: 'Database error' }
      })
    } as unknown as QueryBuilder);

    await cacheGitHubActivity(mockRepo, mockActivity);
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error caching GitHub activity data:',
      expect.objectContaining({ message: 'Database error' })
    );
    
    consoleErrorSpy.mockRestore();
  });
});