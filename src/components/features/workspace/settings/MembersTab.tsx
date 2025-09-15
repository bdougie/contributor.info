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
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { WorkspaceService } from '@/services/workspace.service';
import { useSubscriptionLimits } from '@/hooks/use-subscription-limits';
import { InviteMemberModal } from './InviteMemberModal';
import { UpgradeModal } from '../../../billing/UpgradeModal';
import type { WorkspaceRole, WorkspaceTier, WorkspaceMemberWithUser } from '@/types/workspace';

interface MembersTabProps {
  workspaceId: string;
  currentUserRole: WorkspaceRole;
  tier: WorkspaceTier;
  memberCount: number;
}

export function MembersTab({ workspaceId, currentUserRole }: MembersTabProps) {
  // FOR TESTING: Add mock members
  const [members, setMembers] = useState<WorkspaceMemberWithUser[]>([
    // Uncomment to test with mock members:
    // { id: '1', user_id: '1', workspace_id: workspaceId, role: 'owner', accepted_at: new Date().toISOString(), user: { id: '1', email: 'owner@example.com', display_name: 'John Owner' } },
    // { id: '2', user_id: '2', workspace_id: workspaceId, role: 'maintainer', accepted_at: new Date().toISOString(), user: { id: '2', email: 'maintainer@example.com', display_name: 'Jane Maintainer' } },
  ]);
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

  // Fetch workspace members
  useEffect(() => {
    const fetchMembersAsync = async () => {
      await fetchMembers();
    };
    fetchMembersAsync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('workspace_members')
        .select(
          `
          *,
          user:users!workspace_members_user_id_fkey(
            id,
            email,
            display_name,
            avatar_url
          )
        `
        )
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMembers(data as WorkspaceMemberWithUser[]);
    } catch (error) {
      console.error('Error fetching members:', error);
      toast({
        title: 'Error',
        description: 'Failed to load team members',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInviteSent = async () => {
    toast({
      title: 'Invitation sent',
      description: 'Your team member will receive an email invitation',
    });
    await fetchMembers();
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
    maxMembers = 5;
  }
  const canInviteMore = members.length < maxMembers;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>Manage your workspace team and their permissions</CardDescription>
            </div>
            {canManageMembers && (
              <div className="flex items-center gap-2">
                {!limits.loading && (
                  <div className="text-sm text-muted-foreground">
                    {members.length} / {maxMembers} members
                  </div>
                )}
                {canInviteMore ? (
                  <Button onClick={() => setInviteModalOpen(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Invite Member
                  </Button>
                ) : (
                  <Button
                    onClick={() => setUpgradeModalOpen(true)}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Upgrade to Invite More
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
            if (members.length === 0) {
              return (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="font-medium text-gray-900 dark:text-white">No team members yet</p>
                  {(() => {
                    if (canManageMembers && canInviteMore) {
                      return (
                        <>
                          <p className="text-sm mt-1 text-muted-foreground">
                            Invite your first team member to get started
                          </p>
                          <Button
                            onClick={() => setInviteModalOpen(true)}
                            className="mt-4"
                            variant="outline"
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
                          <p className="text-sm mt-1 text-muted-foreground">
                            Upgrade your plan to invite team members
                          </p>
                          <Button
                            onClick={() => setUpgradeModalOpen(true)}
                            className="mt-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                          >
                            <Sparkles className="h-4 w-4 mr-2" />
                            Upgrade to Enable Invites
                          </Button>
                        </>
                      );
                    }
                    return (
                      <p className="text-sm mt-1 text-muted-foreground">
                        Contact the workspace owner to invite members
                      </p>
                    );
                  })()}
                </div>
              );
            }
            return (
              <div className="space-y-4">
                {/* Member limit alert */}
                {!canInviteMore && canManageMembers && (
                  <div className="flex items-start p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 mr-2 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        Team member limit reached
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        You've reached the maximum of {maxMembers} team members for your current
                        plan.
                      </p>
                      <button
                        onClick={() => setUpgradeModalOpen(true)}
                        className="text-sm text-amber-600 dark:text-amber-400 hover:underline mt-1 font-medium"
                      >
                        Upgrade to add more members →
                      </button>
                    </div>
                  </div>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => {
                      const isCurrentUser = member.user_id === currentUserId;
                      return (
                        <TableRow key={member.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={member.user?.avatar_url} />
                                <AvatarFallback>
                                  {member.user?.display_name?.[0] || member.user?.email?.[0] || '?'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">
                                  {member.user?.display_name || member.user?.email}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {member.user?.email}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getRoleBadgeVariant(member.role)}>
                              {getRoleIcon(member.role)}
                              <span className="ml-1">{member.role}</span>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {member.accepted_at ? (
                              <Badge variant="outline" className="text-green-600">
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-yellow-600">
                                <Mail className="h-3 w-3 mr-1" />
                                Pending
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {member.accepted_at
                              ? new Date(member.accepted_at).toLocaleDateString()
                              : 'Not yet'}
                          </TableCell>
                          <TableCell>
                            {canManageMembers && !isCurrentUser && member.role !== 'owner' && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
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
                                    className="text-red-600"
                                  >
                                    Remove from workspace
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
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
