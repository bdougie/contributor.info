import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2 } from '@/components/ui/icon';
import { toast } from 'sonner';
import { inngest } from '@/lib/inngest/client';
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
  // Store workspaceId for potential future use (e.g., API calls, analytics)
  // Currently using repositoryIds for sync operations
  void workspaceId;
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);

  const handleSync = async () => {
    if (isSyncing) return;

    try {
      setIsSyncing(true);
      setSyncProgress('Starting sync...');

      // Trigger sync for all repositories in the workspace
      const syncPromises = repositoryIds.map(async (repoId) => {
        try {
          // Send event to Inngest to sync repository data
          await inngest.send({
            name: 'capture/repository.sync.graphql',
            data: {
              repositoryId: repoId,
              days: 30,
              priority: 'high' as const,
              reason: 'Manual workspace sync',
            },
          });
        } catch (error) {
          console.error(`Failed to sync repository ${repoId}:`, error);
        }
      });

      setSyncProgress(`Syncing ${repositoryIds.length} repositories...`);
      await Promise.allSettled(syncPromises);

      toast.success(`Started syncing workspace "${workspaceSlug}"`);

      // Optional callback when sync is initiated
      if (onSyncComplete) {
        setTimeout(() => {
          onSyncComplete();
        }, 3000); // Give time for initial sync to start
      }
    } catch (error) {
      console.error('Failed to start workspace sync:', error);
      toast.error('Failed to start sync. Please try again.');
    } finally {
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
            disabled={isSyncing}
            variant={variant}
            size={size}
            className={className}
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
