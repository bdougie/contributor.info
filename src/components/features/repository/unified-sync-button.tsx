import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Lock, Loader2 } from '@/components/ui/icon';
import { useGitHubAuth } from '@/hooks/use-github-auth';
import { toast } from 'sonner';
import { inngest } from '@/lib/inngest/client';
import { supabase } from '@/lib/supabase';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { POLLING_CONFIG, isSyncAllowed } from '@/lib/progressive-capture/throttle-config';
import { getSyncButtonText } from '@/lib/utils/ui-state';

interface UnifiedSyncButtonProps {
  owner: string;
  repo: string;
  repositoryId?: string;
  lastUpdated?: Date | string;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
  autoTriggerOnLoad?: boolean;
}

export function UnifiedSyncButton({
  owner,
  repo,
  repositoryId,
  lastUpdated,
  className = '',
  variant = 'outline',
  size = 'sm',
  showLabel = true,
  autoTriggerOnLoad = false,
}: UnifiedSyncButtonProps) {
  const { isLoggedIn, login } = useGitHubAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasAutoTriggeredRef = useRef(false);
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  // Auto-trigger on page load if configured and data is stale
  useEffect(() => {
    if (autoTriggerOnLoad && !hasAutoTriggeredRef.current && isLoggedIn) {
      const shouldAutoSync = () => {
        if (!lastUpdated) return true;

        const lastUpdateTime = new Date(lastUpdated);
        const hoursSinceUpdate = (Date.now() - lastUpdateTime.getTime()) / (1000 * 60 * 60);

        // Auto-sync if data is older than 24 hours
        return hoursSinceUpdate > 24;
      };

      if (shouldAutoSync()) {
        hasAutoTriggeredRef.current = true;
        // Delay to allow page to fully load
        setTimeout(() => {
          handleUnifiedSync(true);
        }, 3000);
      }
    }
  }, [autoTriggerOnLoad, isLoggedIn, lastUpdated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Calculate if manual sync is allowed based on last update time
  const canSync = () => {
    return isSyncAllowed(lastUpdated, 'manual');
  };

  // Format time since last update
  const getTimeSinceUpdate = () => {
    if (!lastUpdated) return null;

    const lastUpdateTime = new Date(lastUpdated);
    const minutesSinceUpdate = Math.floor((Date.now() - lastUpdateTime.getTime()) / (1000 * 60));

    if (minutesSinceUpdate < 1) return 'just now';
    if (minutesSinceUpdate < 60) return `${minutesSinceUpdate} min ago`;

    const hoursSinceUpdate = Math.floor(minutesSinceUpdate / 60);
    if (hoursSinceUpdate < 24)
      return `${hoursSinceUpdate} hour${hoursSinceUpdate > 1 ? 's' : ''} ago`;

    const daysSinceUpdate = Math.floor(hoursSinceUpdate / 24);
    return `${daysSinceUpdate} day${daysSinceUpdate > 1 ? 's' : ''} ago`;
  };

  const handleLogin = async () => {
    localStorage.setItem('pendingSyncRepo', `${owner}/${repo}`);
    localStorage.setItem('redirectAfterLogin', `/${owner}/${repo}`);
    await login();
  };

  const handleUnifiedSync = async (isAutomatic = false) => {
    if (!isLoggedIn) {
      if (!isAutomatic) {
        handleLogin();
      }
      return;
    }

    if (!canSync() && !isAutomatic) {
      toast.info('Recently synced', {
        description: `This repository was synced ${getTimeSinceUpdate()}. Please wait a few minutes before syncing again.`,
        duration: 5000,
      });
      return;
    }

    setIsSyncing(true);
    setSyncProgress('Initiating sync...');

    // Show user-friendly notification
    if (isAutomatic) {
      toast.info(`Updating ${owner}/${repo}...`, {
        description: 'Loading fresh data in the background',
        duration: 4000,
      });
    } else {
      toast.info(`Refreshing ${owner}/${repo}...`, {
        description: "We're updating this repository with the latest data.",
        duration: 6000,
      });
    }

    try {
      // Get repository ID if not provided
      let repoId = repositoryId;
      if (!repoId) {
        setSyncProgress('Finding repository...');
        const { data: repoData, error: repoError } = await supabase
          .from('repositories')
          .select('id')
          .eq('owner', owner)
          .eq('name', repo)
          .maybeSingle();

        if (repoError || !repoData) {
          console.log(
            `Repository ${owner}/${repo} not found in database, attempting to track it first`
          );
          // Repository not in database, need to track it first
          const trackResponse = await fetch('/api/track-repository', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ owner, repo }),
          });

          // Check content-type before parsing
          const contentType = trackResponse.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            const trackError = await trackResponse.text();
            console.error('Non-JSON response from track API:', trackError.substring(0, 200));
            throw new Error(
              'Invalid response format from server - expected JSON but received HTML'
            );
          }

          if (!trackResponse.ok) {
            const trackError = await trackResponse.json();
            console.error('Failed to track repository:', trackError);
            throw new Error(
              trackError.message || `Failed to track repository: ${trackResponse.status}`
            );
          }

          // Wait a moment for tracking to initialize
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Try to get repo ID again
          const { data: newRepoData } = await supabase
            .from('repositories')
            .select('id')
            .eq('owner', owner)
            .eq('name', repo)
            .maybeSingle();

          if (newRepoData) {
            repoId = newRepoData.id;
          } else {
            throw new Error('Repository not found after tracking');
          }
        } else {
          repoId = repoData.id;
        }
      }

      setSyncProgress('Starting dual sync...');

      // Trigger BOTH gh-datapipe AND Inngest in parallel
      const syncPromises = [];

      // 1. Trigger gh-datapipe backfill for comprehensive historical data
      const ghDatapipePromise = fetch('/api/backfill/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repository: `${owner}/${repo}`,
          days: 30,
        }),
      })
        .then(async (response) => {
          if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            console.error(
              'gh-datapipe trigger failed:',
              response.status,
              response.statusText,
              errorText
            );
            // Don't throw - we want to continue even if gh-datapipe fails
            return null;
          }
          const job = await response.json();

          // Note: SSE not supported in Netlify Functions, relying on polling instead
          console.log('gh-datapipe job started:', job.job_id);

          return job;
        })
        .catch((err) => {
          console.error('gh-datapipe error:', err);
          return null;
        });

      syncPromises.push(ghDatapipePromise);

      // 2. Trigger Inngest sync for immediate processing
      // Try client-side first, then fallback to server-side if that fails
      const inngestPromise = inngest
        .send({
          name: 'capture/repository.sync.graphql',
          data: {
            repositoryId: repoId,
            repositoryName: `${owner}/${repo}`,
            days: 7, // Last 7 days for quick sync
            priority: 'critical',
            reason: isAutomatic ? 'auto' : 'manual',
            triggeredBy: isAutomatic ? 'auto_page_load' : 'user_manual_sync',
          },
        })
        .then((result) => {
          console.log('Inngest direct client job started:', result);
          return result;
        })
        .catch(async (err) => {
          console.warn('Inngest direct client failed, trying server-side fallback:', err.message);

          // Fallback to server-side Inngest trigger
          try {
            const serverResponse = await fetch('/api/trigger-inngest-sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                repositoryId: repoId,
                repositoryName: `${owner}/${repo}`,
                days: 7,
                priority: 'critical',
                reason: isAutomatic ? 'auto' : 'manual',
                triggeredBy: isAutomatic ? 'auto_page_load' : 'user_manual_sync',
              }),
            });

            if (serverResponse.ok) {
              const result = await serverResponse.json();
              console.log('Inngest server-side fallback job started:', result);
              return result;
            } else {
              console.error('Server-side Inngest fallback also failed:', serverResponse.status);
              return null;
            }
          } catch (serverErr) {
            console.error('Server-side Inngest fallback error:', serverErr);
            return null;
          }
        });

      syncPromises.push(inngestPromise);

      // Wait for both to trigger
      const [ghDatapipeResult, inngestResult] = await Promise.all(syncPromises);

      // Check if at least one succeeded
      if (!ghDatapipeResult && !inngestResult) {
        const errorDetails = [
          'Sync methods failed:',
          '• GitHub data pipeline: Unable to trigger backfill',
          '• Inngest background jobs: Connection blocked by security policy',
          '',
          'This may be due to:',
          '• Network connectivity issues',
          '• Service maintenance',
          '• Browser security restrictions',
          '',
          'Please try again in a few minutes or contact support if this persists.',
        ].join('\n');
        throw new Error(errorDetails);
      }

      // Show success notification with details about what worked
      if (!isAutomatic) {
        const successMethods = [];
        const failedMethods = [];

        if (ghDatapipeResult) successMethods.push('GitHub data pipeline');
        else failedMethods.push('GitHub data pipeline');

        if (inngestResult) successMethods.push('Background processor');
        else failedMethods.push('Background processor');

        let description =
          'Data will be refreshed in 1-2 minutes. The page will update automatically.';

        if (failedMethods.length > 0) {
          description = `${successMethods.join(' and ')} initiated successfully. ${failedMethods.join(' and ')} failed but sync will continue.`;
        }

        toast.success('Sync initiated!', {
          description,
          duration: 8000,
        });
      }

      // Start polling for completion
      startPollingForCompletion(repoId);
    } catch (error) {
      console.error('Unified sync error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to initiate sync';

      if (!isAutomatic) {
        toast.error('Sync failed', {
          description: errorMessage,
          duration: 6000,
        });
      } else {
        // For automatic syncs, just log the error silently
        console.error('Auto-sync failed:', errorMessage);
      }
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  };

  const startPollingForCompletion = (repoId: string | undefined) => {
    if (!repoId) return;

    // Clear any existing polling interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    let pollCount = 0;
    const maxPolls = POLLING_CONFIG.maxPolls;

    pollIntervalRef.current = setInterval(async () => {
      pollCount++;

      try {
        // Check if repository was recently updated
        const { data: repoData } = await supabase
          .from('repositories')
          .select('last_updated_at')
          .eq('id', repoId)
          .maybeSingle();

        if (repoData) {
          const updateTime = new Date(repoData.last_updated_at);
          const secondsSinceUpdate = (Date.now() - updateTime.getTime()) / 1000;

          // If updated within completion threshold, consider it complete
          if (secondsSinceUpdate < POLLING_CONFIG.completionThreshold) {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }

            toast.success('Repository data updated!', {
              description: 'Fresh data is now available',
              duration: 6000,
              action: {
                label: 'Refresh',
                onClick: () => window.location.reload(),
              },
            });

            // Auto-refresh after a short delay for seamless experience
            setTimeout(() => {
              window.location.reload();
            }, 1500);
          }
        }

        if (pollCount >= maxPolls) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }

          toast.info('Sync in progress', {
            description:
              'The sync is taking longer than expected. Please refresh the page in a minute.',
            duration: 10000,
          });
        }
      } catch (err) {
        // Silently continue polling
        console.error('Polling error:', err);
      }
    }, POLLING_CONFIG.interval);
  };

  const getButtonIcon = () => {
    const iconClass = showLabel ? 'mr-2 h-4 w-4' : 'h-4 w-4';

    if (isSyncing) {
      return <Loader2 className={`${iconClass} animate-spin`} />;
    }
    if (isLoggedIn) {
      return <RefreshCw className={iconClass} />;
    }
    return <Lock className={iconClass} />;
  };

  const buttonContent = (
    <>
      {getButtonIcon()}
      {showLabel && <span>{getSyncButtonText(isSyncing, isLoggedIn)}</span>}
    </>
  );

  const button = (
    <Button
      onClick={() => handleUnifiedSync(false)}
      disabled={isSyncing}
      variant={variant}
      size={size}
      className={className}
    >
      {buttonContent}
    </Button>
  );

  // If syncing, show progress
  if (isSyncing && syncProgress) {
    return (
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{syncProgress}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Show tooltip with last update time if available
  if (!showLabel && lastUpdated) {
    const timeSince = getTimeSinceUpdate();
    const tooltipText = isLoggedIn
      ? `Last synced ${timeSince}. Click to refresh data.`
      : 'Login to manually sync this repository';

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}
