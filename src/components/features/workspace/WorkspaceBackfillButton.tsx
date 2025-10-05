import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Database } from '@/components/ui/icon';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { LastUpdated } from '@/components/ui/last-updated';

interface WorkspaceBackfillButtonProps {
  workspaceId: string;
  repositories: Array<{
    owner: string;
    name: string;
    full_name: string;
  }>;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
}

interface BackfillStatus {
  total: number;
  completed: number;
  failed: number;
  inProgress: boolean;
}

export function WorkspaceBackfillButton({
  workspaceId,
  repositories,
  className = '',
  variant = 'outline',
  size = 'sm',
  showLabel = true,
}: WorkspaceBackfillButtonProps) {
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillStatus, setBackfillStatus] = useState<BackfillStatus>({
    total: 0,
    completed: 0,
    failed: 0,
    inProgress: false,
  });
  const [lastBackfillTime, setLastBackfillTime] = useState<Date | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Load last backfill time from localStorage
  useEffect(() => {
    const storageKey = `contributor-info:workspace-backfill-${workspaceId}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      setLastBackfillTime(new Date(stored));
    }
  }, [workspaceId]);

  const handleBackfill = async () => {
    if (repositories.length === 0) {
      toast.error('No repositories', {
        description: 'Add repositories to your workspace before running a backfill.',
      });
      return;
    }

    setIsBackfilling(true);
    setBackfillStatus({
      total: repositories.length,
      completed: 0,
      failed: 0,
      inProgress: true,
    });

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      toast.info('Starting backfill', {
        description: `Backfilling 90 days of event data for ${repositories.length} repositories...`,
        duration: 5000,
      });

      let completed = 0;
      let failed = 0;

      // Process repositories sequentially to avoid rate limits
      for (const repo of repositories) {
        if (abortControllerRef.current?.signal.aborted) {
          toast.info('Backfill cancelled', {
            description: `Completed ${completed} of ${repositories.length} repositories.`,
          });
          break;
        }

        try {
          const response = await fetch('/api/backfill/trigger', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              repository: repo.full_name,
              days: 90, // Backfill 90 days as per issue requirements
            }),
            signal: abortControllerRef.current?.signal,
          });

          if (!response.ok) {
            let errorData: { message?: string };
            try {
              errorData = await response.json();
            } catch {
              errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
            }
            throw new Error(errorData.message || 'Failed to trigger backfill');
          }

          completed++;
          setBackfillStatus((prev) => ({
            ...prev,
            completed,
          }));

          // Show progress toast every 5 repos
          if (completed % 5 === 0) {
            toast.info('Backfill progress', {
              description: `Completed ${completed} of ${repositories.length} repositories...`,
              duration: 3000,
            });
          }
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            break;
          }
          console.error('Backfill error for %s:', repo.full_name, error);
          failed++;
          setBackfillStatus((prev) => ({
            ...prev,
            failed,
          }));
        }

        // Add a small delay between requests to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Update last backfill time
      const now = new Date();
      setLastBackfillTime(now);
      localStorage.setItem(`contributor-info:workspace-backfill-${workspaceId}`, now.toISOString());

      // Show completion toast
      if (failed === 0) {
        toast.success('Backfill complete!', {
          description: `Successfully backfilled ${completed} repositories. Event data will be available shortly.`,
          duration: 8000,
        });
      } else {
        toast.warning('Backfill completed with errors', {
          description: `Completed: ${completed}, Failed: ${failed}. Check console for details.`,
          duration: 8000,
        });
      }
    } catch (error) {
      console.error('Workspace backfill error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to backfill workspace';

      toast.error('Backfill failed', {
        description: errorMessage,
        duration: 6000,
      });
    } finally {
      setIsBackfilling(false);
      setBackfillStatus((prev) => ({
        ...prev,
        inProgress: false,
      }));
      abortControllerRef.current = null;
    }
  };

  const buttonContent = (
    <>
      {isBackfilling ? (
        <Loader2 className={showLabel ? 'mr-2 h-4 w-4 animate-spin' : 'h-4 w-4 animate-spin'} />
      ) : (
        <Database className={showLabel ? 'mr-2 h-4 w-4' : 'h-4 w-4'} />
      )}
      {showLabel && <span>{isBackfilling ? 'Backfilling...' : 'Backfill 90 Days'}</span>}
    </>
  );

  const button = (
    <Button
      onClick={handleBackfill}
      disabled={isBackfilling || repositories.length === 0}
      variant={variant}
      size={size}
      className={className}
    >
      {buttonContent}
    </Button>
  );

  // Show tooltip with status
  let tooltipText = 'Backfill 90 days of GitHub events for velocity metrics';

  if (isBackfilling) {
    tooltipText = `Backfilling ${backfillStatus.completed} of ${backfillStatus.total} repositories...`;
  } else if (repositories.length === 0) {
    tooltipText = 'Add repositories to your workspace first';
  } else if (lastBackfillTime) {
    tooltipText = `Last backfill: ${lastBackfillTime.toLocaleDateString()}. Click to backfill 90 days of event data.`;
  }

  return (
    <div className="flex items-center gap-3">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p className="text-xs max-w-xs">{tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {lastBackfillTime && !isBackfilling && (
        <LastUpdated
          timestamp={lastBackfillTime}
          label="Last backfill"
          size="sm"
          showIcon={false}
          includeStructuredData={false}
        />
      )}
    </div>
  );
}
