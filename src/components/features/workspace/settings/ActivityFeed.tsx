import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity } from '@/components/ui/icon';

interface ActivityFeedProps {
  workspaceId: string;
}

export function ActivityFeed({ workspaceId }: ActivityFeedProps) {
  // TODO: Use workspaceId to fetch activity data
  console.log('Loading activity for workspace:', workspaceId);
  // This is a placeholder component for the PR
  // Full implementation will include real-time activity feed with workspace events

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Activity Feed</CardTitle>
          <CardDescription>Recent activity and changes in your workspace</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] w-full pr-4">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Activity className="h-4 w-4" />
                <p className="text-sm">Activity feed coming soon</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Track member joins, repository additions, role changes, and more
              </p>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Activity Types</CardTitle>
          <CardDescription>The following activities will be tracked</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Member invitations and joins</li>
            <li>• Repository additions and removals</li>
            <li>• Role changes</li>
            <li>• Settings updates</li>
            <li>• Workspace configuration changes</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
