import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Crown, LogIn, Plus, Loader2, AlertCircle } from '@/components/ui/icon';
import { getWorkspaceRoute } from '@/lib/utils/workspace-routes';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { WorkspaceService } from '@/services/workspace.service';
import { useUserWorkspaces } from '@/hooks/use-user-workspaces';
import { useSubscriptionLimits } from '@/hooks/use-subscription-limits';
import { useGitHubAuth } from '@/hooks/use-github-auth';
import type { User } from '@supabase/supabase-js';

interface AddToWorkspaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  owner: string;
  repo: string;
}

export function AddToWorkspaceModal({ open, onOpenChange, owner, repo }: AddToWorkspaceModalProps) {
  const navigate = useNavigate();
  const { isLoggedIn } = useGitHubAuth();
  const [user, setUser] = useState<User | null>(null);
  const { workspaces, loading: workspacesLoading } = useUserWorkspaces();
  const { tier, canCreateWorkspace, loading: limitsLoading } = useSubscriptionLimits();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [repoId, setRepoId] = useState<string | undefined>();
  const [lookingUpRepo, setLookingUpRepo] = useState(false);

  const isProUser = tier === 'pro' || tier === 'team' || tier === 'enterprise';
  const loading = workspacesLoading || limitsLoading || lookingUpRepo;

  useEffect(() => {
    const getUser = async () => {
      if (open && isLoggedIn) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setUser(user);
      }
    };
    getUser();
  }, [open, isLoggedIn]);

  useEffect(() => {
    const lookupRepositoryId = async () => {
      if (open && owner && repo) {
        setLookingUpRepo(true);
        setRepoId(undefined); // Reset on each lookup

        try {
          // Try to find the repository with retries
          let attempts = 0;
          const maxAttempts = 3;

          while (attempts < maxAttempts) {
            const { data } = await supabase
              .from('repositories')
              .select('id')
              .eq('owner', owner)
              .eq('name', repo)
              .maybeSingle();

            if (data?.id) {
              setRepoId(data.id);
              break;
            }

            // If not found and not the last attempt, wait and retry
            if (!data && attempts < maxAttempts - 1) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }

            attempts++;
          }

          if (attempts === maxAttempts) {
            console.warn(
              `Repository ${owner}/${repo} not found in database after ${maxAttempts} attempts`
            );
          }
        } catch (error) {
          console.error('Error looking up repository:', error);
        } finally {
          setLookingUpRepo(false);
        }
      }
    };
    lookupRepositoryId();
  }, [open, owner, repo]);

  const handleLogin = useCallback(async () => {
    try {
      const redirectTo = window.location.href;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo,
          scopes: 'public_repo read:user user:email',
        },
      });

      if (error) {
        console.error('Authentication error:', error);
        toast.error('Failed to start authentication. Please try again.');
      } else {
        onOpenChange(false);
      }
    } catch (err) {
      console.error('Unexpected authentication error:', err);
      toast.error('Failed to start authentication. Please try again.');
    }
  }, [onOpenChange]);

  const handleUpgrade = useCallback(() => {
    onOpenChange(false);
    navigate('/billing');
  }, [navigate, onOpenChange]);

  const handleAddToWorkspace = useCallback(async () => {
    if (!selectedWorkspaceId || !user || !repoId) {
      toast.error('Missing required information. Please try again.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await WorkspaceService.addRepositoryToWorkspace(selectedWorkspaceId, user.id, {
        repository_id: repoId,
        is_pinned: false,
      });

      if (result.success) {
        toast.success(`Added ${owner}/${repo} to workspace successfully!`);
        onOpenChange(false);

        const selectedWorkspace = workspaces.find((w) => w.id === selectedWorkspaceId);
        if (selectedWorkspace) {
          navigate(getWorkspaceRoute(selectedWorkspace));
        }
      } else {
        toast.error(result.error || 'Failed to add repository to workspace');
      }
    } catch (error) {
      console.error('Error adding repository to workspace:', error);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedWorkspaceId, user, repoId, owner, repo, workspaces, navigate, onOpenChange]);

  const handleWorkspaceSelect = (value: string) => {
    if (value === 'new') {
      onOpenChange(false);
      navigate('/workspaces/new');
    } else {
      setSelectedWorkspaceId(value);
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!isLoggedIn) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-muted">
              <LogIn className="w-6 h-6 text-muted-foreground" />
            </div>
            <DialogTitle className="text-center">Login Required</DialogTitle>
            <DialogDescription className="text-center">
              Please log in to add repositories to workspaces. Note that a Pro account is required
              for workspace creation and management.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="justify-center">
            <Button onClick={handleLogin} variant="default">
              <LogIn className="w-4 h-4 mr-2" />
              Login to Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (!isProUser) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-muted">
              <Crown className="w-6 h-6 text-muted-foreground" />
            </div>
            <DialogTitle className="text-center">Subscription Required</DialogTitle>
            <DialogDescription className="text-center">
              Workspace features require a paid subscription. Upgrade your account to create and
              manage workspaces, track multiple repositories, and collaborate with your team.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="justify-center">
            <Button onClick={handleUpgrade} variant="default">
              <Crown className="w-4 h-4 mr-2" />
              Upgrade to Pro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (!repoId) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Repository Not Yet Available</DialogTitle>
            <DialogDescription>
              We're still processing{' '}
              <strong>
                {owner}/{repo}
              </strong>
              . This usually takes a few moments.
            </DialogDescription>
          </DialogHeader>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              The repository data is being indexed. Please try again in a few seconds, or refresh
              the page to check the current status.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={() => window.location.reload()}>Refresh Page</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to Workspace</DialogTitle>
          <DialogDescription>
            Add{' '}
            <strong>
              {owner}/{repo}
            </strong>{' '}
            to one of your workspaces or create a new one.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="workspace-select" className="text-sm font-medium">
              Select Workspace
            </label>
            <Select value={selectedWorkspaceId} onValueChange={handleWorkspaceSelect}>
              <SelectTrigger id="workspace-select">
                <SelectValue placeholder="Choose a workspace..." />
              </SelectTrigger>
              <SelectContent>
                {canCreateWorkspace && (
                  <SelectItem value="new">
                    <div className="flex items-center">
                      <Plus className="w-4 h-4 mr-2" />
                      Create new workspace...
                    </div>
                  </SelectItem>
                )}
                {workspaces.map((workspace) => (
                  <SelectItem key={workspace.id} value={workspace.id}>
                    {workspace.name}
                    {workspace.repository_count > 0 && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({workspace.repository_count}{' '}
                        {workspace.repository_count === 1 ? 'repo' : 'repos'})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {workspaces.length === 0 && !canCreateWorkspace && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You don't have any workspaces yet. You've reached your workspace limit.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAddToWorkspace}
            disabled={!selectedWorkspaceId || isSubmitting || lookingUpRepo || !repoId}
          >
            {(() => {
              if (isSubmitting) {
                return (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding...
                  </>
                );
              }
              if (lookingUpRepo) {
                return (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Looking up repository...
                  </>
                );
              }
              return 'Add to Workspace';
            })()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
