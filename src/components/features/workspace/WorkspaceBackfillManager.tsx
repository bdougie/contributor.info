import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Database,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  RefreshCw,
} from '@/components/ui/icon';
import { toast } from 'sonner';
import { LastUpdated } from '@/components/ui/last-updated';

interface Repository {
  id: string;
  owner: string;
  name: string;
  full_name: string;
  stargazers_count: number;
  forks_count: number;
}

interface WorkspaceBackfillManagerProps {
  workspaceId: string;
  repositories: Repository[];
}

interface RepositoryBackfillStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'waiting';
  progress?: number;
  error?: string;
  lastBackfillDate?: string;
  waitingMessage?: string;
}

export function WorkspaceBackfillManager({
  workspaceId,
  repositories,
}: WorkspaceBackfillManagerProps) {
  const [backfillStatuses, setBackfillStatuses] = useState<
    Record<string, RepositoryBackfillStatus>
  >({});
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());

  // Initialize statuses and load last backfill times
  useEffect(() => {
    const initialStatuses: Record<string, RepositoryBackfillStatus> = {};
    repositories.forEach((repo) => {
      const storageKey = `contributor-info:backfill-${workspaceId}-${repo.full_name}`;
      const stored = localStorage.getItem(storageKey);
      initialStatuses[repo.full_name] = {
        status: 'pending',
        lastBackfillDate: stored || undefined,
      };
    });
    setBackfillStatuses(initialStatuses);
    // Select all repos by default
    setSelectedRepos(new Set(repositories.map((r) => r.full_name)));
  }, [repositories, workspaceId]);

  // Future enhancement: Check event data coverage for each repository
  // const getEventDataCoverage = async (repoOwner: string, repoName: string) => {
  //   try {
  //     const ninetyDaysAgo = new Date();
  //     ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  //     const { data, error } = await supabase
  //       .from('github_events_cache')
  //       .select('created_at', { count: 'exact', head: true })
  //       .eq('repository_owner', repoOwner)
  //       .eq('repository_name', repoName)
  //       .gte('created_at', ninetyDaysAgo.toISOString());

  //     if (error) throw error;
  //     return data;
  //   } catch (error) {
  //     console.error('Error checking event coverage:', error);
  //     return null;
  //   }
  // };

  const handleBackfillSelected = async () => {
    if (selectedRepos.size === 0) {
      toast.error('No repositories selected', {
        description: 'Select at least one repository to backfill.',
      });
      return;
    }

    setIsBackfilling(true);
    setOverallProgress(0);

    const reposToBackfill = repositories.filter((r) => selectedRepos.has(r.full_name));
    let completed = 0;

    try {
      toast.info('Starting backfill', {
        description: `Backfilling 90 days of event data for ${reposToBackfill.length} repositories...`,
        duration: 5000,
      });

      for (const repo of reposToBackfill) {
        // Update status to processing
        setBackfillStatuses((prev) => ({
          ...prev,
          [repo.full_name]: {
            ...prev[repo.full_name],
            status: 'processing',
            progress: 0,
          },
        }));

        try {
          const response = await fetch('/api/backfill/trigger', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              repository: repo.full_name,
              days: 90,
            }),
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

          // Update status to completed
          const now = new Date().toISOString();
          setBackfillStatuses((prev) => ({
            ...prev,
            [repo.full_name]: {
              status: 'completed',
              progress: 100,
              lastBackfillDate: now,
            },
          }));

          // Store in localStorage
          const storageKey = `contributor-info:backfill-${workspaceId}-${repo.full_name}`;
          localStorage.setItem(storageKey, now);

          completed++;
          setOverallProgress((completed / reposToBackfill.length) * 100);

          // Show progress toast every 3 repos
          if (completed % 3 === 0 && completed < reposToBackfill.length) {
            toast.info('Backfill progress', {
              description: `Completed ${completed} of ${reposToBackfill.length} repositories...`,
              duration: 3000,
            });
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          console.error('Backfill error for %s:', repo.full_name, error);

          setBackfillStatuses((prev) => ({
            ...prev,
            [repo.full_name]: {
              status: 'failed',
              error: errorMsg,
            },
          }));
        }

        // Small delay between requests to avoid rate limits
        // Show waiting status for next repository
        const nextIndex = reposToBackfill.indexOf(repo) + 1;
        if (nextIndex < reposToBackfill.length) {
          const nextRepo = reposToBackfill[nextIndex];
          setBackfillStatuses((prev) => ({
            ...prev,
            [nextRepo.full_name]: {
              ...prev[nextRepo.full_name],
              status: 'waiting',
              waitingMessage: 'Next in queue...',
            },
          }));
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      const failed = reposToBackfill.length - completed;
      if (failed === 0) {
        toast.success('Backfill complete!', {
          description: `Successfully backfilled ${completed} repositories. Event data will be available shortly.`,
          duration: 8000,
        });
      } else {
        toast.warning('Backfill completed with errors', {
          description: `Completed: ${completed}, Failed: ${failed}. Check the table for details.`,
          duration: 8000,
        });
      }
    } catch (error) {
      console.error('Workspace backfill error:', error);
      toast.error('Backfill failed', {
        description: error instanceof Error ? error.message : 'Failed to backfill workspace',
        duration: 6000,
      });
    } finally {
      setIsBackfilling(false);
      setOverallProgress(0);
    }
  };

  const handleToggleRepository = (fullName: string) => {
    setSelectedRepos((prev) => {
      const next = new Set(prev);
      if (next.has(fullName)) {
        next.delete(fullName);
      } else {
        next.add(fullName);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedRepos.size === repositories.length) {
      setSelectedRepos(new Set());
    } else {
      setSelectedRepos(new Set(repositories.map((r) => r.full_name)));
    }
  };

  const getStatusIcon = (status: RepositoryBackfillStatus['status']) => {
    switch (status) {
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
      case 'waiting':
        return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: RepositoryBackfillStatus['status']) => {
    const variants = {
      pending: 'secondary' as const,
      waiting: 'outline' as const,
      processing: 'default' as const,
      completed: 'default' as const,
      failed: 'destructive' as const,
    };

    return (
      <Badge variant={variants[status]} className="capitalize">
        {status === 'waiting' ? 'Next in queue' : status}
      </Badge>
    );
  };

  if (repositories.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Workspace Event Backfill
          </CardTitle>
          <CardDescription>
            No repositories in workspace. Add repositories to enable backfilling.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Workspace Event Backfill
        </CardTitle>
        <CardDescription>
          Backfill 90 days of GitHub event data (stars, forks, activity) for workspace repositories
          to enable accurate velocity trend metrics.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Why backfill?</strong> Star velocity metrics require 60+ days of continuous
            event data to show meaningful trends. Currently showing 0% trends due to insufficient
            historical data.
          </AlertDescription>
        </Alert>

        {isBackfilling && overallProgress > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className="font-medium">{Math.round(overallProgress)}%</span>
            </div>
            <Progress value={overallProgress} className="w-full" />
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedRepos.size === repositories.length}
              onChange={handleSelectAll}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm text-muted-foreground">
              {selectedRepos.size} of {repositories.length} selected
            </span>
          </div>

          <Button
            onClick={handleBackfillSelected}
            disabled={isBackfilling || selectedRepos.size === 0}
            size="sm"
          >
            {isBackfilling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Backfilling...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Backfill Selected ({selectedRepos.size})
              </>
            )}
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Repository</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Backfill</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {repositories.map((repo) => {
                const status = backfillStatuses[repo.full_name] || { status: 'pending' as const };
                return (
                  <TableRow key={repo.full_name}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedRepos.has(repo.full_name)}
                        onChange={() => handleToggleRepository(repo.full_name)}
                        disabled={isBackfilling}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{repo.full_name}</span>
                        <span className="text-xs text-muted-foreground">
                          ⭐ {repo.stargazers_count} · 🍴 {repo.forks_count}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(status.status)}
                        {getStatusBadge(status.status)}
                        {status.error && (
                          <span className="text-xs text-red-500 truncate max-w-xs">
                            {status.error}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {status.lastBackfillDate ? (
                        <LastUpdated
                          timestamp={status.lastBackfillDate}
                          label=""
                          size="sm"
                          showIcon={false}
                          includeStructuredData={false}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {status.status === 'processing' && status.progress !== undefined && (
                        <div className="flex items-center gap-2">
                          <Progress value={status.progress} className="w-16" />
                          <span className="text-xs">{status.progress}%</span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          This will fetch and store WatchEvent, ForkEvent, and other activity events from the last
          90 days (within GitHub API limits) to enable meaningful velocity trend comparisons.
        </p>
      </CardContent>
    </Card>
  );
}
