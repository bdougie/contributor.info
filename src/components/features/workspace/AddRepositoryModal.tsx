import { useState, useCallback, useEffect, useRef } from 'react';
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
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GitHubSearchInput } from '@/components/ui/github-search-input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { WorkspaceService as DefaultWorkspaceService } from '@/services/workspace.service';
import { getSupabase } from '@/lib/supabase-lazy';
import { toast } from 'sonner';
import {
  Package,
  X,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Star,
} from '@/components/ui/icon';
import type { Workspace } from '@/types/workspace';
import type { GitHubRepository } from '@/lib/github';
import { z } from 'zod';
import { waitForRepository } from '@/lib/utils/repository-helpers';
import { getAppUserId } from '@/lib/auth-helpers';
import { useOrgReposForImport } from '@/hooks/use-org-repos-for-import';
import {
  filterEligible,
  capSelection,
  toStagedRepository,
  type OrgImportRepo,
} from '@/lib/utils/org-import';
import { mapWithConcurrency } from '@/lib/utils/concurrency';
import type { SupabaseClient } from '@supabase/supabase-js';

// Use mock supabase in Storybook if available
interface WindowWithMocks extends Window {
  __mockSupabase?: SupabaseClient;
  __mockWorkspaceService?: typeof DefaultWorkspaceService;
}

// Helper to get supabase client (mock in Storybook, lazy otherwise)
async function getSupabaseClient(): Promise<SupabaseClient> {
  if (typeof window !== 'undefined' && (window as WindowWithMocks).__mockSupabase) {
    return (window as WindowWithMocks).__mockSupabase!;
  }
  return getSupabase();
}

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

const GITHUB_APP_INSTALL_URL = 'https://github.com/apps/contributor-info/installations/new';

/**
 * Tracking failure that carries the structured error code from the
 * track-repository API (e.g. app_installation_required for private repos)
 */
class TrackingError extends Error {
  code?: string;
  installUrl?: string;

  constructor(message: string, code?: string, installUrl?: string) {
    super(message);
    this.name = 'TrackingError';
    this.code = code;
    this.installUrl = installUrl;
  }
}

interface StagedRepository extends GitHubRepository {
  notes?: string;
  tags?: string[];
  is_pinned?: boolean;
}

// Extend existing GitHubRepository type for workspace context
interface ExistingRepository extends Omit<
  GitHubRepository,
  'id' | 'owner' | 'private' | 'pushed_at'
