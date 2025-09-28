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
import { z } from 'zod';
import {
  createRepositoryFallback,
  waitForRepository,
  type ExtendedGitHubRepository
} from '@/lib/utils/repository-helpers';

// Use mock supabase in Storybook if available
interface WindowWithMocks extends Window {
  __mockSupabase?: typeof defaultSupabase;
  __mockWorkspaceService?: typeof DefaultWorkspaceService;
}

const supabase =
  typeof window !== 'undefined' && (window as WindowWithMocks).__mockSupabase
    ? (window as WindowWithMocks).__mockSupabase!
    : defaultSupabase;

// Use mock WorkspaceService in Storybook if available
const WorkspaceService =
  typeof window !== 'undefined' && (window as WindowWithMocks).__mockWorkspaceService
    ? (window as WindowWithMocks).__mockWorkspaceService!
    : DefaultWorkspaceService;

// Tier configuration
const TIER_LIMITS = {
  free: 4,
  pro: 10,
  enterprise: 100,
} as const;

interface StagedRepository extends GitHubRepository {
  notes?: string;
  tags?: string[];
  is_pinned?: boolean;
}

// Extend existing GitHubRepository type for workspace context
interface ExistingRepository
  extends Omit<GitHubRepository, 'id' | 'owner' | 'private' | 'pushed_at'> {
  id: string; // Database stores ID as string
  owner: string; // Simplified from GitHubRepository's owner object
  workspace_repo_id?: string;
  is_pinned?: boolean;
}

