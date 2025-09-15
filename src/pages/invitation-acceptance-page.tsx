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

      if (!result.success || !result.data) {
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
    if (!token || !invitation) {
      toast({
        title: 'Error',
        description: 'Invalid invitation data',
        variant: 'destructive',
      });
      return;
    }

    try {
      setProcessing(true);

      // Get current user with timeout
      const userPromise = supabase.auth.getUser();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Authentication timeout')), 5000)
      );

      const {
        data: { user },
      } = (await Promise.race([userPromise, timeoutPromise])) as Awaited<
        ReturnType<typeof supabase.auth.getUser>
      >;

      if (!user) {
        toast({
          title: 'Authentication Required',
          description: 'Please log in to accept this invitation',
          variant: 'destructive',
        });
        navigate(`/login?redirect=/invitation/${token}`);
        return;
      }

      const result = await WorkspaceService.acceptInvitation(token, user.id);

      if (result.success) {
        toast({
          title: 'Welcome to the workspace!',
          description: `You've successfully joined ${invitation.workspace.name}`,
        });

        // Redirect to the workspace dashboard
        navigate(`/workspace/${invitation.workspace.id}`);
      } else {
        // Provide specific error messages based on status code
        const errorMessage = (() => {
          switch (result.statusCode) {
            case 400:
              return 'Invalid invitation data. Please check the invitation link.';
            case 404:
              return 'Invitation not found. It may have been deleted.';
            case 409:
              return result.error || 'This invitation has already been processed.';
            case 410:
              return 'This invitation has expired. Please request a new one.';
            default:
              return result.error || 'Failed to accept invitation';
          }
        })();

        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
      let errorMessage = 'An unexpected error occurred';
      if (error instanceof Error) {
        errorMessage =
          error.message === 'Authentication timeout'
            ? 'Authentication timeout. Please try again.'
            : 'An unexpected error occurred';
      }

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!token) {
      toast({
        title: 'Error',
        description: 'Invalid invitation token',
        variant: 'destructive',
      });
      return;
    }

    try {
      setProcessing(true);

      // Add timeout to prevent hanging
      const declinePromise = WorkspaceService.declineInvitation(token);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), 10000)
      );

      const result = (await Promise.race([declinePromise, timeoutPromise])) as Awaited<
        ReturnType<typeof WorkspaceService.declineInvitation>
      >;

      if (result.success) {
        toast({
          title: 'Invitation declined',
          description: 'You have declined the workspace invitation',
        });
        navigate('/');
      } else {
        // Provide specific error messages
        const errorMessage = (() => {
          switch (result.statusCode) {
            case 400:
              return 'Invalid invitation format.';
            case 404:
              return 'Invitation not found.';
            case 409:
              return 'This invitation has already been processed.';
            default:
              return result.error || 'Failed to decline invitation';
          }
        })();

        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error declining invitation:', error);
      let errorMessage = 'An unexpected error occurred';
      if (error instanceof Error) {
        errorMessage =
          error.message === 'Request timeout'
            ? 'Request timeout. Please try again.'
            : 'An unexpected error occurred';
      }

      toast({
        title: 'Error',
        description: errorMessage,
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
