import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  GitPullRequest,
  GitCommit,
  MessageSquare,
  AlertCircle,
  Star,
  Crown,
  Users,
} from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type { ContributorStat } from './AnalyticsDashboard';
import type { TimeRange } from './TimeRangeSelector';

export interface ContributorLeaderboardProps {
  contributors: ContributorStat[];
  loading?: boolean;
  timeRange?: TimeRange;
  maxDisplay?: number;
  className?: string;
}

type SortBy = 'contributions' | 'pull_requests' | 'commits' | 'reviews' | 'issues';

const RANK_COLORS = {
  1: 'text-yellow-600 dark:text-yellow-400',
  2: 'text-gray-500 dark:text-gray-400',
  3: 'text-orange-600 dark:text-orange-400',
};

const RANK_ICONS = {
  1: Trophy,
  2: Star,
  3: Crown,
};

export function ContributorLeaderboard({
  contributors,
  loading = false,
  maxDisplay = 20,
  className,
}: ContributorLeaderboardProps) {
  const [sortBy, setSortBy] = useState<SortBy>('contributions');
  const [showAll, setShowAll] = useState(false);

  // Sort and rank contributors
  const rankedContributors = useMemo(() => {
    const sorted = [...contributors].sort((a, b) => {
      switch (sortBy) {
        case 'contributions':
          return b.contributions - a.contributions;
        case 'pull_requests':
          return b.pull_requests - a.pull_requests;
        case 'commits':
          return b.commits - a.commits;
        case 'reviews':
          return b.reviews - a.reviews;
        case 'issues':
          return b.issues - a.issues;
        default:
          return b.contributions - a.contributions;
      }
    });

    // Add rank
    return sorted.map((contributor, index) => ({
      ...contributor,
      rank: index + 1,
    }));
  }, [contributors, sortBy]);

  const displayedContributors = showAll
    ? rankedContributors
    : rankedContributors.slice(0, maxDisplay);

  const topContributor = rankedContributors[0];
  const maxContributions = topContributor?.contributions || 1;

  if (loading) {
    return (
      <div className={cn('space-y-6', className)}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <div className="h-6 w-48 bg-muted animate-pulse rounded" />
                <div className="h-4 w-64 bg-muted animate-pulse rounded mt-2" />
              </div>
              <div className="h-10 w-40 bg-muted animate-pulse rounded" />
            </div>
          </CardHeader>
        </Card>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="relative overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 bg-muted animate-pulse rounded-full" />
                  <div className="space-y-2">
                    <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                    <div className="h-3 w-32 bg-muted animate-pulse rounded" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="h-3 w-16 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (contributors.length === 0) {
    return (
      <div className={cn('space-y-6', className)}>
        <Card>
          <CardHeader>
            <CardTitle>Contributor Leaderboard</CardTitle>
            <CardDescription>Top contributors ranked by activity</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No contributors yet</p>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Contributors will appear here once they start contributing to your workspace
              repositories. Add contributors to your workspace to start tracking their activity.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with sorting */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Contributor Leaderboard</CardTitle>
              <CardDescription>Top contributors ranked by activity</CardDescription>
            </div>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortBy)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contributions">Total Activity</SelectItem>
                <SelectItem value="pull_requests">Pull Requests</SelectItem>
                <SelectItem value="commits">Commits</SelectItem>
                <SelectItem value="reviews">Reviews</SelectItem>
                <SelectItem value="issues">Issues</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {/* Top 3 Contributors */}
      <div className="grid gap-4 md:grid-cols-3">
        {rankedContributors.slice(0, 3).map((contributor) => {
          const RankIcon = RANK_ICONS[contributor.rank as keyof typeof RANK_ICONS];
          const rankColor = RANK_COLORS[contributor.rank as keyof typeof RANK_COLORS];

          return (
            <Card key={contributor.id} className="relative overflow-hidden">
              <div className="absolute top-2 right-2">
                {RankIcon && <RankIcon className={cn('h-6 w-6', rankColor)} />}
              </div>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 border-2 border-background">
                    <AvatarImage src={contributor.avatar_url} />
                    <AvatarFallback>
                      {contributor.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{contributor.username}</p>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {contributor.contributions}
                      </span>
                      contributions
                      {contributor.trend !== undefined && contributor.trend !== 0 && (
                        <span
                          className={cn(
                            'flex items-center gap-0.5 ml-1',
                            contributor.trend > 0
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          )}
                        >
                          {contributor.trend > 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {Math.abs(contributor.trend)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1">
                    <GitPullRequest className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{contributor.pull_requests} PRs</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <GitCommit className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{contributor.commits} Commits</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{contributor.reviews} Reviews</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{contributor.issues} Issues</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Full Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Contributors</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {displayedContributors.slice(3).map((contributor) => (
            <div
              key={contributor.id}
              className="flex items-center justify-between py-3 border-b last:border-0"
            >
              <div className="flex items-center gap-3">
                {/* Rank */}
                <div className="w-8 text-center">
                  <span
                    className={cn(
                      'font-semibold text-sm',
                      contributor.rank <= 3
                        ? RANK_COLORS[contributor.rank as keyof typeof RANK_COLORS]
                        : 'text-muted-foreground'
                    )}
                  >
                    #{contributor.rank}
                  </span>
                </div>

                {/* Avatar and Name */}
                <Avatar className="h-8 w-8">
                  <AvatarImage src={contributor.avatar_url} />
                  <AvatarFallback>{contributor.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{contributor.username}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{contributor.pull_requests} PRs</span>
                    <span>{contributor.commits} commits</span>
                    <span>{contributor.reviews} reviews</span>
                    <span>{contributor.issues} issues</span>
                  </div>
                </div>
              </div>

              {/* Contribution Bar and Count */}
              <div className="flex items-center gap-4">
                <div className="w-32">
                  <Progress
                    value={(contributor.contributions / maxContributions) * 100}
                    className="h-2"
                  />
                </div>
                <div className="w-20 text-right">
                  <span className="text-sm font-semibold">{contributor.contributions}</span>
                  {contributor.trend !== undefined && contributor.trend !== 0 && (
                    <Badge
                      variant="secondary"
                      className={cn(
                        'ml-1 text-xs px-1 py-0',
                        contributor.trend > 0
                          ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                          : 'bg-red-500/10 text-red-700 dark:text-red-400'
                      )}
                    >
                      {contributor.trend > 0 ? '+' : ''}
                      {contributor.trend}%
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}

          {!showAll && rankedContributors.length > maxDisplay && (
            <div className="text-center pt-4">
              <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>
                Show {rankedContributors.length - maxDisplay} more contributors
              </Button>
            </div>
          )}

          {showAll && rankedContributors.length > maxDisplay && (
            <div className="text-center pt-4">
              <Button variant="outline" size="sm" onClick={() => setShowAll(false)}>
                Show less
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
