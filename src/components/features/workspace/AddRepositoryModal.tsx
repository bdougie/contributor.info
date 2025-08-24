import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AddRepositoryForm } from './AddRepositoryForm';
import { WorkspaceService } from '@/services/workspace.service';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { AddRepositoryRequest } from '@/types/workspace';
import type { User } from '@supabase/supabase-js';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get the current user when the modal opens
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    
    if (open) {
      getUser();
    }
  }, [open]);

  const handleAddRepository = useCallback(async (data: AddRepositoryRequest) => {
    if (!user?.id) {
      setError('You must be logged in to add repositories');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await WorkspaceService.addRepositoryToWorkspace(
        workspaceId,
        user.id,
        data
      );
      
      if (response.success) {
        toast.success('Repository added to workspace successfully!');
        onOpenChange(false);
        
        // Call optional success callback
        if (onSuccess) {
          onSuccess();
        }
      } else {
        setError(response.error || 'Failed to add repository');
      }
    } catch (err) {
      console.error('Error adding repository to workspace:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user, workspaceId, onOpenChange, onSuccess]);

  const handleCancel = useCallback(() => {
    if (!loading) {
      setError(null);
      onOpenChange(false);
    }
  }, [loading, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add Repository to Workspace</DialogTitle>
          <DialogDescription>
            Search for and add repositories to your workspace. You can organize them with tags and notes.
          </DialogDescription>
        </DialogHeader>

        <AddRepositoryForm
          onSubmit={handleAddRepository}
          onCancel={handleCancel}
          loading={loading}
          error={error}
          workspaceId={workspaceId}
        />
      </DialogContent>
    </Dialog>
  );
}