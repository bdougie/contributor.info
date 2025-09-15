import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserPlus } from '@/components/ui/icon';
import type { WorkspaceRole, WorkspaceTier } from '@/types/workspace';

interface MembersTabProps {
  workspaceId: string;
  currentUserRole: WorkspaceRole;
  tier: WorkspaceTier;
  memberCount: number;
}

export function MembersTab({ workspaceId, currentUserRole, tier, memberCount }: MembersTabProps) {
  // TODO: Use workspaceId to fetch members
  console.log('Loading members for workspace:', workspaceId);
  // This is a placeholder component for the PR
  // Full implementation will include member list, invite modal, and role management

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>Manage your workspace team and their permissions</CardDescription>
            </div>
            {tier !== 'free' && currentUserRole !== 'contributor' && (
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Member
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>Member management interface coming soon</p>
            <p className="text-sm mt-2">
              Current members: {memberCount} /{' '}
              {(() => {
                if (tier === 'free') return '1';
                if (tier === 'pro') return '5';
                return 'Unlimited';
              })()}
            </p>
          </div>
        </CardContent>
      </Card>

      {tier === 'free' && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="text-lg">Upgrade to Pro</CardTitle>
            <CardDescription>
              Invite up to 5 team members to collaborate on your workspace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="default">Upgrade to Pro</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