> {
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
  const [appUserId, setAppUserId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [stagedRepos, setStagedRepos] = useState<StagedRepository[]>([]);
  const [existingRepoIds, setExistingRepoIds] = useState<Set<string>>(new Set());
  const [existingRepos, setExistingRepos] = useState<ExistingRepository[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingRepoId, setRemovingRepoId] = useState<string | null>(null);
  // Private repos that need the GitHub App installed before they can be added
  const [installNeeded, setInstallNeeded] = useState<{ repos: string[]; url: string } | null>(null);
  const [privateRepoInput, setPrivateRepoInput] = useState('');

  // Org import tab state
  const [orgInput, setOrgInput] = useState('');
  const [orgQuery, setOrgQuery] = useState<string | null>(null);
  const [showForksArchived, setShowForksArchived] = useState(false);
  const autoStagedOrgRef = useRef<string | null>(null);
  const {
    repos: orgRepos,
    appInstalled: orgAppInstalled,
    isLoading: orgLoading,
    error: orgError,
  } = useOrgReposForImport(orgQuery);

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
        const supabase = await getSupabaseClient();

        // Get user and app_users.id
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setError('You must be logged in to add repositories');
          return;
        }

        // Get app_users.id for workspace operations
        const appUserIdValue = await getAppUserId();
        setAppUserId(appUserIdValue);

        if (!appUserIdValue) {
          setError('Unable to verify user permissions. Please try logging in again.');
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

  const handleAddPrivateRepo = useCallback(() => {
    const match = privateRepoInput.trim().match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
    if (!match) {
      setError('Enter the repository as owner/name, e.g. acme/internal-tools');
      setTimeout(() => setError(null), 3000);
      return;
    }
    const [, owner, name] = match;

    // Private repos can't be found via GitHub search with our public-only
    // OAuth scope, so stage them from the typed owner/name — the tracking
    // API verifies access via the GitHub App installation
    handleSelectRepository({
      id: 0,
      name,
      full_name: `${owner}/${name}`,
      owner: { login: owner, avatar_url: `https://github.com/${owner}.png` },
      description: null,
      stargazers_count: 0,
      forks_count: 0,
      private: true,
    });
    setPrivateRepoInput('');
  }, [privateRepoInput, handleSelectRepository]);

  /** A repo row can be checked when it isn't already in the workspace and,
   * if private, the org has the GitHub App installed. */
  const isOrgRepoSelectable = useCallback(
    (repo: OrgImportRepo) =>
      !existingRepoIds.has(repo.fullName) && (!repo.isPrivate || orgAppInstalled),
    [existingRepoIds, orgAppInstalled]
  );

  const handleToggleOrgRepo = useCallback(
    (repo: OrgImportRepo, checked: boolean) => {
      if (checked) {
        handleSelectRepository(toStagedRepository(repo));
      } else {
        setStagedRepos((prev) => prev.filter((r) => r.full_name !== repo.fullName));
      }
    },
    [handleSelectRepository]
  );

  const handleLoadOrg = useCallback(() => {
    const trimmed = orgInput.trim().replace(/^@/, '');
    if (!/^[a-zA-Z0-9-]+$/.test(trimmed)) {
      setError('Enter a GitHub organization name, e.g. papercomputeco');
      setTimeout(() => setError(null), 3000);
      return;
    }
    setOrgQuery(trimmed);
  }, [orgInput]);

  // Pre-select the org's eligible repos (most recently pushed first) up to
  // the remaining workspace slots, once per loaded org
  useEffect(() => {
    if (!orgQuery || orgLoading || orgRepos.length === 0) return;
    if (autoStagedOrgRef.current === orgQuery) return;
    autoStagedOrgRef.current = orgQuery;

    setStagedRepos((prev) => {
      const stagedNames = new Set(prev.map((r) => r.full_name));
      const eligible = filterEligible(orgRepos, false).filter(
        (repo) => isOrgRepoSelectable(repo) && !stagedNames.has(repo.fullName)
      );
      const slotsLeft = remainingSlots - prev.length;
      const toStage = capSelection(eligible, slotsLeft);
      if (toStage.length === 0) return prev;
      toast.success(`Selected ${toStage.length} repositories from ${orgQuery}`);
      return [...prev, ...toStage.map(toStagedRepository)];
    });
  }, [orgQuery, orgLoading, orgRepos, isOrgRepoSelectable, remainingSlots]);

  const handleRemoveFromStaging = useCallback(
    (fullName: string) => {
      setStagedRepos(stagedRepos.filter((r) => r.full_name !== fullName));
    },
    [stagedRepos]
  );

  const handleRemoveFromWorkspace = useCallback(
    async (repoId: string, repoName: string) => {
      if (!appUserId) {
        setError('You must be logged in to remove repositories');
        return;
      }

      // Verify user is workspace owner
      if (workspace?.owner_id !== appUserId) {
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
        const supabase = await getSupabaseClient();

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
    [appUserId, workspace, workspaceId, onSuccess]
  );

  /**
   * Track and resolve a repository ID, starting tracking if needed.
   * Returns the repository ID or throws a user-friendly error.
   */
  const trackAndResolveRepository = useCallback(
    async (supabase: SupabaseClient, repo: StagedRepository): Promise<string> => {
      const owner = repo.owner.login;
      const name = repo.name;

      // Check if repository already exists in our database
      const { data: existingRepo } = await supabase
        .from('repositories')
        .select('id')
        .eq('owner', owner)
        .eq('name', name)
        .maybeSingle();

      if (existingRepo) {
        // Repos registered by the GitHub App installation webhook (e.g. private
        // repos) exist here without being tracked — only short-circuit when
        // tracking is actually set up, otherwise go through the track API
        const { data: trackedRepo } = await supabase
          .from('tracked_repositories')
          .select('id')
          .eq('repository_id', existingRepo.id)
          .eq('tracking_enabled', true)
          .maybeSingle();

        if (trackedRepo) {
          return existingRepo.id;
        }
      }

      // Repository not tracked yet — start tracking via API
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const trackResponse = await fetch('/api/track-repository', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ owner, repo: name }),
      });

      const trackResult = await trackResponse.json();

      // Handle API-level errors with user-friendly messages
      if (!trackResponse.ok) {
        if (trackResult.code === 'app_installation_required') {
          throw new TrackingError(
            `${repo.full_name} is private. Install the contributor.info GitHub App on it to opt in.`,
            trackResult.code,
            trackResult.installUrl || GITHUB_APP_INSTALL_URL
          );
        }
        if (trackResponse.status === 404) {
          throw new TrackingError(
            `${repo.full_name} was not found on GitHub. If it's a private repository, install the contributor.info GitHub App on it first.`,
            trackResult.code,
            trackResult.installUrl || GITHUB_APP_INSTALL_URL
          );
        }
        if (trackResponse.status === 403) {
          throw new Error(`You don't have permission to track ${repo.full_name}.`);
        }
        if (trackResponse.status === 429) {
          throw new Error('Rate limit reached. Please wait a moment and try again.');
        }
        if (trackResponse.status === 503) {
          throw new Error('The tracking service is temporarily unavailable. Please try again.');
        }
        throw new Error(trackResult.message || `Unable to track ${repo.full_name}.`);
      }

      if (trackResult.code === 'installation_pending') {
        // App installed but the webhook hasn't registered the repo yet —
        // wait for the repository row to appear
        return await waitForRepository(owner, name);
      }

      if (trackResult.success && trackResult.repositoryId) {
        return trackResult.repositoryId;
      }

      if (trackResult.success) {
        // Tracking initiated but no ID returned yet — poll for it
        return await waitForRepository(owner, name);
      }

      // trackResult.success is false but HTTP was 200
      throw new Error(trackResult.message || `Unable to track ${repo.full_name}.`);
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    if (!appUserId) {
      setError('You must be logged in to add repositories');
      return;
    }

    if (stagedRepos.length === 0) {
      setError('Please add at least one repository to your selection');
      return;
    }

    setSubmitting(true);
    setError(null);
    setInstallNeeded(null);

    try {
      const supabase = await getSupabaseClient();

      // Track and resolve all repositories (starts tracking for untracked
      // repos), at most 4 in flight to stay under GitHub/API rate limits
      const repoResults = await mapWithConcurrency(
        stagedRepos,
        4,
        async (
          repo
        ): Promise<{
          id: string | null;
          error: string | null;
          trackingError?: unknown;
          repo: StagedRepository;
        }> => {
          try {
            const id = await trackAndResolveRepository(supabase, repo);
            return { id, error: null, repo };
          } catch (err) {
            const message =
              err instanceof Error ? err.message : `Failed to set up ${repo.full_name}`;
            console.error('Error tracking repository %s:', repo.full_name, err);
            return { id: null, error: message, trackingError: err, repo };
          }
        }
      );

      const resolved = repoResults.filter(
        (r): r is { id: string; error: null; repo: StagedRepository } => r.id !== null
      );
      const failed = repoResults.filter((r) => r.id === null);

      // Surface private repos that need the GitHub App with a dedicated
      // install prompt instead of a plain error message
      const installFailures = failed.filter(
        (r) => r.trackingError instanceof TrackingError && r.trackingError.installUrl
      );
      if (installFailures.length > 0) {
        setInstallNeeded({
          repos: installFailures.map((r) => r.repo.full_name),
          url:
            (installFailures[0].trackingError as TrackingError).installUrl ||
            GITHUB_APP_INSTALL_URL,
        });
      }

      // Add all resolved repositories to the workspace in one batch
      let successCount = 0;
      const errors: string[] = failed
        .filter((r) => !installFailures.includes(r))
        .map((r) => r.error!);

      if (resolved.length > 0) {
        const response = await WorkspaceService.addRepositoriesToWorkspace(
          workspaceId,
          appUserId,
          resolved.map((r) => r.id)
        );

        if (response.success && response.data) {
          successCount = response.data.added.length;
          if (response.data.skipped.length > 0) {
            errors.push(
              `${response.data.skipped.length} ${response.data.skipped.length === 1 ? 'repository was' : 'repositories were'} already in this workspace`
            );
          }
        } else {
          errors.push(response.error || 'Failed to add repositories to workspace');
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
  }, [appUserId, workspaceId, stagedRepos, onOpenChange, onSuccess, trackAndResolveRepository]);

  const handleCancel = useCallback(() => {
    if (!submitting) {
      setError(null);
      setInstallNeeded(null);
      setStagedRepos([]);
      setOrgInput('');
      setOrgQuery(null);
      setShowForksArchived(false);
      autoStagedOrgRef.current = null;
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

        {/* Add repositories: search or org import */}
        <Tabs defaultValue="search">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="search">Search</TabsTrigger>
            <TabsTrigger value="org">Import from org</TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-2">
            <GitHubSearchInput
              placeholder="Search for repositories (e.g., facebook/react)"
              onSearch={(query) => {
                // This is for manual search submission
                console.log('%s', `Manual search: ${query}`);
              }}
              onSelect={handleSelectRepository}
              showButton={false}
            />
            <div className="flex gap-2">
              <Input
                value={privateRepoInput}
                onChange={(e) => setPrivateRepoInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddPrivateRepo();
                  }
                }}
                placeholder="owner/repo"
                aria-label="Add a private repository by owner/name"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddPrivateRepo}
                disabled={!privateRepoInput.trim()}
              >
                Add private repo
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Private repositories don't appear in search. Enter owner/name directly — tracking them
              requires installing the contributor.info GitHub App.
            </p>
          </TabsContent>

          <TabsContent value="org" className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={orgInput}
                onChange={(e) => setOrgInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleLoadOrg();
                  }
                }}
                placeholder="Organization name (e.g. papercomputeco)"
                aria-label="GitHub organization name"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleLoadOrg}
                disabled={!orgInput.trim() || orgLoading}
              >
                {orgLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Load repos'}
              </Button>
            </div>

            {orgError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{orgError}</AlertDescription>
              </Alert>
            )}

            {orgQuery && !orgLoading && !orgError && (
              <>
                {orgRepos.some((r) => r.isPrivate) && !orgAppInstalled && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="flex flex-col gap-2">
                      <span>
                        Private repositories in {orgQuery} need the contributor.info GitHub App
                        installed on the org before they can be added.
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-fit gap-1"
                        onClick={() =>
                          window.open(GITHUB_APP_INSTALL_URL, '_blank', 'noopener,noreferrer')
                        }
                      >
                        Install GitHub App
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {filterEligible(orgRepos, showForksArchived).length} repositories in {orgQuery}
                  </span>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="show-forks-archived"
                      checked={showForksArchived}
                      onCheckedChange={setShowForksArchived}
                    />
                    <Label htmlFor="show-forks-archived" className="text-xs">
                      Show forks & archived
                    </Label>
                  </div>
                </div>

                <ScrollArea className="h-[180px] pr-4 border rounded-lg p-2">
                  <div className="space-y-1">
                    {filterEligible(orgRepos, showForksArchived).map((repo) => {
                      const inWorkspace = existingRepoIds.has(repo.fullName);
                      const isStaged = stagedRepos.some((r) => r.full_name === repo.fullName);
                      const selectable = isOrgRepoSelectable(repo);
                      return (
                        <div
                          key={repo.fullName}
                          className={`flex items-center gap-2 p-1.5 rounded ${
                            selectable ? '' : 'opacity-50'
                          }`}
                        >
                          <Checkbox
                            id={`org-repo-${repo.fullName}`}
                            checked={isStaged || inWorkspace}
                            disabled={!selectable || (!isStaged && !canAddMore)}
                            onCheckedChange={(checked) =>
                              handleToggleOrgRepo(repo, checked === true)
                            }
                            aria-label={`Select ${repo.fullName}`}
                          />
                          <label
                            htmlFor={`org-repo-${repo.fullName}`}
                            className="flex-1 min-w-0 flex items-center gap-2 text-sm cursor-pointer"
                          >
                            <span className="truncate font-medium">{repo.name}</span>
                            {repo.isPrivate && (
                              <Badge variant="outline" className="text-xs">
                                private
                              </Badge>
                            )}
                            {repo.isFork && (
                              <Badge variant="secondary" className="text-xs">
                                fork
                              </Badge>
                            )}
                            {repo.isArchived && (
                              <Badge variant="secondary" className="text-xs">
                                archived
                              </Badge>
                            )}
                            {inWorkspace && (
                              <Badge variant="secondary" className="text-xs">
                                added
                              </Badge>
                            )}
                            <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                              <Star className="h-3 w-3" />
                              {repo.stargazersCount.toLocaleString()}
                            </span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </>
            )}
          </TabsContent>
        </Tabs>

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

        {/* GitHub App install prompt for private repositories */}
        {installNeeded && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex flex-col gap-2">
              <span>
                {installNeeded.repos.join(', ')}{' '}
                {installNeeded.repos.length === 1
                  ? 'is a private repository'
                  : 'are private repositories'}
                . Install the contributor.info GitHub App on{' '}
                {installNeeded.repos.length === 1 ? 'it' : 'them'} to opt in, then add{' '}
                {installNeeded.repos.length === 1 ? 'it' : 'them'} again.
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-fit gap-1"
                onClick={() => window.open(installNeeded.url, '_blank', 'noopener,noreferrer')}
              >
                Install GitHub App
                <ExternalLink className="h-3 w-3" />
              </Button>
            </AlertDescription>
          </Alert>
        )}

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
                Setting up {stagedRepos.length}{' '}
                {stagedRepos.length === 1 ? 'repository' : 'repositories'}...
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
