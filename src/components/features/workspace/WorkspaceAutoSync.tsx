import { useState, useEffect, useRef } from 'react';
import { RefreshCw, Clock } from '@/components/ui/icon';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';
import { env } from '@/lib/env';

interface WorkspaceAutoSyncProps {
  workspaceId: string;
  workspaceSlug: string;
  repositoryIds: string[];
  className?: string;
  onSyncComplete?: () => void;
  syncIntervalMinutes?: number; // Default 60 minutes
}

export function WorkspaceAutoSync({
  workspaceId,
  workspaceSlug,
  repositoryIds,
  className = '',
  onSyncComplete,
  syncIntervalMinutes = 60,
}: WorkspaceAutoSyncProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(() => {
    // Try to restore last sync time from localStorage
    const stored = localStorage.getItem(`workspace-sync-${workspaceId}`);
    return stored ? new Date(stored) : null;
  });
  const [nextSyncTime, setNextSyncTime] = useState<Date | null>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pageVisibilityRef = useRef<boolean>(true);

  // Function to perform sync
  const performSync = async (isManual = false) => {
    if (isSyncing || repositoryIds.length === 0) return;

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      setIsSyncing(true);

      // Use environment variables for Supabase URL
      // In development, call Supabase Edge Function directly
      // In production, use the Netlify redirect
      const isDev = import.meta.env.DEV;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const syncUrl =
        isDev && supabaseUrl ? `${supabaseUrl}/functions/v1/workspace-sync` : '/api/workspace-sync';

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      // Add auth headers for Supabase Edge Functions
      // Note: Using anon key here since this runs in the browser
      // For RLS bypass, the edge function itself should use service role key
      const anonKey = env.SUPABASE_ANON_KEY;
      if (anonKey) {
        headers['apikey'] = anonKey;
        headers['Authorization'] = `Bearer ${anonKey}`;
      }

      // Call the API endpoint to trigger sync
      const response = await fetch(syncUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          workspaceId,
          repositoryIds,
        }),
        signal: controller.signal,
      });

      const result = await response.json();

      if (response.ok) {
        const now = new Date();
        setLastSyncTime(now);
        localStorage.setItem(`workspace-sync-${workspaceId}`, now.toISOString());

        // Calculate next sync time
        const nextSync = new Date(now.getTime() + syncIntervalMinutes * 60 * 1000);
        setNextSyncTime(nextSync);

        // Call completion callback
        if (onSyncComplete) {
          onSyncComplete();
        }

        // Log success silently (no toast for auto-sync)
        if (!isManual) {
          console.log('[AutoSync] Workspace %s synced successfully', workspaceSlug);
        }
      } else {
        // Handle rate limiting for auto-sync
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const retrySeconds = retryAfter ? parseInt(retryAfter, 10) : 3600; // Default to 1 hour
          const nextSync = new Date(Date.now() + retrySeconds * 1000);
          setNextSyncTime(nextSync);
          console.log('[AutoSync] Rate limited. Next sync at %s', nextSync.toLocaleTimeString());
        } else {
          console.error('[AutoSync] Sync failed:', result);
        }
      }
    } catch (error) {
      console.error('[AutoSync] Failed to sync workspace:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[AutoSync] Sync request timed out');
      }
    } finally {
      clearTimeout(timeoutId);
      setIsSyncing(false);
    }
  };

  // Set up auto-sync interval
  useEffect(() => {
    // Check if we should sync on mount
    const checkInitialSync = async () => {
      if (lastSyncTime) {
        const timeSinceLastSync = Date.now() - lastSyncTime.getTime();
        const syncIntervalMs = syncIntervalMinutes * 60 * 1000;

        if (timeSinceLastSync >= syncIntervalMs) {
          // Sync needed
          await performSync(false);
        } else {
          // Calculate next sync time
          const nextSync = new Date(lastSyncTime.getTime() + syncIntervalMs);
          setNextSyncTime(nextSync);
        }
      } else {
        // No previous sync, perform initial sync
        await performSync(false);
      }
    };

    checkInitialSync();

    // Set up interval for periodic syncing
    syncIntervalRef.current = setInterval(
      () => {
        if (pageVisibilityRef.current) {
          performSync(false);
        }
      },
      syncIntervalMinutes * 60 * 1000
    );

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, repositoryIds.length, syncIntervalMinutes]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      pageVisibilityRef.current = !document.hidden;

      // When page becomes visible, check if we need to sync
      if (!document.hidden && lastSyncTime) {
        const timeSinceLastSync = Date.now() - lastSyncTime.getTime();
        const syncIntervalMs = syncIntervalMinutes * 60 * 1000;

        if (timeSinceLastSync >= syncIntervalMs) {
          performSync(false);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSyncTime, syncIntervalMinutes]);

  // Format display text
  const getLastSyncText = () => {
    if (!lastSyncTime) return 'Never synced';

    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - lastSyncTime.getTime()) / (1000 * 60));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes === 1) return '1 minute ago';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;

    return formatDistanceToNow(lastSyncTime, { addSuffix: true });
  };

  const getNextSyncText = () => {
    if (!nextSyncTime || isSyncing) return '';

    const now = new Date();
    const diffMinutes = Math.floor((nextSyncTime.getTime() - now.getTime()) / (1000 * 60));

    if (diffMinutes <= 0) return 'Syncing soon...';
    if (diffMinutes === 1) return 'Next sync in 1 minute';
    if (diffMinutes < 60) return `Next sync in ${diffMinutes} minutes`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours === 1) return 'Next sync in 1 hour';
    return `Next sync in ${diffHours} hours`;
  };

  const isDataStale = () => {
    if (!lastSyncTime) return true;
    const timeSinceLastSync = Date.now() - lastSyncTime.getTime();
    return timeSinceLastSync > syncIntervalMinutes * 60 * 1000 * 1.5; // 1.5x the interval
  };

  return (
    <div className={`flex items-center gap-4 text-sm text-muted-foreground ${className}`}>
      <TooltipProvider>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <span>
            Last checked: <span className="font-medium">{getLastSyncText()}</span>
            {isDataStale() && <span className="ml-2 text-yellow-600">(may be outdated)</span>}
          </span>
          {nextSyncTime && !isSyncing && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="ml-2 text-xs opacity-75">• {getNextSyncText()}</span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Auto-sync runs every {syncIntervalMinutes} minutes when the page is active</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => performSync(true)}
              disabled={isSyncing || repositoryIds.length === 0}
              className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Sync now"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isSyncing ? 'Syncing...' : 'Sync now'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
