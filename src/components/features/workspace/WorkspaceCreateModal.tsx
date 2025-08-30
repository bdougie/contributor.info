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
import { WorkspaceService } from '@/services/workspace.service';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAnalytics } from '@/hooks/use-analytics';
import type { CreateWorkspaceRequest } from '@/types/workspace';
import type { User } from '@supabase/supabase-js';

export interface WorkspaceCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (workspaceId: string) => void;
  mode?: 'create' | 'edit';
  initialValues?: Partial<CreateWorkspaceRequest>;
  workspaceId?: string;
}

export function WorkspaceCreateModal({
  open,
  onOpenChange,
  onSuccess,
  mode = 'create',
  initialValues,
  workspaceId,
}: WorkspaceCreateModalProps) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { trackWorkspaceCreated, trackWorkspaceSettingsModified } = useAnalytics();

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

  const handleWorkspaceSubmit = useCallback(
    async (data: CreateWorkspaceRequest) => {
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
            trackWorkspaceCreated('onboarding');
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
            onSuccess(response.data.id);
          }

          // Navigate to the workspace if creating new one
          if (mode === 'create') {
            navigate(`/i/${response.data.id}`);
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
    [user, navigate, onOpenChange, onSuccess, mode, workspaceId]
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
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Create New Workspace' : 'Edit Workspace'}</DialogTitle>
          <DialogDescription>
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
      </DialogContent>
    </Dialog>
  );
}
