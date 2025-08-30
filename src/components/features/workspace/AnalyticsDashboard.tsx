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
import { Download, Filter, Brain, Star, Trophy } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type { WorkspaceRepositoryWithDetails } from '@/types/workspace';

// Import new AI-powered analytics components
import { CommunitySuccessChart } from '@/components/features/analytics/CommunitySuccessChart';
import { ChampionContributorList } from '@/components/features/analytics/ChampionContributorList';
import { RisingStarIndicator } from '@/components/features/analytics/RisingStarIndicator';
import { AchievementMatrix } from '@/components/features/analytics/AchievementMatrix';
import { ContributorImpactCard } from '@/components/features/analytics/ContributorImpactCard';

// Import AI analytics types
import type { AIEnhancedContributorProfile, CommunitySuccessMetrics } from '@/lib/analytics/ai-contributor-analyzer';

export interface AnalyticsData {
  activities: ActivityItem[];
  contributors: ContributorStat[];
  repositories: RepositoryMetric[];
  trends: TrendDataset[];
  // AI-powered analytics data
  aiEnhancedProfiles?: AIEnhancedContributorProfile[];
  communityMetrics?: CommunitySuccessMetrics;
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
  data,
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

      {/* AI-Powered Analytics Dashboard */}
      {data?.communityMetrics ? (
        <div className="space-y-6">
          {/* Community Success Overview */}
          <CommunitySuccessChart
            metrics={data.communityMetrics}
            timeRange={timeRange === 'all' ? '90d' : timeRange}
            onTimeRangeChange={(range) => setTimeRange(range as TimeRange)}
          />

          {/* Top Contributors Section */}
          {data.aiEnhancedProfiles && data.aiEnhancedProfiles.length > 0 && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Champions List */}
              <div className="xl:col-span-2">
                <ChampionContributorList
                  profiles={data.aiEnhancedProfiles}
                  showInsights={true}
                  maxChampions={tier === 'free' ? 2 : tier === 'pro' ? 3 : 5}
                />
              </div>

              {/* Rising Stars Indicator */}
              <div className="xl:col-span-1">
                <RisingStarIndicator
                  profiles={data.aiEnhancedProfiles}
                  showDetails={tier !== 'free'}
                  maxStars={tier === 'free' ? 2 : 3}
                />
              </div>
            </div>
          )}

          {/* Detailed Impact Cards for Top Contributors */}
          {data.aiEnhancedProfiles && data.aiEnhancedProfiles.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Star className="h-5 w-5 text-yellow-500" />
                <h2 className="text-xl font-semibold">Featured Contributors</h2>
                <div className="flex items-center space-x-1 text-sm text-gray-500">
                  <Brain className="h-4 w-4" />
                  <span>AI-Enhanced Insights</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {data.aiEnhancedProfiles
                  .filter(p => p.celebrationPriority === 'high')
                  .slice(0, tier === 'free' ? 2 : tier === 'pro' ? 4 : 6)
                  .map((profile, index) => (
                    <ContributorImpactCard
                      key={profile.login}
                      profile={profile}
                      rank={index + 1}
                      showFullInsights={tier !== 'free'}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Achievement Matrix */}
          {data.aiEnhancedProfiles && data.aiEnhancedProfiles.length > 0 && tier !== 'free' && (
            <AchievementMatrix
              profiles={data.aiEnhancedProfiles}
            />
          )}

          {/* Tier Upgrade CTA for Free Users */}
          {tier === 'free' && (
            <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  <span>Unlock Advanced Analytics</span>
                </CardTitle>
                <CardDescription>
                  Get deeper AI insights, more contributor analysis, and comprehensive achievement tracking
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">5+</div>
                    <div className="text-sm text-gray-600">Champions</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">90d</div>
                    <div className="text-sm text-gray-600">History</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">Full</div>
                    <div className="text-sm text-gray-600">AI Insights</div>
                  </div>
                </div>
                <Button className="w-full" size="lg">
                  Upgrade to Pro
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        /* Fallback when no AI data available */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Brain className="h-5 w-5 text-blue-500" />
              <span>AI Analytics Initializing</span>
            </CardTitle>
            <CardDescription>
              Advanced contributor insights are being generated. This may take a few minutes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-3 text-sm text-gray-600">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span>Analyzing contributor patterns...</span>
              </div>
              <div className="flex items-center space-x-3 text-sm text-gray-600">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>Generating AI insights...</span>
              </div>
              <div className="flex items-center space-x-3 text-sm text-gray-600">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                <span>Building community metrics...</span>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Once processing is complete, you'll see comprehensive analytics including champion contributors, 
                rising stars, AI-generated impact narratives, and community success metrics.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
