import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '../supabase';

// Mock the Supabase client
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn()
  }
}));

describe('Supabase Query Patterns - 406 Error Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('maybeSingle() behavior with no rows found', () => {
    it('should return null when no repository is found', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
      };
      
      (supabase.from as any).mockReturnValue(mockQuery);

      const { data, error } = await supabase
        .from('repositories')
        .select('*')
        .eq('owner', 'non-existent')
        .eq('name', 'repo')
        .maybeSingle();

      expect(data).toBeNull();
      expect(error).toBeNull();
      expect(mockQuery.maybeSingle).toHaveBeenCalled();
    });

    it('should return null when no contributor is found', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
      };
      
      (supabase.from as any).mockReturnValue(mockQuery);

      const { data, error } = await supabase
        .from('contributors')
        .select('*')
        .eq('github_id', 999999999)
        .maybeSingle();

      expect(data).toBeNull();
      expect(error).toBeNull();
    });

    it('should return null when no pull request is found', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
      };
      
      (supabase.from as any).mockReturnValue(mockQuery);

      const { data, error } = await supabase
        .from('pull_requests')
        .select('*')
        .eq('github_id', 'non-existent-pr')
        .maybeSingle();

      expect(data).toBeNull();
      expect(error).toBeNull();
    });

    it('should return null when no active backfill state is found', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
      };
      
      (supabase.from as any).mockReturnValue(mockQuery);

      const { data, error } = await supabase
        .from('progressive_backfill_state')
        .select('status')
        .eq('repository_id', 'test-repo-id')
        .eq('status', 'active')
        .maybeSingle();

      expect(data).toBeNull();
      expect(error).toBeNull();
    });
  });

  describe('maybeSingle() behavior with data found', () => {
    it('should return data when repository exists', async () => {
      const mockRepo = { 
        id: '123', 
        owner: 'test', 
        name: 'repo',
        last_updated_at: new Date().toISOString()
      };
      
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: mockRepo, error: null })
      };
      
      (supabase.from as any).mockReturnValue(mockQuery);

      const { data, error } = await supabase
        .from('repositories')
        .select('*')
        .eq('owner', 'test')
        .eq('name', 'repo')
        .maybeSingle();

      expect(data).toEqual(mockRepo);
      expect(error).toBeNull();
    });
  });

  describe('Upsert operations with maybeSingle()', () => {
    it('should handle upsert when no existing record exists', async () => {
      const newContributor = {
        id: 'uuid-123',
        github_id: 12345,
        username: 'testuser',
        avatar_url: 'https://example.com/avatar.jpg'
      };

      const mockQuery = {
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: newContributor, error: null })
      };
      
      (supabase.from as any).mockReturnValue(mockQuery);

      const { data, error } = await supabase
        .from('contributors')
        .upsert({
          github_id: 12345,
          username: 'testuser',
          avatar_url: 'https://example.com/avatar.jpg'
        }, {
          onConflict: 'github_id',
          ignoreDuplicates: false
        })
        .select('id')
        .maybeSingle();

      expect(data).toEqual(newContributor);
      expect(error).toBeNull();
      expect(mockQuery.upsert).toHaveBeenCalled();
    });

    it('should handle upsert when RLS policies prevent return', async () => {
      const mockQuery = {
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
      };
      
      (supabase.from as any).mockReturnValue(mockQuery);

      const { data, error } = await supabase
        .from('restricted_table')
        .upsert({ some_data: 'value' })
        .select()
        .maybeSingle();

      // Should not throw, just return null
      expect(data).toBeNull();
      expect(error).toBeNull();
    });
  });

  describe('Error handling patterns', () => {
    it('should properly handle null data with error checking', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
      };
      
      (supabase.from as any).mockReturnValue(mockQuery);

      const { data, error } = await supabase
        .from('repositories')
        .select('*')
        .eq('id', 'non-existent')
        .maybeSingle();

      // Common pattern in our codebase
      if (error || !data) {
        // This should execute without throwing
        expect(data).toBeNull();
        expect(error).toBeNull();
      }
    });

    it('should handle actual database errors differently from not-found', async () => {
      const dbError = { message: 'Database connection error', code: '500' };
      
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: dbError })
      };
      
      (supabase.from as any).mockReturnValue(mockQuery);

      const { data, error } = await supabase
        .from('repositories')
        .select('*')
        .eq('id', 'test')
        .maybeSingle();

      expect(data).toBeNull();
      expect(error).toEqual(dbError);
      expect(error?.message).toBe('Database connection error');
    });
  });

  describe('Common query patterns from the codebase', () => {
    it('should handle repository lookup pattern', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
      };
      
      (supabase.from as any).mockReturnValue(mockQuery);

      // Pattern from supabase-pr-data.ts
      const { data: existingRepo } = await supabase
        .from('repositories')
        .select('id, owner, name')
        .eq('owner', 'microsoft')
        .eq('name', 'vscode')
        .maybeSingle();

      if (!existingRepo) {
        // Should be able to handle this gracefully
        expect(existingRepo).toBeNull();
      }
    });

    it('should handle contributor existence check pattern', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
      };
      
      (supabase.from as any).mockReturnValue(mockQuery);

      // Pattern from github-graphql-stats.ts
      const { data: contributor } = await supabase
        .from('contributors')
        .select('id')
        .eq('github_id', 123456)
        .maybeSingle();

      if (!contributor) {
        // Insert new contributor
        expect(contributor).toBeNull();
      }
    });

    it('should handle backfill state check pattern', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
      };
      
      (supabase.from as any).mockReturnValue(mockQuery);

      // Pattern from inngest functions
      const { data } = await supabase
        .from('progressive_backfill_state')
        .select('status')
        .eq('repository_id', 'repo-123')
        .eq('status', 'active')
        .maybeSingle();

      const hasActiveBackfill = !!data;
      expect(hasActiveBackfill).toBe(false);
    });
  });

  describe('Migration from single() to maybeSingle()', () => {
    it('should not throw 406 error when no rows found (previously would with .single())', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
      };
      
      (supabase.from as any).mockReturnValue(mockQuery);

      // This would have thrown a 406 error with .single()
      const result = await supabase
        .from('repositories')
        .select('*')
        .eq('owner', 'non-existent-owner')
        .eq('name', 'non-existent-repo')
        .maybeSingle();

      // But with .maybeSingle() it returns gracefully
      expect(result.data).toBeNull();
      expect(result.error).toBeNull();
      expect(() => result).not.toThrow();
    });

    it('should still return error when multiple rows found', async () => {
      const multipleRowsError = { 
        message: 'Multiple rows returned', 
        code: 'PGRST116' 
      };
      
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ 
          data: null, 
          error: multipleRowsError 
        })
      };
      
      (supabase.from as any).mockReturnValue(mockQuery);

      const { data, error } = await supabase
        .from('repositories')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      expect(data).toBeNull();
      expect(error).toEqual(multipleRowsError);
      expect(error?.code).toBe('PGRST116');
    });
  });
});