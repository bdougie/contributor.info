import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OptimizedAvatar } from "@/components/ui/optimized-avatar";
import { useRepoStats } from "@/hooks/use-repo-stats";
import { useTimeFormatter } from "@/hooks/use-time-formatter";
import { LotteryFactor } from "@/lib/types";
import { RepositoryInlineMetadata } from "@/components/ui/repository-inline-metadata";
import { Button } from "@/components/ui/button";
import { useRepositoryMetadata } from "@/hooks/use-repository-metadata";
import { useTimeRangeStore } from "@/lib/time-range-store";
import { useState, useMemo, useEffect } from "react"
import { Clock, ChevronDown, RefreshCw } from '@/components/ui/icon';
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Define type for the extended lottery factor with additional properties
interface ExtendedLotteryFactorType extends LotteryFactor {
  score: number;
  rating: string;
}

// Type guard for ExtendedLotteryFactorType
const isExtendedLotteryFactor = (factor: unknown): factor is ExtendedLotteryFactorType => {
  return factor && 
         typeof factor === 'object' && 
         typeof factor.score === 'number' && 
         typeof factor.rating === 'string';
};

interface RepoStatsSummaryProps {
  owner?: string;
  repo?: string;
}

/**
 * Component that displays repository statistics summary
 * Demonstrates using useRepoStats hook instead of directly accessing context
 */
