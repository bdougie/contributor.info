import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { indexGitHistory } from '../../../../app/services/git-history';
import { Logger } from '../../../../app/services/logger';
import { Octokit } from '@octokit/rest';
import { Repository } from '../../../../app/types/github';

// Create mock logger instance
const mockLoggerInstance = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  child: vi.fn().mockReturnThis()
};

// Mock the logger module
vi.mock('../../../../app/services/logger', () => ({
  Logger: vi.fn().mockImplementation(() => mockLoggerInstance)
}));

// Mock supabase
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn()
  }
}));

describe('Git History Service', () => {
  let mockOctokit: Partial<Octokit>;
  let mockRepository: Repository;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset logger mock functions
    mockLoggerInstance.info.mockClear();
    mockLoggerInstance.error.mockClear();
    mockLoggerInstance.warn.mockClear();
    mockLoggerInstance.debug.mockClear();

    // Setup repository mock
    mockRepository = {
      id: 123456,
      full_name: 'test/repo',
      name: 'repo',
      owner: {
        login: 'test',
        id: 789,
        avatar_url: 'https://github.com/test.png',
        html_url: 'https://github.com/test',
        type: 'Organization'
      },
      private: false,
      description: 'Test repository',
      html_url: 'https://github.com/test/repo',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    } as Repository;

    // Setup Octokit mock
    mockOctokit = {
      repos: {
        listCommits: vi.fn(),
        getCommit: vi.fn()
      }
    } as Partial<Octokit>;

    // Logger instance is already mocked
  });

  describe('Structured Logging', () => {
    it('should use structured logging instead of console.error', async () => {
      const { supabase } = await import('../../../lib/supabase');
      
      // Mock database error
      (supabase.from as Mock).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database connection failed' }
            })
          })
        })
      });

      await indexGitHistory(mockRepository, mockOctokit as Octokit);

      // Verify structured logger was used for errors
      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        'Error fetching repository from database: %s',
        'Database connection failed'
      );
      
      // Verify console.error was NOT called directly
      const consoleErrorSpy = vi.spyOn(console, 'error');
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('[Git History]')
      );
    });

    it('should use parameterized logging to prevent format string vulnerabilities', async () => {
      const { supabase } = await import('../../../lib/supabase');
      
      // Mock successful repository lookup
      (supabase.from as Mock).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'repo-uuid' },
              error: null
            })
          })
        })
      });

      // Mock commits with potentially dangerous user input
      const maliciousUsername = '%s%s%s%n%n%n';
      (mockOctokit.repos!.listCommits as Mock).mockResolvedValue({
        data: [{
          sha: 'abc123',
          commit: {
            author: {
              name: 'Test User',
              date: new Date().toISOString()
            }
          },
          author: {
            id: 999,
            login: maliciousUsername,
            avatar_url: 'https://github.com/test.png'
          }
        }]
      });

      // Mock commit details
      (mockOctokit.repos!.getCommit as Mock).mockResolvedValue({
        data: {
          sha: 'abc123',
          files: [{ filename: 'test.js' }]
        }
      });

      // Mock contributor lookup failure
      (supabase.from as Mock).mockImplementation((table: string) => {
        if (table === 'contributors') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Contributor not found' }
                })
              })
            })
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'repo-uuid' },
                error: null
              })
            })
          })
        };
      });

      await indexGitHistory(mockRepository, mockOctokit as Octokit);

      // Verify parameterized logging was used (prevents format string attacks)
      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        'Error fetching contributor %s: %s',
        maliciousUsername,
        'Contributor not found'
      );
    });

    it('should log progress updates using structured logging', async () => {
      const { supabase } = await import('../../../lib/supabase');
      
      // Mock successful repository lookup
      (supabase.from as Mock).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'repo-uuid' },
              error: null
            })
          })
        })
      });

      // Mock empty commits (to complete quickly)
      (mockOctokit.repos!.listCommits as Mock).mockResolvedValue({
        data: []
      });

      // Mock file_contributors upsert
      (supabase.from as Mock).mockImplementation((table: string) => {
        if (table === 'file_contributors') {
          return {
            upsert: vi.fn().mockResolvedValue({
              error: null
            })
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'repo-uuid' },
                error: null
              })
            })
          })
        };
      });

      await indexGitHistory(mockRepository, mockOctokit as Octokit);

      // Verify progress logging
      expect(mockLoggerInstance.info).toHaveBeenCalledWith(
        'Starting git history indexing for %s',
        'test/repo'
      );
      
      expect(mockLoggerInstance.info).toHaveBeenCalledWith(
        'Git history indexing completed for %s',
        'test/repo'
      );
    });
  });

  describe('Schema Field Corrections', () => {
    it('should use correct schema field names (username not github_login)', async () => {
      const { supabase } = await import('../../../lib/supabase');
      
      let contributorQuery: any = null;
      let contributorInsert: any = null;

      // Mock repository lookup
      (supabase.from as Mock).mockImplementation((table: string) => {
        if (table === 'repositories') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'repo-uuid' },
                  error: null
                })
              })
            })
          };
        }
        
        if (table === 'contributors') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn((field: string, value: any) => {
                contributorQuery = { field, value };
                return {
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: null
                  })
                };
              })
            }),
            insert: vi.fn((data: any) => {
              contributorInsert = data;
              return {
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'contributor-uuid' },
                    error: null
                  })
                })
              };
            })
          };
        }
        
        if (table === 'file_contributors') {
          return {
            upsert: vi.fn().mockResolvedValue({
              error: null
            })
          };
        }
        
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: null
              })
            })
          })
        };
      });

      // Mock commits
      (mockOctokit.repos!.listCommits as Mock).mockResolvedValue({
        data: [{
          sha: 'abc123',
          commit: {
            author: {
              name: 'Test User',
              date: new Date().toISOString()
            }
          },
          author: {
            id: 999,
            login: 'testuser',
            avatar_url: 'https://github.com/testuser.png'
          }
        }]
      });

      // Mock commit details
      (mockOctokit.repos!.getCommit as Mock).mockResolvedValue({
        data: {
          sha: 'abc123',
          files: [{ filename: 'test.js' }]
        }
      });

      await indexGitHistory(mockRepository, mockOctokit as Octokit);

      // Verify correct field names were used
      expect(contributorQuery).toEqual({
        field: 'username',  // Should be 'username', not 'github_login'
        value: 'testuser'
      });

      expect(contributorInsert).toMatchObject({
        github_id: 999,
        username: 'testuser',  // Should be 'username', not 'github_login'
        display_name: 'Test User',  // Should be 'display_name', not 'name'
        avatar_url: 'https://github.com/testuser.png',
        profile_url: 'https://github.com/testuser'
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle commit processing errors gracefully', async () => {
      const { supabase } = await import('../../../lib/supabase');
      
      // Mock successful repository lookup
      (supabase.from as Mock).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'repo-uuid' },
              error: null
            })
          })
        })
      });

      // Mock commits
      (mockOctokit.repos!.listCommits as Mock).mockResolvedValue({
        data: [{
          sha: 'abc123',
          commit: {
            author: {
              name: 'Test User',
              date: new Date().toISOString()
            }
          },
          author: {
            id: 999,
            login: 'testuser',
            avatar_url: 'https://github.com/testuser.png'
          }
        }]
      });

      // Mock commit details to throw error
      (mockOctokit.repos!.getCommit as Mock).mockRejectedValue(
        new Error('API rate limit exceeded')
      );

      // Mock file_contributors upsert
      (supabase.from as Mock).mockImplementation((table: string) => {
        if (table === 'file_contributors') {
          return {
            upsert: vi.fn().mockResolvedValue({
              error: null
            })
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'repo-uuid' },
                error: null
              })
            })
          })
        };
      });

      await indexGitHistory(mockRepository, mockOctokit as Octokit);

      // Verify error was logged properly
      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        'Error processing commit %s: %s',
        'abc123',
        'API rate limit exceeded'
      );
    });

    it('should handle pagination errors gracefully', async () => {
      const { supabase } = await import('../../../lib/supabase');
      
      // Mock successful repository lookup
      (supabase.from as Mock).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'repo-uuid' },
              error: null
            })
          })
        })
      });

      // Mock commit listing to fail
      (mockOctokit.repos!.listCommits as Mock).mockRejectedValue(
        new Error('Network error')
      );

      // Mock file_contributors upsert
      (supabase.from as Mock).mockImplementation((table: string) => {
        if (table === 'file_contributors') {
          return {
            upsert: vi.fn().mockResolvedValue({
              error: null
            })
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'repo-uuid' },
                error: null
              })
            })
          })
        };
      });

      await indexGitHistory(mockRepository, mockOctokit as Octokit);

      // Verify error was logged
      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        'Error fetching commits page %d: %s',
        1,
        'Network error'
      );
    });
  });
});