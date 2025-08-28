import React, { useState, lazy, Suspense, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { TimeRangeSelector, TimeRange } from './TimeRangeSelector';
import { Download } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { AnalyticsErrorBoundary } from './ErrorBoundary';
import {
  AnalyticsDashboardSkeleton,
  ChartSkeleton,
  LeaderboardSkeleton,
  ActivityTableSkeleton,
} from './skeletons/AnalyticsSkeletons';
import { exportToCSV, exportToJSON } from './utils/analytics-utils';
import { useScreenReaderAnnounce } from './hooks/useAccessibility';
import type { WorkspaceRepositoryWithDetails } from '@/types/workspace';

// Lazy load heavy components for better initial load
const ActivityTable = lazy(() =>
  import('./ActivityTableRefactored').then((m) => ({ default: m.ActivityTable }))
);
const ContributorLeaderboard = lazy(() => import('./ContributorLeaderboard'));
const RepositoryComparison = lazy(() => import('./RepositoryComparison'));
const ActivityChart = lazy(() => import('./ActivityChart'));

// Type definitions
export interface AnalyticsData {
  activities: ActivityItem[];
  contributors: ContributorStat[];
  repositories: RepositoryMetric[];
  trends: TrendDataset[];
}

export interface ActivityItem {
  id: string;
  type: 'pr' | 'issue' | 'commit' | 'review';
  title: string;
  description?: string;
  author: {
    username: string;
    avatar?: string;
  };
  repository: string;
  created_at: string;
  status: 'open' | 'merged' | 'closed' | 'approved' | 'changes_requested';
  url: string;
}

export interface ContributorStat {
  id: string;
  username: string;
  avatar_url?: string;
  contributions: number;
  pull_requests: number;
  issues: number;
  reviews: number;
  commits: number;
  rank?: number;
  trend?: number;
}

export interface RepositoryMetric {
  id: string;
  name: string;
  owner: string;
  stars: number;
  forks: number;
  pull_requests: number;
  issues: number;
  contributors: number;
  activity_score: number;
  trend?: number;
}

export interface TrendDataset {
  label: string;
  data: Array<{
    date: string;
    value: number;
  }>;
  color?: string;
}

export interface AnalyticsDashboardProps {
  workspaceId: string;
  data: AnalyticsData;
  repositories?: WorkspaceRepositoryWithDetails[];
  loading?: boolean;
  tier?: 'free' | 'pro' | 'enterprise';
  onExport?: (format: 'csv' | 'json' | 'pdf') => void;
  className?: string;
}

const TIER_LIMITS = {
  free: {
    historyDays: 30,
    maxRepositories: 3,
    exportFormats: [] as string[],
  },
  pro: {
    historyDays: 90,
    maxRepositories: 5,
    exportFormats: ['csv', 'json'],
  },
  enterprise: {
    historyDays: 365,
    maxRepositories: -1, // unlimited
    exportFormats: ['csv', 'json', 'pdf'],
  },
};

// Memoized metric card component
const MetricCard = memo(
  ({
    title,
    value,
    change,
    icon,
  }: {
    title: string;
    value: string | number;
    change?: number;
    icon?: React.ReactNode;
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change !== undefined && (
          <p
            className={cn(
              'text-xs',
              change > 0 ? 'text-green-600' : (change < 0 ? 'text-red-600' : 'text-muted-foreground')
            )}
          >
            {change > 0 ? '+' : ''}
            {change}% from last period
          </p>
        )}
      </CardContent>
    </Card>
  )
);

MetricCard.displayName = 'MetricCard';

// Main dashboard component
export const AnalyticsDashboard = memo(
  ({
    data,
    repositories = [],
    loading = false,
    tier = 'free',
    onExport,
    className,
  }: AnalyticsDashboardProps) => {
    const [timeRange, setTimeRange] = useState<TimeRange>({
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: new Date(),
      period: '30d',
    });
    const [activeTab, setActiveTab] = useState<
      'overview' | 'activity' | 'contributors' | 'repositories'
    >('overview');

    const announce = useScreenReaderAnnounce();
    const limits = TIER_LIMITS[tier];

    // Handle export with proper error handling
    const handleExport = async (format: 'csv' | 'json' | 'pdf') => {
      try {
        announce(`Exporting data as ${format.toUpperCase()}`);

        if (format === 'csv') {
          await exportToCSV(data.activities, 'analytics-export');
        } else if (format === 'json') {
          await exportToJSON(data, 'analytics-export');
        } else if (format === 'pdf' && onExport) {
          onExport(format);
        }

        announce(`Export completed successfully`);
      } catch (error) {
        console.error('Export failed:', error);
        announce(`Export failed. Please try again.`);
      }
    };

    if (loading) {
      return <AnalyticsDashboardSkeleton />;
    }

    return (
      <div className={cn('space-y-6', className)}>
        {/* Header with controls */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Analytics Dashboard</h2>
            <p className="text-muted-foreground">
              Track performance and activity across your workspace
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <TimeRangeSelector
              value={timeRange}
              onChange={setTimeRange}
              maxDays={limits.historyDays}
              aria-label="Select time range for analytics"
            />

            {limits.exportFormats.length > 0 && (
              <Select onValueChange={handleExport}>
                <SelectTrigger className="w-32" aria-label="Export data">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </SelectTrigger>
                <SelectContent>
                  {limits.exportFormats.map((format) => (
                    <SelectItem key={format} value={format}>
                      {format.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-2 border-b" role="tablist">
          {(['overview', 'activity', 'contributors', 'repositories'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors',
                'hover:text-primary',
                activeTab === tab
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground'
              )}
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`tabpanel-${tab}`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab panels */}
        <div role="tabpanel" id={`tabpanel-${activeTab}`}>
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Metrics grid */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard title="Total Activities" value={data.activities.length} change={12} />
                <MetricCard
                  title="Active Contributors"
                  value={data.contributors.length}
                  change={-5}
                />
                <MetricCard title="Repositories" value={repositories.length} change={0} />
                <MetricCard
                  title="Avg. Activity Score"
                  value={Math.round(
                    data.repositories.reduce((acc, r) => acc + r.activity_score, 0) /
                      data.repositories.length
                  )}
                  change={8}
                />
              </div>

              {/* Charts */}
              <div className="grid gap-6 lg:grid-cols-2">
                <AnalyticsErrorBoundary>
                  <Suspense fallback={<ChartSkeleton />}>
                    <ActivityChart
                      data={data.trends}
                      title="Activity Trends"
                      description="Activity over time across all repositories"
                    />
                  </Suspense>
                </AnalyticsErrorBoundary>

                <AnalyticsErrorBoundary>
                  <Suspense fallback={<LeaderboardSkeleton />}>
                    <ContributorLeaderboard
                      contributors={data.contributors.slice(0, 5)}
                      title="Top Contributors"
                    />
                  </Suspense>
                </AnalyticsErrorBoundary>
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <AnalyticsErrorBoundary>
              <Suspense fallback={<ActivityTableSkeleton />}>
                <ActivityTable activities={data.activities} pageSize={50} />
              </Suspense>
            </AnalyticsErrorBoundary>
          )}

          {activeTab === 'contributors' && (
            <AnalyticsErrorBoundary>
              <Suspense fallback={<LeaderboardSkeleton />}>
                <ContributorLeaderboard
                  contributors={data.contributors}
                  title="All Contributors"
                  showAll
                />
              </Suspense>
            </AnalyticsErrorBoundary>
          )}

          {activeTab === 'repositories' && (
            <AnalyticsErrorBoundary>
              <Suspense fallback={<ChartSkeleton />}>
                <RepositoryComparison
                  repositories={data.repositories}
                  title="Repository Comparison"
                />
              </Suspense>
            </AnalyticsErrorBoundary>
          )}
        </div>

        {/* Tier limitation notice */}
        {tier === 'free' && (
          <Card className="border-dashed">
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">
                <strong>Free tier limitations:</strong> 30-day history, 3 repositories max, no
                exports.
                <Button
                  variant="link"
                  className="px-2"
                  onClick={() => window.open('/pricing', '_blank')}
                >
                  Upgrade to Pro
                </Button>
                for extended features.
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }
);

AnalyticsDashboard.displayName = 'AnalyticsDashboard';
