import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Package, Plus, Sparkles, BarChart3, Share2 } from '@/components/ui/icon';
import { useFeatureFlags } from '@/lib/feature-flags/context';
import { FEATURE_FLAGS } from '@/lib/feature-flags/types';
import { WorkspaceCreationDisabled } from './WorkspaceCreationDisabled';
import type { User } from '@supabase/supabase-js';

export interface WorkspaceOnboardingProps {
  onCreateClick: () => void;
  className?: string;
  user?: User | null;
}

export function WorkspaceOnboarding({ onCreateClick, className, user }: WorkspaceOnboardingProps) {
  const { checkFlag } = useFeatureFlags();
  const canCreateWorkspaces = checkFlag(FEATURE_FLAGS.ENABLE_WORKSPACE_CREATION);

  if (!canCreateWorkspaces) {
    return (
      <Card className={className}>
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-3">
            <div className="p-3 bg-muted rounded-full">
              <Sparkles className="h-6 w-6 text-muted-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">Workspaces</CardTitle>
          <p className="text-muted-foreground mt-2">
            Organize repositories, track contributors, and collaborate with your team
          </p>
        </CardHeader>

        <CardContent>
          <WorkspaceCreationDisabled variant="card" user={user} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="text-center pb-4">
        <div className="flex justify-center mb-3">
          <div className="p-3 bg-muted rounded-full">
            <Sparkles className="h-6 w-6 text-muted-foreground" />
          </div>
        </div>
        <CardTitle className="text-2xl">Create Your First Workspace</CardTitle>
        <p className="text-muted-foreground mt-2">
          Organize repositories, track contributors, and collaborate with your team
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-start gap-3 p-2">
            <div className="p-2 bg-muted rounded-md flex-shrink-0">
              <Package className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium">Organize Repositories</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Group related projects together
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-2">
            <div className="p-2 bg-muted rounded-md flex-shrink-0">
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium">Track Contributors</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Monitor activity across projects
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-2">
            <div className="p-2 bg-muted rounded-md flex-shrink-0">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium">View Analytics</h4>
              <p className="text-xs text-muted-foreground mt-0.5">Get insights on contributions</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-2">
            <div className="p-2 bg-muted rounded-md flex-shrink-0">
              <Share2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium">Collaborate</h4>
              <p className="text-xs text-muted-foreground mt-0.5">Share with team members</p>
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <Button type="button" onClick={onCreateClick} className="w-full" size="lg">
            <Plus className="mr-2 h-4 w-4" />
            Create Your First Workspace
          </Button>
          <p className="text-xs text-center text-muted-foreground mt-3">
            Free plan includes up to 3 workspaces
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Compact version for when user already has workspaces
export function WorkspaceOnboardingCompact({ onCreateClick, user }: WorkspaceOnboardingProps) {
  const { checkFlag } = useFeatureFlags();
  const canCreateWorkspaces = checkFlag(FEATURE_FLAGS.ENABLE_WORKSPACE_CREATION);

  if (!canCreateWorkspaces) {
    return (
      <Card>
        <CardContent className="py-6 px-6">
          <WorkspaceCreationDisabled variant="card" user={user} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-6 px-6">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-4 flex-1">
            <div className="p-2 bg-muted rounded-md flex-shrink-0">
              <Package className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Need another workspace?</h3>
              <p className="text-sm text-muted-foreground">
                Organize more repositories into collections
              </p>
            </div>
          </div>
          <Button type="button" onClick={onCreateClick} variant="outline" className="flex-shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            New Workspace
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
