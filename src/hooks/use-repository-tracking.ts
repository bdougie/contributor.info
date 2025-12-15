import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupabase } from '@/lib/supabase-lazy';
import { useGitHubAuth } from './use-github-auth';
import { handleApiResponse } from '@/lib/utils/api-helpers';
import { NotificationService } from '@/lib/notifications';
import { trackEvent } from '@/lib/posthog-lazy';
import { captureException } from '@/lib/sentry-lazy';

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
      const supabase = await getSupabase();
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

    // PostHog: Track when user initiates tracking
    trackEvent('repository_track_attempt', {
      owner,
      repo,
      repository: `${owner}/${repo}`,
      is_authenticated: isLoggedIn,
      timestamp: new Date().toISOString(),
    });

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

      const result = await handleApiResponse<TrackRepositoryResponse>(response, 'track-repository');

      // PostHog: Track API response
      trackEvent('repository_track_api_response', {
        owner,
        repo,
        repository: `${owner}/${repo}`,
        status_code: response.status,
        success: result?.success ?? false,
        inngest_event_sent: !!result?.eventId,
        timestamp: new Date().toISOString(),
      });

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
          const supabaseClient = await getSupabase();
          const { data: repoData } = await supabaseClient
            .from('repositories')
            .select('id, owner, name')
            .eq('owner', owner)
            .eq('name', repo)
            .maybeSingle();

          const hasData = !!repoData;

          // Determine poll status
          let pollStatus: 'success' | 'timeout' | 'pending' = 'pending';
          if (hasData) {
            pollStatus = 'success';
          } else if (pollCount >= maxPolls) {
            pollStatus = 'timeout';
          }

          // PostHog: Track polling lifecycle
          trackEvent('repository_status_poll', {
            owner,
            repo,
            repository: `${owner}/${repo}`,
            poll_count: pollCount,
            has_data: hasData,
            final_status: pollStatus,
          });

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

            // Create notification for successful tracking
            await NotificationService.createNotification({
              operation_id: result.eventId || `track-${Date.now()}`,
              operation_type: 'repository_tracking',
              repository: `${owner}/${repo}`,
              status: 'completed',
              title: `Repository tracking complete`,
              message: `${owner}/${repo} is now being tracked`,
              metadata: {
                repository_id: repoData.id,
              },
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

            // Sentry: Capture timeout as an error for monitoring
            captureException(new Error(`Repository tracking polling timeout: ${owner}/${repo}`), {
              level: 'warning',
              tags: {
                type: 'tracking_timeout',
                repository: `${owner}/${repo}`,
              },
              extra: {
                poll_count: pollCount,
                max_polls: maxPolls,
              },
            });

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

      // Determine error type for analytics
      let errorType = 'UNKNOWN_ERROR';
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('fetch')) {
          errorType = 'NETWORK_ERROR';
        } else if (error.message.includes('auth') || error.message.includes('login')) {
          errorType = 'AUTH_ERROR';
        } else if (error.message.includes('permission') || error.message.includes('forbidden')) {
          errorType = 'PERMISSION_ERROR';
        } else if (error.message.includes('not found')) {
          errorType = 'NOT_FOUND_ERROR';
        }
      }

      // PostHog: Track API failure
      trackEvent('repository_track_api_response', {
        owner,
        repo,
        repository: `${owner}/${repo}`,
        success: false,
        error_type: errorType,
        timestamp: new Date().toISOString(),
      });

      // Sentry: Capture the error for detailed debugging
      captureException(error instanceof Error ? error : new Error(errorMessage), {
        level: 'error',
        tags: {
          type: 'tracking_failed',
          error_type: errorType,
          repository: `${owner}/${repo}`,
        },
        extra: {
          owner,
          repo,
        },
      });

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