export function RepoStatsSummary({ owner, repo }: RepoStatsSummaryProps) {
  // Use our custom hooks
  const {
    stats,
    lotteryFactor,
    directCommitsData,
    getContributorStats,
    getFilteredPullRequests,
  } = useRepoStats();

  const { formatRelativeTime } = useTimeFormatter();
  const { metadata } = useRepositoryMetadata(owner, repo);
  const { timeRange, setTimeRange } = useTimeRangeStore();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Get filtered data based on bot inclusion setting
  const includeBots = true; // This could be a prop or state
  const filteredPRs = getFilteredPullRequests(includeBots);
  const contributorStats = getContributorStats(includeBots);

  if (stats.loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Repository Statistics</CardTitle>
          <CardDescription>Loading data...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  if (stats.error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Repository Statistics</CardTitle>
          <CardDescription>Error loading data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-destructive">{stats.error}</div>
        </CardContent>
      </Card>
    );
  }

  const totalPRs = filteredPRs.length;

  // Calculate some statistics for display
  const mergedPRs = filteredPRs.filter((pr) => pr.merged_at).length;
  const mergeRate = totalPRs > 0 ? (mergedPRs / totalPRs) * 100 : 0;

  // Determine if we should show "Load more history" button
  const shouldShowLoadMore = () => {
    // Show if data is stale/old and we have a smaller timeRange for larger repos
    const isStaleData = metadata?.dataFreshness === 'stale' || metadata?.dataFreshness === 'old';
    const isLargeRepo = metadata?.size === 'large' || metadata?.size === 'xl';
    const hasLimitedTimeRange = parseInt(timeRange) < 90; // Less than 3 months
    
    return isStaleData && isLargeRepo && hasLimitedTimeRange;
  };

  // Get next appropriate time range based on repository size
  const getNextTimeRange = () => {
    const currentDays = parseInt(timeRange);
    const repoSize = metadata?.size;
    
    if (repoSize === 'xl') {
      // XL repos: 3 -> 7 -> 14 days max
      if (currentDays <= 3) return '7';
      if (currentDays <= 7) return '14';
      return timeRange; // Don't go beyond 14 for XL
    } else if (repoSize === 'large') {
      // Large repos: 7 -> 14 -> 30 days max
      if (currentDays <= 7) return '14';
      if (currentDays <= 14) return '30';
      return timeRange; // Don't go beyond 30 for large
    }
    
    // Default progression for other sizes
    if (currentDays <= 7) return '14';
    if (currentDays <= 14) return '30';
    if (currentDays <= 30) return '90';
    return timeRange;
  };

  const handleLoadMoreHistory = () => {
    const nextRange = getNextTimeRange();
    if (nextRange !== timeRange) {
      setTimeRange(nextRange);
    }
  };

  // Get size-appropriate refresh time range
  const getSizeAppropriateRefreshRange = () => {
    const repoSize = metadata?.size;
    
    if (repoSize === 'xl') {
      return '3'; // XL repos: only 3 days for manual refresh
    } else if (repoSize === 'large') {
      return '7'; // Large repos: 7 days for manual refresh
    } else if (repoSize === 'medium') {
      return '14'; // Medium repos: 14 days for manual refresh
    }
    
    return '30'; // Small repos or unknown: 30 days
  };

  const handleManualRefresh = async () => {
    if (!owner || !repo || isRefreshing) return;
    
    setIsRefreshing(true);
    
    try {
      // Get the appropriate time range for this repository size
      const refreshTimeRange = getSizeAppropriateRefreshRange();
      
      // Emit a custom event to trigger data refresh
      const refreshEvent = new CustomEvent('manual-repository-refresh', {
        detail: {
          repository: `${owner}/${repo}`,
          timeRange: refreshTimeRange,
          repositorySize: metadata?.size,
          triggerSource: 'manual'
        }
      });
      
      window.dispatchEvent(refreshEvent);
      
      // Show a toast with size-appropriate message
      const sizeInfo = metadata?.size ? ` (${meta_data.size.toUpperCase()} repo, ${refreshTimeRange} days)` : '';
      toast.success(`Refreshing _data${sizeInfo}...`);
      
    } catch (error) {
      console.error(, error);
      toast.error('Failed to refresh _data');
      setIsRefreshing(false);
    }
  };
  
  // Handle cleanup of refresh timeout
  useEffect(() => {
    let refreshTimeout: NodeJS.Timeout;
    
    if (isRefreshing) {
      refreshTimeout = setTimeout(() => {
        setIsRefreshing(false);
      }, 2000);
    }
    
    return () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
    };
  }, [isRefreshing]);

  // Get the most recent PR - memoized for performance
  const mostRecentPR = useMemo(() => {
    return filteredPRs.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
  }, [filteredPRs]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <span>Repository Statistics</span>
              {owner && repo && (
                <RepositoryInlineMetadata owner={owner} repo={repo} />
              )}
            </CardTitle>
            <CardDescription>
              Summary of repository activity and health metrics
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="h-8 w-8 p-0"
            title={`Refresh data (${getSizeAppropriateRefreshRange()} days for ${metadata?.size || 'unknown'} size repo)`}
          >
            <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Pull Requests
            </h3>
            <div className="text-2xl font-bold">{totalPRs}</div>
            <p className="text-xs text-muted-foreground">
              {mergedPRs} merged ({mergeRate.toFixed(1)}% success rate)
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Contributors
            </h3>
            <div className="text-2xl font-bold">
              {contributorStats.totalContributors}
            </div>
            <p className="text-xs text-muted-foreground">
              {contributorStats.topContributors.length > 0
                ? `Top: ${contributorStats.topContributors[0].login}`
                : "No top contributors"}
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Lottery Factor
            </h3>
            <div className="text-2xl font-bold">
              {isExtendedLotteryFactor(lotteryFactor)
                ? lotteryFactor.score.toFixed(1)
                : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              {isExtendedLotteryFactor(lotteryFactor)
                ? lotteryFactor.rating
                : "Not calculated"}
            </p>
          </div>
        </div>

        {directCommitsData?.hasYoloCoders && (
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md p-3">
            <h3 className="font-medium text-amber-800 dark:text-amber-300">
              Warning: Direct Commits Detected
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
              {directCommitsData.yoloCoderStats.length} contributor
              {directCommitsData.yoloCoderStats.length !== 1 ? "s have" : " has"} pushed
              commits directly to the main branch, bypassing code review.
            </p>
          </div>
        )}

        {shouldShowLoadMore() && (
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-sm font-medium mb-1">Limited History Available</h3>
                <p className="text-xs text-muted-foreground">
                  Showing {timeRange} days of data. Load more history to see additional activity.
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleLoadMoreHistory}
                className="flex items-center gap-2"
                disabled={getNextTimeRange() === timeRange}
              >
                <Clock className="h-3 w-3" />
                Load More
                <ChevronDown className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        {mostRecentPR && (
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium mb-2">Most Recent Activity</h3>
            <a
              href={mostRecentPR.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block hover:bg-muted p-2 -m-2 rounded-md transition-colors"
            >
              <div className="flex items-center gap-2">
                <OptimizedAvatar
                  src={mostRecentPR.user.avatar_url}
                  alt={mostRecentPR.user.login}
                  size={24}
                  lazy={false}
                  fallback={mostRecentPR.user.login[0]?.toUpperCase() || '?'}
                  className="w-6 h-6"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {mostRecentPR.title}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <span>#{mostRecentPR.number}</span>
                    <span>·</span>
                    <span>{mostRecentPR.user.login}</span>
                    <span>·</span>
                    <span>{formatRelativeTime(mostRecentPR.created_at)}</span>
                  </div>
                </div>
              </div>
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
