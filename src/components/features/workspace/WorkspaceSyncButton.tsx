import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2 } from '@/components/ui/icon';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface WorkspaceSyncButtonProps {
  workspaceId: string;
  workspaceSlug: string;
  repositoryIds: string[];
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  onSyncComplete?: () => void;
}

export function WorkspaceSyncButton({
  workspaceId,
  workspaceSlug,
  repositoryIds,
  className = '',
  variant = 'outline',
  size = 'sm',
  onSyncComplete,
}: WorkspaceSyncButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);

  const handleSync = async () => {
    if (isSyncing) return;

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      setIsSyncing(true);
      setSyncProgress('Starting sync...');

      // Call the server-side API endpoint to trigger sync
      const response = await fetch('/.netlify/functions/workspace-sync-simple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId,
          repositoryIds,
        }),
        signal: controller.signal,
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 429) {
          // Rate limited
          const retryAfter = response.headers.get('Retry-After');
          const message =
            result.message || `Too many sync requests. Please wait ${retryAfter || '60'} seconds.`;
          toast.error(message);
        } else if (response.status === 503) {
          toast.error('Sync service is temporarily unavailable. Please try again later.');
        } else {
          toast.error(result.message || 'Failed to start sync. Please try again.');
        }
        console.error('Workspace sync failed:', result);
        return;
      }

      // Show success message
      if (result.failureCount > 0) {
        toast.warning(
          `Sync started for ${result.successCount} of ${repositoryIds.length} repositories`
        );
      } else {
        toast.success(`Started syncing workspace "${workspaceSlug}"`);
      }

      // Optional callback when sync is initiated
      if (onSyncComplete) {
        setTimeout(() => {
          onSyncComplete();
        }, 3000); // Give time for initial sync to start
      }
    } catch (error) {
      console.error('Failed to start workspace sync:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        toast.error('Sync request timed out. Please try again.');
      } else {
        toast.error('Network error. Please check your connection and try again.');
      }
    } finally {
      clearTimeout(timeoutId);
      setIsSyncing(false);
      setSyncProgress(null);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleSync}
            disabled={isSyncing || repositoryIds.length === 0}
            variant={variant}
            size={size}
            className={`${className} disabled:cursor-not-allowed`}
          >
            {isSyncing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {syncProgress && <span className="ml-2">{syncProgress}</span>}
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                <span className="ml-2">Sync Workspace Data</span>
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Refresh repository data, stars, forks, and activity</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
