import { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ActivityTable } from './ActivityTable';
import { ContributorLeaderboard } from './ContributorLeaderboard';
import { RepositoryComparison } from './RepositoryComparison';
import { TrendChart } from './TrendChart';
import { TimeRangeSelector, TimeRange } from './TimeRangeSelector';
import { Download, Filter, BarChart3, Users, GitBranch, TrendingUp } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type { WorkspaceRepositoryWithDetails } from '@/types/workspace';

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
  author: {
    username: string;
    avatar_url?: string;
  };
  repository: string;
  created_at: string;
  status?: string;
  url?: string;
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

export function AnalyticsDashboard({
  workspaceId: _workspaceId,
  data,
  repositories = [],
  loading = false,
  tier = 'free',
  onExport,
  className,
}: AnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [selectedTab, setSelectedTab] = useState('overview');
  const [selectedRepos, setSelectedRepos] = useState<string[]>([]);
  const [activityFilter, setActivityFilter] = useState<string>('all');

  const tierLimits = TIER_LIMITS[tier];

  // Filter data based on selected repositories
  const filteredData = useMemo(() => {
    if (selectedRepos.length === 0) return data;

    return {
      activities: data.activities.filter((a) => 
        selectedRepos.some(repoId => {
          const repo = repositories.find(r => r.id === repoId);
          return repo && a.repository === `${repo.repository.owner}/${repo.repository.name}`;
        })
      ),
      contributors: data.contributors,
      repositories: data.repositories.filter((r) =>
        selectedRepos.includes(r.id)
      ),
      trends: data.trends,
    };
  }, [data, selectedRepos, repositories]);

  // Filter activities based on type
  const filteredActivities = useMemo(() => {
    if (activityFilter === 'all') return filteredData.activities;
    return filteredData.activities.filter((a) => a.type === activityFilter);
  }, [filteredData.activities, activityFilter]);

  const handleExport = (format: 'csv' | 'json' | 'pdf') => {
    if (tierLimits.exportFormats.includes(format)) {
      onExport?.(format);
    }
  };

  const handleRepositorySelect = (repoIds: string[]) => {
    if (tierLimits.maxRepositories === -1 || repoIds.length <= tierLimits.maxRepositories) {
      setSelectedRepos(repoIds);
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Analytics Dashboard</CardTitle>
              <CardDescription>
                Comprehensive insights across your workspace repositories
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <TimeRangeSelector
                value={timeRange}
                onChange={setTimeRange}
              />
              {tierLimits.exportFormats.length > 0 && (
                <Select onValueChange={(value) => handleExport(value as 'csv' | 'json' | 'pdf')}>
                  <SelectTrigger className="w-32">
                    <Download className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Export" />
                  </SelectTrigger>
                  <SelectContent>
                    {tierLimits.exportFormats.map((format) => (
                      <SelectItem key={format} value={format}>
                        Export {format.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Repository Filter */}
      {repositories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filter by Repository
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedRepos.length === 0 ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedRepos([])}
              >
                All Repositories
              </Button>
              {repositories.slice(0, tierLimits.maxRepositories === -1 ? undefined : tierLimits.maxRepositories).map((repo) => (
                <Button
                  key={repo.id}
                  variant={selectedRepos.includes(repo.id) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    if (selectedRepos.includes(repo.id)) {
                      setSelectedRepos(selectedRepos.filter((id) => id !== repo.id));
                    } else {
                      handleRepositorySelect([...selectedRepos, repo.id]);
                    }
                  }}
                >
                  {repo.repository.name}
                </Button>
              ))}
            </div>
            {tier === 'free' && repositories.length > tierLimits.maxRepositories && (
              <p className="text-sm text-muted-foreground mt-2">
                Upgrade to Pro to compare more than {tierLimits.maxRepositories} repositories
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main Analytics Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="contributors" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Contributors
          </TabsTrigger>
          <TabsTrigger value="repositories" className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            Repositories
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Trend Charts */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Pull Requests Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <TrendChart
                  title=""
                  data={{
                    labels: filteredData.trends[0]?.data.map(d => d.date) || [],
                    datasets: [{
                      label: 'Pull Requests',
                      data: filteredData.trends[0]?.data.map(d => d.value) || [],
                      color: '#10b981',
                    }],
                  }}
                  loading={loading}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contributor Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <TrendChart
                  title=""
                  data={{
                    labels: filteredData.trends[1]?.data.map(d => d.date) || [],
                    datasets: [{
                      label: 'Active Contributors',
                      data: filteredData.trends[1]?.data.map(d => d.value) || [],
                      color: '#3b82f6',
                    }],
                  }}
                  loading={loading}
                />
              </CardContent>
            </Card>
          </div>

          {/* Quick Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Contributors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredData.contributors.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredData.activities.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Active Repositories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredData.repositories.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Activity Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round(
                    filteredData.repositories.reduce((sum, r) => sum + r.activity_score, 0) /
                    (filteredData.repositories.length || 1)
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Activity</CardTitle>
                <Select value={activityFilter} onValueChange={setActivityFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="pr">Pull Requests</SelectItem>
                    <SelectItem value="issue">Issues</SelectItem>
                    <SelectItem value="commit">Commits</SelectItem>
                    <SelectItem value="review">Reviews</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ActivityTable
                activities={filteredActivities}
                loading={loading}
                pageSize={50}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contributors">
          <ContributorLeaderboard
            contributors={filteredData.contributors}
            loading={loading}
            timeRange={timeRange}
          />
        </TabsContent>

        <TabsContent value="repositories">
          <RepositoryComparison
            repositories={filteredData.repositories}
            loading={loading}
            maxRepositories={tierLimits.maxRepositories === -1 ? 10 : tierLimits.maxRepositories}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}