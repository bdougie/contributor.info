import { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Clock } from '@/components/ui/icon';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';
import { getSupabase } from '@/lib/supabase-lazy';

/**
 * Two different timestamps live here and must never be conflated:
 * - "Refresh requested": when this browser last asked the backend to queue a
 *   sync. It advances only when the request was accepted for at least one
 *   repository. It says nothing about the data on screen.
 * - "Data refreshed": supplied by the parent from the data hook, when the rows
 *   being displayed were last confirmed current. Omitted when the parent
 *   cannot vouch for it.
 */
interface WorkspaceAutoSyncProps {
  workspaceId: string;
  workspaceSlug: string;
  repositoryIds: string[];
  className?: string;
  /**
   * Runs after a sync request is accepted, and is awaited so the spinner covers
   * the caller's own refresh. Rejections are shown inline.
   */
  onSyncRequested?: () => void | Promise<void>;
  syncIntervalMinutes?: number; // Default 60 minutes
  /** When the displayed data was last confirmed current; null/undefined when unknown. */
  dataRefreshedAt?: Date | null;
  /** True when the parent knows the displayed data is older than its freshness window. */
  dataStale?: boolean;
}

interface SyncRequestSummary {
  total: number;
  queued: number;
  failed: number;
}

interface SyncRequestResult {
  repositoryId: string;
  repository?: string;
  status: 'queued' | 'failed';
  error?: string;
}

interface SyncRequestResponse {
  message?: string;
  requestedAt?: string;
  results?: SyncRequestResult[];
  summary?: SyncRequestSummary;
}

interface InvokeErrorContext {
  status?: number;
  headers?: Headers;
  json?: () => Promise<unknown>;
}

interface InvokeError {
  message?: string;
  context?: InvokeErrorContext;
}

function storageKey(workspaceId: string): string {
  return `workspace-sync-requested-${workspaceId}`;
}

function readStoredDate(key: string): Date | null {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    const parsed = new Date(stored);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

function formatAgo(date: Date | null, never: string): string {
  if (!date) return never;
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / (1000 * 60));
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes === 1) return '1 minute ago';
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;
  return formatDistanceToNow(date, { addSuffix: true });
}

async function describeRequestFailure(error: InvokeError): Promise<string> {
  const status = error.context?.status;
  let serverMessage: string | undefined;
  if (error.context?.json) {
    try {
      const body = (await error.context.json()) as { message?: unknown; error?: unknown };
      if (typeof body.message === 'string') serverMessage = body.message;
      else if (typeof body.error === 'string') serverMessage = body.error;
    } catch {
      // Non-JSON body; use the status text below.
    }
  }
  if (status === 401) return 'Sign in again to request a sync.';
  if (status === 403) return serverMessage || 'Only workspace members can request a sync.';
  if (status === 429) return serverMessage || 'Too many sync requests. Try again later.';
  if (status !== undefined) return serverMessage || `Sync request failed (HTTP ${status}).`;
  return 'Could not reach the sync service.';
}

