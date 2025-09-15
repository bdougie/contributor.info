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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserPlus, Crown, Shield, Users, MoreVertical, Mail } from 'lucide-react';
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
import type { WorkspaceRole, WorkspaceTier, WorkspaceMemberWithUser } from '@/types/workspace';

interface MembersTabProps {
  workspaceId: string;
  currentUserRole: WorkspaceRole;
  tier: WorkspaceTier;
  memberCount: number;
}

export function MembersTab({ workspaceId, currentUserRole, tier }: MembersTabProps) {
  const [members, setMembers] = useState<WorkspaceMemberWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('contributor');
  const [inviting, setInviting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { toast } = useToast();

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

  const handleInviteMember = async () => {
    if (!inviteEmail) return;

    try {
      setInviting(true);
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const result = await WorkspaceService.inviteMember(
        workspaceId,
        user.user.id,
        inviteEmail,
        inviteRole
      );

      if (result.success) {
        toast({
          title: 'Invitation sent',
          description: `Invited ${inviteEmail} as ${inviteRole}`,
        });
        setInviteDialogOpen(false);
        setInviteEmail('');
        setInviteRole('contributor');
        await fetchMembers();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send invitation',
        variant: 'destructive',
      });
    } finally {
      setInviting(false);
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
  let maxMembers = 1;
  if (tier === 'pro') {
    maxMembers = 5;
  } else if (tier === 'enterprise') {
    maxMembers = 100;
  }
  const canInvite = canManageMembers && members.length < maxMembers;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>Manage your workspace team and their permissions</CardDescription>
            </div>
            {canInvite && (
              <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Invite Member
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite Team Member</DialogTitle>
                    <DialogDescription>
                      Invite a new member to collaborate in this workspace
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="colleague@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select
                        value={inviteRole}
                        onValueChange={(v) => setInviteRole(v as WorkspaceRole)}
                      >
                        <SelectTrigger id="role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="contributor">Contributor</SelectItem>
                          {currentUserRole === 'owner' && (
                            <SelectItem value="maintainer">Maintainer</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleInviteMember} disabled={inviting || !inviteEmail}>
                      {inviting ? 'Sending...' : 'Send Invitation'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
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
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="font-medium">No team members yet</p>
                  <p className="text-sm mt-1">Invite your first team member to get started</p>
                </div>
              );
            }
            return (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  {members.length} of {maxMembers} members
                </div>
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

      {tier === 'free' && members.length >= 1 && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="text-lg">Upgrade to Pro</CardTitle>
            <CardDescription>
              You've reached the member limit for the free tier. Upgrade to Pro to invite up to 5
              team members.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="default">Upgrade to Pro</Button>
          </CardContent>
        </Card>
      )}

      {tier === 'pro' && members.length >= 5 && (
        <Card className="border-purple-200 bg-purple-50/50">
          <CardHeader>
            <CardTitle className="text-lg">Need more seats?</CardTitle>
            <CardDescription>
              You've reached the member limit for Pro. Upgrade to Enterprise for up to 100 team
              members.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="default">Contact Sales</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
