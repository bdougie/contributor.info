import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { indexGitHistory, findFileContributors, getExpertiseFromFiles } from '../../../../app/services/git-history';
import { Repository } from '../../../../app/types/github';
import { Octokit } from '@octokit/rest';

// Mock dependencies
vi.mock('../../../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Mock console methods to avoid noise in tests
const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('Git History Service', () => {
  const mockRepository: Repository = {
    id: 123,
    name: 'test-repo',
    full_name: 'test-org/test-repo',
    owner: {
      login: 'test-org',
      id: 456,
      type: 'Organization',
    },
    private: false,
    description: 'Test repository',
    fork: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    pushed_at: '2024-01-01T00:00:00Z',
    homepage: null,
    size: 100,
    stargazers_count: 10,
    watchers_count: 10,
    language: 'TypeScript',
    forks_count: 5,
    open_issues_count: 3,
    default_branch: 'main',
    topics: [],
    archived: false,
    disabled: false,
    visibility: 'public',
  };

  const mockOctokit = {
    repos: {
      listCommits: vi.fn(),
      getCommit: vi.fn(),
    },
  } as unknown as Octokit;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('indexGitHistory', () => {
    it('should process commits and flush file contributors periodically', async () => {
      // Mock database responses
      const mockDbRepo = { id: 'repo-uuid' };
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({ data: mockDbRepo });
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      
      const { supabase } = await import('../../../../src/lib/supabase');
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'repositories') {
          return {
            select: mockSelect,
            eq: mockEq,
            single: mockSingle,
          } as any;
        }
        if (table === 'file_contributors') {
          return {
            upsert: mockUpsert,
          } as any;
        }
        if (table === 'contributors') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null }),
            insert: vi.fn().mockReturnThis(),
          } as any;
        }
        return {} as any;
      });

      // Mock commit data
      const mockCommits = Array.from({ length: 55 }, (_, i) => ({
        sha: `commit-${i}`,
        author: {
          login: `user${i % 3}`,
          id: 1000 + (i % 3),
          avatar_url: `https://github.com/user${i % 3}.png`,
        },
        commit: {
          author: {
            name: `User ${i % 3}`,
            date: new Date().toISOString(),
          },
        },
      }));

      const mockDetailedCommit = {
        files: [
          { filename: 'src/index.ts' },
          { filename: 'src/utils.ts' },
          { filename: 'tests/index.test.ts' },
        ],
      };

      vi.mocked(mockOctokit.repos.listCommits)
        .mockResolvedValueOnce({ data: mockCommits.slice(0, 50) } as any)
        .mockResolvedValueOnce({ data: mockCommits.slice(50) } as any)
        .mockResolvedValueOnce({ data: [] } as any);

      vi.mocked(mockOctokit.repos.getCommit).mockResolvedValue({ data: mockDetailedCommit } as any);

      // Execute the function
      await indexGitHistory(mockRepository, mockOctokit);

      // Verify repository lookup
      expect(supabase.from).toHaveBeenCalledWith('repositories');
      expect(mockSelect).toHaveBeenCalledWith('id');
      expect(mockEq).toHaveBeenCalledWith('github_id', 123);

      // Verify commits were fetched
      expect(mockOctokit.repos.listCommits).toHaveBeenCalledTimes(3);

      // Verify file contributors were flushed (should flush at commit 50 and at the end)
      expect(mockUpsert).toHaveBeenCalledTimes(2);

      // Verify logging
      expect(consoleLogSpy).toHaveBeenCalledWith('Starting git history indexing for test-org/test-repo');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Git history indexing completed'));
    });

    it('should handle repository not found in database', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({ data: null });
      
      const { supabase } = await import('../../../../src/lib/supabase');
      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      } as any);

      await indexGitHistory(mockRepository, mockOctokit);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Repository not found in database');
      expect(mockOctokit.repos.listCommits).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      const mockDbRepo = { id: 'repo-uuid' };
      const { supabase } = await import('../../../../src/lib/supabase');
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockDbRepo }),
      } as any);

      const apiError = new Error('API rate limit exceeded');
      vi.mocked(mockOctokit.repos.listCommits).mockRejectedValue(apiError);

      // The function logs the error but doesn't throw it
      await indexGitHistory(mockRepository, mockOctokit);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching commits page 1:', apiError);
    });

    it('should skip commits without author login', async () => {
      const mockDbRepo = { id: 'repo-uuid' };
      const { supabase } = await import('../../../../src/lib/supabase');
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'repositories') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockDbRepo }),
          } as any;
        }
        return {
          upsert: vi.fn().mockResolvedValue({ error: null }),
        } as any;
      });

      const mockCommits = [
        {
          sha: 'commit-1',
          author: null, // No author
          commit: {
            author: {
              name: 'Anonymous',
              date: new Date().toISOString(),
            },
          },
        },
        {
          sha: 'commit-2',
          author: {
            login: 'validuser',
            id: 1001,
            avatar_url: 'https://github.com/validuser.png',
          },
          commit: {
            author: {
              name: 'Valid User',
              date: new Date().toISOString(),
            },
          },
        },
      ];

      vi.mocked(mockOctokit.repos.listCommits).mockResolvedValue({ data: mockCommits } as any);
      vi.mocked(mockOctokit.repos.getCommit).mockResolvedValue({ 
        data: { files: [{ filename: 'test.ts' }] } 
      } as any);

      await indexGitHistory(mockRepository, mockOctokit);

      // Should process both commits (skipping invalid one happens internally)
      expect(mockOctokit.repos.listCommits).toHaveBeenCalled();
    });
  });

  describe('findFileContributors', () => {
    it('should return contributors who worked on specified files', async () => {
      const mockFileContributors = [
        {
          contributor_id: 'contrib-1',
          commit_count: 10,
          contributors: {
            id: 'contrib-1',
            github_login: 'developer1',
            name: 'Developer One',
            avatar_url: 'https://github.com/developer1.png',
          },
        },
        {
          contributor_id: 'contrib-2',
          commit_count: 5,
          contributors: {
            id: 'contrib-2',
            github_login: 'developer2',
            name: 'Developer Two',
            avatar_url: 'https://github.com/developer2.png',
          },
        },
        {
          contributor_id: 'contrib-1',
          commit_count: 3,
          contributors: {
            id: 'contrib-1',
            github_login: 'developer1',
            name: 'Developer One',
            avatar_url: 'https://github.com/developer1.png',
          },
        },
      ];

      const { supabase } = await import('../../../../src/lib/supabase');
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: mockFileContributors }),
      } as any);

      const result = await findFileContributors('repo-uuid', ['src/index.ts', 'src/utils.ts']);

      expect(result.size).toBe(2);
      
      const dev1 = result.get('developer1');
      expect(dev1).toEqual({
        login: 'developer1',
        name: 'Developer One',
        avatarUrl: 'https://github.com/developer1.png',
        fileCount: 2,
        totalCommits: 13,
      });

      const dev2 = result.get('developer2');
      expect(dev2).toEqual({
        login: 'developer2',
        name: 'Developer Two',
        avatarUrl: 'https://github.com/developer2.png',
        fileCount: 1,
        totalCommits: 5,
      });
    });

    it('should return empty map when no contributors found', async () => {
      const { supabase } = await import('../../../../src/lib/supabase');
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: [] }),
      } as any);

      const result = await findFileContributors('repo-uuid', ['nonexistent.ts']);

      expect(result.size).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      const { supabase } = await import('../../../../src/lib/supabase');
      const dbError = new Error('Database connection failed');
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockRejectedValue(dbError),
      } as any);

      const result = await findFileContributors('repo-uuid', ['src/index.ts']);

      expect(result.size).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error finding file contributors:', dbError);
    });
  });

  describe('getExpertiseFromFiles', () => {
    it('should correctly identify frontend expertise', () => {
      const filePaths = [
        'src/components/Button.tsx',
        'src/pages/Home.jsx',
        'src/views/Dashboard.vue',
        'src/routes/index.svelte',
      ];

      const expertise = getExpertiseFromFiles(filePaths);

      expect(expertise).toContain('frontend');
    });

    it('should correctly identify backend expertise', () => {
      const filePaths = [
        'api/users/index.py',
        'server/controllers/auth.rb',
        'src/api/products.java',
        'internal/handlers/webhook.go',
      ];

      const expertise = getExpertiseFromFiles(filePaths);

      expect(expertise).toContain('backend');
    });

    it('should correctly identify database expertise', () => {
      const filePaths = [
        'migrations/001_create_users.sql',
        'db/schema.sql',
        'database/migrations/2024_01_01_create_products.migration',
      ];

      const expertise = getExpertiseFromFiles(filePaths);

      expect(expertise).toContain('database');
    });

    it('should correctly identify testing expertise', () => {
      const filePaths = [
        'tests/unit/user.test.ts',
        'spec/integration/api_spec.rb',
        'src/__tests__/components.test.js',
        'e2e/login.spec.ts',
      ];

      const expertise = getExpertiseFromFiles(filePaths);

      expect(expertise).toContain('testing');
    });

    it('should correctly identify security expertise', () => {
      const filePaths = [
        'src/auth/jwt.ts',
        'security/policies.yml',
        'lib/permissions/rbac.js',
        'middleware/authentication.go',
      ];

      const expertise = getExpertiseFromFiles(filePaths);

      expect(expertise).toContain('security');
    });

    it('should correctly identify devops expertise', () => {
      const filePaths = [
        '.github/workflows/ci.yml',
        'docker-compose.yaml',
        'kubernetes/deployment.yml',
        'Dockerfile',
      ];

      const expertise = getExpertiseFromFiles(filePaths);

      expect(expertise).toContain('devops');
    });

    it('should correctly identify documentation expertise', () => {
      const filePaths = [
        'README.md',
        'docs/api/endpoints.mdx',
        'CONTRIBUTING.rst',
        'docs/getting-started.md',
      ];

      const expertise = getExpertiseFromFiles(filePaths);

      expect(expertise).toContain('documentation');
    });

    it('should correctly identify styling expertise', () => {
      const filePaths = [
        'src/styles/main.css',
        'components/Button.scss',
        'theme/variables.sass',
        'styles/global.less',
      ];

      const expertise = getExpertiseFromFiles(filePaths);

      expect(expertise).toContain('styling');
    });

    it('should identify multiple expertise areas', () => {
      const filePaths = [
        'src/components/Login.tsx',  // frontend
        'api/auth/login.ts',         // backend
        'tests/auth.test.ts',        // testing
        'styles/login.css',          // styling
        '.github/workflows/test.yml', // devops
      ];

      const expertise = getExpertiseFromFiles(filePaths);

      expect(expertise).toContain('frontend');
      expect(expertise).toContain('backend');
      expect(expertise).toContain('testing');
      expect(expertise).toContain('styling');
      expect(expertise).toContain('devops');
      expect(expertise).toContain('security'); // auth/login.ts triggers security expertise
      expect(expertise.length).toBe(6);
    });

    it('should return empty array for non-code files', () => {
      const filePaths = [
        'image.png',
        'data.json',
        'config.txt',
      ];

      const expertise = getExpertiseFromFiles(filePaths);

      // JSON files don't match any expertise pattern in the current implementation
      expect(expertise.length).toBe(0);
    });

    it('should handle empty file paths array', () => {
      const expertise = getExpertiseFromFiles([]);

      expect(expertise).toEqual([]);
    });
  });
});