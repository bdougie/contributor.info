import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRepositoryDiscovery } from '../use-repository-discovery';

// Module-level mocks for proper isolation
const mockSupabaseFrom = vi.fn();
const mockToastInfo = vi.fn();
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
const mockFetch = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => mockSupabaseFrom()
  }
}));

vi.mock('sonner', () => ({
  toast: {
    info: () => mockToastInfo(),
    error: () => mockToastError(),
    success: () => mockToastSuccess()
  }
}));

// Replace global fetch with mock
global.fetch = mockFetch as any;

describe('useRepositoryDiscovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset all mock implementations
    mockSupabaseFrom.mockClear();
    mockToastInfo.mockClear();
    mockToastError.mockClear();
    mockToastSuccess.mockClear();
    mockFetch.mockClear();
    
    // Setup default successful API response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ 
        success: true, 
        message: 'Discovery started',
        eventId: 'mock-event-id'
      })
    });
  });

  describe('initial state', () => {
    it('should return checking state when disabled', () => {
      const { result } = renderHook(() =>
        useRepositoryDiscovery({
          owner: 'pytorch',
          repo: 'pytorch',
          enabled: false
        })
      );

      expect(result.current).toEqual({
        status: 'checking',
        repository: null,
        message: null,
        isNewRepository: false
      });
    });

    it('should return checking state when owner or repo is undefined', () => {
      const { result } = renderHook(() =>
        useRepositoryDiscovery({
          owner: undefined,
          repo: 'pytorch',
          enabled: true
        })
      );

      expect(result.current).toEqual({
        status: 'checking',
        repository: null,
        message: null,
        isNewRepository: false
      });
    });
  });

  describe('existing repository', () => {
    it('should show ready state when repository exists', async () => {
      // Create a mock query builder
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(() => Promise.resolve({ 
          data: { id: 'existing-repo-id', owner: 'pytorch', name: 'pytorch' }, 
          error: null 
        }))
      };
      
      mockSupabaseFrom.mockReturnValue(mockQueryBuilder);

      const { result } = renderHook(() =>
        useRepositoryDiscovery({
          owner: 'pytorch',
          repo: 'pytorch',
          enabled: true
        })
      );

      await waitFor(() => {
        expect(result.current.status).toBe('ready');
        expect(result.current.isNewRepository).toBe(false);
      });
    });
  });

  describe('new repository discovery', () => {
    it('should initiate discovery for new repository', async () => {
      // Mock repository not found
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(() => Promise.resolve({ 
          data: null,
          error: { code: 'PGRST116', message: 'Not found' }
        }))
      };
      
      mockSupabaseFrom.mockReturnValue(mockQueryBuilder);

      const { result } = renderHook(() =>
        useRepositoryDiscovery({
          owner: 'newowner',
          repo: 'newrepo',
          enabled: true
        })
      );

      await waitFor(() => {
        expect(result.current.status).toBe('discovering');
        expect(result.current.isNewRepository).toBe(true);
      });

      // Verify API call
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/discover-repository',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ owner: 'newowner', repo: 'newrepo' })
          })
        );
      });
    });
  });

  describe('_error handling', () => {
    it('should handle repository check _errors', async () => {
      // Mock database error
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(() => Promise.resolve({ 
          data: null,
          error: { code: 'DB_ERROR', message: 'Database error' }
        }))
      };
      
      mockSupabaseFrom.mockReturnValue(mockQueryBuilder);

      const { result } = renderHook(() =>
        useRepositoryDiscovery({
          owner: 'owner',
          repo: 'repo',
          enabled: true
        })
      );

      await waitFor(() => {
        expect(result.current.status).toBe('_error');
        expect(result.current.message).toContain('check the repository');
      });
    });

    it('should handle discovery API failure', async () => {
      // Mock repository not found
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(() => Promise.resolve({ 
          data: null,
          error: { code: 'PGRST116', message: 'Not found' }
        }))
      };
      
      mockSupabaseFrom.mockReturnValue(mockQueryBuilder);

      // Mock API error
      mockFetch.mockRejectedValueOnce(new Error('Network _error'));

      const { result } = renderHook(() =>
        useRepositoryDiscovery({
          owner: 'owner',
          repo: 'repo',
          enabled: true
        })
      );

      await waitFor(() => {
        expect(result.current.status).toBe('_error');
        expect(result.current.message).toContain('start discovery process');
      });
    });
  });

  describe('state transitions', () => {
    it('should reset state when repository changes', async () => {
      // Initial repository exists
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn()
          .mockResolvedValueOnce({ 
            data: { id: 'repo1', owner: 'owner1', name: 'repo1' }, 
            error: null 
          })
          .mockResolvedValueOnce({ 
            data: { id: 'repo2', owner: 'owner2', name: 'repo2' }, 
            error: null 
          })
      };
      
      mockSupabaseFrom.mockReturnValue(mockQueryBuilder);

      const { result, rerender } = renderHook(
        ({ owner, repo }) => useRepositoryDiscovery({ owner, repo, enabled: true }),
        { initialProps: { owner: 'owner1', repo: 'repo1' } }
      );

      await waitFor(() => {
        expect(result.current.status).toBe('ready');
      });

      // Change repository
      rerender({ owner: 'owner2', repo: 'repo2' });

      // Should reset to checking state first
      expect(result.current.status).toBe('checking');

      await waitFor(() => {
        expect(result.current.status).toBe('ready');
      });
    });

    it('should handle enabled state changes', () => {
      const { result, rerender } = renderHook(
        ({ enabled }) => useRepositoryDiscovery({ owner: 'owner', repo: 'repo', enabled }),
        { initialProps: { enabled: false } }
      );

      expect(result.current.status).toBe('checking');

      // Enable should trigger repository check
      rerender({ enabled: true });
      expect(result.current.status).toBe('checking');
    });
  });
