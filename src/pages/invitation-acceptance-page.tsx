import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { InvitationPreview } from '@/components/features/workspace/invitation/InvitationPreview';
import { InvitationActions } from '@/components/features/workspace/invitation/InvitationActions';
import {
  InvitationError,
  InvitationErrorType,
} from '@/components/features/workspace/invitation/InvitationError';
import { WorkspaceService } from '@/services/workspace.service';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import type { WorkspaceWithDetails } from '@/types/workspace';

interface InvitationDetails {
  id: string;
  workspace: WorkspaceWithDetails;
  role: string;
  inviterName?: string;
  expiresAt: string;
  status: string;
}

export const InvitationAcceptancePage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [error, setError] = useState<InvitationErrorType | null>(null);

  useEffect(() => {
    const runValidation = async () => {
      if (token) {
        await validateInvitation();
      }
    };
    runValidation();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const validateInvitation = async () => {
    try {
      setLoading(true);

      // Check if user is authenticated
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        // Redirect to login with return URL
        navigate(`/login?redirect=/invitation/${token}`);
        return;
      }

      // Validate the invitation token
      const result = await WorkspaceService.validateInvitation(token!);

      if (!result.success) {
        // Determine error type based on the error message
        if (result.error?.includes('expired')) {
          setError('expired');
        } else if (result.error?.includes('already a member')) {
          setError('already-member');
        } else if (result.error?.includes('not found')) {
          setError('not-found');
        } else {
          setError('invalid');
        }
        return;
      }

      setInvitation(result.data);
    } catch (err) {
      console.error('Error validating invitation:', err);
      setError('invalid');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!token || !invitation) return;

    try {
      setProcessing(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      const result = await WorkspaceService.acceptInvitation();

      if (result.success) {
        toast({
          title: 'Welcome to the workspace!',
          description: `You've successfully joined ${invitation.workspace.name}`,
        });

        // Redirect to the workspace dashboard
        navigate(`/workspace/${invitation.workspace.id}`);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to accept invitation',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!token) return;

    try {
      setProcessing(true);

      const result = await WorkspaceService.declineInvitation();

      if (result.success) {
        toast({
          title: 'Invitation declined',
          description: 'You have declined the workspace invitation',
        });
        navigate('/');
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to decline invitation',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  // Show error state
  if (error) {
    return <InvitationError type={error} />;
  }

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Validating invitation...</p>
        </div>
      </div>
    );
  }

  // Show invitation details
  if (invitation) {
    return (
      <div className="min-h-screen py-12 px-4">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight">Workspace Invitation</h1>
            <p className="mt-2 text-muted-foreground">You've been invited to join a workspace</p>
          </div>

          <InvitationPreview
            workspace={invitation.workspace}
            inviterName={invitation.inviterName}
            role={invitation.role}
          />

          <InvitationActions
            onAccept={handleAccept}
            onDecline={handleDecline}
            isProcessing={processing}
          />
        </div>
      </div>
    );
  }

  // Fallback
  return null;
};
