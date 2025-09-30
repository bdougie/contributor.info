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
import { getWorkspaceRoute } from '@/lib/utils/workspace-routes';

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
      setError(null); // Clear any previous errors

      // Validate token format first (basic UUID check)
      if (!token || token.length < 32) {
        console.error('Invalid token format:', token);
        setError('invalid');
        return;
      }

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
        // Determine error type based on the error message and status code
        console.error('Invitation validation failed:', {
          error: result.error,
          statusCode: result.statusCode,
          token: token.substring(0, 8) + '...', // Log first 8 chars for debugging
        });

        if (result.statusCode === 404 || result.error?.includes('not found')) {
          setError('not-found');
        } else if (result.statusCode === 410 || result.error?.includes('expired')) {
          setError('expired');
        } else if (result.error?.includes('already been accepted')) {
          setError('already-accepted');
        } else if (result.error?.includes('already a member')) {
          setError('already-member');
        } else if (result.error?.includes('declined')) {
          setError('declined');
        } else {
          setError('invalid');
        }
        return;
      }

      // Successful validation
      console.log('Invitation validated successfully:', {
        workspaceName: result.data.workspace.name,
        role: result.data.role,
        expiresAt: result.data.expiresAt,
      });

      setInvitation(result.data);
    } catch (err) {
      console.error('Error validating invitation:', err);

      // Provide more specific error handling
      if (err instanceof Error) {
        if (err.message.includes('NetworkError') || err.message.includes('fetch')) {
          setError('network-error');
        } else if (err.message.includes('timeout')) {
          setError('timeout');
        } else {
          setError('invalid');
        }
      } else {
        setError('invalid');
      }
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
        navigate(getWorkspaceRoute(invitation.workspace));
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
        <div className="text-center max-w-md mx-auto px-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Validating invitation...</h2>
          <p className="text-muted-foreground text-sm">
            Please wait while we verify your workspace invitation.
          </p>
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
            <p className="mt-2 text-muted-foreground">
              You've been invited to join <strong>{invitation.workspace.name}</strong>
            </p>
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

          {/* Additional security notice */}
          <div className="text-center text-sm text-muted-foreground bg-muted/20 rounded-lg p-4">
            🔒 This invitation is secure and can only be used by the email address it was sent to.
          </div>
        </div>
      </div>
    );
  }

  // Fallback
  return null;
};
