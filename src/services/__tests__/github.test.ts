import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchPullRequestActivities } from '../../../services/github';
import { getCachedGitHubActivity, cacheGitHubActivity } from '../../../services/supabase';

// Mock the Supabase cache functions
vi.mock('../../../services/supabase', () => ({
  getCachedGitHubActivity: vi.fn(),
  cacheGitHubActivity: vi.fn()
}));

// Mock fetch
global.fetch = vi.fn();

describe('GitHub Activity with Supabase caching', () => {
  const mockRepo = 'owner/repo';
  const mockData = [{ id: 1, title: 'Test PR' }];
  
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Mock fetch implementation
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockData
    });
  });
  
  it('should return cached data when available', async () => {
    // Setup mock to return cached data
    (getCachedGitHubActivity as any).mockResolvedValue(mockData);
    
    const result = await fetchPullRequestActivities(mockRepo);
    
    // Check that cache was checked
    expect(getCachedGitHubActivity).toHaveBeenCalledWith(mockRepo);
    
    // Check that fetch was not called (since cache hit)
    expect(global.fetch).not.toHaveBeenCalled();
    
    // Check that the data is correct
    expect(result).toEqual(mockData);
  });
  
  it('should fetch from GitHub API and update cache on cache miss', async () => {
    // Setup mock to return null (cache miss)
    (getCachedGitHubActivity as any).mockResolvedValue(null);
    
    const result = await fetchPullRequestActivities(mockRepo);
    
    // Check that cache was checked
    expect(getCachedGitHubActivity).toHaveBeenCalledWith(mockRepo);
    
    // Check that fetch was called
    expect(global.fetch).toHaveBeenCalledWith(`https://api.github.com/repos/${mockRepo}/pulls`);
    
    // Check that the cache was updated
    expect(cacheGitHubActivity).toHaveBeenCalledWith(mockRepo, mockData);
    
    // Check that the data is correct
    expect(result).toEqual(mockData);
  });
  
  it('should throw an error when repo is not provided', async () => {
    await expect(fetchPullRequestActivities()).rejects.toThrow('Repository name is required');
  });
  
  it('should throw an error when GitHub API request fails', async () => {
    // Setup mock to return null (cache miss)
    (getCachedGitHubActivity as any).mockResolvedValue(null);
    
    // Mock fetch to return an error
    (global.fetch as any).mockResolvedValue({
      ok: false,
      statusText: 'Not Found'
    });
    
    await expect(fetchPullRequestActivities(mockRepo)).rejects.toThrow('Failed to fetch pull request activities: Not Found');
  });
});