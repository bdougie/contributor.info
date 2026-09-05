import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from '@/components/ui/icon';
import { WorkspaceCreateForm } from '@/components/features/workspace/WorkspaceCreateForm';
import { WorkspaceService } from '@/services/workspace.service';
import { getSupabase } from '@/lib/supabase-lazy';
import { toast } from 'sonner';
import { trackEvent } from '@/lib/posthog-lazy';
import type { CreateWorkspaceRequest } from '@/types/workspace';
import type { User } from '@supabase/supabase-js';
import { getWorkspaceRoute } from '@/lib/utils/workspace-routes';
import { getAppUserId } from '@/lib/auth-helpers';
import { getLoginRoute } from '@/lib/auth/login-redirect';
import {
  parseRepositoryInput,
  readWorkspaceDraft,
  saveWorkspaceDraft,
  clearWorkspaceDraft,
} from '@/lib/utils/workspace-onboarding';

export default function WorkspaceNewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const repository = parseRepositoryInput(new URLSearchParams(location.search).get('repository'));
  const initialValues = useMemo(() => readWorkspaceDraft(repository), [repository]);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [draftSaved, setDraftSaved] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasTrackedPageView = useRef(false);
  const creationStartTime = useRef<number>(Date.now());

  useEffect(() => {
    let active = true;
    // Get the current user when the page loads
    const getUser = async () => {
      try {
        const supabase = await getSupabase();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!active) return;
        setUser(user);

        // Track workspace creation page view
        if (!hasTrackedPageView.current && user) {
          hasTrackedPageView.current = true;
          trackEvent('workspace_creation_started', {
            source: 'workspace_new_page',
            user_id: user.id,
          });
        }
      } catch {
        if (active) setError('Unable to check your session. Sign in to continue.');
      } finally {
        if (active) setAuthLoading(false);
      }
    };

    getUser();
    return () => {
      active = false;
    };
  }, []);

  const handleWorkspaceSubmit = async (data: CreateWorkspaceRequest) => {
    setDraftSaved(saveWorkspaceDraft(repository, data));
    if (!user?.id) {
      setError('You must be logged in to create a workspace');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = await getSupabase();
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      if (!currentUser) {
        setUser(null);
        setError('Your session expired. Sign in to continue with your workspace draft.');
        return;
      }
      // Resolve auth.users.id to app_users.id for workspace operations
      const resolvedUserId = await getAppUserId();
      if (!resolvedUserId) {
        setUser(null);
        setError('Unable to resolve your user account. Please try logging in again.');
        setLoading(false);
        return;
      }

      const response = await WorkspaceService.createWorkspace(
        { appUserId: resolvedUserId, authUserId: currentUser.id },
        data
      );

      if (response.success && response.data) {
        // Track successful workspace creation
        const timeToCreate = Date.now() - creationStartTime.current;
        trackEvent('workspace_created', {
          workspace_id: response.data.id,
          workspace_name: data.name,
          time_to_create_ms: timeToCreate,
          is_first_workspace: true, // This could be enhanced by checking actual count
        });

        // Track if this is the user's first workspace
        const { count } = await supabase
          .from('workspaces')
          .select('*', { count: 'exact', head: true })
          .eq('owner_id', resolvedUserId);

        if (count === 1) {
          trackEvent('first_workspace_created', {
            workspace_id: response.data.id,
            time_to_create_ms: timeToCreate,
          });
        }

        toast.success('Workspace created successfully!');
        // Ensure we have a valid slug before navigating
        const slugOrId = response.data.slug || response.data.id;
        if (!slugOrId) {
          console.error('No slug or ID returned from workspace creation');
          setError('Workspace created but navigation failed. Please refresh the page.');
          return;
        }
        clearWorkspaceDraft(repository);
        const query = repository ? `?${new URLSearchParams({ addRepository: repository })}` : '';
        navigate(`${getWorkspaceRoute(response.data)}${query}`);
      } else {
        setError(response.error || 'Failed to create workspace');

        // Track workspace creation failure
        trackEvent('workspace_creation_failed', {
          error: response.error || 'Unknown error',
          workspace_name: data.name,
        });
      }
    } catch (err) {
      console.error('%s', 'Error creating workspace:', err);
      setError('An unexpected error occurred. Please try again.');

      // Track workspace creation error
      trackEvent('workspace_creation_error', {
        error_type: 'exception',
        workspace_name: data.name,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    clearWorkspaceDraft(repository);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" size="sm" onClick={handleCancel} className="mb-4 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>

          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Create New Workspace</h1>
            <p className="text-muted-foreground">
              Organize your favorite repositories and collaborate with your team. You can add
              repositories and invite members after creating your workspace.
            </p>
          </div>
        </div>

        {/* Main Content Card */}
        <Card>
          <CardHeader>
            <CardTitle>Workspace Details</CardTitle>
          </CardHeader>
          <CardContent>
            {authLoading && (
              <p role="status" className="mb-4 text-sm">
                Checking your session...
              </p>
            )}
            {!authLoading && !user && (
              <div className="mb-4 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Sign in with GitHub before creating your workspace. Your draft will be kept in
                  this tab.
                </p>
                <Button
                  onClick={() => navigate(getLoginRoute(location.pathname + location.search))}
                >
                  Sign in to continue
                </Button>
              </div>
            )}
            {!draftSaved && (
              <p role="alert" className="mb-4 text-sm text-destructive">
                Browser storage is unavailable. Your draft cannot be restored after sign-in or a
                refresh.
              </p>
            )}
            {repository && (
              <p className="mb-4 text-sm">After creation, continue adding {repository}.</p>
            )}
            <WorkspaceCreateForm
              key={repository || 'new'}
              onSubmit={handleWorkspaceSubmit}
              onCancel={handleCancel}
              loading={loading || authLoading}
              submitDisabled={!user}
              initialValues={initialValues}
              onChange={(data) => setDraftSaved(saveWorkspaceDraft(repository, data))}
              error={error}
              mode="create"
            />
          </CardContent>
        </Card>

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Need help? Check out our{' '}
            <Button variant="link" className="p-0 h-auto text-sm" asChild>
              <a
                href="https://docs.contributor.info/workspaces/overview"
                target="_blank"
                rel="noopener noreferrer"
              >
                documentation
              </a>
            </Button>{' '}
            to learn more about workspaces.
          </p>
        </div>
      </div>
    </div>
  );
}
