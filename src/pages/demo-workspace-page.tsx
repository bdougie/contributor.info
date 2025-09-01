import { useState, useMemo, lazy, Suspense, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { WorkspaceDashboard } from '@/components/features/workspace';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Info, Sparkles, GitPullRequest, AlertCircle, Layout, X } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

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
// Lazy load heavy components
const ContributorLeaderboard = lazy(() =>
  import('@/components/features/workspace/ContributorLeaderboard').then((m) => ({
    default: m.ContributorLeaderboard,
  }))
);
import { RisingStarsChart } from '@/components/features/analytics/RisingStarsChart';
import { generateRisingStarsData } from '@/lib/demo/rising-stars-generator';

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
  const [expandedChart, setExpandedChart] = useState<'trends' | 'activity' | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  // Generate rising stars data using extracted functions for better maintainability
  const risingStarsData = useMemo(() => {
    return generateRisingStarsData(demoAnalyticsData.contributors);
  }, [demoAnalyticsData.contributors]);

  const handleTabChange = (value: string) => {
    if (value === 'overview') {
      navigate(`/i/demo`);
    } else {
      navigate(`/i/demo/${value}`);
    }
  };

  const toggleChartExpansion = (chart: 'trends' | 'activity') => {
    setExpandedChart(expandedChart === chart ? null : chart);
  };

  const getTrendChartHeight = () => {
    if (expandedChart === 'trends') {
      return isMobile ? 300 : 500;
    }
    return isMobile ? 250 : 300;
  };

  const getActivityChartHeight = () => {
    if (expandedChart === 'activity') {
      return isMobile ? 300 : 500;
    }
    return isMobile ? 250 : 300;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container px-4 py-6">
        {/* Demo workspace banner */}
        <Alert className="mb-6 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <Sparkles className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Demo Workspace</strong> - This workspace uses sample data to showcase
            contributor.info's features. All data shown here is generated for demonstration
            purposes.
          </AlertDescription>
        </Alert>

        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
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
          <TabsList className="grid grid-cols-5 w-full sm:w-auto">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">
              Overview
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs sm:text-sm">
              Activity
            </TabsTrigger>
            <TabsTrigger value="prs" className="text-xs sm:text-sm">
              PRs
            </TabsTrigger>
            <TabsTrigger value="issues" className="text-xs sm:text-sm">
              Issues
            </TabsTrigger>
            <TabsTrigger value="contributors" className="text-xs sm:text-sm">
              Contributors
            </TabsTrigger>
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

          <TabsContent value="activity" className="space-y-6">
            <div className={cn('grid gap-6', expandedChart ? 'grid-cols-1' : 'lg:grid-cols-2')}>
              {(!expandedChart || expandedChart === 'trends') && (
                <Card
                  className={cn(
                    'transition-all duration-300',
                    expandedChart === 'trends' && 'col-span-full'
                  )}
                >
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Activity Trends</CardTitle>
                      <CardDescription>Repository activity over time</CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleChartExpansion('trends')}
                      className="h-8 w-8"
                    >
                      {expandedChart === 'trends' ? (
                        <X className="h-4 w-4" />
                      ) : (
                        <Layout className="h-4 w-4" />
                      )}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <TrendChart
                      title=""
                      data={demoTrendData}
                      height={getTrendChartHeight()}
                      showLegend={true}
                    />
                  </CardContent>
                </Card>
              )}

              {(!expandedChart || expandedChart === 'activity') && (
                <Card
                  className={cn(
                    'transition-all duration-300',
                    expandedChart === 'activity' && 'col-span-full'
                  )}
                >
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Code Activity</CardTitle>
                      <CardDescription>Daily code changes (additions vs deletions)</CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleChartExpansion('activity')}
                      className="h-8 w-8"
                    >
                      {expandedChart === 'activity' ? (
                        <X className="h-4 w-4" />
                      ) : (
                        <Layout className="h-4 w-4" />
                      )}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <ActivityChart
                      title=""
                      data={demoActivityData}
                      height={getActivityChartHeight()}
                    />
                  </CardContent>
                </Card>
              )}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Activity Timeline</CardTitle>
                <CardDescription>Recent activity across all repositories</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                  <ActivityTable
                    activities={demoAnalyticsData.activities.slice(0, 10)}
                    loading={false}
                  />
                </div>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
                  <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                    <ActivityTable
                      activities={demoAnalyticsData.activities
                        .filter((a) => a.type === 'pr')
                        .slice(0, 20)}
                      loading={false}
                    />
                  </div>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
                  <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                    <ActivityTable
                      activities={demoAnalyticsData.activities
                        .filter((a) => a.type === 'issue')
                        .slice(0, 20)}
                      loading={false}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="contributors" className="space-y-6">
            <Suspense
              fallback={
                <Card>
                  <CardHeader>
                    <CardTitle>Top Contributors</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-muted animate-pulse rounded-full" />
                            <div className="space-y-1">
                              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                              <div className="h-3 w-32 bg-muted animate-pulse rounded" />
                            </div>
                          </div>
                          <div className="h-5 w-12 bg-muted animate-pulse rounded" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              }
            >
              <ContributorLeaderboard
                contributors={demoAnalyticsData.contributors}
                loading={false}
              />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default DemoWorkspacePage;
