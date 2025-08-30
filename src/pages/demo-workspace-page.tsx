import { useState, useMemo, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { WorkspaceExportService } from '@/services/workspace-export.service';
import { WorkspaceDashboard } from '@/components/features/workspace';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Sparkles } from '@/components/ui/icon';

// Lazy load the heavy analytics dashboard
const AnalyticsDashboard = lazy(() =>
  import('@/components/features/workspace/AnalyticsDashboard').then((m) => ({
    default: m.AnalyticsDashboard,
  }))
);

// Import demo data cache
import {
  getCachedAnalyticsData,
  getCachedWorkspaceRepositories,
  getCachedWorkspaceMetrics,
  getCachedWorkspaceTrendData,
  getCachedRepositories,
} from '@/lib/demo/demo-data-cache';

import {
  TimeRangeSelector,
  type TimeRange,
} from '@/components/features/workspace/TimeRangeSelector';
import { ActivityTable } from '@/components/features/workspace/ActivityTable';
import { ActivityChart } from '@/components/features/workspace/ActivityChart';
import { ContributorLeaderboard } from '@/components/features/workspace/ContributorLeaderboard';

// Time range mappings
const TIME_RANGE_DAYS = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
  all: 730,
} as const;

export function DemoWorkspacePage() {
  const { workspaceId = 'demo', tab } = useParams<{ workspaceId: string; tab?: string }>();
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [tier] = useState<'free' | 'pro' | 'enterprise'>('pro');

  // Generate demo data with caching
  const demoAnalyticsData = useMemo(() => getCachedAnalyticsData(), []);
  const demoRepositories = useMemo(
    () => getCachedWorkspaceRepositories(workspaceId),
    [workspaceId]
  );
  const demoRepos = useMemo(() => getCachedRepositories(), []);

  // Generate time-range aware metrics and trends with caching
  const demoMetrics = useMemo(
    () => getCachedWorkspaceMetrics(demoRepos, timeRange),
    [demoRepos, timeRange]
  );

  const demoActivityData = useMemo(
    () => getCachedWorkspaceTrendData(TIME_RANGE_DAYS[timeRange], demoRepos),
    [demoRepos, timeRange]
  );

  const handleTabChange = (value: string) => {
    if (value === 'overview') {
      navigate(`/i/demo`);
    } else {
      navigate(`/i/demo/${value}`);
    }
  };

  const handleExport = async (format: 'csv' | 'json' | 'pdf') => {
    try {
      await WorkspaceExportService.export(demoAnalyticsData, format, {
        workspaceName: 'Demo Workspace',
        dateRange: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date(),
        },
      });
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        {/* Demo workspace banner */}
        <Alert className="mb-6 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <Sparkles className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            <strong>Demo Workspace</strong> - This workspace uses sample data to showcase
            contributor.info's features. All data shown here is generated for demonstration
            purposes.
          </AlertDescription>
        </Alert>

        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Sparkles className="h-8 w-8 text-primary" />
                Demo Workspace
              </h1>
              <p className="text-muted-foreground mt-2">
                Explore contributor analytics with sample data
              </p>
            </div>
            <TimeRangeSelector
              value={timeRange}
              onChange={setTimeRange}
              data-testid="time-range-selector"
            />
          </div>
        </div>

        <Tabs value={tab || 'overview'} onValueChange={handleTabChange} className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="contributors">Contributors</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <WorkspaceDashboard
              workspaceId="demo"
              workspaceName="Demo Workspace"
              metrics={demoMetrics}
              trendData={{ labels: [], datasets: [] }} // Empty for now
              activityData={demoActivityData}
              repositories={demoRepos}
              loading={false}
              tier={tier}
              timeRange={timeRange}
            />

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  About This Demo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  This demo workspace showcases the full power of contributor.info's analytics
                  platform. The data you see here is generated using deterministic algorithms to
                  provide a realistic view of how the platform works with actual repository data.
                </p>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <h4 className="font-medium text-foreground mb-1">Sample Repositories</h4>
                    <p className="text-muted-foreground">
                      {demoRepositories.length} repositories with varied languages and activities
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground mb-1">Generated Activities</h4>
                    <p className="text-muted-foreground">
                      {demoAnalyticsData.activities.length} activities across the last 30 days
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground mb-1">Contributors</h4>
                    <p className="text-muted-foreground">
                      {demoAnalyticsData.contributors.length} active contributors
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Suspense
              fallback={
                <div className="flex items-center justify-center min-h-[400px]">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              }
            >
              <AnalyticsDashboard
                data={demoAnalyticsData}
                repositories={demoRepositories}
                loading={false}
                tier={tier}
                onExport={handleExport}
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="activity" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <ActivityChart title="Activity Trends" data={demoActivityData} height={300} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Activity Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <ActivityTable
                    activities={demoAnalyticsData.activities.slice(0, 10)}
                    loading={false}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="contributors" className="space-y-6">
            <ContributorLeaderboard contributors={demoAnalyticsData.contributors} loading={false} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default DemoWorkspacePage;
