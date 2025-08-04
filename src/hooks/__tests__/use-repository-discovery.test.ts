import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRepositoryDiscovery } from '../use-repository-discovery';

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn()
  }
}));

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn()
  }
}));

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useRepositoryDiscovery', () => {
  let mockSupabaseFrom: any;
  let mockToast: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get mock references
    const { supabase } = await import('@/lib/supabase');
    const { toast } = await import('sonner');
    
    mockSupabaseFrom = vi.mocked(supabase.from);
    mockToast = vi.mocked(toast);
    
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

  afterEach(() => {
    vi.clearAllMocks();
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
      // Mock repository found
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ 
                data: { id: 'existing-repo-id', owner: 'pytorch', name: 'pytorch' }, 
                error: null 
              }))
            }))
          }))
        }))
      });

      const { result } = renderHook(() =>
        useRepositoryDiscovery({
          owner: 'pytorch',
          repo: 'pytorch',
          enabled: true
        })
      );

      await waitFor(() => {
        expect(result.current.status).toBe('ready');
      });

      expect(result.current.repository).toEqual({
        id: 'existing-repo-id',
        owner: 'pytorch',
        name: 'pytorch'
      });
      expect(result.current.isNewRepository).toBe(false);
    });
  });

  describe('new repository discovery', () => {
    it('should initiate discovery for new repository', async () => {
      // Mock repository not found (PGRST116 error)
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ 
                data: null, 
                error: { code: 'PGRST116' } 
              }))
            }))
          }))
        }))
      });

      const { result } = renderHook(() =>
        useRepositoryDiscovery({
          owner: 'pytorch',
          repo: 'pytorch',
          enabled: true
        })
      );

      await waitFor(() => {
        expect(result.current.status).toBe('discovering');
      });

      expect(result.current.isNewRepository).toBe(true);
      expect(result.current.message).toBe('Setting up pytorch/pytorch...');

      // Should show user-friendly notification
      expect(mockToast.info).toHaveBeenCalledWith(
        'Setting up pytorch/pytorch...',
        expect.objectContaining({
          description: "This is a new repository! We're gathering contributor data for you. This usually takes 1-2 minutes.",
          duration: 8000
        })
      );

      // Should call discovery API
      expect(mockFetch).toHaveBeenCalledWith('/api/discover-repository', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner: 'pytorch', repo: 'pytorch' })
      });
    });
  });

  describe('error handling', () => {
    it('should handle repository check errors', async () => {
      // Mock database error (not PGRST116)
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ 
                data: null, 
                error: { code: 'CONNECTION_ERROR', message: 'Database connection failed' } 
              }))
            }))
          }))
        }))
      });

      const { result } = renderHook(() =>
        useRepositoryDiscovery({
          owner: 'pytorch',
          repo: 'pytorch',
          enabled: true
        })
      );

      await waitFor(() => {
        expect(result.current.status).toBe('error');
      });

      expect(result.current.message).toBe('Failed to check repository status');
    });

    it('should handle discovery API failure', async () => {
      // Mock repository not found
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ 
                data: null, 
                error: { code: 'PGRST116' } 
              }))
            }))
          }))
        }))
      });

      // Mock API failure
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500
      });

      const { result } = renderHook(() =>
        useRepositoryDiscovery({
          owner: 'pytorch',
          repo: 'pytorch',
          enabled: true
        })
      );

      await waitFor(() => {
        expect(result.current.status).toBe('error');
      });

      expect(result.current.message).toBe('Failed to set up repository. Please try refreshing the page.');
      
      // Should show error notification
      expect(mockToast.error).toHaveBeenCalledWith(
        'Failed to set up repository',
        expect.objectContaining({
          description: 'Please try refreshing the page.',
          duration: 6000
        })
      );
    });
  });

  describe('state transitions', () => {
    it('should reset state when repository changes', () => {
      const { result, rerender } = renderHook(
        (props) => useRepositoryDiscovery(props),
        {
          initialProps: {
            owner: 'pytorch',
            repo: 'pytorch',
            enabled: true
          }
        }
      );

      // Change to different repository
      rerender({
        owner: 'microsoft',
        repo: 'vscode',
        enabled: true
      });

      // State should reset for new repository
      expect(result.current).toEqual({
        status: 'checking',
        repository: null,
        message: null,
        isNewRepository: false
      });
    });

    it('should handle enabled state changes', () => {
      const { result, rerender } = renderHook(
        (props) => useRepositoryDiscovery(props),
        {
          initialProps: {
            owner: 'pytorch',
            repo: 'pytorch',
            enabled: true
          }
        }
      );

      // Disable the hook
      rerender({
        owner: 'pytorch',
        repo: 'pytorch',
        enabled: false
      });

      expect(result.current.status).toBe('checking');
    });
  });
});