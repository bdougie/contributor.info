import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTrackRepositoryWithNotification } from '../use-track-repository-with-notification';

// Mock dependencies - follow existing project patterns
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn()
  }
}));

vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    send: vi.fn()
  }
}));

vi.mock('@/lib/progressive-capture/ui-notifications', () => ({
  ProgressiveCaptureNotifications: {
    showProcessingStarted: vi.fn()
  }
}));

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    error: vi.fn()
  }
}));

describe('useTrackRepositoryWithNotification', () => {
  let mockSupabaseFrom: any;
  let mockInngestSend: any;
  let mockToastInfo: any;
  let mockToastError: any;
  let mockShowProcessingStarted: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get mock references
    const { supabase } = await import('@/lib/supabase');
    const { inngest } = await import('@/lib/inngest/client');
    const { toast } = await import('sonner');
    const { ProgressiveCaptureNotifications } = await import('@/lib/progressive-capture/ui-notifications');
    
    mockSupabaseFrom = vi.mocked(supabase.from);
    mockInngestSend = vi.mocked(inngest.send);
    mockToastInfo = vi.mocked(toast.info);
    mockToastError = vi.mocked(toast.error);
    mockShowProcessingStarted = vi.mocked(ProgressiveCaptureNotifications.showProcessingStarted);
    
    // Setup default successful mocks
    mockInngestSend.mockResolvedValue({ ids: ['mock-event-id'] });
    mockShowProcessingStarted.mockReturnValue('mock-toast-id');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should return default state when disabled', () => {
      const { result } = renderHook(() =>
        useTrackRepositoryWithNotification({
          owner: 'pytorch',
          repo: 'pytorch',
          enabled: false
        })
      );

      expect(result.current).toEqual({
        isNewRepository: false,
        isTracking: false,
        hasData: false
      });
    });

    it('should return default state when owner or repo is undefined', () => {
      const { result } = renderHook(() =>
        useTrackRepositoryWithNotification({
          owner: undefined,
          repo: 'pytorch',
          enabled: true
        })
      );

      expect(result.current).toEqual({
        isNewRepository: false,
        isTracking: false,
        hasData: false
      });
    });
  });

  describe('new repository detection', () => {
    it('should detect new repository and track it', async () => {
      // Mock repository not found first, then tracked_repositories not found, then successful insert
      mockSupabaseFrom
        .mockReturnValueOnce({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({ 
                  data: null, 
                  error: { code: 'PGRST116' } 
                }))
              }))
            }))
          }))
        })
        .mockReturnValueOnce({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({ 
                  data: null, 
                  error: { code: 'PGRST116' } 
                }))
              }))
            }))
          }))
        })
        .mockReturnValueOnce({
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => ({ 
                data: { id: 'new-repo-id' }, 
                error: null 
              }))
            }))
          }))
        });

      const { result } = renderHook(() =>
        useTrackRepositoryWithNotification({
          owner: 'pytorch',
          repo: 'pytorch',
          enabled: true
        })
      );

      await waitFor(() => {
        expect(result.current.isNewRepository).toBe(true);
      });

      await waitFor(() => {
        expect(result.current.isTracking).toBe(true);
      });

      // Should show user-friendly notification
      expect(mockToastInfo).toHaveBeenCalledWith(
        'Setting up pytorch/pytorch...',
        expect.objectContaining({
          description: "This is a new repository! We're gathering contributor data for you. This usually takes 1-2 minutes.",
          duration: 8000
        })
      );

      // Should trigger both classification and sync
      expect(mockInngestSend).toHaveBeenCalledTimes(2);
      expect(mockInngestSend).toHaveBeenCalledWith({
        name: 'classify/repository.single',
        data: {
          repositoryId: 'new-repo-id',
          owner: 'pytorch',
          repo: 'pytorch'
        }
      });
      expect(mockInngestSend).toHaveBeenCalledWith({
        name: 'capture/repository.sync',
        data: {
          owner: 'pytorch',
          repo: 'pytorch',
          priority: 'high',
          source: 'user-search'
        }
      });

      // Should show processing notification
      expect(mockShowProcessingStarted).toHaveBeenCalledWith(
        'pytorch/pytorch',
        'inngest',
        60000
      );
    });
  });

  describe('existing repository with data', () => {
    it('should detect repository with data and not trigger sync', async () => {
      // Mock repository found, then PR data found
      mockSupabaseFrom
        .mockReturnValueOnce({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({ 
                  data: { id: 'existing-repo-id' }, 
                  error: null 
                }))
              }))
            }))
          }))
        })
        .mockReturnValueOnce({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({ 
                  data: [{ id: 'pr-1' }], 
                  error: null 
                }))
              }))
            }))
          }))
        });

      const { result } = renderHook(() =>
        useTrackRepositoryWithNotification({
          owner: 'pytorch',
          repo: 'pytorch',
          enabled: true
        })
      );

      await waitFor(() => {
        expect(result.current.hasData).toBe(true);
      });

      expect(result.current.isNewRepository).toBe(false);
      expect(result.current.isTracking).toBe(false);

      // Should not trigger sync since data exists
      expect(mockInngestSend).not.toHaveBeenCalled();
    });

    it('should trigger sync for repository with no PR data', async () => {
      // Mock repository found, then no PR data
      mockSupabaseFrom
        .mockReturnValueOnce({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({ 
                  data: { id: 'existing-repo-id' }, 
                  error: null 
                }))
              }))
            }))
          }))
        })
        .mockReturnValueOnce({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({ 
                  data: [], 
                  error: null 
                }))
              }))
            }))
          }))
        });

      const { result } = renderHook(() =>
        useTrackRepositoryWithNotification({
          owner: 'pytorch',
          repo: 'pytorch',
          enabled: true
        })
      );

      await waitFor(() => {
        expect(result.current.hasData).toBe(true);
      });

      // Should show refresh notification
      expect(mockToastInfo).toHaveBeenCalledWith(
        'Refreshing pytorch/pytorch...',
        expect.objectContaining({
          description: "We're updating this repository with the latest data.",
          duration: 6000
        })
      );

      // Should trigger sync
      expect(mockInngestSend).toHaveBeenCalledWith({
        name: 'capture/repository.sync',
        data: {
          owner: 'pytorch',
          repo: 'pytorch',
          priority: 'high',
          source: 'user-search-empty'
        }
      });
    });
  });

  describe('error handling', () => {
    it('should handle repository insert failure', async () => {
      // Mock repository not found, tracked_repositories not found, then failed insert
      mockSupabaseFrom
        .mockReturnValueOnce({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({ 
                  data: null, 
                  error: { code: 'PGRST116' } 
                }))
              }))
            }))
          }))
        })
        .mockReturnValueOnce({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({ 
                  data: null, 
                  error: { code: 'PGRST116' } 
                }))
              }))
            }))
          }))
        })
        .mockReturnValueOnce({
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => ({ 
                data: null, 
                error: { message: 'Insert failed' } 
              }))
            }))
          }))
        });

      const { result } = renderHook(() =>
        useTrackRepositoryWithNotification({
          owner: 'pytorch',
          repo: 'pytorch',
          enabled: true
        })
      );

      await waitFor(() => {
        expect(result.current.isNewRepository).toBe(true);
      });

      // Should show error notification
      expect(mockToastError).toHaveBeenCalledWith(
        'Failed to set up repository',
        expect.objectContaining({
          description: 'Please try refreshing the page.',
          duration: 6000
        })
      );
    });

    it('should handle Inngest send failure gracefully', async () => {
      // Mock successful setup but Inngest failure
      mockSupabaseFrom
        .mockReturnValueOnce({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({ 
                  data: null, 
                  error: { code: 'PGRST116' } 
                }))
              }))
            }))
          }))
        })
        .mockReturnValueOnce({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({ 
                  data: null, 
                  error: { code: 'PGRST116' } 
                }))
              }))
            }))
          }))
        })
        .mockReturnValueOnce({
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => ({ 
                data: { id: 'new-repo-id' }, 
                error: null 
              }))
            }))
          }))
        });

      // Mock Inngest failure
      mockInngestSend.mockRejectedValue(new Error('Inngest failed'));

      const { result } = renderHook(() =>
        useTrackRepositoryWithNotification({
          owner: 'pytorch',
          repo: 'pytorch',
          enabled: true
        })
      );

      await waitFor(() => {
        expect(result.current.isTracking).toBe(true);
      });

      // Should not crash the hook - error should be logged but hook continues
      expect(result.current.isNewRepository).toBe(true);
      expect(result.current.isTracking).toBe(true);
    });
  });

  describe('notification behavior', () => {
    it('should reset state when repository changes', () => {
      const { result, rerender } = renderHook(
        (props) => useTrackRepositoryWithNotification(props),
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
        isNewRepository: false,
        isTracking: false,
        hasData: false
      });
    });
  });

  describe('large repository scenarios', () => {
    it('should handle pytorch repository with high priority', async () => {
      mockSupabaseFrom
        .mockReturnValueOnce({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({ 
                  data: null, 
                  error: { code: 'PGRST116' } 
                }))
              }))
            }))
          }))
        })
        .mockReturnValueOnce({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({ 
                  data: null, 
                  error: { code: 'PGRST116' } 
                }))
              }))
            }))
          }))
        })
        .mockReturnValueOnce({
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => ({ 
                data: { id: 'pytorch-repo-id' }, 
                error: null 
              }))
            }))
          }))
        });

      const { result } = renderHook(() =>
        useTrackRepositoryWithNotification({
          owner: 'pytorch',
          repo: 'pytorch',
          enabled: true
        })
      );

      await waitFor(() => {
        expect(result.current.isTracking).toBe(true);
      });

      // Should set high priority for user-initiated requests
      expect(mockInngestSend).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            priority: 'high'
          })
        })
      );
    });
  });
});