export function WorkspaceAutoSync({
  workspaceId,
  workspaceSlug,
  repositoryIds,
  className = '',
  onSyncRequested,
  syncIntervalMinutes = 60,
  dataRefreshedAt,
  dataStale,
}: WorkspaceAutoSyncProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastRequestedAt, setLastRequestedAt] = useState<Date | null>(() =>
    readStoredDate(storageKey(workspaceId))
  );
  const [nextSyncTime, setNextSyncTime] = useState<Date | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pageVisibilityRef = useRef<boolean>(true);
  const isSyncingRef = useRef(false);
  const onSyncRequestedRef = useRef(onSyncRequested);
  onSyncRequestedRef.current = onSyncRequested;

  const performSync = useCallback(
    async (isManual = false) => {
      if (isSyncingRef.current || repositoryIds.length === 0) return;
      isSyncingRef.current = true;
      setIsSyncing(true);
      setRequestError(null);

      try {
        // The SDK sends the signed-in user's JWT; the function checks membership.
        const supabase = await getSupabase();
        const { data, error } = await supabase.functions.invoke<SyncRequestResponse>(
          'workspace-sync',
          { body: { workspaceId, repositoryIds } }
        );

        if (error) {
          const invokeError = error as InvokeError;
          const retryAfter = invokeError.context?.headers?.get?.('Retry-After');
          if (invokeError.context?.status === 429 && retryAfter) {
            setNextSyncTime(new Date(Date.now() + parseInt(retryAfter, 10) * 1000));
          }
          setRequestError(await describeRequestFailure(invokeError));
          return;
        }

        const summary = data?.summary;
        const queued = summary?.queued ?? 0;
        if (!summary || queued === 0) {
          const firstFailure = data?.results?.find((result) => result.status === 'failed');
          setRequestError(
            firstFailure?.error
              ? `Sync request failed: ${firstFailure.error}`
              : 'Sync request failed for every repository.'
          );
          return;
        }

        const now = new Date();
        setLastRequestedAt(now);
        try {
          localStorage.setItem(storageKey(workspaceId), now.toISOString());
        } catch {
          // Storage may be unavailable; the in-memory timestamp still applies.
        }
        setNextSyncTime(new Date(now.getTime() + syncIntervalMinutes * 60 * 1000));

        if (summary.failed > 0) {
          setRequestError(
            `Sync requested for ${queued} of ${summary.total} repositories; ${summary.failed} could not be queued.`
          );
        }

        if (!isManual) {
          console.log('[AutoSync] Workspace %s sync requested', workspaceSlug);
        }

        // Awaited so the spinner reflects the caller's actual refresh outcome.
        try {
          await onSyncRequestedRef.current?.();
        } catch (callbackError) {
          setRequestError(
            callbackError instanceof Error
              ? callbackError.message
              : 'Refreshing the displayed data failed.'
          );
        }
      } catch (error) {
        console.error('[AutoSync] Failed to request workspace sync:', error);
        setRequestError('Could not reach the sync service.');
      } finally {
        isSyncingRef.current = false;
        setIsSyncing(false);
      }
    },
    [workspaceId, repositoryIds, syncIntervalMinutes, workspaceSlug]
  );

  // Set up auto-sync interval
  useEffect(() => {
    const checkInitialSync = async () => {
      if (lastRequestedAt) {
        const timeSinceLastSync = Date.now() - lastRequestedAt.getTime();
        const syncIntervalMs = syncIntervalMinutes * 60 * 1000;

        if (timeSinceLastSync >= syncIntervalMs) {
          await performSync(false);
        } else {
          setNextSyncTime(new Date(lastRequestedAt.getTime() + syncIntervalMs));
        }
      } else {
        await performSync(false);
      }
    };

    checkInitialSync();

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

      if (!document.hidden && lastRequestedAt) {
        const timeSinceLastSync = Date.now() - lastRequestedAt.getTime();
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
  }, [lastRequestedAt, syncIntervalMinutes, performSync]);

  const getNextSyncText = () => {
    if (!nextSyncTime || isSyncing) return '';

    const diffMinutes = Math.floor((nextSyncTime.getTime() - Date.now()) / (1000 * 60));

    if (diffMinutes <= 0) return 'Syncing soon...';
    if (diffMinutes === 1) return 'Next sync in 1 minute';
    if (diffMinutes < 60) return `Next sync in ${diffMinutes} minutes`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours === 1) return 'Next sync in 1 hour';
    return `Next sync in ${diffHours} hours`;
  };

  const showsDataFreshness = dataRefreshedAt !== undefined;
  const requestIsOld =
    !lastRequestedAt ||
    Date.now() - lastRequestedAt.getTime() > syncIntervalMinutes * 60 * 1000 * 1.5;

  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground ${className}`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {showsDataFreshness ? (
          <span className="inline-flex items-start gap-2">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Data refreshed:{' '}
              <span className="font-medium">{formatAgo(dataRefreshedAt ?? null, 'not yet')}</span>
              {dataStale && <span className="ml-2 text-yellow-600">(may be outdated)</span>}
            </span>
          </span>
        ) : (
          <span className="inline-flex items-start gap-2">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Refresh requested:{' '}
              <span className="font-medium">{formatAgo(lastRequestedAt, 'never')}</span>
              {requestIsOld && <span className="ml-2 text-yellow-600">(may be outdated)</span>}
            </span>
          </span>
        )}
        {nextSyncTime && !isSyncing && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="ml-2 text-xs opacity-75">• {getNextSyncText()}</span>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                A sync is requested every {syncIntervalMinutes} minutes while the page is active.
                {showsDataFreshness && ' Last requested: '}
                {showsDataFreshness && formatAgo(lastRequestedAt, 'never')}
              </p>
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

      {requestError && (
        <span role="status" className="text-xs text-destructive">
          {requestError}
        </span>
      )}
    </div>
  );
}
