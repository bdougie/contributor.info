import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Lock, Loader2 } from '@/components/ui/icon';
import { useGitHubAuth } from '@/hooks/use-github-auth';
import { toast } from 'sonner';
import { inngest } from '@/lib/inngest/client';
import { supabase } from '@/lib/supabase';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { POLLING_CONFIG, isSyncAllowed } from '@/lib/progressive-capture/throttle-config';

interface ManualSyncButtonProps {
  owner: string;
  repo: string;
  repositoryId?: string;
  lastUpdated?: Date | string;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
}

export function ManualSyncButton({
  owner,
  repo,
  repositoryId,
  lastUpdated,
  className = '',
  variant = 'outline',
  size = 'sm',
  showLabel = true
}: ManualSyncButtonProps) {
  const { isLoggedIn, login } = useGitHubAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  // Calculate if sync is allowed based on last update time
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
    if (hoursSinceUpdate < 24) return `${hoursSinceUpdate} hour${hoursSinceUpdate > 1 ? 's' : ''} ago`;
    
    const daysSinceUpdate = Math.floor(hoursSinceUpdate / 24);
    return `${daysSinceUpdate} day${daysSinceUpdate > 1 ? 's' : ''} ago`;
  };

  const handleLogin = async () => {
    // Store the repository path so we can auto-sync after login
    localStorage.setItem('pendingSyncRepo', `${owner}/${repo}`);
    localStorage.setItem('redirectAfterLogin', `/${owner}/${repo}`);
    await login();
  };

  const handleManualSync = async () => {
    if (!isLoggedIn) {
      handleLogin();
      return;
    }

    if (!canSync()) {
      toast.info('Recently synced', {
        description: `This repository was synced ${getTimeSinceUpdate()}. Please wait a few minutes before syncing again.`,
        duration: 5000
      });
      return;
    }

    setIsSyncing(true);
    setSyncProgress('Initiating sync...');

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
          .single();

        if (repoError || !repoData) {
          throw new Error('Repository not found in database');
        }
        repoId = repoData.id;
      }

      setSyncProgress('Queueing sync job...');

      // Send sync event to Inngest with manual trigger and priority
      const result = await inngest.send({
        name: 'capture/repository.sync.graphql',
        data: {
          repositoryId: repoId,
          repositoryName: `${owner}/${repo}`,
          days: 7, // Sync last 7 days for manual refresh
          priority: 'critical', // High priority for manual syncs
          reason: 'manual', // Bypass throttling
          triggeredBy: 'user_manual_sync'
        }
      });

      if (result.ids && result.ids.length > 0) {
        toast.success('Sync initiated!', {
          description: 'Data will be refreshed in 1-2 minutes. The page will update automatically.',
          duration: 8000
        });

        // Start polling for completion
        startPollingForCompletion(repoId);
      } else {
        throw new Error('Failed to queue sync job');
      }

    } catch (error) {
      console.error('Manual sync error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to initiate sync';
      
      toast.error('Sync failed', {
        description: errorMessage,
        duration: 6000
      });
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
          .single();

        if (repoData) {
          const updateTime = new Date(repoData.last_updated_at);
          const secondsSinceUpdate = (Date.now() - updateTime.getTime()) / 1000;
          
          // If updated within completion threshold, consider it complete
          if (secondsSinceUpdate < POLLING_CONFIG.completionThreshold) {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            toast.success('Sync complete!', {
              description: 'Data has been refreshed successfully.',
              duration: 5000
            });
            
            // Refresh the page after a short delay
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
            description: 'The sync is taking longer than expected. Please refresh the page in a minute.',
            duration: 10000
          });
        }
      } catch (err) {
        // Silently continue polling
        console.error('Polling error:', err);
      }
    }, POLLING_CONFIG.interval);
  };

  const buttonContent = (
    <>
      {isSyncing ? (
        <Loader2 className={showLabel ? "mr-2 h-4 w-4 animate-spin" : "h-4 w-4 animate-spin"} />
      ) : isLoggedIn ? (
        <RefreshCw className={showLabel ? "mr-2 h-4 w-4" : "h-4 w-4"} />
      ) : (
        <Lock className={showLabel ? "mr-2 h-4 w-4" : "h-4 w-4"} />
      )}
      {showLabel && (
        <span>
          {isSyncing ? 'Syncing...' : isLoggedIn ? 'Sync Now' : 'Login to Sync'}
        </span>
      )}
    </>
  );

  const button = (
    <Button
      onClick={handleManualSync}
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
          <TooltipTrigger asChild>
            {button}
          </TooltipTrigger>
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
          <TooltipTrigger asChild>
            {button}
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}