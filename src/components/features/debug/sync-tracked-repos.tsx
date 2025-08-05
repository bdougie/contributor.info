import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { RefreshCw, Database, CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { sendInngestEvent } from "@/lib/inngest/client-safe";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Repository {
  id: string;
  owner: string;
  name: string;
  is_active: boolean;
  last_updated_at: string | null;
}

interface TrackedRepo {
  repository_id: string;
  tracking_enabled: boolean;
  last_sync_at: string | null;
  repositories: Repository;
}

interface SyncResult {
  synced: string[];
  failed: string[];
  total: number;
}

export function SyncTrackedRepos() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [trackedRepos, setTrackedRepos] = useState<TrackedRepo[]>([]);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    loadTrackedRepos();
  }, []);

  const loadTrackedRepos = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tracked_repositories')
        .select(`
          repository_id,
          tracking_enabled,
          last_sync_at,
          repositories!inner(
            id,
            owner,
            name,
            is_active,
            last_updated_at
          )
        `)
        .eq('tracking_enabled', true)
        .eq('repositories.is_active', true)
        .order('last_sync_at', { ascending: true, nullsFirst: true })
        .limit(100);

      if (error) throw error;

      // Type assertion to handle Supabase's loose typing
      const typedData = (data || []) as unknown as TrackedRepo[];
      setTrackedRepos(typedData);
      
      // Auto-select repos that have never been synced
      const neverSynced = (data || [])
        .filter(repo => !repo.last_sync_at)
        .map(repo => repo.repository_id);
      setSelectedRepos(new Set(neverSynced));
      
    } catch (error) {
      console.error('Error loading tracked repos:', error);
      toast({
        title: "Error",
        description: "Failed to load tracked repositories",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatLastSync = (date: string | null) => {
    if (!date) return "Never";
    
    const syncDate = new Date(date);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - syncDate.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return "< 1 hour ago";
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffHours < 48) return "1 day ago";
    return `${Math.floor(diffHours / 24)} days ago`;
  };

  const getSyncStatus = (lastSync: string | null) => {
    if (!lastSync) return { color: "destructive", label: "Never synced" };
    
    const syncDate = new Date(lastSync);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - syncDate.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 24) return { color: "default", label: "Fresh" };
    if (diffHours < 72) return { color: "secondary", label: "Recent" };
    if (diffHours < 168) return { color: "outline", label: "Stale" };
    return { color: "destructive", label: "Very stale" };
  };

  const toggleRepoSelection = (repoId: string) => {
    const newSelected = new Set(selectedRepos);
    if (newSelected.has(repoId)) {
      newSelected.delete(repoId);
    } else {
      newSelected.add(repoId);
    }
    setSelectedRepos(newSelected);
  };

  const selectAll = () => {
    setSelectedRepos(new Set(trackedRepos.map(r => r.repository_id)));
  };

  const selectNone = () => {
    setSelectedRepos(new Set());
  };

  const selectStale = () => {
    const staleRepos = trackedRepos.filter(repo => {
      if (!repo.last_sync_at) return true;
      const syncDate = new Date(repo.last_sync_at);
      const now = new Date();
      const diffHours = Math.floor((now.getTime() - syncDate.getTime()) / (1000 * 60 * 60));
      return diffHours > 72; // More than 3 days old
    });
    setSelectedRepos(new Set(staleRepos.map(r => r.repository_id)));
  };

  const syncSelectedRepos = async () => {
    if (selectedRepos.size === 0) {
      toast({
        title: "No repositories selected",
        description: "Please select at least one repository to sync",
        variant: "destructive"
      });
      return;
    }

    setIsSyncing(true);
    setSyncProgress(0);
    setSyncResult(null);

    const result: SyncResult = {
      synced: [],
      failed: [],
      total: selectedRepos.size
    };

    const reposToSync = trackedRepos.filter(r => selectedRepos.has(r.repository_id));
    const batchSize = 5;
    let processed = 0;

    try {
      // Process in batches to avoid overwhelming the system
      for (let i = 0; i < reposToSync.length; i += batchSize) {
        const batch = reposToSync.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (repo) => {
          const fullName = `${repo.repositories.owner}/${repo.repositories.name}`;
          
          try {
            // Send multiple event types to ensure sync coverage
            const events = [
              {
                name: 'capture/repository.sync',
                data: {
                  repositoryId: repo.repository_id,
                  repositoryFullName: fullName,
                  source: 'manual-ui',
                  syncMode: 'enhanced'
                }
              },
              {
                name: 'progressive-capture/sync.repository',
                data: {
                  repositoryId: repo.repository_id,
                  repositoryName: fullName,
                  mode: 'recent',
                  source: 'manual-ui'
                }
              }
            ];

            for (const event of events) {
              await sendInngestEvent({
                name: event.name,
                data: event.data
              });
            }

            result.synced.push(fullName);
          } catch (error) {
            console.error(`Failed to sync ${fullName}:`, error);
            result.failed.push(fullName);
          }
        });

        await Promise.all(batchPromises);
        processed += batch.length;
        setSyncProgress(Math.round((processed / reposToSync.length) * 100));

        // Small delay between batches
        if (i + batchSize < reposToSync.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      setSyncResult(result);

      if (result.synced.length > 0) {
        toast({
          title: "Sync triggered successfully",
          description: `Triggered sync for ${result.synced.length} repositories`,
        });
      }

      if (result.failed.length > 0) {
        toast({
          title: "Some syncs failed",
          description: `Failed to sync ${result.failed.length} repositories`,
          variant: "destructive"
        });
      }

      // Reload the list after sync
      setTimeout(() => {
        loadTrackedRepos();
      }, 2000);

    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: "Sync failed",
        description: "An error occurred while syncing repositories",
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Sync Tracked Repositories
        </CardTitle>
        <CardDescription>
          Manually trigger sync for tracked repositories to update their data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{trackedRepos.length}</div>
            <div className="text-sm text-muted-foreground">Total Tracked</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-destructive">
              {trackedRepos.filter(r => !r.last_sync_at).length}
            </div>
            <div className="text-sm text-muted-foreground">Never Synced</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-500">
              {trackedRepos.filter(r => {
                if (!r.last_sync_at) return false;
                const diffHours = (new Date().getTime() - new Date(r.last_sync_at).getTime()) / (1000 * 60 * 60);
                return diffHours > 72;
              }).length}
            </div>
            <div className="text-sm text-muted-foreground">Stale (3+ days)</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-500">{selectedRepos.size}</div>
            <div className="text-sm text-muted-foreground">Selected</div>
          </div>
        </div>

        {/* Selection Controls */}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={selectAll}>
            Select All
          </Button>
          <Button size="sm" variant="outline" onClick={selectNone}>
            Select None
          </Button>
          <Button size="sm" variant="outline" onClick={selectStale}>
            Select Stale
          </Button>
        </div>

        {/* Repository List */}
        <div className="space-y-2 max-h-96 overflow-y-auto border rounded-lg p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : trackedRepos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No tracked repositories found
            </div>
          ) : (
            trackedRepos.map((repo) => {
              const fullName = `${repo.repositories.owner}/${repo.repositories.name}`;
              const status = getSyncStatus(repo.last_sync_at);
              const isSelected = selectedRepos.has(repo.repository_id);
              
              return (
                <div
                  key={repo.repository_id}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    isSelected ? 'bg-muted border-primary' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => toggleRepoSelection(repo.repository_id)}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="h-4 w-4"
                    />
                    <div>
                      <div className="font-medium">{fullName}</div>
                      <div className="text-sm text-muted-foreground">
                        Last sync: {formatLastSync(repo.last_sync_at)}
                      </div>
                    </div>
                  </div>
                  <Badge variant={status.color as any}>
                    {status.label}
                  </Badge>
                </div>
              );
            })
          )}
        </div>

        {/* Sync Progress */}
        {isSyncing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Syncing repositories...</span>
              <span>{syncProgress}%</span>
            </div>
            <Progress value={syncProgress} />
          </div>
        )}

        {/* Sync Results */}
        {syncResult && !isSyncing && (
          <div className="space-y-2">
            {syncResult.synced.length > 0 && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Successfully triggered sync for {syncResult.synced.length} repositories
                </AlertDescription>
              </Alert>
            )}
            {syncResult.failed.length > 0 && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  Failed to sync {syncResult.failed.length} repositories
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={syncSelectedRepos}
            disabled={isSyncing || selectedRepos.size === 0}
            className="flex-1"
          >
            {isSyncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync {selectedRepos.size} Selected Repositories
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={loadTrackedRepos}
            disabled={isLoading || isSyncing}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Info */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Sync jobs are processed by Inngest workers. Large repositories may take several minutes to complete.
            Check the Inngest dashboard for detailed progress.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}