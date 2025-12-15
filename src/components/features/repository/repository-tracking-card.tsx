import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  Lock,
  Loader2,
  AlertCircle,
  RefreshCw,
  Clock,
  CheckCircle2,
} from '@/components/ui/icon';
import { useGitHubAuth } from '@/hooks/use-github-auth';
import { toast } from 'sonner';
import { trackEvent } from '@/lib/posthog-lazy';
import { captureException } from '@/lib/sentry-lazy';
import { handleApiResponse } from '@/lib/utils/api-helpers';
import type { TrackRepositoryResponse, RepositoryStatusResponse } from '@/types/repository-api';

// Constants
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_COUNT = 60; // Poll for up to 2 minutes
const STATUS_CHECK_DEBOUNCE_MS = 1000;
const STATUS_CHECK_TIMEOUT_MS = 10000;

interface RepositoryTrackingCardProps {
  owner: string;
  repo: string;
  onTrackingComplete?: () => void;
  className?: string;
}

// Type for tracking flow stage (for PLG abandonment tracking)
type TrackingStage = 'viewing' | 'clicked_track' | 'waiting_for_data';

export function RepositoryTrackingCard({
  owner,
  repo,
  onTrackingComplete,
  className = '',
}: RepositoryTrackingCardProps) {
  const { isLoggedIn, login } = useGitHubAuth();
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [pipelineStatus, setPipelineStatus] = useState<RepositoryStatusResponse | null>(null);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const viewEventTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statusCheckDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastStatusCheckRef = useRef<number>(0);

  // PLG Tracking: Track user stage and timing for abandonment detection
  const trackingStageRef = useRef<TrackingStage>('viewing');
  const trackingStartTimeRef = useRef<number | null>(null);
  const hasCompletedRef = useRef(false); // Track if user completed the flow

  // Store current owner/repo in refs to avoid stale closures in cleanup effect
  const ownerRef = useRef(owner);
  const repoRef = useRef(repo);
  ownerRef.current = owner;
  repoRef.current = repo;

  // Safe trackEvent wrapper with error handling
  const safeTrackEvent = useCallback(
    async (eventName: string, properties?: Record<string, unknown>) => {
      try {
        await trackEvent(eventName, properties);
      } catch (error) {
        console.warn('Failed to track event:', eventName, error);
      }
    },
    []
  );

  // Check repository status from the API with debounce and timeout
  const checkPipelineStatus = useCallback(async () => {
    if (!owner || !repo) return;

    // Debounce: prevent rapid successive calls
    const now = Date.now();
    if (now - lastStatusCheckRef.current < STATUS_CHECK_DEBOUNCE_MS) {
      return;
    }
    lastStatusCheckRef.current = now;

    // Clear any pending debounced check
    if (statusCheckDebounceRef.current) {
      clearTimeout(statusCheckDebounceRef.current);
      statusCheckDebounceRef.current = null;
    }

    setIsCheckingStatus(true);
    setPipelineStatus(null);

    // Create abort controller for timeout
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), STATUS_CHECK_TIMEOUT_MS);

    try {
      const response = await fetch(`/api/repository-status?owner=${owner}&repo=${repo}`, {
        signal: abortController.signal,
      });
      clearTimeout(timeoutId);

      if (!isMountedRef.current) return;

      const data: RepositoryStatusResponse = await response.json();

      setPipelineStatus(data);

      // Track status check
      safeTrackEvent('repository_status_checked', {
        repository: `${owner}/${repo}`,
        status: data.status,
        has_data: data.hasData,
        has_commits: data.dataAvailability?.hasCommits,
        has_prs: data.dataAvailability?.hasPullRequests,
      });

      // If data is now available, offer to refresh
      if (data.hasData) {
        toast.success('Repository data is now available!', {
          description: 'Click refresh to see your repository analytics.',
          action: {
            label: 'Refresh',
            onClick: () => window.location.reload(),
          },
          duration: 10000,
        });
      } else if (data.status === 'syncing') {
        toast.info('Repository is still syncing', {
          description: data.message || 'Data will be available shortly. Check back in a minute.',
          duration: 6000,
        });
      } else if (data.status === 'pending') {
        toast.warning('Sync may be delayed', {
          description:
            'The background process may be experiencing delays. Try again in a few minutes.',
          duration: 8000,
        });
      }
    } catch (err) {
      clearTimeout(timeoutId);
      if (!isMountedRef.current) return;

      if (err instanceof Error && err.name === 'AbortError') {
        toast.error('Status check timed out', {
          description: 'The server took too long to respond. Please try again.',
        });
      } else {
        console.error('Failed to check status:', err);
        toast.error('Failed to check status', {
          description: 'Please try again in a moment.',
        });
      }
    } finally {
      if (isMountedRef.current) {
        setIsCheckingStatus(false);
      }
    }
  }, [owner, repo, safeTrackEvent]);

  // Track when users view the "Track This Repository" prompt (debounced)
  useEffect(() => {
    // Clear any existing timeout
    if (viewEventTimeoutRef.current) {
      clearTimeout(viewEventTimeoutRef.current);
    }

    // Debounce the view event to prevent spam
    viewEventTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        safeTrackEvent('viewed_track_repository_prompt', {
          repository: `${owner}/${repo}`,
          owner,
          repo,
          isLoggedIn,
          page_url: window.location.href,
          page_path: window.location.pathname,
        });
      }
    }, 500);

    return () => {
      if (viewEventTimeoutRef.current) {
        clearTimeout(viewEventTimeoutRef.current);
        viewEventTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, repo, safeTrackEvent]); // Intentionally exclude isLoggedIn to avoid duplicate events on auth changes

  const handleLogin = async () => {
    // Track login button click
    safeTrackEvent('clicked_login_to_track_repository', {
      repository: `${owner}/${repo}`,
      owner,
      repo,
    });

    // Store the repository path so we can auto-track after login
    localStorage.setItem('pendingTrackRepo', `${owner}/${repo}`);
    localStorage.setItem('redirectAfterLogin', `/${owner}/${repo}`);
    await login();
  };

  const handleTrackRepository = async () => {
    // Prevent duplicate tracking requests
    if (isTracking) {
      return;
    }

    // PLG Tracking: Update stage and start timing
    trackingStageRef.current = 'clicked_track';
    trackingStartTimeRef.current = Date.now();

    // PostHog: Track repository tracking attempt (comprehensive event)
    safeTrackEvent('repository_track_attempt', {
      repository: `${owner}/${repo}`,
      owner,
      repo,
      is_authenticated: isLoggedIn,
      timestamp: new Date().toISOString(),
    });

    // Track button click (PLG event)
    safeTrackEvent('clicked_track_repository', {
      repository: `${owner}/${repo}`,
      owner,
      repo,
    });

    // Validate props before sending
    if (!owner || !repo) {
      console.error('Missing owner or repo:', { owner, repo });
      setError('Invalid repository information');
      toast.error('Invalid repository', {
        description: 'Repository information is missing',
        duration: 6000,
      });
      return;
    }

    setIsTracking(true);
    setError(null);

    try {
      console.log('Sending track request for: %s/%s', owner, repo);

      // Call the new tracking API endpoint
      const response = await fetch('/api/track-repository', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ owner, repo }),
      });

      const result = await handleApiResponse<TrackRepositoryResponse>(response, 'track-repository');

      console.log('Track repository response: %o', result);

      // PostHog: Track API response
      safeTrackEvent('repository_track_api_response', {
        repository: `${owner}/${repo}`,
        owner,
        repo,
        status_code: response.status,
        success: result?.success ?? false,
        inngest_event_sent: !!result?.eventId,
        timestamp: new Date().toISOString(),
      });

      // Check if tracking was successful
      if (result && result.success) {
        console.log('Tracking initiated successfully, eventId: %s', result.eventId);

        // Track successful tracking initiation
        safeTrackEvent('repository_tracking_initiated', {
          repository: `${owner}/${repo}`,
          owner,
          repo,
          eventId: result.eventId,
        });

        // Show success message
        toast.success('Repository tracking initiated!', {
          description:
            'Data will be available in 1-2 minutes. The page will refresh automatically.',
          duration: 8000,
        });
      } else {
        throw new Error(result?.message || 'Tracking failed');
      }

      // PLG Tracking: Update stage to waiting
      trackingStageRef.current = 'waiting_for_data';

      // Start polling for completion
      startPollingForData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to track repository';
      setError(errorMessage);

      // Track tracking failure with error type instead of raw message
      let errorType = 'UNKNOWN_ERROR';
      if (err instanceof Error) {
        if (err.message.includes('network') || err.message.includes('fetch')) {
          errorType = 'NETWORK_ERROR';
        } else if (err.message.includes('auth') || err.message.includes('login')) {
          errorType = 'AUTH_ERROR';
        } else if (err.message.includes('permission') || err.message.includes('forbidden')) {
          errorType = 'PERMISSION_ERROR';
        } else if (err.message.includes('not found')) {
          errorType = 'NOT_FOUND_ERROR';
        }
      }

      // PostHog: Track failure event
      safeTrackEvent('repository_tracking_failed', {
        repository: `${owner}/${repo}`,
        owner,
        repo,
        errorType,
      });

      // PostHog: Track API response with failure
      safeTrackEvent('repository_track_api_response', {
        repository: `${owner}/${repo}`,
        owner,
        repo,
        success: false,
        error_type: errorType,
        timestamp: new Date().toISOString(),
      });

      // Sentry: Capture error for debugging
      captureException(err instanceof Error ? err : new Error(errorMessage), {
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

      toast.error('Tracking failed', {
        description: errorMessage,
        duration: 6000,
      });
    } finally {
      setIsTracking(false);
    }
  };

  // Cleanup polling and timeouts on unmount + PLG abandonment tracking
  // Note: Uses refs for owner/repo to avoid stale closures and prevent effect from
  // running on prop changes (which would incorrectly set isMountedRef to false)
  useEffect(() => {
    return () => {
      isMountedRef.current = false;

      // PLG Tracking: Fire abandonment event if user left during active tracking flow
      // Only fire if user was actively engaged (past 'viewing' stage) and didn't complete
      if (!hasCompletedRef.current && trackingStageRef.current !== 'viewing') {
        const timeInFlow = trackingStartTimeRef.current
          ? Date.now() - trackingStartTimeRef.current
          : undefined;

        safeTrackEvent('track_repository_abandoned', {
          repository: `${ownerRef.current}/${repoRef.current}`,
          abandon_stage: trackingStageRef.current,
          time_in_flow_ms: timeInFlow,
        });
      }

      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (viewEventTimeoutRef.current) {
        clearTimeout(viewEventTimeoutRef.current);
        viewEventTimeoutRef.current = null;
      }
      if (statusCheckDebounceRef.current) {
        clearTimeout(statusCheckDebounceRef.current);
        statusCheckDebounceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - cleanup should only run on unmount, uses refs to avoid stale closures

  const startPollingForData = () => {
    let pollCount = 0;

    // Clear any existing interval before starting a new one
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(async () => {
      pollCount++;

      // Use refs to get current owner/repo values to avoid stale closure
      const currentOwner = ownerRef.current;
      const currentRepo = repoRef.current;

      try {
        // Check if repository now has data
        const response = await fetch(
          `/api/repository-status?owner=${currentOwner}&repo=${currentRepo}`
        );
        const data = await response.json();

        // Determine poll status
        let pollStatus: 'success' | 'timeout' | 'pending' = 'pending';
        if (data.hasData) {
          pollStatus = 'success';
        } else if (pollCount >= MAX_POLL_COUNT) {
          pollStatus = 'timeout';
        }

        // PostHog: Track polling lifecycle
        safeTrackEvent('repository_status_poll', {
          repository: `${currentOwner}/${currentRepo}`,
          owner: currentOwner,
          repo: currentRepo,
          poll_count: pollCount,
          has_data: data.hasData,
          final_status: pollStatus,
        });

        if (data.hasData) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }

          // Only proceed if component is still mounted
          if (!isMountedRef.current) {
            return;
          }

          // PLG Tracking: Mark flow as completed (prevents abandonment event)
          hasCompletedRef.current = true;

          // Track when data becomes available
          safeTrackEvent('repository_data_ready', {
            repository: `${currentOwner}/${currentRepo}`,
            owner: currentOwner,
            repo: currentRepo,
            pollAttempts: pollCount,
          });

          toast.success('Repository data is ready!', {
            description: 'Refreshing page...',
            duration: 2000,
          });

          // Trigger callback or refresh
          if (onTrackingComplete) {
            onTrackingComplete();
          } else {
            // Refresh the page after a short delay
            setTimeout(() => {
              if (isMountedRef.current) {
                window.location.reload();
              }
            }, 1500);
          }
        }

        if (pollCount >= MAX_POLL_COUNT) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }

          // Only proceed if component is still mounted
          if (isMountedRef.current) {
            // PLG Tracking: Calculate wait duration for timeout event
            const waitDurationMs = trackingStartTimeRef.current
              ? Date.now() - trackingStartTimeRef.current
              : pollCount * POLL_INTERVAL_MS;

            // PLG Tracking: Fire timeout viewed event
            safeTrackEvent('track_repository_timeout_viewed', {
              repository: `${currentOwner}/${currentRepo}`,
              wait_duration_ms: waitDurationMs,
            });

            // Track the polling timeout as a failure event
            safeTrackEvent('repository_tracking_failed', {
              repository: `${currentOwner}/${currentRepo}`,
              owner: currentOwner,
              repo: currentRepo,
              errorType: 'POLLING_TIMEOUT',
              pollAttempts: pollCount,
            });

            // Sentry: Capture timeout for monitoring
            captureException(
              new Error(`Repository tracking polling timeout: ${currentOwner}/${currentRepo}`),
              {
                level: 'warning',
                tags: {
                  type: 'tracking_timeout',
                  repository: `${currentOwner}/${currentRepo}`,
                },
                extra: {
                  poll_count: pollCount,
                  max_polls: MAX_POLL_COUNT,
                  wait_duration_ms: waitDurationMs,
                },
              }
            );

            // Set timeout state to show improved UX
            setHasTimedOut(true);
            setError(
              'Data sync is taking longer than expected. The background sync is still running.'
            );

            toast.info('Data sync is taking longer than expected', {
              description: 'Use the "Check Status" button to see current progress.',
              duration: 10000,
            });
          }
        }
      } catch (err) {
        // Silently continue polling
        console.error('Polling error:', err);
      }
    }, POLL_INTERVAL_MS);
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">
            {owner}/{repo}
          </h2>
          <p className="text-sm text-muted-foreground">This repository hasn't been tracked yet</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Primary Call-to-Action section */}
        <div className="text-center py-8">
          <BarChart3 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Start tracking this repository</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Unlock contributor analytics, PR visualizations, and community health metrics. We'll
            analyze the repository and provide insights into contribution patterns.
          </p>

          {/* Primary tracking button - more prominent placement */}
          <div className="flex justify-center mb-3">
            {!isLoggedIn ? (
              <Button
                onClick={handleLogin}
                size="lg"
                variant="default"
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                <Lock className="mr-2 h-4 w-4" />
                Login to Track Repository
              </Button>
            ) : (
              <Button
                onClick={handleTrackRepository}
                disabled={isTracking}
                size="lg"
                variant="default"
                className="bg-orange-500 hover:bg-orange-600 text-white disabled:bg-orange-300"
              >
                {isTracking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting up tracking...
                  </>
                ) : (
                  <>
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Track This Repository
                  </>
                )}
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Setup takes 1-2 minutes • Data refreshes automatically
          </p>
        </div>

        {/* Error display */}
        {error && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>

            {/* Timeout-specific UI with Check Status */}
            {hasTimedOut && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>Pipeline Status</span>
                </div>

                {/* Status display */}
                {pipelineStatus && (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      {pipelineStatus.hasData ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      <span className="capitalize">
                        {(() => {
                          switch (pipelineStatus.status) {
                            case 'syncing':
                              return 'Syncing in progress...';
                            case 'pending':
                              return 'Waiting for sync';
                            case 'ready':
                              return 'Data ready!';
                            default:
                              return pipelineStatus.message || pipelineStatus.status;
                          }
                        })()}
                      </span>
                    </div>

                    {pipelineStatus.dataAvailability && (
                      <div className="text-xs text-muted-foreground space-y-1 pl-6">
                        <div className="flex gap-4">
                          <span>
                            Commits: {pipelineStatus.dataAvailability.commitCount}
                            {pipelineStatus.dataAvailability.hasCommits && ' ✓'}
                          </span>
                          <span>
                            PRs: {pipelineStatus.dataAvailability.prCount}
                            {pipelineStatus.dataAvailability.hasPullRequests && ' ✓'}
                          </span>
                          <span>
                            Contributors: {pipelineStatus.dataAvailability.contributorCount}
                            {pipelineStatus.dataAvailability.hasContributors && ' ✓'}
                          </span>
                        </div>
                      </div>
                    )}

                    {pipelineStatus.repository?.createdAt && (
                      <div className="text-xs text-muted-foreground pl-6">
                        Tracking started:{' '}
                        {new Date(pipelineStatus.repository.createdAt).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={checkPipelineStatus}
                    disabled={isCheckingStatus}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    {isCheckingStatus ? (
                      <>
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-3 w-3" />
                        Check Status
                      </>
                    )}
                  </Button>

                  {pipelineStatus?.hasData && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => window.location.reload()}
                      className="bg-green-500 hover:bg-green-600 text-white"
                    >
                      <CheckCircle2 className="mr-2 h-3 w-3" />
                      View Repository
                    </Button>
                  )}

                  <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
                    Refresh Page
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setError(null);
                      setHasTimedOut(false);
                      setPipelineStatus(null);
                      handleTrackRepository();
                    }}
                  >
                    Try Again
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Large repositories may take several minutes to sync. The background process
                  continues even after this page times out.
                </p>
              </div>
            )}

            {/* Non-timeout error actions */}
            {!hasTimedOut && error.includes('longer than expected') && (
              <div className="flex gap-2 justify-center">
                <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
                  Refresh Page
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setError(null);
                    handleTrackRepository();
                  }}
                >
                  Try Again
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
