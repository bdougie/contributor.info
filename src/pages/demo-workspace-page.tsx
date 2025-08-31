import { useState, useMemo, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { WorkspaceExportService } from '@/services/workspace-export.service';
import { WorkspaceDashboard } from '@/components/features/workspace';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Sparkles, GitPullRequest, AlertCircle } from '@/components/ui/icon';

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
import { TrendChart } from '@/components/features/workspace/TrendChart';
import { ContributorLeaderboard } from '@/components/features/workspace/ContributorLeaderboard';
import { RisingStarsChart } from '@/components/features/analytics/RisingStarsChart';
import { calculateRisingStars } from '@/lib/analytics/rising-stars-data';

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

  const demoTrendData = useMemo(() => {
    // Generate trend data with proper structure
    const days = TIME_RANGE_DAYS[timeRange];
    const labels = Array.from({ length: days }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (days - i - 1));
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    return {
      labels,
      datasets: [
        {
          label: 'Pull Requests',
          data: Array.from({ length: days }, () => Math.floor(Math.random() * 20) + 5),
          color: '#10B981',
        },
        {
          label: 'Issues',
          data: Array.from({ length: days }, () => Math.floor(Math.random() * 15) + 3),
          color: '#3B82F6',
        },
        {
          label: 'Commits',
          data: Array.from({ length: days }, () => Math.floor(Math.random() * 30) + 10),
          color: '#8B5CF6',
        },
      ],
    };
  }, [timeRange]);

  // Generate rising stars data
  const risingStarsData = useMemo(() => {
    // Convert demo analytics data to the format expected by calculateRisingStars
    const contributorMetrics = demoAnalyticsData.contributors.map((contributor, idx) => ({
      contributor: {
        id: `contributor-${idx}`,
        github_id: Math.floor(Math.random() * 100000),
        username: contributor.username,
        display_name: contributor.username,
        avatar_url: contributor.avatar_url || '',
        profile_url: `https://github.com/${contributor.username}`,
        is_bot: false,
        first_seen_at: new Date(
          Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000
        ).toISOString(),
        last_updated_at: new Date().toISOString(),
        is_active: true,
      },
      pullRequests: [] as any, // Use empty array for demo data
      commitCount: Math.floor(Math.random() * 50) + 5,
      issueCount: Math.floor(Math.random() * 20) + 2,
      commentCount: Math.floor(Math.random() * 30) + 3,
      reviewCount: Math.floor(Math.random() * 15) + 1,
      discussionCount: Math.floor(Math.random() * 10),
    }));

    return calculateRisingStars(contributorMetrics, {
      timeWindowDays: TIME_RANGE_DAYS[timeRange],
      minActivity: 3,
      newContributorDays: 90,
    });
  }, [demoAnalyticsData.contributors, demoAnalyticsData.activities, timeRange]);

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
            <TabsTrigger value="prs">Pull Requests</TabsTrigger>
            <TabsTrigger value="issues">Issues</TabsTrigger>
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
            >
              {/* Rising Stars Chart */}
              <RisingStarsChart
                data={risingStarsData}
                height={400}
                maxBubbles={30}
                className="mt-6"
              />
            </WorkspaceDashboard>

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
                  <CardTitle>Activity Trends</CardTitle>
                  <CardDescription>Repository activity over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <TrendChart title="" data={demoTrendData} height={300} showLegend={true} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Code Activity</CardTitle>
                  <CardDescription>Daily code changes (additions vs deletions)</CardDescription>
                </CardHeader>
                <CardContent>
                  <ActivityChart title="" data={demoActivityData} height={300} />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Activity Timeline</CardTitle>
                <CardDescription>Recent activity across all repositories</CardDescription>
              </CardHeader>
              <CardContent>
                <ActivityTable
                  activities={demoAnalyticsData.activities.slice(0, 10)}
                  loading={false}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="prs" className="space-y-6">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GitPullRequest className="h-5 w-5" />
                    Pull Requests Overview
                  </CardTitle>
                  <CardDescription>
                    Recent pull request activity across all repositories
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="p-4 rounded-lg bg-muted">
                      <div className="text-2xl font-bold">142</div>
                      <div className="text-sm text-muted-foreground">Open PRs</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <div className="text-2xl font-bold">89</div>
                      <div className="text-sm text-muted-foreground">Merged Today</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <div className="text-2xl font-bold">23</div>
                      <div className="text-sm text-muted-foreground">Awaiting Review</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <div className="text-2xl font-bold">1.2h</div>
                      <div className="text-sm text-muted-foreground">Avg. Time to Merge</div>
                    </div>
                  </div>
                  <ActivityTable
                    activities={demoAnalyticsData.activities
                      .filter((a) => a.type === 'pr')
                      .slice(0, 20)}
                    loading={false}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="issues" className="space-y-6">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Issues Overview
                  </CardTitle>
                  <CardDescription>
                    Track and manage issues across your repositories
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="p-4 rounded-lg bg-muted">
                      <div className="text-2xl font-bold">287</div>
                      <div className="text-sm text-muted-foreground">Open Issues</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <div className="text-2xl font-bold">45</div>
                      <div className="text-sm text-muted-foreground">Closed Today</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <div className="text-2xl font-bold">62</div>
                      <div className="text-sm text-muted-foreground">High Priority</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <div className="text-2xl font-bold">3.4d</div>
                      <div className="text-sm text-muted-foreground">Avg. Resolution</div>
                    </div>
                  </div>
                  <ActivityTable
                    activities={demoAnalyticsData.activities
                      .filter((a) => a.type === 'issue')
                      .slice(0, 20)}
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
