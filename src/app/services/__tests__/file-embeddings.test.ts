import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateFileEmbeddings, findSimilarFiles } from '../../../../app/services/file-embeddings';
import { Repository } from '../../../../app/types/github';
import { Octokit } from '@octokit/rest';

// Mock dependencies
vi.mock('../../../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock('../../../../app/services/embeddings', () => ({
  generateEmbedding: vi.fn(),
}));

// Mock console methods
const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('File Embeddings Service', () => {
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
      getContent: vi.fn(),
    },
  } as unknown as Octokit;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generateFileEmbeddings', () => {
    it('should process code files and generate embeddings', async () => {
      const mockDbRepo = { id: 'repo-uuid' };
      const mockEmbedding = new Array(384).fill(0.1);
      
      const { supabase } = await import('../../../../src/lib/supabase');
      const { generateEmbedding } = await import('../../../../app/services/embeddings');
      
      // Mock repository lookup
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'repositories') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockDbRepo }),
          } as any;
        }
        if (table === 'file_embeddings') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
            upsert: vi.fn().mockResolvedValue({ error: null }),
          } as any;
        }
        return {} as any;
      });

      // Mock file content
      const mockFileContent = Buffer.from('export function testFunction() { return "hello"; }').toString('base64');
      vi.mocked(mockOctokit.repos.getContent).mockResolvedValue({
        data: {
          type: 'file',
          content: mockFileContent,
        },
      } as any);

      // Mock embedding generation
      vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding);

      const filePaths = ['src/index.ts', 'src/utils.ts', 'README.md'];

      await generateFileEmbeddings(mockRepository, mockOctokit, filePaths);

      // Should only process code files (skip README.md)
      expect(mockOctokit.repos.getContent).toHaveBeenCalledTimes(2);
      expect(mockOctokit.repos.getContent).toHaveBeenCalledWith({
        owner: 'test-org',
        repo: 'test-repo',
        path: 'src/index.ts',
      });
      expect(mockOctokit.repos.getContent).toHaveBeenCalledWith({
        owner: 'test-org',
        repo: 'test-repo',
        path: 'src/utils.ts',
      });

      // Should generate embeddings
      expect(generateEmbedding).toHaveBeenCalledTimes(2);
      
      // Should log completion
      expect(consoleLogSpy).toHaveBeenCalledWith('Completed embedding generation for test-org/test-repo');
    });

    it('should skip files that already have embeddings with same content', async () => {
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
        if (table === 'file_embeddings') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: 'existing-embedding' } }),
            upsert: vi.fn().mockResolvedValue({ error: null }),
          } as any;
        }
        return {} as any;
      });

      const mockFileContent = Buffer.from('console.log("test");').toString('base64');
      vi.mocked(mockOctokit.repos.getContent).mockResolvedValue({
        data: {
          type: 'file',
          content: mockFileContent,
        },
      } as any);

      await generateFileEmbeddings(mockRepository, mockOctokit, ['src/test.js']);

      // Should check for existing embedding
      expect(supabase.from).toHaveBeenCalledWith('file_embeddings');
      
      // Should not generate new embedding
      const { generateEmbedding } = await import('../../../../app/services/embeddings');
      expect(generateEmbedding).not.toHaveBeenCalled();
      
      // Should log skip message
      expect(consoleLogSpy).toHaveBeenCalledWith('Skipping src/test.js - embedding already exists');
    });

    it('should handle repository not found in database', async () => {
      const { supabase } = await import('../../../../src/lib/supabase');
      
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null }),
      } as any);

      await generateFileEmbeddings(mockRepository, mockOctokit, ['src/index.ts']);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Repository not found in database');
      expect(mockOctokit.repos.getContent).not.toHaveBeenCalled();
    });

    it('should retry on network errors', async () => {
      const mockDbRepo = { id: 'repo-uuid' };
      const mockEmbedding = new Array(384).fill(0.1);
      
      const { supabase } = await import('../../../../src/lib/supabase');
      const { generateEmbedding } = await import('../../../../app/services/embeddings');
      
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'repositories') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockDbRepo }),
          } as any;
        }
        if (table === 'file_embeddings') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
            upsert: vi.fn().mockResolvedValue({ error: null }),
          } as any;
        }
        return {} as any;
      });

      // Mock network error on first attempt, success on second
      const networkError = new Error('Network timeout');
      vi.mocked(mockOctokit.repos.getContent)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({
          data: {
            type: 'file',
            content: Buffer.from('test content').toString('base64'),
          },
        } as any);

      vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding);

      await generateFileEmbeddings(mockRepository, mockOctokit, ['src/index.ts']);

      // Should retry the failed request
      expect(mockOctokit.repos.getContent).toHaveBeenCalledTimes(2);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Fetching content for src/index.ts failed (attempt 1/3)'),
        networkError
      );
    });

    it('should handle rate limit errors with retry', async () => {
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
        return {} as any;
      });

      const rateLimitError = new Error('API rate limit exceeded (429)');
      vi.mocked(mockOctokit.repos.getContent).mockRejectedValue(rateLimitError);

      await generateFileEmbeddings(mockRepository, mockOctokit, ['src/index.ts']);

      // Should attempt retries
      expect(mockOctokit.repos.getContent).toHaveBeenCalledTimes(3);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(3);
    });

    it('should handle non-retryable errors immediately', async () => {
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
        return {} as any;
      });

      const authError = new Error('Authentication failed - invalid token');
      vi.mocked(mockOctokit.repos.getContent).mockRejectedValue(authError);

      await generateFileEmbeddings(mockRepository, mockOctokit, ['src/index.ts']);

      // Should not retry non-retryable errors
      expect(mockOctokit.repos.getContent).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error processing file src/index.ts:', authError);
    });

    it('should process files in batches', async () => {
      const mockDbRepo = { id: 'repo-uuid' };
      const mockEmbedding = new Array(384).fill(0.1);
      
      const { supabase } = await import('../../../../src/lib/supabase');
      const { generateEmbedding } = await import('../../../../app/services/embeddings');
      
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'repositories') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockDbRepo }),
          } as any;
        }
        if (table === 'file_embeddings') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
            upsert: mockUpsert,
          } as any;
        }
        return {} as any;
      });

      vi.mocked(mockOctokit.repos.getContent).mockResolvedValue({
        data: {
          type: 'file',
          content: Buffer.from('test').toString('base64'),
        },
      } as any);

      vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding);

      // Create 15 files (should process in 2 batches of 10 and 5)
      const filePaths = Array.from({ length: 15 }, (_, i) => `src/file${i}.ts`);

      await generateFileEmbeddings(mockRepository, mockOctokit, filePaths);

      // Should process all files
      expect(mockOctokit.repos.getContent).toHaveBeenCalledTimes(15);
      
      // Should insert in 2 batches
      expect(mockUpsert).toHaveBeenCalledTimes(2);
    });
  });

  describe('findSimilarFiles', () => {
    it('should find similar files using vector similarity', async () => {
      const mockInputEmbeddings = [
        {
          file_path: 'src/auth.ts',
          embedding: new Array(384).fill(0.1),
        },
      ];

      const mockSimilarFiles = [
        { file_path: 'src/auth.ts', similarity: 1.0 },
        { file_path: 'src/login.ts', similarity: 0.9 },
        { file_path: 'src/permissions.ts', similarity: 0.85 },
      ];

      const { supabase } = await import('../../../../src/lib/supabase');
      
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: mockInputEmbeddings }),
      } as any);

      vi.mocked(supabase.rpc).mockResolvedValue({ data: mockSimilarFiles });

      const result = await findSimilarFiles('repo-uuid', ['src/auth.ts']);

      expect(supabase.rpc).toHaveBeenCalledWith('match_file_embeddings', {
        query_embedding: mockInputEmbeddings[0].embedding,
        repository_id: 'repo-uuid',
        match_threshold: 0.8,
        match_count: 10,
      });

      const similarForAuth = result.get('src/auth.ts');
      expect(similarForAuth).toHaveLength(2); // Excludes the file itself
      expect(similarForAuth?.[0]).toEqual({ path: 'src/login.ts', similarity: 0.9 });
      expect(similarForAuth?.[1]).toEqual({ path: 'src/permissions.ts', similarity: 0.85 });
    });

    it('should handle custom threshold', async () => {
      const mockInputEmbeddings = [
        {
          file_path: 'src/utils.ts',
          embedding: new Array(384).fill(0.2),
        },
      ];

      const { supabase } = await import('../../../../src/lib/supabase');
      
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: mockInputEmbeddings }),
      } as any);

      vi.mocked(supabase.rpc).mockResolvedValue({ data: [] });

      await findSimilarFiles('repo-uuid', ['src/utils.ts'], 0.95);

      expect(supabase.rpc).toHaveBeenCalledWith('match_file_embeddings', {
        query_embedding: mockInputEmbeddings[0].embedding,
        repository_id: 'repo-uuid',
        match_threshold: 0.95,
        match_count: 10,
      });
    });

    it('should return empty map when no embeddings found for input files', async () => {
      const { supabase } = await import('../../../../src/lib/supabase');
      
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: [] }),
      } as any);

      const result = await findSimilarFiles('repo-uuid', ['src/new-file.ts']);

      expect(result.size).toBe(0);
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      const { supabase } = await import('../../../../src/lib/supabase');
      const dbError = new Error('Database connection failed');
      
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockRejectedValue(dbError),
      } as any);

      const result = await findSimilarFiles('repo-uuid', ['src/test.ts']);

      expect(result.size).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error finding similar files:', dbError);
    });

    it('should process multiple input files', async () => {
      const mockInputEmbeddings = [
        {
          file_path: 'src/file1.ts',
          embedding: new Array(384).fill(0.1),
        },
        {
          file_path: 'src/file2.ts',
          embedding: new Array(384).fill(0.2),
        },
      ];

      const mockSimilarFiles1 = [
        { file_path: 'src/file1.ts', similarity: 1.0 },
        { file_path: 'src/related1.ts', similarity: 0.85 },
      ];

      const mockSimilarFiles2 = [
        { file_path: 'src/file2.ts', similarity: 1.0 },
        { file_path: 'src/related2.ts', similarity: 0.82 },
      ];

      const { supabase } = await import('../../../../src/lib/supabase');
      
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: mockInputEmbeddings }),
      } as any);

      vi.mocked(supabase.rpc)
        .mockResolvedValueOnce({ data: mockSimilarFiles1 })
        .mockResolvedValueOnce({ data: mockSimilarFiles2 });

      const result = await findSimilarFiles('repo-uuid', ['src/file1.ts', 'src/file2.ts']);

      expect(result.size).toBe(2);
      
      const similar1 = result.get('src/file1.ts');
      expect(similar1).toHaveLength(1);
      expect(similar1?.[0]).toEqual({ path: 'src/related1.ts', similarity: 0.85 });

      const similar2 = result.get('src/file2.ts');
      expect(similar2).toHaveLength(1);
      expect(similar2?.[0]).toEqual({ path: 'src/related2.ts', similarity: 0.82 });
    });
  });
});