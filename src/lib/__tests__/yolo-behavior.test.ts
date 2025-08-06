import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchDirectCommits } from '../github';

// Mock supabase
vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } })
    }
  }
}));

// Mock fetch for testing
global.fetch = vi.fn();

describe('YOLO Algorithm Improved Implementation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use commits API and return structured data', async () => {
    // Mock all required API calls with minimal data for basic functionality test
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/repos/test/repo') && !url.includes('/commits') && !url.includes('/pulls')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ default_branch: 'main' })
        });
      }
      
      if (url.includes('/repos/test/repo/pulls') && !url.includes('/commits')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]) // No PRs for simplicity
        });
      }
      
      if (url.includes('/commits') && url.includes('sha=main')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              sha: 'commit-sha-1',
              author: {
                login: 'testuser',
                avatar_url: 'https://example.com/avatar.jpg'
              },
              commit: {
                author: { date: new Date().toISOString() }
              }
            }
          ])
        });
      }
      
      return Promise.resolve({ ok: false, statusText: 'Not Found' });
    });

    const result = await fetchDirectCommits('test', 'repo', '30');
    
    expect(result).toHaveProperty('directCommits');
    expect(result).toHaveProperty('hasYoloCoders');
    expect(result).toHaveProperty('yoloCoderStats');
    
    expect(Array.isArray(result.directCommits)).toBe(true);
    expect(Array.isArray(result.yoloCoderStats)).toBe(true);
    expect(typeof result.hasYoloCoders).toBe('boolean');
  });

  it('should identify direct commits correctly', async () => {
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/repos/test/repo') && !url.includes('/commits') && !url.includes('/pulls')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ default_branch: 'main' })
        });
      }
      
      if (url.includes('/repos/test/repo/pulls') && !url.includes('/commits')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        });
      }
      
      if (url.includes('/commits') && url.includes('sha=main')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              sha: 'direct-commit-sha',
              author: {
                login: 'testuser',
                avatar_url: 'https://example.com/avatar.jpg'
              },
              commit: {
                author: { date: new Date().toISOString() }
              }
            }
          ])
        });
      }
      
      return Promise.resolve({ ok: false, statusText: 'Not Found' });
    });

    const result = await fetchDirectCommits('test', 'repo', '30');
    
    expect(result.directCommits.length).toBe(1);
    expect(result.directCommits[0]).toHaveProperty('sha', 'direct-commit-sha');
    expect(result.directCommits[0]).toHaveProperty('actor');
    expect(result.directCommits[0]).toHaveProperty('event_time');
    expect(result.directCommits[0]).toHaveProperty('push_num_commits', 1);
    
    expect(result.directCommits[0].actor).toHaveProperty('login', 'testuser');
    expect(result.directCommits[0].actor).toHaveProperty('avatar_url');
    expect(result.directCommits[0].actor).toHaveProperty('type');
  });

  it('should calculate yolo coder stats correctly', async () => {
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/repos/test/repo') && !url.includes('/commits') && !url.includes('/pulls')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ default_branch: 'main' })
        });
      }
      
      if (url.includes('/repos/test/repo/pulls') && !url.includes('/commits')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        });
      }
      
      if (url.includes('/commits') && url.includes('sha=main')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              sha: 'commit-1',
              author: {
                login: 'testuser',
                avatar_url: 'https://example.com/avatar.jpg'
              },
              commit: {
                author: { date: new Date().toISOString() }
              }
            }
          ])
        });
      }
      
      return Promise.resolve({ ok: false, statusText: 'Not Found' });
    });

    const result = await fetchDirectCommits('test', 'repo', '30');
    
    expect(result.hasYoloCoders).toBe(true);
    expect(result.yoloCoderStats.length).toBe(1);
    
    const coder = result.yoloCoderStats[0];
    expect(coder).toHaveProperty('login', 'testuser');
    expect(coder).toHaveProperty('avatar_url');
    expect(coder).toHaveProperty('directCommits', 1);
    expect(coder).toHaveProperty('totalCommits', 1);
    expect(coder).toHaveProperty('directCommitPercentage');
    expect(coder).toHaveProperty('type', 'User');
  });

  it('should support extended time ranges up to 90 days', async () => {
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/repos/test/repo') && !url.includes('/commits') && !url.includes('/pulls')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ default_branch: 'main' })
        });
      }
      
      if (url.includes('/repos/test/repo/pulls') && !url.includes('/commits')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        });
      }
      
      if (url.includes('/commits') && url.includes('sha=main')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        });
      }
      
      return Promise.resolve({ ok: false, statusText: 'Not Found' });
    });

    await fetchDirectCommits('test', 'repo', '90');
    
    // Verify the commits API was called with correct since parameter
    const commitsCalls = (global.fetch as any).mock.calls.filter((call: any[]) => 
      call[0].includes('/commits') && call[0].includes('since=')
    );
    expect(commitsCalls.length).toBeGreaterThan(0);
    
    // Verify the since parameter represents approximately 90 days ago
    const urlWithSince = commitsCalls[0][0];
    const sinceParam = new URL(urlWithSince).searchParams.get('since');
    expect(sinceParam).toBeTruthy();
    
    const sinceDate = new Date(sinceParam!);
    const daysDiff = Math.abs((new Date().getTime() - sinceDate.getTime()) / (1000 * 60 * 60 * 24));
    expect(daysDiff).toBeCloseTo(90, 1); // Within 1 day tolerance
  });

  it('should handle bot detection correctly', async () => {
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/repos/test/repo') && !url.includes('/commits') && !url.includes('/pulls')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ default_branch: 'main' })
        });
      }
      
      if (url.includes('/repos/test/repo/pulls') && !url.includes('/commits')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        });
      }
      
      if (url.includes('/commits')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              sha: 'bot-commit-sha',
              author: {
                login: 'dependabot[bot]',
                avatar_url: 'https://example.com/bot-avatar.jpg'
              },
              commit: {
                author: { date: new Date().toISOString() }
              }
            }
          ])
        });
      }
      
      return Promise.resolve({ ok: false, statusText: 'Not Found' });
    });

    const result = await fetchDirectCommits('test', 'repo', '30');
    
    expect(result.yoloCoderStats[0].type).toBe('Bot');
    expect(result.yoloCoderStats[0].login).toBe('dependabot[bot]');
  });

  it('should limit time range to maximum 90 days', async () => {
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/repos/test/repo') && !url.includes('/commits') && !url.includes('/pulls')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ default_branch: 'main' })
        });
      }
      
      if (url.includes('/repos/test/repo/pulls') && !url.includes('/commits')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        });
      }
      
      if (url.includes('/commits') && url.includes('sha=main')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        });
      }
      
      return Promise.resolve({ ok: false, statusText: 'Not Found' });
    });

    await fetchDirectCommits('test', 'repo', '120'); // Request 120 days
    
    // Verify the since parameter represents no more than 90 days ago
    const commitsCalls = (global.fetch as any).mock.calls.filter((call: any[]) => 
      call[0].includes('/commits') && call[0].includes('since=')
    );
    expect(commitsCalls.length).toBeGreaterThan(0);
    
    const urlWithSince = commitsCalls[0][0];
    const sinceParam = new URL(urlWithSince).searchParams.get('since');
    expect(sinceParam).toBeTruthy();
    
    const sinceDate = new Date(sinceParam!);
    const daysDiff = Math.abs((new Date().getTime() - sinceDate.getTime()) / (1000 * 60 * 60 * 24));
    expect(daysDiff).toBeCloseTo(90, 1); // Should be capped at 90 days
  });
