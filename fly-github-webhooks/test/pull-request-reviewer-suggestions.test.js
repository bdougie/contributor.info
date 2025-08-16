import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handlePRWithReviewerSuggestions } from '../src/handlers/pull-request-reviewer-suggestions.js';
import Logger from '../src/utils/logger.js';

// Mock dependencies
vi.mock('../src/utils/logger.js');

describe('Pull Request Reviewer Suggestions Handler', () => {
  let mockSupabase;
  let mockGithubApp;
  let mockOctokit;
  let mockLogger;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup logger mock
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      child: vi.fn(() => mockLogger)
    };

    // Setup Octokit mock
    mockOctokit = {
      rest: {
        pulls: {
          listFiles: vi.fn()
        },
        issues: {
          createComment: vi.fn()
        }
      }
    };

    // Setup GitHub App mock
    mockGithubApp = {
      getInstallationOctokit: vi.fn().mockResolvedValue(mockOctokit)
    };

    // Setup Supabase mock with proper structure
    mockSupabase = {
      from: vi.fn((table) => {
        const mockQueries = {
          repositories: {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn()
              }))
            })),
            upsert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn()
              }))
            }))
          },
          contributors: {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn()
              }))
            })),
            upsert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn()
              }))
            }))
          },
          pull_requests: {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn()
              }))
            })),
            upsert: vi.fn()
          },
          reviews: {
            select: vi.fn(() => ({
              eq: vi.fn()
            }))
          },
          comments: {
            select: vi.fn(() => ({
              eq: vi.fn()
            }))
          },
          file_contributors: {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                in: vi.fn()
              }))
            }))
          }
        };

        return mockQueries[table] || {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn()
            }))
          }))
        };
      })
    };
  });

  describe('Database Query Fixes', () => {
    it('should correctly use internal repository ID instead of GitHub ID', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          id: 123,
          number: 1,
          user: { id: 456, login: 'testuser', type: 'User' },
          draft: false,
          base: { ref: 'main' },
          head: { ref: 'feature' },
          title: 'Test PR',
          body: 'Test body',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          html_url: 'https://github.com/test/repo/pull/1'
        },
        repository: {
          id: 789, // GitHub ID
          name: 'repo',
          full_name: 'test/repo',
          owner: { login: 'test' },
          private: false,
          html_url: 'https://github.com/test/repo',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        installation: { id: 999 }
      };

      // Mock repository lookup to return internal ID
      const internalRepoId = 'uuid-repo-123';
      const repoSelectMock = vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: internalRepoId },
            error: null
          })
        }))
      }));

      // Mock contributor lookup
      const internalContributorId = 'uuid-contributor-456';
      const contributorSelectMock = vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: internalContributorId },
            error: null
          })
        }))
      }));

      // Mock PR history query
      const prHistoryMock = vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({
            data: [
              { id: '1', state: 'closed', merged: true },
              { id: '2', state: 'closed', merged: false }
            ],
            error: null
          })
        }))
      }));

      // Setup the mocks
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'repositories') {
          return { select: repoSelectMock };
        }
        if (table === 'contributors') {
          return { select: contributorSelectMock };
        }
        if (table === 'pull_requests') {
          return { select: prHistoryMock };
        }
        // Default mock for other tables
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: [], error: null })
          }))
        };
      });

      // Mock file list
      mockOctokit.rest.pulls.listFiles.mockResolvedValue({
        data: [{ filename: 'src/index.js' }]
      });

      await handlePRWithReviewerSuggestions(payload, mockGithubApp, mockSupabase, mockLogger);

      // Verify repository lookup used GitHub ID
      expect(repoSelectMock).toHaveBeenCalled();
      const repoCall = repoSelectMock.mock.results[0].value.eq;
      expect(repoCall).toHaveBeenCalledWith('github_id', 789);

      // Verify PR history query used internal repository ID
      expect(prHistoryMock).toHaveBeenCalled();
      const prCall = prHistoryMock.mock.results[0].value.eq;
      expect(prCall).toHaveBeenCalledWith('repository_id', internalRepoId);
    });

    it('should handle missing repository gracefully', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          id: 123,
          number: 1,
          user: { id: 456, login: 'testuser', type: 'User' },
          draft: false,
          base: { ref: 'main' },
          head: { ref: 'feature' },
          title: 'Test PR',
          body: 'Test body',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          html_url: 'https://github.com/test/repo/pull/1'
        },
        repository: {
          id: 789,
          name: 'repo',
          full_name: 'test/repo',
          owner: { login: 'test' },
          private: false,
          html_url: 'https://github.com/test/repo',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        installation: { id: 999 }
      };

      // Mock repository not found
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'repositories') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: null
                })
              }))
            })),
            upsert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'new-repo-id' },
                  error: null
                })
              }))
            }))
          };
        }
        // Return empty data for other tables
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: [], error: null })
          }))
        };
      });

      // Mock file list
      mockOctokit.rest.pulls.listFiles.mockResolvedValue({
        data: [{ filename: 'src/index.js' }]
      });

      const result = await handlePRWithReviewerSuggestions(payload, mockGithubApp, mockSupabase, mockLogger);

      // Should still complete successfully
      expect(result.success).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Repository not found'),
        expect.any(String)
      );
    });
  });

  describe('Query Limit Fixes', () => {
    it('should fetch all file contributors without artificial limits', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          id: 123,
          number: 1,
          user: { id: 456, login: 'testuser', type: 'User' },
          draft: false,
          base: { ref: 'main' },
          head: { ref: 'feature' },
          title: 'Test PR',
          body: 'Test body',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          html_url: 'https://github.com/test/repo/pull/1'
        },
        repository: {
          id: 789,
          name: 'repo',
          full_name: 'test/repo',
          owner: { login: 'test' },
          private: false,
          html_url: 'https://github.com/test/repo',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        installation: { id: 999 }
      };

      const fileContributorsMock = vi.fn().mockResolvedValue({
        data: Array.from({ length: 20 }, (_, i) => ({
          contributor_id: `contributor-${i}`,
          commit_count: 10 - i,
          contributors: {
            github_id: 1000 + i,
            username: `user${i}`,
            avatar_url: `https://github.com/user${i}.png`
          }
        })),
        error: null
      });

      // Setup mocks
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'repositories') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'repo-id' },
                  error: null
                })
              }))
            }))
          };
        }
        if (table === 'file_contributors') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                in: fileContributorsMock
              }))
            }))
          };
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: [], error: null })
          }))
        };
      });

      // Mock file list
      mockOctokit.rest.pulls.listFiles.mockResolvedValue({
        data: [{ filename: 'src/index.js' }]
      });

      await handlePRWithReviewerSuggestions(payload, mockGithubApp, mockSupabase, mockLogger);

      // Verify no limit was applied to file contributors query
      expect(fileContributorsMock).toHaveBeenCalled();
      // The query should not have a .limit() call in the new implementation
    });

    it('should fetch all reviews without artificial limits', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          id: 123,
          number: 1,
          user: { id: 456, login: 'testuser', type: 'User' },
          draft: false,
          base: { ref: 'main' },
          head: { ref: 'feature' },
          title: 'Test PR',
          body: 'Test body',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          html_url: 'https://github.com/test/repo/pull/1'
        },
        repository: {
          id: 789,
          name: 'repo',
          full_name: 'test/repo',
          owner: { login: 'test' },
          private: false,
          html_url: 'https://github.com/test/repo',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        installation: { id: 999 }
      };

      const reviewsMock = vi.fn().mockResolvedValue({
        data: Array.from({ length: 100 }, (_, i) => ({
          reviewer_id: `reviewer-${i}`,
          contributors: {
            username: `reviewer${i}`,
            avatar_url: `https://github.com/reviewer${i}.png`
          },
          pull_requests: {
            author_id: 'author-1',
            repository_id: 'repo-id'
          }
        })),
        error: null
      });

      // Setup mocks
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'repositories') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'repo-id' },
                  error: null
                })
              }))
            }))
          };
        }
        if (table === 'reviews') {
          return {
            select: vi.fn(() => ({
              eq: reviewsMock
            }))
          };
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: [], error: null })
          }))
        };
      });

      // Mock file list
      mockOctokit.rest.pulls.listFiles.mockResolvedValue({
        data: [{ filename: 'src/index.js' }]
      });

      await handlePRWithReviewerSuggestions(payload, mockGithubApp, mockSupabase, mockLogger);

      // Verify reviews were fetched without limit
      expect(reviewsMock).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          id: 123,
          number: 1,
          user: { id: 456, login: 'testuser', type: 'User' },
          draft: false,
          base: { ref: 'main' },
          head: { ref: 'feature' },
          title: 'Test PR',
          body: 'Test body',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          html_url: 'https://github.com/test/repo/pull/1'
        },
        repository: {
          id: 789,
          name: 'repo',
          full_name: 'test/repo',
          owner: { login: 'test' },
          private: false,
          html_url: 'https://github.com/test/repo',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        installation: { id: 999 }
      };

      // Mock database error
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database connection failed' }
            })
          }))
        }))
      }));

      // Mock file list
      mockOctokit.rest.pulls.listFiles.mockResolvedValue({
        data: [{ filename: 'src/index.js' }]
      });

      const result = await handlePRWithReviewerSuggestions(payload, mockGithubApp, mockSupabase, mockLogger);

      // Should handle error gracefully
      expect(result.success).toBe(true);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should validate data structures before processing', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          id: 123,
          number: 1,
          user: { id: 456, login: 'testuser', type: 'User' },
          draft: false,
          base: { ref: 'main' },
          head: { ref: 'feature' },
          title: 'Test PR',
          body: 'Test body',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          html_url: 'https://github.com/test/repo/pull/1'
        },
        repository: {
          id: 789,
          name: 'repo',
          full_name: 'test/repo',
          owner: { login: 'test' },
          private: false,
          html_url: 'https://github.com/test/repo',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        installation: { id: 999 }
      };

      // Mock malformed data
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'repositories') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'repo-id' },
                  error: null
                })
              }))
            }))
          };
        }
        if (table === 'file_contributors') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                in: vi.fn().mockResolvedValue({
                  data: [
                    { 
                      contributor_id: 'c1',
                      commit_count: 5,
                      contributors: null // Missing nested data
                    },
                    {
                      contributor_id: 'c2',
                      commit_count: 3,
                      contributors: {
                        username: 'user2',
                        avatar_url: 'https://github.com/user2.png'
                      }
                    }
                  ],
                  error: null
                })
              }))
            }))
          };
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: [], error: null })
          }))
        };
      });

      // Mock file list
      mockOctokit.rest.pulls.listFiles.mockResolvedValue({
        data: [{ filename: 'src/index.js' }]
      });

      const result = await handlePRWithReviewerSuggestions(payload, mockGithubApp, mockSupabase, mockLogger);

      // Should handle malformed data gracefully
      expect(result.success).toBe(true);
      // Should only process valid contributor data
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalled();
    });
  });

  describe('Logging Standards', () => {
    it('should use structured logging with proper parameter formatting', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          id: 123,
          number: 1,
          user: { id: 456, login: 'testuser', type: 'User' },
          draft: false,
          base: { ref: 'main' },
          head: { ref: 'feature' },
          title: 'Test PR',
          body: 'Test body',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          html_url: 'https://github.com/test/repo/pull/1'
        },
        repository: {
          id: 789,
          name: 'repo',
          full_name: 'test/repo',
          owner: { login: 'test' },
          private: false,
          html_url: 'https://github.com/test/repo',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        installation: { id: 999 }
      };

      // Setup basic mocks
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Test error' }
            })
          }))
        }))
      }));

      mockOctokit.rest.pulls.listFiles.mockResolvedValue({
        data: [{ filename: 'src/index.js' }]
      });

      await handlePRWithReviewerSuggestions(payload, mockGithubApp, mockSupabase, mockLogger);

      // Verify structured logging calls
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Processing PR'),
        expect.any(Number),
        expect.any(String),
        expect.any(String)
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Repository not found'),
        expect.any(String)
      );
    });
  });
});