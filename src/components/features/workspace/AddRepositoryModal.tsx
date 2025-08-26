import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GitHubSearchInput } from '@/components/ui/github-search-input';
import { WorkspaceService as DefaultWorkspaceService } from '@/services/workspace.service';
import { supabase as defaultSupabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Package, X, AlertCircle, CheckCircle2, Loader2, Star } from '@/components/ui/icon';
import type { Workspace } from '@/types/workspace';
import type { GitHubRepository } from '@/lib/github';
import type { User } from '@supabase/supabase-js';

// Use mock supabase in Storybook if available
const supabase = (typeof window !== 'undefined' && (window as any).__mockSupabase) 
  ? (window as any).__mockSupabase 
  : defaultSupabase;

// Use mock WorkspaceService in Storybook if available
const WorkspaceService = (typeof window !== 'undefined' && (window as any).__mockWorkspaceService)
  ? (window as any).__mockWorkspaceService
  : DefaultWorkspaceService;

interface StagedRepository extends GitHubRepository {
  notes?: string;
  tags?: string[];
  is_pinned?: boolean;
}

export interface AddRepositoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onSuccess?: () => void;
}

export function AddRepositoryModal({ 
  open, 
  onOpenChange,
  workspaceId,
  onSuccess
}: AddRepositoryModalProps) {
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [stagedRepos, setStagedRepos] = useState<StagedRepository[]>([]);
  const [existingRepoIds, setExistingRepoIds] = useState<Set<string>>(new Set());
  const [existingRepos, setExistingRepos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingRepoId, setRemovingRepoId] = useState<string | null>(null);

  // Calculate limits
  const isFreeTier = workspace?.tier === 'free';
  // Use the correct limits based on tier
  const maxRepos = isFreeTier ? 4 : (workspace?.tier === 'pro' ? 50 : 1000);
  // Use the actual count of existing repos instead of relying on database field
  const currentRepoCount = existingRepos.length;
  const remainingSlots = maxRepos - currentRepoCount;
  const canAddMore = stagedRepos.length < remainingSlots;

  useEffect(() => {
    // Get the current user and workspace details when the modal opens
    const initialize = async () => {
      if (!open) return;

      setLoading(true);
      setError(null);

      try {
        // Get user
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);

        if (!user) {
          setError('You must be logged in to add repositories');
          return;
        }

        // Get workspace details
        const { data: workspaceData } = await supabase
          .from('workspaces')
          .select('*')
          .eq('id', workspaceId)
          .single();

        if (workspaceData) {
          setWorkspace(workspaceData);
        }

        // Get existing repositories in workspace with full details
        const { data: existingWorkspaceRepos } = await supabase
          .from('workspace_repositories')
          .select(`
            repository_id,
            is_pinned,
            repositories (
              id,
              full_name,
              name,
              owner,
              description,
              language,
              stargazers_count,
              forks_count
            )
          `)
          .eq('workspace_id', workspaceId);

        if (existingWorkspaceRepos) {
          const repos = existingWorkspaceRepos
            .filter((r: any) => r.repositories)
            .map((r: any) => ({
              ...r.repositories,
              workspace_repo_id: r.repository_id,
              is_pinned: r.is_pinned
            }));
          
          setExistingRepos(repos);
          setExistingRepoIds(new Set(repos.map((r: any) => r.full_name)));
        }
      } catch (err) {
        console.error('Error initializing modal:', err);
        setError('Failed to load workspace details');
      } finally {
        setLoading(false);
      }
    };
    
    initialize();
  }, [open, workspaceId]);

  const handleSelectRepository = useCallback((repo: GitHubRepository) => {
    // Check if already in workspace
    if (existingRepoIds.has(repo.full_name)) {
      toast.warning(`${repo.full_name} is already in this workspace`);
      return;
    }

    // Check if already staged
    if (stagedRepos.some(r => r.full_name === repo.full_name)) {
      toast.info(`${repo.full_name} is already in your cart`);
      return;
    }

    // Check if we have room
    if (!canAddMore) {
      toast.error(`Repository limit reached. Maximum ${maxRepos} repositories allowed.`);
      return;
    }

    // Add to staging
    setStagedRepos([...stagedRepos, repo]);
    toast.success(`Added ${repo.full_name} to cart`);
  }, [stagedRepos, existingRepoIds, canAddMore, maxRepos]);

  const handleRemoveFromStaging = useCallback((fullName: string) => {
    setStagedRepos(stagedRepos.filter(r => r.full_name !== fullName));
  }, [stagedRepos]);

  const handleRemoveFromWorkspace = useCallback(async (repoId: string, repoName: string) => {
    if (!user?.id) {
      setError('You must be logged in to remove repositories');
      return;
    }

    setRemovingRepoId(repoId);
    try {
      // Remove from workspace
      const { error: removeError } = await supabase
        .from('workspace_repositories')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('repository_id', repoId);

      if (removeError) {
        throw removeError;
      }

      // Update local state
      setExistingRepos(existingRepos.filter(r => r.id !== repoId));
      setExistingRepoIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(repoName);
        return newSet;
      });

      toast.success(`Removed ${repoName} from workspace`);
      
      // Call success callback to refresh parent
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Error removing repository:', err);
      toast.error(`Failed to remove ${repoName} from workspace`);
    } finally {
      setRemovingRepoId(null);
    }
  }, [user, workspaceId, existingRepos, onSuccess]);

  const handleSubmit = useCallback(async () => {
    if (!user?.id) {
      setError('You must be logged in to add repositories');
      return;
    }

    if (stagedRepos.length === 0) {
      toast.warning('Please add at least one repository to your cart');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // First, we need to ensure these repositories are tracked in our system
      const repoPromises = stagedRepos.map(async (repo) => {
        // Check if repository exists in our database
        const { data: existingRepo } = await supabase
          .from('repositories')
          .select('id')
          .eq('full_name', repo.full_name)
          .single();

        if (existingRepo) {
          return existingRepo.id;
        }

        // If not, create it
        const { data: newRepo, error: createError } = await supabase
          .from('repositories')
          .insert({
            github_id: repo.id,
            full_name: repo.full_name,
            name: repo.name,
            owner: repo.owner.login,
            description: repo.description,
            language: repo.language,
            stargazers_count: repo.stargazers_count,
            forks_count: repo.forks_count,
            is_tracked: true,
            is_active: true,
          })
          .select('id')
          .single();

        if (createError) {
          console.error('Error creating repository:', createError);
          throw new Error(`Failed to add ${repo.full_name}`);
        }

        return newRepo.id;
      });

      const repositoryIds = await Promise.all(repoPromises);

      // Now add all repositories to the workspace
      let successCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < repositoryIds.length; i++) {
        const repoId = repositoryIds[i];
        const stagedRepo = stagedRepos[i];

        const response = await WorkspaceService.addRepositoryToWorkspace(
          workspaceId,
          user.id,
          {
            repository_id: repoId,
            notes: stagedRepo.notes,
            tags: stagedRepo.tags,
            is_pinned: stagedRepo.is_pinned,
          }
        );

        if (response.success) {
          successCount++;
        } else {
          errors.push(`${stagedRepo.full_name}: ${response.error}`);
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully added ${successCount} ${successCount === 1 ? 'repository' : 'repositories'} to workspace!`);
        
        // Clear staging area
        setStagedRepos([]);
        
        // Call success callback
        if (onSuccess) {
          onSuccess();
        }

        // Close modal if all succeeded
        if (errors.length === 0) {
          onOpenChange(false);
        }
      }

      if (errors.length > 0) {
        setError(errors.join('\n'));
      }
    } catch (err) {
      console.error('Error adding repositories to workspace:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [user, workspaceId, stagedRepos, onOpenChange, onSuccess]);

  const handleCancel = useCallback(() => {
    if (!submitting) {
      setError(null);
      setStagedRepos([]);
      onOpenChange(false);
    }
  }, [submitting, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Manage Workspace Repositories
          </DialogTitle>
          <DialogDescription>
            Add new repositories or remove existing ones from your workspace. 
            {isFreeTier && ` Free tier is limited to ${maxRepos} repositories.`}
          </DialogDescription>
        </DialogHeader>

        {/* Tier Limit Display */}
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Repository Slots:</span>
            <Badge variant={remainingSlots <= 2 ? 'destructive' : 'secondary'}>
              {currentRepoCount} / {maxRepos} used
            </Badge>
          </div>
          {isFreeTier && (
            <Badge variant="outline" className="gap-1">
              <AlertCircle className="h-3 w-3" />
              Free Tier
            </Badge>
          )}
        </div>

        {/* Search Section */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Search GitHub</label>
          <GitHubSearchInput
            placeholder="Search for repositories (e.g., facebook/react)"
            onSearch={(query) => {
              // This is for manual search submission
              console.log('Manual search:', query);
            }}
            onSelect={handleSelectRepository}
            showButton={false}
          />
        </div>

        {/* Existing Repositories Section */}
        {existingRepos.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Current Workspace Repositories</h3>
                <Badge variant="outline">{existingRepos.length} repositories</Badge>
              </div>
              <ScrollArea className="h-[150px] pr-4">
                <div className="space-y-2">
                  {existingRepos.map((repo) => (
                    <div
                      key={repo.id}
                      className="flex items-start justify-between p-2 rounded-lg border bg-muted/30"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {repo.full_name}
                          </span>
                          {repo.is_pinned && (
                            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          {repo.language && (
                            <span className="text-xs text-muted-foreground">
                              {repo.language}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Star className="h-3 w-3" />
                            {repo.stargazers_count?.toLocaleString() || 0}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveFromWorkspace(repo.id, repo.full_name)}
                        disabled={removingRepoId === repo.id}
                        className="ml-2 text-destructive hover:text-destructive"
                      >
                        {removingRepoId === repo.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </>
        )}

        <Separator />

        {/* Shopping Cart Section */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium flex items-center gap-2">
              <Package className="h-4 w-4" />
              Selected Repositories ({stagedRepos.length})
            </h3>
            {stagedRepos.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStagedRepos([])}
              >
                Clear All
              </Button>
            )}
          </div>

          {stagedRepos.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No repositories selected</p>
                <p className="text-xs mt-1">Search and select repositories above</p>
              </div>
            </div>
          ) : (
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-2">
                {stagedRepos.map((repo) => (
                  <div
                    key={repo.full_name}
                    className="flex items-start justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <img
                          src={repo.owner.avatar_url}
                          alt={repo.owner.login}
                          className="h-5 w-5 rounded"
                        />
                        <span className="font-medium text-sm truncate">
                          {repo.full_name}
                        </span>
                      </div>
                      {repo.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {repo.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        {repo.language && (
                          <span className="text-xs text-muted-foreground">
                            {repo.language}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Star className="h-3 w-3" />
                          {repo.stargazers_count.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveFromStaging(repo.full_name)}
                      className="ml-2"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
          </Alert>
        )}

        {/* Warning if approaching limit */}
        {!error && remainingSlots > 0 && remainingSlots <= stagedRepos.length && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You're about to use all remaining repository slots. 
              {isFreeTier && ' Upgrade to Pro for unlimited repositories.'}
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || stagedRepos.length === 0 || loading}
            className="gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Adding {stagedRepos.length} {stagedRepos.length === 1 ? 'Repository' : 'Repositories'}...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Add {stagedRepos.length} {stagedRepos.length === 1 ? 'Repository' : 'Repositories'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}