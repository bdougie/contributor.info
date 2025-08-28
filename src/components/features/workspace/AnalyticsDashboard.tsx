import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TimeRangeSelector, TimeRange } from './TimeRangeSelector';
import { Download, Filter } from '@/components/ui/icon';
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
  repositories = [],
  tier = 'free',
  onExport,
  className,
}: Omit<AnalyticsDashboardProps, 'workspaceId'>) {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [selectedRepos, setSelectedRepos] = useState<string[]>([]);

  const tierLimits = TIER_LIMITS[tier];

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
              <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
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
              {repositories
                .slice(
                  0,
                  tierLimits.maxRepositories === -1 ? undefined : tierLimits.maxRepositories
                )
                .map((repo) => (
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

      {/* Analytics content - temporarily empty for redesign */}
      <Card>
        <CardHeader>
          <CardTitle>Analytics Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Analytics dashboard is being redesigned. Please check back soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
