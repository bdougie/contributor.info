import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  UserPlus,
  Crown,
  Shield,
  Users,
  MoreVertical,
  Mail,
  Sparkles,
  Clock,
  UserCheck,
  Send,
  Trash2,
  UserX,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { getSupabase } from '@/lib/supabase-lazy';
import { useToast } from '@/hooks/use-toast';
import { WorkspaceService } from '@/services/workspace.service';
import { useSubscriptionLimits } from '@/hooks/use-subscription-limits';
import { InviteMemberModal } from './InviteMemberModal';
import { UpgradeModal } from '../../../billing/UpgradeModal';
import type {
  WorkspaceRole,
  WorkspaceTier,
  WorkspaceMemberWithUser,
  WorkspaceInvitation,
} from '@/types/workspace';

interface MembersTabProps {
  workspaceId: string;
  currentUserRole: WorkspaceRole;
  tier: WorkspaceTier;
  memberCount: number;
}

export function MembersTab({ workspaceId, currentUserRole }: MembersTabProps) {
  const [members, setMembers] = useState<WorkspaceMemberWithUser[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<WorkspaceInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [operationInProgress, setOperationInProgress] = useState<string | null>(null);
  const { toast } = useToast();
  const limits = useSubscriptionLimits();

  // Get current user's app_users.id for proper comparison
  useEffect(() => {
    const getCurrentUser = async () => {
      const supabase = await getSupabase();
      const { data: user } = await supabase.auth.getUser();
      if (user.user) {
        // Get the app_users.id for proper comparison with workspace_members.user_id
        const { data: appUser } = await supabase
          .from('app_users')
          .select('id')
          .eq('auth_user_id', user.user.id)
          .maybeSingle();

        if (appUser) {
          setCurrentUserId(appUser.id);
        } else {
          // If no app_users record exists, we can't properly identify the current user
          console.warn('No app_users record found for current user');
        }
      }
    };
    getCurrentUser();
  }, []);

  // Fetch workspace members and pending invitations
  useEffect(() => {
    const fetchData = async () => {
      // Use Promise.allSettled to handle partial failures
      const results = await Promise.allSettled([fetchMembers(), fetchPendingInvitations()]);

      // Log any failures for debugging
      const failures = results.filter((r) => r.status === 'rejected');
      if (failures.length > 0) {
        console.error('Failed to load some data:', failures);
      }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      console.log('Fetching members for workspace:', workspaceId);

      const supabase = await getSupabase();
      // Optimized query: Use Supabase relationship expansion to get user data in a single query
      // workspace_members.user_id has a foreign key to app_users.id (workspace_members_user_id_fkey)
      const { data, error } = await supabase
        .from('workspace_members')
        .select(
          `
          *,
          app_users!workspace_members_user_id_fkey (
            id,
            auth_user_id,
            email,
            display_name,
            avatar_url
          )
        `
        )
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      console.log('Members query result:', { data, error });
      if (error) throw error;

      // Log warning if we're missing user data for some members
      const membersWithoutUsers = data?.filter((m) => !m.app_users) || [];
      if (membersWithoutUsers.length > 0) {
        console.warn(
          '%s member(s) missing from app_users table. Using fallback identifiers. This may indicate the sync trigger needs attention.',
          membersWithoutUsers.length
        );
      }

      // Transform the data to match expected structure
      const transformedMembers = (data || []).map((member) => {
        const userData = member.app_users;
        return {
          ...member,
          user: userData
            ? {
                id: userData.auth_user_id,
                email: userData.email,
                display_name: userData.display_name || userData.email?.split('@')[0],
                avatar_url: userData.avatar_url,
              }
            : {
                // Fallback when no user data is found - use identifiable placeholders
                // This should be rare if the app_users sync trigger is working correctly
                id: member.user_id,
                email: `member-${member.user_id.substring(0, 8)}@pending.sync`,
                display_name: `Member ${member.user_id.substring(0, 8)}`,
                avatar_url: null,
              },
        };
      });

      console.log('Setting members state with:', transformedMembers);
      setMembers(transformedMembers as WorkspaceMemberWithUser[]);
      return true; // Return success status
    } catch (error) {
      console.error('Error fetching members:', error);
      toast({
        title: 'Error',
        description: 'Failed to load team members',
        variant: 'destructive',
      });
      setMembers([]); // Set to empty array on error
      return false; // Return failure status
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingInvitations = async () => {
    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from('workspace_invitations')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('status', 'pending')
        .order('invited_at', { ascending: false });

      if (error) throw error;
      setPendingInvitations(data || []);
      return true; // Return success status
    } catch (error) {
      console.error('Error fetching invitations:', error);
      toast({
        title: 'Error loading invitations',
        description: 'Failed to load pending invitations. Please refresh the page.',
        variant: 'destructive',
      });
      setPendingInvitations([]); // Set to empty array on error
      return false; // Return failure status
    }
  };

  const handleInviteSent = async () => {
    toast({
      title: 'Invitation sent successfully',
      description: 'An email has been sent. They have 7 days to accept the invitation.',
    });

    // Handle partial failures gracefully
    const results = await Promise.allSettled([fetchMembers(), fetchPendingInvitations()]);

    // Check if any failed
    const failedOperations = results.filter((result) => result.status === 'rejected');
    if (failedOperations.length > 0) {
      console.error('Some operations failed during refresh:', failedOperations);
      // The individual functions already show error toasts, so no need for additional notification
    }
  };

  const handleResendInvitation = async (invitationId: string, email: string) => {
    setOperationInProgress(`resend-${invitationId}`);

    try {
      const supabase = await getSupabase();
      // Update the invitation's expires_at to extend it by 7 days
      const { error } = await supabase
        .from('workspace_invitations')
        .update({
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          invited_at: new Date().toISOString(),
        })
        .eq('id', invitationId);

      if (error) throw error;

      // Trigger email via Supabase Edge Function
      try {
        const { error: emailError } = await supabase.functions.invoke(
          'workspace-invitation-email',
          {
            body: {
              invitationId,
            },
          }
        );

        if (emailError) {
          console.error('Failed to send invitation email:', emailError);
          toast({
            title: 'Warning',
            description: 'Invitation updated but email could not be sent. Please try again.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Invitation resent',
            description: `A new invitation email has been sent to ${email}`,
          });
        }
      } catch (emailErr) {
        console.error('Error sending invitation email:', emailErr);
        toast({
          title: 'Warning',
          description: 'Invitation updated but email could not be sent.',
          variant: 'destructive',
        });
      }

      await fetchPendingInvitations();
    } catch (error) {
      console.error('Error resending invitation:', error);
      toast({
        title: 'Error',
        description: 'Unable to resend the invitation. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setOperationInProgress(null);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    setOperationInProgress(`cancel-${invitationId}`);

    try {
      const supabase = await getSupabase();
      const { error } = await supabase
        .from('workspace_invitations')
        .update({ status: 'expired' })
        .eq('id', invitationId);

      if (error) throw error;

      toast({
        title: 'Invitation cancelled',
        description: 'The invitation has been cancelled',
      });
      await fetchPendingInvitations();
    } catch {
      toast({
        title: 'Error',
        description: 'Unable to cancel the invitation. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setOperationInProgress(null);
    }
  };

  const handleUpdateRole = async (_memberId: string, userId: string, newRole: WorkspaceRole) => {
    setOperationInProgress(`role-${userId}`);

    try {
      const supabase = await getSupabase();
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const result = await WorkspaceService.updateMemberRole(
        workspaceId,
        user.user.id,
        userId,
        newRole
      );

      if (result.success) {
        toast({
          title: 'Role updated',
          description: 'Member role has been updated successfully',
        });
        await fetchMembers();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        title: 'Failed to update role',
        description:
          error instanceof Error
            ? error.message
            : 'Unable to update the member role. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setOperationInProgress(null);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    console.log('Removing member:', userId);

    // Add confirmation dialog
    const confirmed = window.confirm(
      'Are you sure you want to remove this member from the workspace?'
    );
    if (!confirmed) return;

    // Optimistic update - immediately remove from UI
    const previousMembers = members;
    setMembers(members.filter((m) => m.user_id !== userId));

    // Show loading toast
    const loadingToast = toast({
      title: 'Removing member...',
      description: 'Please wait while we update the workspace',
      duration: 30000, // Long duration, will dismiss manually
    });

    try {
      const supabase = await getSupabase();
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      console.log('Calling removeMember with:', {
        workspaceId,
        userId,
        requestingUserId: user.user.id,
      });
      const result = await WorkspaceService.removeMember(workspaceId, user.user.id, userId);
      console.log('Remove member result:', result);

      if (result.success) {
        // Dismiss loading toast
        loadingToast.dismiss();

        toast({
          title: 'Member removed',
          description: 'Team member has been removed from the workspace',
        });

        // Fetch fresh data to ensure consistency
        await fetchMembers();
      } else {
        throw new Error(result.error || 'Failed to remove member');
      }
    } catch (error) {
      console.error('Error removing member:', error);

      // Revert optimistic update on error
      setMembers(previousMembers);

      // Dismiss loading toast
      loadingToast.dismiss();

      toast({
        title: 'Failed to remove member',
        description:
          error instanceof Error
            ? error.message
            : 'Unable to remove the team member. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const getRoleIcon = (role: WorkspaceRole) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4" />;
      case 'maintainer':
        return <Shield className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  const getRoleBadgeVariant = (role: WorkspaceRole) => {
    switch (role) {
      case 'owner':
        return 'default';
      case 'maintainer':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const canManageMembers = currentUserRole === 'owner' || currentUserRole === 'maintainer';
  const canChangeRoles = currentUserRole === 'owner';

  // Use subscription limits for member count with error handling for unknown tiers
  let maxMembers = 1; // Safe default for unknown tiers
  switch (limits.tier) {
    case 'free':
      maxMembers = 1;
      break;
    case 'pro':
      maxMembers = 1; // Pro plan is solo, no team members
      break;
    case 'team':
      maxMembers = 5; // Team plan allows 5 members
      break;
    case 'enterprise':
      maxMembers = 50; // Enterprise plan allows more members
      break;
    default:
      console.warn('Unknown subscription tier: %s. Using default member limit of 1.', limits.tier);
      maxMembers = 1; // Safe default for unknown tiers
  }
  const canInviteMore = members.length < maxMembers;

  return (
    <>
      <Card className="min-w-0 shadow-none">
        <CardHeader className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="min-w-0">
              <CardTitle>Members</CardTitle>
              <CardDescription>Manage access to this workspace.</CardDescription>
            </div>
            {canManageMembers && (
              <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                {!limits.loading && (
                  <div className="text-sm text-muted-foreground whitespace-nowrap">
                    {members.length} / {maxMembers} members
                  </div>
                )}
                {canInviteMore ? (
                  <Button onClick={() => setInviteModalOpen(true)} className="whitespace-nowrap">
                    <UserPlus className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Invite Member</span>
                    <span className="sm:hidden">Invite</span>
                  </Button>
                ) : (
                  <Button
                    onClick={() => setUpgradeModalOpen(true)}
                    variant="outline"
                    className="whitespace-nowrap"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Upgrade plan</span>
                    <span className="sm:hidden">Upgrade</span>
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">
          {(() => {
            if (loading) {
              return (
                <div className="text-center py-8 text-muted-foreground">Loading members...</div>
              );
            }
            if (members.length === 0 && pendingInvitations.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <div className="bg-muted/30 rounded-full p-6 mb-4">
                    <Users className="h-12 w-12 text-muted-foreground/60" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Start building your team
                  </h3>
                  {(() => {
                    if (canManageMembers && canInviteMore) {
                      return (
                        <>
                          <p className="text-sm text-muted-foreground text-center mb-6 max-w-sm">
                            Collaborate with your team by inviting members to this workspace.
                            They'll be able to view repositories, analytics, and contribute to the
                            workspace.
                          </p>
                          <Button
                            onClick={() => setInviteModalOpen(true)}
                            size="lg"
                            className="shadow-sm"
                          >
                            <UserPlus className="h-4 w-4 mr-2" />
                            Invite Your First Member
                          </Button>
                        </>
                      );
                    }
                    if (canManageMembers && !canInviteMore) {
                      return (
                        <>
                          <p className="text-sm text-muted-foreground text-center mb-6 max-w-sm">
                            Your current plan doesn't include team collaboration. Upgrade to invite
                            team members and work together.
                          </p>
                          <Button
                            onClick={() => setUpgradeModalOpen(true)}
                            size="lg"
                            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-sm"
                          >
                            <Sparkles className="h-4 w-4 mr-2" />
                            Upgrade to Enable Teams
                          </Button>
                        </>
                      );
                    }
                    return (
                      <p className="text-sm text-muted-foreground text-center max-w-sm">
                        You don't have permission to invite members. Contact the workspace owner to
                        request access.
                      </p>
                    );
                  })()}
                </div>
              );
            }
            return (
              <div className="space-y-6">
                {!canInviteMore && canManageMembers && (
                  <p className="text-sm text-muted-foreground">
                    Your plan includes {maxMembers} member{maxMembers !== 1 ? 's' : ''}. Upgrade to
                    invite more.
                  </p>
                )}

                {/* Pending Invitations Section */}
                {pendingInvitations.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Pending invitations ({pendingInvitations.length})</span>
                    </div>
                    <div className="space-y-2">
                      {pendingInvitations.map((invitation) => (
                        <div
                          key={invitation.id}
                          className="flex flex-col gap-3 rounded-lg bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="bg-background rounded-full p-2 flex-shrink-0">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{invitation.email}</p>
                              <div className="flex items-center gap-3 mt-1 flex-wrap">
                                <Badge variant="secondary" className="text-xs flex-shrink-0">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Waiting for acceptance
                                </Badge>
                                <Badge variant="outline" className="text-xs flex-shrink-0">
                                  {invitation.role}
                                </Badge>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  Expires {new Date(invitation.expires_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>
                          {canManageMembers && (
                            <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleResendInvitation(invitation.id, invitation.email)
                                }
                                disabled={operationInProgress === `resend-${invitation.id}`}
                              >
                                {operationInProgress === `resend-${invitation.id}` ? (
                                  <>Sending...</>
                                ) : (
                                  <>
                                    <Send className="h-3 w-3 mr-1" />
                                    Resend
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancelInvitation(invitation.id)}
                                className="text-destructive hover:text-destructive"
                                aria-label={`Cancel invitation for ${invitation.email}`}
                                disabled={operationInProgress === `cancel-${invitation.id}`}
                              >
                                <UserX className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {members.length > 0 && <Separator className="my-4" />}
                  </div>
                )}

                {/* Active Members Section */}
                {members.length > 0 && (
                  <div className="space-y-3">
                    {pendingInvitations.length > 0 && (
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <UserCheck className="h-4 w-4" />
                        <span>Active members ({members.length})</span>
                      </div>
                    )}
                    <div className="w-full overflow-x-auto">
                      <Table className="w-full table-fixed sm:table-auto">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Member</TableHead>
                            <TableHead className="hidden sm:table-cell">Role</TableHead>
                            <TableHead className="hidden md:table-cell">Joined</TableHead>
                            <TableHead className="w-14 text-right">
                              <span className="sr-only">Actions</span>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {members.map((member) => {
                            const isCurrentUser = member.user_id === currentUserId;
                            return (
                              <TableRow key={member.id} className="group">
                                <TableCell>
                                  <div className="flex items-center gap-3 min-w-0">
                                    <Avatar className="h-8 w-8 flex-shrink-0">
                                      <AvatarImage src={member.user?.avatar_url} />
                                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm">
                                        {member.user?.display_name?.[0] ||
                                          member.user?.email?.[0] ||
                                          '?'}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0 flex-1">
                                      <div className="font-medium flex flex-wrap items-center gap-2">
                                        <span className="truncate">
                                          {member.user?.display_name ||
                                            member.user?.email?.split('@')[0]}
                                        </span>
                                        {isCurrentUser && (
                                          <Badge
                                            variant="secondary"
                                            className="text-xs flex-shrink-0"
                                          >
                                            You
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="text-sm text-muted-foreground truncate">
                                        {member.user?.email}
                                      </div>
                                      <span className="mt-1 block text-xs capitalize text-muted-foreground sm:hidden">
                                        {member.role}
                                      </span>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="hidden sm:table-cell">
                                  <Badge
                                    variant={getRoleBadgeVariant(member.role)}
                                    className="gap-1"
                                  >
                                    {getRoleIcon(member.role)}
                                    <span>
                                      {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                                    </span>
                                  </Badge>
                                </TableCell>
                                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                                  {member.accepted_at
                                    ? new Date(member.accepted_at).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                      })
                                    : 'Pending'}
                                </TableCell>
                                <TableCell className="text-right">
                                  {canManageMembers && !isCurrentUser && member.role !== 'owner' ? (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-11 w-11 p-0"
                                          aria-label={`Manage ${member.user?.display_name || member.user?.email || 'member'}`}
                                          disabled={
                                            operationInProgress === `role-${member.user_id}`
                                          }
                                        >
                                          <MoreVertical className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-48">
                                        {canChangeRoles && member.accepted_at && (
                                          <>
                                            <DropdownMenuItem
                                              onClick={() =>
                                                handleUpdateRole(
                                                  member.id,
                                                  member.user_id,
                                                  member.role === 'maintainer'
                                                    ? 'contributor'
                                                    : 'maintainer'
                                                )
                                              }
                                            >
                                              Change to{' '}
                                              {member.role === 'maintainer'
                                                ? 'Contributor'
                                                : 'Maintainer'}
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                          </>
                                        )}
                                        <DropdownMenuItem
                                          onClick={() => handleRemoveMember(member.user_id)}
                                          className="text-destructive focus:text-destructive"
                                        >
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          Remove member
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  ) : null}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Invite Modal */}
      <InviteMemberModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        workspaceId={workspaceId}
        currentMemberCount={members.length}
        onInviteSent={handleInviteSent}
      />

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        feature="team-members"
      />
    </>
  );
}
