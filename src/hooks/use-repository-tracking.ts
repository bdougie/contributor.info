import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useGitHubAuth } from './use-github-auth';
import { handleApiResponse } from '@/lib/utils/api-helpers';

// Type for track repository API response
interface TrackRepositoryResponse {
  success: boolean;
  repositoryId?: string;
  eventId?: string;
  message?: string;
}

export interface TrackingState {
  status: 'checking' | 'not_tracked' | 'tracking' | 'tracked' | 'error' | 'timeout' | 'idle';
  repository: { id: string; owner: string; name: string } | null;
  message: string | null;
  error: string | null;
}

interface TrackingOptions {
  owner: string | undefined;
  repo: string | undefined;
  enabled?: boolean;
  onTrackingComplete?: (repositoryId: string) => void;
}

/**
 * Hook for explicit repository tracking with user control
 * Replaces the automatic discovery with manual tracking
 */
export function useRepositoryTracking({
  owner,
  repo,
  enabled = true,
  onTrackingComplete,
}: TrackingOptions) {
  const [state, setState] = useState<TrackingState>({
    status: 'checking',
    repository: null,
    message: null,
    error: null,
  });

  const { isLoggedIn } = useGitHubAuth();
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check if repository exists in database
  const checkRepository = useCallback(async () => {
    if (!owner || !repo) {
      setState({
        status: 'checking',
        repository: null,
        message: null,
        error: null,
      });
      return;
    }

    try {
      setState((prev) => ({ ...prev, status: 'checking', error: null }));

      // Check if repository exists
      const { data: repoData, error } = await supabase
        .from('repositories')
        .select('id, owner, name')
        .eq('owner', owner)
        .eq('name', repo)
        .maybeSingle();

      if (error) {
        console.error('Error checking repository:', error);
        setState({
          status: 'error',
          repository: null,
          message: null,
          error: 'Failed to check repository status',
        });
        return;
      }

      if (repoData) {
        // Repository is tracked
        setState({
          status: 'tracked',
          repository: repoData,
          message: null,
          error: null,
        });
      } else {
        // Repository not tracked
        setState({
          status: 'not_tracked',
          repository: null,
          message: 'Repository not tracked yet',
          error: null,
        });
      }
    } catch (error) {
      console.error('Repository check error:', error);
      setState({
        status: 'error',
        repository: null,
        message: null,
        error: 'Something went wrong. Please try again.',
      });
    }
  }, [owner, repo]);

  // Track repository explicitly (called by user action)
  const trackRepository = useCallback(async () => {
    // Prevent multiple simultaneous tracking requests
    if (state.status === 'tracking') {
      console.warn('Repository tracking already in progress');
      return { success: false, error: 'Tracking already in progress' };
    }

    if (!owner || !repo) {
      return { success: false, error: 'Invalid repository' };
    }

    if (!isLoggedIn) {
      return { success: false, error: 'Please login to track repositories' };
    }

    setState((prev) => ({
      ...prev,
      status: 'tracking',
      message: 'Initiating repository tracking...',
      error: null,
    }));

    try {
      // Call the tracking API endpoint
      const response = await fetch('/api/track-repository', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ owner, repo }),
      });

      // Check if API is unavailable (common in local dev without GitHub token)
      let result: TrackRepositoryResponse | null = null;

      if (response.status === 503) {
        console.info('Track API unavailable (likely missing GitHub token), using direct database creation');

        // Fallback: Create repository directly in the database
        const { data: newRepo, error: createError } = await supabase
          .from('repositories')
          .insert({
            owner,
            name: repo,
            full_name: `${owner}/${repo}`,
            is_active: true,
          })
          .select('id')
          .single();

        if (createError) {
          // Check if repository already exists
          const { data: existingRepo } = await supabase
            .from('repositories')
            .select('id')
            .eq('owner', owner)
            .eq('name', repo)
            .maybeSingle();

          if (existingRepo) {
            result = { success: true, repositoryId: existingRepo.id };
          } else {
            throw createError;
          }
        } else {
          result = { success: true, repositoryId: newRepo.id };
        }
      } else {
        result = await handleApiResponse<TrackRepositoryResponse>(response, 'track-repository');
      }

      // Clear any existing polling interval
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }

      // Start polling for repository creation
      let pollCount = 0;
      const maxPolls = 60; // 2 minutes max

      pollIntervalRef.current = setInterval(async () => {
        pollCount++;

        try {
          const { data: repoData } = await supabase
            .from('repositories')
            .select('id, owner, name')
            .eq('owner', owner)
            .eq('name', repo)
            .maybeSingle();

          if (repoData) {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }

            setState({
              status: 'tracked',
              repository: repoData,
              message: 'Repository successfully tracked!',
              error: null,
            });

            if (onTrackingComplete) {
              onTrackingComplete(repoData.id);
            }
          }

          if (pollCount >= maxPolls) {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            setState((prev) => ({
              ...prev,
              status: 'timeout',
              error:
                'Tracking is taking longer than expected. The data sync is still running in the background.',
            }));
          }
        } catch (error) {
          console.error('Polling error:', error);
        }
      }, 2000);

      return { success: true, repositoryId: result?.repositoryId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to track repository';

      setState({
        status: 'error',
        repository: null,
        message: null,
        error: errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  }, [owner, repo, isLoggedIn, state.status, onTrackingComplete]);

  // Check repository on mount and when owner/repo changes
  useEffect(() => {
    if (enabled) {
      checkRepository();
    }
  }, [owner, repo, enabled, checkRepository]);

  // Check if we should auto-track after login
  useEffect(() => {
    if (isLoggedIn) {
      const pendingTrack = localStorage.getItem('pendingTrackRepo');
      if (pendingTrack === `${owner}/${repo}`) {
        localStorage.removeItem('pendingTrackRepo');
        // Auto-track the repository
        trackRepository();
      }
    }
  }, [isLoggedIn, owner, repo, trackRepository]);

  const retryTracking = useCallback(() => {
    setState((prev) => ({
      ...prev,
      status: 'idle',
      error: null,
    }));
    trackRepository();
  }, [trackRepository]);

  // Cleanup polling interval on unmount or when dependencies change
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  return {
    ...state,
    trackRepository,
    retryTracking,
    refreshStatus: checkRepository,
    isLoggedIn,
  };
}
