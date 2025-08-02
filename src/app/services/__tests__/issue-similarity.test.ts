import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies BEFORE importing anything that uses them
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      const chainObj = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null }),
        upsert: vi.fn().mockReturnThis()
      };
      return chainObj;
    }),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null })
  }
}));

vi.mock('@xenova/transformers', () => ({
  pipeline: vi.fn(() => Promise.resolve((text: string, options: any) => ({
    data: new Float32Array(384).fill(0.1), // Mock 384-dimensional embedding
    tolist: () => [[...new Float32Array(384).fill(0.1)]]
  }))),
  env: {
    allowLocalModels: false,
    useBrowserCache: false
  }
}));

// Import after mocking
import { 
  generateIssueEmbedding, 
  calculateContentHash, 
  storeIssueEmbedding,
  findSimilarIssues,
  processNewIssue,
  formatSimilarIssuesComment,
  calculateDiscussionScore
} from '../../../../app/services/issue-similarity';
import { supabase } from '../../../lib/supabase';

describe('Issue Similarity Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateIssueEmbedding', () => {
    it('should generate 384-dimensional embeddings', async () => {
      const embedding = await generateIssueEmbedding('Test issue', 'Test body');
      
      expect(embedding).toHaveLength(384);
      expect(embedding.every(val => typeof val === 'number')).toBe(true);
    });

    it('should handle null body gracefully', async () => {
      const embedding = await generateIssueEmbedding('Test issue', null);
      
      expect(embedding).toHaveLength(384);
    });

    it('should handle empty strings', async () => {
      const embedding = await generateIssueEmbedding('', '');
      
      expect(embedding).toHaveLength(384);
    });
  });

  describe('calculateContentHash', () => {
    it('should generate consistent hashes for same content', () => {
      const hash1 = calculateContentHash('Test title', 'Test body');
      const hash2 = calculateContentHash('Test title', 'Test body');
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 produces 64 char hex
    });

    it('should generate different hashes for different content', () => {
      const hash1 = calculateContentHash('Test title 1', 'Test body');
      const hash2 = calculateContentHash('Test title 2', 'Test body');
      
      expect(hash1).not.toBe(hash2);
    });

    it('should handle special characters safely', () => {
      const hash = calculateContentHash('Title with | pipe', 'Body with | pipe');
      
      expect(hash).toHaveLength(64);
      // Should not throw error
    });

    it('should handle null body', () => {
      const hash = calculateContentHash('Test title', null);
      
      expect(hash).toHaveLength(64);
    });
  });

  describe('storeIssueEmbedding', () => {
    it('should store embedding in database', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      });
      
      vi.mocked(supabase).from = vi.fn().mockReturnValue({
        update: mockUpdate
      } as any);

      const embedding = new Array(384).fill(0.1);
      await storeIssueEmbedding('issue-id', embedding, 'hash123');

      expect(supabase.from).toHaveBeenCalledWith('issues');
      expect(mockUpdate).toHaveBeenCalledWith({
        embedding,
        embedding_generated_at: expect.any(String),
        content_hash: 'hash123'
      });
    });

    it('should throw error on database failure', async () => {
      vi.mocked(supabase).from = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ 
            error: new Error('Database error') 
          })
        })
      } as any);

      const embedding = new Array(384).fill(0.1);
      
      await expect(
        storeIssueEmbedding('issue-id', embedding, 'hash123')
      ).rejects.toThrow('Database error');
    });
  });

  describe('findSimilarIssues', () => {
    it('should find similar issues using RPC', async () => {
      const mockSimilarIssues = [
        {
          id: '1',
          number: 10,
          title: 'Similar issue',
          similarity: 0.85,
          state: 'open',
          html_url: 'https://github.com/test/repo/issues/10'
        }
      ];

      vi.mocked(supabase).rpc = vi.fn().mockResolvedValue({
        data: mockSimilarIssues,
        error: null
      });

      const embedding = new Array(384).fill(0.1);
      const results = await findSimilarIssues(
        embedding,
        'repo-id',
        'exclude-id',
        5,
        0.8
      );

      expect(supabase.rpc).toHaveBeenCalledWith('find_similar_issues', {
        query_embedding: embedding,
        match_count: 5,
        repo_id: 'repo-id',
        similarity_threshold: 0.8,
        exclude_issue_id: 'exclude-id'
      });
      expect(results).toEqual(mockSimilarIssues);
    });

    it('should return empty array on error', async () => {
      vi.mocked(supabase).rpc = vi.fn().mockResolvedValue({
        data: null,
        error: new Error('RPC error')
      });

      const embedding = new Array(384).fill(0.1);
      const results = await findSimilarIssues(embedding, 'repo-id');

      expect(results).toEqual([]);
    });
  });

  describe('processNewIssue', () => {
    it('should process issue and return similar issues', async () => {
      const mockIssue = {
        id: 'issue-1',
        github_id: 123,
        number: 1,
        title: 'Test issue',
        body: 'Test body',
        repository_id: 'repo-1',
        html_url: 'https://github.com/test/repo/issues/1'
      };

      const mockSimilarIssues = [
        {
          number: 10,
          title: 'Similar issue',
          state: 'open',
          similarity: 0.85,
          html_url: 'https://github.com/test/repo/issues/10'
        }
      ];

      // Mock database update
      vi.mocked(supabase).from = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        })
      } as any);

      // Mock RPC call
      vi.mocked(supabase).rpc = vi.fn().mockResolvedValue({
        data: mockSimilarIssues,
        error: null
      });

      const results = await processNewIssue(mockIssue);

      expect(results).toEqual(mockSimilarIssues);
    });
  });

  describe('formatSimilarIssuesComment', () => {
    it('should format comment with similar issues', () => {
      const similarIssues = [
        {
          number: 10,
          title: 'Similar issue 1',
          state: 'open',
          similarity: 0.92,
          html_url: 'https://github.com/test/repo/issues/10'
        },
        {
          number: 20,
          title: 'Similar issue 2',
          state: 'closed',
          similarity: 0.85,
          html_url: 'https://github.com/test/repo/issues/20'
        }
      ];

      const comment = formatSimilarIssuesComment(similarIssues);

      expect(comment).toContain('## 🔍 Similar Issues Found');
      expect(comment).toContain('🟢 [#10 - Similar issue 1]');
      expect(comment).toContain('(92% similar)');
      expect(comment).toContain('🔴 [#20 - Similar issue 2]');
      expect(comment).toContain('(85% similar)');
      expect(comment).toContain('contributor.info');
    });

    it('should return empty string for no similar issues', () => {
      const comment = formatSimilarIssuesComment([]);
      
      expect(comment).toBe('');
    });
  });

  describe('calculateDiscussionScore', () => {
    it('should score high for question-like issues', () => {
      const issue = {
        title: 'How do I implement this feature?',
        body: 'I need help understanding the best approach...',
        labels: [{ name: 'question' }]
      };

      const score = calculateDiscussionScore(issue);
      
      expect(score).toBeGreaterThan(0.5);
      expect(score).toBeLessThanOrEqual(1.0);
    });

    it('should score low for bug reports', () => {
      const issue = {
        title: 'Bug: Application crashes on startup',
        body: 'Steps to reproduce: 1. Start app 2. Crash',
        labels: [{ name: 'bug' }]
      };

      const score = calculateDiscussionScore(issue);
      
      expect(score).toBeLessThan(0.5);
    });

    it('should handle missing labels', () => {
      const issue = {
        title: 'Feature request',
        body: 'Add new feature'
      };

      const score = calculateDiscussionScore(issue);
      
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1.0);
    });
  });
});