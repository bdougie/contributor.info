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
  AlertCircle,
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
import { supabase } from '@/lib/supabase';
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
  const { toast } = useToast();
  const limits = useSubscriptionLimits();

  // Get current user ID
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: user } = await supabase.auth.getUser();
      if (user.user) {
        setCurrentUserId(user.user.id);
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
      const { data, error } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch user details separately for each member
      const memberIds = data?.map((m) => m.user_id) || [];
      const { data: usersData } =
        memberIds.length > 0
          ? await supabase
              .from('app_users')
              .select('auth_user_id, email, display_name, avatar_url')
              .in('auth_user_id', memberIds)
          : { data: [] };

      // Create a map of user data for easy lookup
      const userMap = new Map((usersData || []).map((u) => [u.auth_user_id, u]));

      // Transform the data to match expected structure
      const transformedMembers = (data || []).map((member) => {
        const userData = userMap.get(member.user_id);
        return {
          ...member,
          user: userData
            ? {
                id: userData.auth_user_id,
                email: userData.email,
                display_name: userData.display_name || userData.email?.split('@')[0],
                avatar_url: userData.avatar_url,
              }
            : null,
        };
      });

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
      title: 'Invitation sent',
      description: 'Your team member will receive an email invitation',
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
    try {
      // Update the invitation's expires_at to extend it by 7 days
      const { error } = await supabase
        .from('workspace_invitations')
        .update({
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          invited_at: new Date().toISOString(),
        })
        .eq('id', invitationId);

      if (error) throw error;

      // Trigger email via Supabase Edge Function (Resend integration)
      // The workspace_invitations table update should trigger the email automatically
      toast({
        title: 'Invitation resent',
        description: `A new invitation email has been sent to ${email}`,
      });

      await fetchPendingInvitations();
    } catch (error) {
      console.error('Error resending invitation:', error);
      toast({
        title: 'Error',
        description: 'Failed to resend invitation',
        variant: 'destructive',
      });
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
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
        description: 'Failed to cancel invitation',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateRole = async (_memberId: string, userId: string, newRole: WorkspaceRole) => {
    try {
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
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update role',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const result = await WorkspaceService.removeMember(workspaceId, user.user.id, userId);

      if (result.success) {
        toast({
          title: 'Member removed',
          description: 'Team member has been removed from the workspace',
        });
        await fetchMembers();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove member',
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

  // Use subscription limits for member count
  let maxMembers = 50;
  if (limits.tier === 'free') {
    maxMembers = 1;
  } else if (limits.tier === 'pro') {
    maxMembers = 1; // Pro plan is solo, no team members
  } else if (limits.tier === 'team') {
    maxMembers = 5; // Team plan allows 5 members
  }
  const canInviteMore = members.length < maxMembers;

  return (
    <div className="space-y-6 w-full">
      <Card className="w-full overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="min-w-0">
              <CardTitle>Team Members</CardTitle>
              <CardDescription>Manage your workspace team and their permissions</CardDescription>
            </div>
            {canManageMembers && (
              <div className="flex items-center gap-2 flex-shrink-0">
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
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 whitespace-nowrap"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Upgrade to Invite More</span>
                    <span className="sm:hidden">Upgrade</span>
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
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
                {/* Member limit alert */}
                {!canInviteMore && canManageMembers && (
                  <div className="flex items-start p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 mr-3 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        Team member limit reached
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        You've reached the maximum of {maxMembers} team member
                        {maxMembers !== 1 ? 's' : ''} for your current plan.
                      </p>
                      <button
                        onClick={() => setUpgradeModalOpen(true)}
                        className="text-sm text-amber-600 dark:text-amber-400 hover:underline mt-2 font-medium inline-flex items-center"
                      >
                        Upgrade to add more members
                        <Sparkles className="h-3 w-3 ml-1" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Pending Invitations Section */}
                {pendingInvitations.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Pending Invitations ({pendingInvitations.length})</span>
                    </div>
                    <div className="space-y-2">
                      {pendingInvitations.map((invitation) => (
                        <div
                          key={invitation.id}
                          className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-muted-foreground/10 gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="bg-background rounded-full p-2 flex-shrink-0">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{invitation.email}</p>
                              <div className="flex items-center gap-3 mt-1 flex-wrap">
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
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleResendInvitation(invitation.id, invitation.email)
                                }
                              >
                                <Send className="h-3 w-3 mr-1" />
                                Resend
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancelInvitation(invitation.id)}
                                className="text-destructive hover:text-destructive"
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
                        <span>Active Members ({members.length})</span>
                      </div>
                    )}
                    <div className="w-full overflow-x-auto">
                      <Table className="w-full">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[250px]">Member</TableHead>
                            <TableHead className="min-w-[120px]">Role</TableHead>
                            <TableHead className="min-w-[120px]">Joined</TableHead>
                            <TableHead className="min-w-[100px] text-right">Actions</TableHead>
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
                                      <div className="font-medium flex items-center gap-2">
                                        <span className="truncate max-w-[200px]">
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
                                      <div className="text-sm text-muted-foreground truncate max-w-[250px]">
                                        {member.user?.email}
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
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
                                <TableCell className="text-sm text-muted-foreground">
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
                                          className="opacity-0 group-hover:opacity-100 transition-opacity"
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
                                  ) : (
                                    member.role === 'owner' && (
                                      <Badge variant="outline" className="text-xs opacity-60">
                                        Owner
                                      </Badge>
                                    )
                                  )}
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
    </div>
  );
}