// Type for workspace repository query result
// Removed WorkspaceRepoQueryResult - now using Zod schema validation instead

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
  onSuccess,
}: AddRepositoryModalProps) {
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [stagedRepos, setStagedRepos] = useState<StagedRepository[]>([]);
  const [existingRepoIds, setExistingRepoIds] = useState<Set<string>>(new Set());
  const [existingRepos, setExistingRepos] = useState<ExistingRepository[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingRepoId, setRemovingRepoId] = useState<string | null>(null);

  // Calculate limits
  const isFreeTier = workspace?.tier === 'free';
  // Use the correct limits based on tier from configuration
  const tier = workspace?.tier || 'free';
  const maxRepos = TIER_LIMITS[tier as keyof typeof TIER_LIMITS] || TIER_LIMITS.free;
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
        const {
          data: { user },
        } = await supabase.auth.getUser();
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
          .maybeSingle();

        if (workspaceData) {
          setWorkspace(workspaceData);
        }

        // Get existing repositories in workspace with full details
        const { data: existingWorkspaceRepos } = await supabase
          .from('workspace_repositories')
          .select(
            `
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
          `
          )
          .eq('workspace_id', workspaceId);

        if (existingWorkspaceRepos) {
          // Use Zod to validate the query result instead of casting
          const workspaceRepoSchema = z.array(
            z.object({
              repository_id: z.string(),
              is_pinned: z.boolean().nullable().optional(),
              repositories: z
                .object({
                  id: z.string(),
                  full_name: z.string(),
                  name: z.string(),
                  owner: z.string(),
                  description: z.string().nullable(),
                  language: z.string().nullable(),
                  stargazers_count: z.number(),
                  forks_count: z.number(),
                })
                .nullable(),
            })
          );

          const validationResult = workspaceRepoSchema.safeParse(existingWorkspaceRepos);
          if (!validationResult.success) {
            console.error('%s %o', 'Invalid workspace repos data:', validationResult.error);
            return [];
          }

          const repos = validationResult.data
            .filter((r) => r.repositories)
            .map(
              (r): ExistingRepository => ({
                ...r.repositories!,
                workspace_repo_id: r.repository_id,
                is_pinned: r.is_pinned ?? false,
              })
            );

          setExistingRepos(repos);
          setExistingRepoIds(new Set(repos.map((r) => r.full_name)));
        }
      } catch (err) {
        console.error('%s %o', 'Error initializing modal:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(`Failed to load workspace details: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, [open, workspaceId]);

  const handleSelectRepository = useCallback(
    (repo: GitHubRepository) => {
      // Check if already in workspace
      if (existingRepoIds.has(repo.full_name)) {
        setError(`${repo.full_name} is already in this workspace`);
        setTimeout(() => setError(null), 3000);
        return;
      }

      // Check if already staged
      if (stagedRepos.some((r) => r.full_name === repo.full_name)) {
        setError(`${repo.full_name} is already in your selection`);
        setTimeout(() => setError(null), 3000);
        return;
      }

      // Check if we have room
      if (!canAddMore) {
        setError(
          `Repository limit reached. Maximum ${maxRepos} repositories allowed for ${workspace?.tier || 'free'} tier.`
        );
        return;
      }

      // Add to staging
      setStagedRepos([...stagedRepos, repo]);
      toast.success(`Added ${repo.full_name} to selection`);
    },
    [stagedRepos, existingRepoIds, canAddMore, maxRepos, workspace?.tier]
  );

  const handleRemoveFromStaging = useCallback(
    (fullName: string) => {
      setStagedRepos(stagedRepos.filter((r) => r.full_name !== fullName));
    },
    [stagedRepos]
  );

  const handleRemoveFromWorkspace = useCallback(
    async (repoId: string, repoName: string) => {
      if (!user?.id) {
        setError('You must be logged in to remove repositories');
        return;
      }

      // Verify user is workspace owner
      if (workspace?.owner_id !== user.id) {
        setError('Only workspace owners can remove repositories');
        return;
      }

      // Confirm removal with user
      const confirmed = window.confirm(
        `Are you sure you want to remove ${repoName} from this workspace? This action cannot be undone.`
      );

      if (!confirmed) {
        return;
      }

      setRemovingRepoId(repoId);
      try {
        // Remove from workspace (RLS policies should also enforce ownership)
        const { error: removeError } = await supabase
          .from('workspace_repositories')
          .delete()
          .eq('workspace_id', workspaceId)
          .eq('repository_id', repoId);

        if (removeError) {
          throw removeError;
        }

        // Update local state only after successful removal
        setExistingRepos((prevRepos) => prevRepos.filter((r) => r.id !== repoId));
        setExistingRepoIds((prev) => {
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
        console.error('%s %o', 'Error removing repository:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        toast.error(`Failed to remove ${repoName}: ${errorMessage}`);
      } finally {
        setRemovingRepoId(null);
      }
    },
    [user, workspace, workspaceId, onSuccess]
  );

  const handleSubmit = useCallback(async () => {
    if (!user?.id) {
      setError('You must be logged in to add repositories');
      return;
    }

    if (stagedRepos.length === 0) {
      setError('Please add at least one repository to your selection');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // First, we need to ensure these repositories are tracked in our system
      const repoPromises = stagedRepos.map(async (repo) => {
        try {
          // First check if repository already exists in our database
          const { data: existingRepo } = await supabase
            .from('repositories')
            .select('id')
            .eq('owner', repo.owner.login)
            .eq('name', repo.name)
            .maybeSingle();

          if (existingRepo) {
            return existingRepo.id;
          }

          // Try to track via API endpoint for proper GitHub data
          try {
            const trackResponse = await fetch('/api/track-repository', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include',
              body: JSON.stringify({
                owner: repo.owner.login,
                repo: repo.name,
              }),
            });

            // Check if API is unavailable (common in local dev without GitHub token)
            if (trackResponse.status === 503) {
              console.log('Track API unavailable (likely missing GitHub token), using direct database creation');
              throw new Error('API unavailable - using fallback');
            }

            const trackResult = await trackResponse.json();

            if (trackResult.success) {
              // If we have a repositoryId in the response, use it
              if (trackResult.repositoryId) {
                return trackResult.repositoryId;
              }

              // Otherwise, wait for repository to be created with exponential backoff
              try {
                const repoId = await waitForRepository(repo.owner.login, repo.name);
                return repoId;
              } catch (error) {
                console.error('Failed to find repository after tracking:', error);
              }
            } else if (trackResult.message?.includes('already being tracked')) {
              // Repository is already tracked, wait for it with exponential backoff
              try {
                const repoId = await waitForRepository(repo.owner.login, repo.name);
                return repoId;
              } catch (error) {
                console.error('Failed to find already tracked repository:', error);
              }
            }
          } catch (apiError) {
            // In local development without GitHub token, this is expected
            const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown error';
            if (errorMessage !== 'API unavailable - using fallback') {
              console.info('Track API unavailable, using direct database creation instead');
            }
          }

          // Fallback: Create repository directly if API fails (e.g., in development without GitHub token)
          const extendedRepo = repo as ExtendedGitHubRepository;

          const { data: newRepo, error: createError } = await createRepositoryFallback(
            repo.owner.login,
            repo.name,
            extendedRepo
          );

          if (createError) {
            const errorMessage = createError instanceof Error ? createError.message : 'Unknown error';
            console.error('Error creating repository %s:', repo.full_name, createError);
            throw new Error(`Failed to add ${repo.full_name}: ${errorMessage}`);
          }

          if (!newRepo) {
            throw new Error(`Failed to create repository ${repo.full_name}`);
          }

          return newRepo.id;
        } catch (error) {
          console.error('Error processing repository %s:', repo.full_name, error);
          // Return null to indicate failure but don't throw to allow other repos to process
          return null;
        }
      });

      const repositoryResults = await Promise.all(repoPromises);
      const repositoryIds = repositoryResults.filter((id): id is string => id !== null);

      // Track which repositories failed to process
      const failedRepos = stagedRepos.filter((_, index) => repositoryResults[index] === null);

      // Now add all repositories to the workspace
      let successCount = 0;
      const errors: string[] = failedRepos.map(r => `Failed to process ${r.full_name}`);

      // Create a map of successful repository IDs to their staged repos
      const successfulRepos = repositoryIds.map(id => {
        const index = repositoryResults.findIndex(r => r === id);
        return { id, repo: stagedRepos[index] };
      });

      for (const { id: repoId, repo: stagedRepo } of successfulRepos) {

        const response = await WorkspaceService.addRepositoryToWorkspace(workspaceId, user.id, {
          repository_id: repoId,
          notes: stagedRepo.notes,
          tags: stagedRepo.tags,
          is_pinned: stagedRepo.is_pinned,
        });

        if (response.success) {
          successCount++;
        } else {
          errors.push(`${stagedRepo.full_name}: ${response.error}`);
        }
      }

      if (successCount > 0) {
        toast.success(
          `Successfully added ${successCount} ${successCount === 1 ? 'repository' : 'repositories'} to workspace!`
        );

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
      console.error('%s %o', 'Error adding repositories to workspace:', err);
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
        <div
          className="flex items-center justify-between p-3 bg-muted rounded-lg"
          role="status"
          aria-live="polite"
        >
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
              console.log('%s', `Manual search: ${query}`);
            }}
            onSelect={handleSelectRepository}
            showButton={false}
          />
        </div>

        {/* Existing Repositories Section */}
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2 text-sm text-muted-foreground">Loading repositories...</span>
          </div>
        ) : (
          existingRepos.length > 0 && (
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
                            <span className="text-sm font-medium truncate">{repo.full_name}</span>
                            {repo.is_pinned && (
                              <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            {repo.language && (
                              <span className="text-xs text-muted-foreground">{repo.language}</span>
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
                          disabled={removingRepoId === repo.id || removingRepoId !== null}
                          className="ml-2 text-destructive hover:text-destructive"
                          aria-label={`Remove ${repo.full_name} from workspace`}
                          title={`Remove ${repo.full_name} from workspace`}
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
          )
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
              <Button variant="ghost" size="sm" onClick={() => setStagedRepos([])}>
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
                        <span className="font-medium text-sm truncate">{repo.full_name}</span>
                      </div>
                      {repo.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {repo.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        {repo.language && (
                          <span className="text-xs text-muted-foreground">{repo.language}</span>
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
                      aria-label={`Remove ${repo.full_name} from selection`}
                      title="Remove from selection"
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
          <Button variant="outline" onClick={handleCancel} disabled={submitting}>
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
                Adding {stagedRepos.length}{' '}
                {stagedRepos.length === 1 ? 'Repository' : 'Repositories'}...
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
