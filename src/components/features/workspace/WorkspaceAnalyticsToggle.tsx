/**
 * Example component showing feature flag usage for workspace analytics
 */

import { FeatureFlag, FEATURE_FLAGS, useFeatureFlag } from '@/lib/feature-flags';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, TrendingUp, Users, GitPullRequest } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

interface WorkspaceAnalyticsToggleProps {
  workspaceId: string;
  className?: string;
}

/**
 * Component that shows analytics dashboard when feature flag is enabled
 * This demonstrates how to use feature flags in production components
 */
export function WorkspaceAnalyticsToggle({
  workspaceId,
  className,
}: WorkspaceAnalyticsToggleProps) {
  // Check if the feature flag is enabled
  const isAnalyticsEnabled = useFeatureFlag(FEATURE_FLAGS.ENABLE_WORKSPACE_ANALYTICS);

  // You can also use the component-based approach
  return (
    <FeatureFlag
      flag={FEATURE_FLAGS.ENABLE_WORKSPACE_ANALYTICS}
      fallback={
        // Show a teaser when the feature is not enabled
        <Card className={cn('border-dashed', className)}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Analytics Coming Soon
            </CardTitle>
            <CardDescription>
              Advanced analytics and insights for your workspace will be available soon.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 opacity-50">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm">Trend Analysis</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="text-sm">Contributor Insights</span>
              </div>
              <div className="flex items-center gap-2">
                <GitPullRequest className="h-4 w-4" />
                <span className="text-sm">PR Metrics</span>
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                <span className="text-sm">Activity Reports</span>
              </div>
            </div>
          </CardContent>
        </Card>
      }
    >
      {/* Show the full analytics dashboard when enabled */}
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Workspace Analytics
            {isAnalyticsEnabled && (
              <span className="ml-2 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-0.5 rounded">
                BETA
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Comprehensive insights and metrics for workspace {workspaceId}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Analytics content would go here */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Total Contributors</p>
                <p className="text-2xl font-bold">142</p>
                <p className="text-xs text-green-600">+12% from last month</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Active PRs</p>
                <p className="text-2xl font-bold">38</p>
                <p className="text-xs text-blue-600">8 ready to merge</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Code Velocity</p>
                <p className="text-2xl font-bold">2.3x</p>
                <p className="text-xs text-green-600">Above average</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Health Score</p>
                <p className="text-2xl font-bold">85%</p>
                <p className="text-xs text-orange-600">Good</p>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Button variant="outline" size="sm">
                View Detailed Analytics
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </FeatureFlag>
  );
}
