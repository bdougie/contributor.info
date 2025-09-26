import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  X,
  Search,
  UserPlus,
  GitCommit,
  GitPullRequest,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Minus,
} from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { humanizeNumber } from '@/lib/utils';
import { getTrendColor } from '@/lib/utils/state-mapping';

export interface Contributor {
  id: string;
  username: string;
  avatar_url: string;
  name?: string;
  bio?: string;
  company?: string;
  location?: string;
  contributions: {
    commits: number;
    pull_requests: number;
    issues: number;
    reviews: number;
    comments: number;
  };
  stats: {
    total_contributions: number;
    contribution_trend: number; // percentage change
    last_active: string;
    repositories_contributed: number;
  };
  is_tracked?: boolean;
}

export interface ContributorsListProps {
  contributors: Contributor[];
  trackedContributors?: string[];
  onTrackContributor?: (contributorId: string) => void;
  onUntrackContributor?: (contributorId: string) => void;
  onContributorClick?: (contributor: Contributor) => void;
  onAddContributor?: () => void;
  onAddToGroup?: (contributorId: string) => void;
  loading?: boolean;
  className?: string;
  view?: 'grid' | 'list';
  showHeader?: boolean;
}

function ContributorCard({
  contributor,
  isTracked,
  onTrack,
  onUntrack,
  onClick,
  onAddToGroup,
}: {
  contributor: Contributor;
  isTracked: boolean;
  onTrack?: () => void;
  onUntrack?: () => void;
  onClick?: () => void;
  onAddToGroup?: () => void;
}) {
  const trend = contributor.stats.contribution_trend;
  let TrendIcon = Minus;
  if (trend > 0) {
    TrendIcon = TrendingUp;
  } else if (trend < 0) {
    TrendIcon = TrendingDown;
  }
  const trendColor = getTrendColor(trend);

  return (
    <Card className="relative hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onAddToGroup || onClick}
              className="hover:opacity-80 transition-opacity"
              title={onAddToGroup ? "Add to group" : "View profile"}
            >
              <img
                src={contributor.avatar_url}
                alt={contributor.username}
                className="h-12 w-12 rounded-full cursor-pointer"
              />
            </button>
            <button
              onClick={onClick}
              className="text-left hover:opacity-80 transition-opacity"
            >
              <p className="font-semibold">{contributor.name || contributor.username}</p>
              <p className="text-sm text-muted-foreground">@{contributor.username}</p>
            </button>
          </div>
          <Button
            variant={isTracked ? 'ghost' : 'outline'}
            size="icon"
            className="h-10 w-10 min-h-[44px] min-w-[44px] p-0"
            onClick={isTracked ? onUntrack : onTrack}
          >
            {isTracked ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
          </Button>
        </div>

        {contributor.bio && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{contributor.bio}</p>
        )}

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <GitCommit className="h-3 w-3 text-muted-foreground" />
              <span className="text-sm font-medium">
                {humanizeNumber(contributor.contributions.commits)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Commits</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <GitPullRequest className="h-3 w-3 text-muted-foreground" />
              <span className="text-sm font-medium">
                {humanizeNumber(contributor.contributions.pull_requests)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">PRs</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <MessageSquare className="h-3 w-3 text-muted-foreground" />
              <span className="text-sm font-medium">
                {humanizeNumber(contributor.contributions.reviews)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Reviews</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t">
          <div className="flex items-center gap-1">
            <TrendIcon className={cn('h-3 w-3', trendColor)} />
            <span className={cn('text-sm', trendColor)}>
              {trend > 0 ? '+' : ''}
              {trend}%
            </span>
            <span className="text-xs text-muted-foreground">this month</span>
          </div>
          <Badge variant="secondary" className="text-xs">
            {contributor.stats.repositories_contributed} repos
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function ContributorListItem({
  contributor,
  isTracked,
  onTrack,
  onUntrack,
  onClick,
}: {
  contributor: Contributor;
  isTracked: boolean;
  onTrack?: () => void;
  onUntrack?: () => void;
  onClick?: () => void;
}) {
  const trend = contributor.stats.contribution_trend;
  let TrendIcon = Minus;
  if (trend > 0) {
    TrendIcon = TrendingUp;
  } else if (trend < 0) {
    TrendIcon = TrendingDown;
  }
  const trendColor = getTrendColor(trend);

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
      <button onClick={onClick} className="flex items-center gap-4 flex-1">
        <img
          src={contributor.avatar_url}
          alt={contributor.username}
          className="h-10 w-10 rounded-full"
        />
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <p className="font-semibold">{contributor.name || contributor.username}</p>
            <span className="text-sm text-muted-foreground">@{contributor.username}</span>
          </div>
          {contributor.bio && (
            <p className="text-sm text-muted-foreground line-clamp-1">{contributor.bio}</p>
          )}
        </div>
      </button>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <GitCommit className="h-3 w-3 text-muted-foreground" />
            <span>{humanizeNumber(contributor.contributions.commits)}</span>
          </div>
          <div className="flex items-center gap-1">
            <GitPullRequest className="h-3 w-3 text-muted-foreground" />
            <span>{humanizeNumber(contributor.contributions.pull_requests)}</span>
          </div>
          <div className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3 text-muted-foreground" />
            <span>{humanizeNumber(contributor.contributions.reviews)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <TrendIcon className={cn('h-3 w-3', trendColor)} />
          <span className={cn('text-sm', trendColor)}>
            {trend > 0 ? '+' : ''}
            {trend}%
          </span>
        </div>

        <Badge variant="secondary" className="text-xs">
          {contributor.stats.repositories_contributed} repos
        </Badge>

        <Button
          variant={isTracked ? 'ghost' : 'outline'}
          size="icon"
          className="h-10 w-10 min-h-[44px] min-w-[44px] p-0"
          onClick={(e) => {
            e.stopPropagation();
            if (isTracked) {
              onUntrack?.();
            } else {
              onTrack?.();
            }
          }}
        >
          {isTracked ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

export function ContributorsList({
  contributors,
  trackedContributors = [],
  onTrackContributor,
  onUntrackContributor,
  onContributorClick,
  onAddToGroup,
  loading = false,
  className,
  view = 'grid',
  showHeader = true,
}: ContributorsListProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredContributors = contributors.filter((contributor) => {
    const matchesSearch =
      contributor.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contributor.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contributor.bio?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  if (loading) {
    return (
      <Card className={cn('w-full', className)}>
        <CardHeader>
          <CardTitle>Contributors</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={
              view === 'grid' ? 'grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-3'
            }
          >
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!showHeader) {
    // When header is hidden, just return the content without card wrapper
    return (
      <div className={cn('w-full', className)}>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contributors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 min-h-[44px]"
            />
          </div>
        </div>

        {filteredContributors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <UserPlus className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">
              {searchTerm
                ? 'No contributors match your search'
                : 'No contributors found in selected repositories'}
            </p>
            {searchTerm && (
              <p className="text-sm text-muted-foreground mb-4">
                Try adjusting your search terms or clear the search to see all contributors
              </p>
            )}
          </div>
        ) : (
          <div
            className={
              view === 'grid' ? 'grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-3'
            }
          >
            {filteredContributors.map((contributor) => {
              const isTracked = trackedContributors.includes(contributor.id);
              if (view === 'grid') {
                return (
                  <ContributorCard
                    key={contributor.id}
                    contributor={contributor}
                    isTracked={isTracked}
                    onTrack={() => onTrackContributor?.(contributor.id)}
                    onUntrack={() => onUntrackContributor?.(contributor.id)}
                    onClick={() => onContributorClick?.(contributor)}
                    onAddToGroup={() => onAddToGroup?.(contributor.id)}
                  />
                );
              } else {
                return (
                  <ContributorListItem
                    key={contributor.id}
                    contributor={contributor}
                    isTracked={isTracked}
                    onTrack={() => onTrackContributor?.(contributor.id)}
                    onUntrack={() => onUntrackContributor?.(contributor.id)}
                    onClick={() => onContributorClick?.(contributor)}
                  />
                );
              }
            })}
          </div>
        )}
      </div>
    );
  }

  // Original card-wrapped version (for backwards compatibility)
  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Contributors</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {contributors.length} contributors from selected repositories
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contributors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 min-h-[44px]"
            />
          </div>
        </div>

        {filteredContributors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <UserPlus className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">
              {searchTerm
                ? 'No contributors match your search'
                : 'No contributors found in selected repositories'}
            </p>
            {searchTerm && (
              <p className="text-sm text-muted-foreground mb-4">
                Try adjusting your search terms or clear the search to see all contributors
              </p>
            )}
          </div>
        ) : (
          <div
            className={
              view === 'grid' ? 'grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-3'
            }
          >
            {filteredContributors.map((contributor) => {
              const isTracked = trackedContributors.includes(contributor.id);

              return view === 'grid' ? (
                <ContributorCard
                  key={contributor.id}
                  contributor={contributor}
                  isTracked={isTracked}
                  onTrack={() => onTrackContributor?.(contributor.id)}
                  onUntrack={() => onUntrackContributor?.(contributor.id)}
                  onClick={() => onContributorClick?.(contributor)}
                  onAddToGroup={() => onAddToGroup?.(contributor.id)}
                />
              ) : (
                <ContributorListItem
                  key={contributor.id}
                  contributor={contributor}
                  isTracked={isTracked}
                  onTrack={() => onTrackContributor?.(contributor.id)}
                  onUntrack={() => onUntrackContributor?.(contributor.id)}
                  onClick={() => onContributorClick?.(contributor)}
                />
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Skeleton component for loading state
export function ContributorsListSkeleton({
  className,
  view = 'grid',
}: {
  className?: string;
  view?: 'grid' | 'list';
}) {
  return <ContributorsList contributors={[]} loading={true} className={className} view={view} />;
}
