import React from 'react';
import { Users, GitBranch, Activity, Calendar } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WorkspaceWithDetails } from '@/types/workspace';

interface InvitationPreviewProps {
  workspace: WorkspaceWithDetails;
  inviterName?: string;
  role: string;
}

export const InvitationPreview: React.FC<InvitationPreviewProps> = ({
  workspace,
  inviterName,
  role,
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{workspace.name}</CardTitle>
        {workspace.description && <CardDescription>{workspace.description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-6">
        {inviterName && (
          <Alert className="border-blue-200 bg-blue-50/50">
            <AlertDescription>
              <strong>{inviterName}</strong> has invited you to join as a <strong>{role}</strong>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center space-x-3">
            <GitBranch className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Repositories</p>
              <p className="font-semibold">{workspace.repository_count || 0}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Team Members</p>
              <p className="font-semibold">{workspace.member_count || 0}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant="outline" className="capitalize">
                {workspace.status || 'Active'}
              </Badge>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="font-semibold">{new Date(workspace.created_at).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <h3 className="text-sm font-medium mb-2">Your permissions as {role}:</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            {role === 'maintainer' ? (
              <>
                <li>• Add and remove repositories</li>
                <li>• Edit workspace settings</li>
                <li>• Invite contributor members</li>
                <li>• View all analytics and data</li>
              </>
            ) : (
              <>
                <li>• View workspace repositories</li>
                <li>• Access analytics and insights</li>
                <li>• View team member list</li>
                <li>• Read-only access to settings</li>
              </>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
