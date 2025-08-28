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
  TrendingUp,
  TrendingDown,
  GitPullRequest,
  GitCommit,
  MessageSquare,
  AlertCircle,
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
  1: 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white',
  2: 'bg-muted text-muted-foreground',
  3: 'bg-muted text-muted-foreground',
};

export function ContributorLeaderboard({
  contributors,
  loading = false,
  maxDisplay = 20,
  className,
}: ContributorLeaderboardProps) {
  const [sortBy, setSortBy] = useState<SortBy>('contributions');
  const [showAll, setShowAll] = useState(false);

  // Calculate activity score (similar to monthly leaderboard)
  const calculateScore = (contributor: ContributorStat) => {
    // Weight: PRs (40%), Reviews (30%), Commits (20%), Issues (10%)
    return Math.round(
      contributor.pull_requests * 40 +
        contributor.reviews * 30 +
        contributor.commits * 2 +
        contributor.issues * 10
    );
  };

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

    // Add rank and score
    return sorted.map((contributor, index) => ({
      ...contributor,
      rank: index + 1,
      score: calculateScore(contributor),
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
          const rankStyle = RANK_COLORS[contributor.rank as keyof typeof RANK_COLORS];

          return (
            <Card key={contributor.id} className="relative overflow-hidden">
              <div className="absolute top-2 right-2">
                <div
                  className={cn(
                    'h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold',
                    rankStyle || 'bg-muted text-muted-foreground'
                  )}
                >
                  {contributor.rank}
                </div>
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
              <CardContent className="relative space-y-2">
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
                {/* Activity Score Badge */}
                <div className="absolute bottom-2 right-2">
                  <div className="text-xs text-muted-foreground">
                    Score:{' '}
                    <span className="font-semibold text-foreground">{contributor.score}</span>
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
                <div className="w-8 flex justify-center">
                  <div
                    className={cn(
                      'h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold',
                      contributor.rank === 1
                        ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {contributor.rank}
                  </div>
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
                <div className="flex items-center gap-3">
                  <div className="text-right">
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
                  <div className="text-xs text-muted-foreground border-l pl-3">
                    Score: <span className="font-semibold">{contributor.score}</span>
                  </div>
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
