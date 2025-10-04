import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { WorkspaceCreateForm } from './WorkspaceCreateForm';
import { WorkspaceCreationDisabled } from './WorkspaceCreationDisabled';
import { WorkspaceService } from '@/services/workspace.service';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAnalytics } from '@/hooks/use-analytics';
import { getWorkspaceRoute } from '@/lib/utils/workspace-routes';
import { useFeatureFlags } from '@/lib/feature-flags/context';
import { FEATURE_FLAGS } from '@/lib/feature-flags/types';
import type { CreateWorkspaceRequest } from '@/types/workspace';
import type { User } from '@supabase/supabase-js';

export interface WorkspaceCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (workspaceSlug: string) => void;
  mode?: 'create' | 'edit';
  initialValues?: Partial<CreateWorkspaceRequest>;
  workspaceId?: string;
  source?: 'home' | 'settings' | 'onboarding';
}

export function WorkspaceCreateModal({
  open,
  onOpenChange,
  onSuccess,
  mode = 'create',
  initialValues,
  workspaceId,
  source = 'home',
}: WorkspaceCreateModalProps) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { trackWorkspaceCreated, trackWorkspaceSettingsModified } = useAnalytics();
  const { checkFlag } = useFeatureFlags();

  // Check if workspace creation is enabled
  const canCreateWorkspaces = checkFlag(FEATURE_FLAGS.ENABLE_WORKSPACE_CREATION);

  useEffect(() => {
    // Get the current user when the modal opens
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    };

    if (open) {
      getUser();
    }
  }, [open]);

  const handleRequestAccess = useCallback(async () => {
    if (!user) {
      // For logged-out users, trigger GitHub OAuth sign-in
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
        }
      } catch (err) {
        console.error('Unexpected authentication error:', err);
        toast.error('Failed to start authentication. Please try again.');
      }
      onOpenChange(false);
    } else {
      // For logged-in users without pro access, show generic message
      toast.success(
        "Thanks for your interest! We'll notify you when workspace creation is available."
      );
      onOpenChange(false);
    }
  }, [user, onOpenChange]);

  const handleWorkspaceSubmit = useCallback(
    async (data: CreateWorkspaceRequest) => {
      // Additional feature flag check during submission
      if (mode === 'create' && !canCreateWorkspaces) {
        setError('Workspace creation is currently disabled');
        return;
      }

      if (!user?.id) {
        setError(`You must be logged in to ${mode === 'create' ? 'create' : 'edit'} a workspace`);
        return;
      }

      // Check for workspaceId when in edit mode
      if (mode === 'edit' && !workspaceId) {
        setError('Workspace ID is required for editing');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        let response;

        if (mode === 'create') {
          response = await WorkspaceService.createWorkspace(user.id, data);
        } else {
          // workspaceId is guaranteed to be defined here due to the check above
          response = await WorkspaceService.updateWorkspace(workspaceId!, user.id, data);
        }

        if (response.success && response.data) {
          // Track workspace creation or update
          if (mode === 'create') {
            trackWorkspaceCreated(source);
          } else {
            trackWorkspaceSettingsModified('general');
          }

          toast.success(
            mode === 'create'
              ? 'Workspace created successfully!'
              : 'Workspace updated successfully!'
          );
          onOpenChange(false);

          // Call optional success callback
          if (onSuccess) {
            onSuccess(response.data.slug);
          }

          // Navigate to the workspace if creating new one
          if (mode === 'create') {
            navigate(getWorkspaceRoute(response.data));
          }
        } else {
          setError(
            response.error || `Failed to ${mode === 'create' ? 'create' : 'update'} workspace`
          );
        }
      } catch (err) {
        console.error(`Error ${mode === 'create' ? 'creating' : 'updating'} workspace:`, err);
        setError('An unexpected error occurred. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [
      user,
      navigate,
      onOpenChange,
      onSuccess,
      mode,
      workspaceId,
      source,
      trackWorkspaceCreated,
      trackWorkspaceSettingsModified,
      canCreateWorkspaces,
    ]
  );

  const handleCancel = useCallback(() => {
    if (!loading) {
      setError(null);
      onOpenChange(false);
    }
  }, [loading, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        {mode === 'create' && !canCreateWorkspaces ? (
          <>
            <WorkspaceCreationDisabled
              variant="modal"
              onRequestAccess={handleRequestAccess}
              user={user}
            />
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle data-testid="modal-title-enabled">
                {mode === 'create' ? 'Create New Workspace' : 'Edit Workspace'}
              </DialogTitle>
              <DialogDescription data-testid="modal-description-enabled">
                {mode === 'create'
                  ? 'Organize your favorite repositories and collaborate with your team. You can add repositories and invite members after creating your workspace.'
                  : 'Update your workspace settings. Changes will be applied immediately.'}
              </DialogDescription>
            </DialogHeader>

            <WorkspaceCreateForm
              onSubmit={handleWorkspaceSubmit}
              onCancel={handleCancel}
              loading={loading}
              error={error}
              mode={mode}
              initialValues={initialValues}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
