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

// Define type for the extended lottery factor with additional properties
interface ExtendedLotteryFactorType extends LotteryFactor {
  score: number;
  rating: string;
}

/**
 * Component that displays repository statistics summary
 * Demonstrates using useRepoStats hook instead of directly accessing context
 */
export function RepoStatsSummary() {
  // Use our custom hooks
  const {
    stats,
    lotteryFactor,
    directCommitsData,
    getContributorStats,
    getFilteredPullRequests,
  } = useRepoStats();

  const { formatRelativeTime } = useTimeFormatter();

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

  // Get the most recent PR
  const mostRecentPR = filteredPRs.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Repository Statistics</CardTitle>
        <CardDescription>
          Summary of repository activity and health metrics
        </CardDescription>
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
              {lotteryFactor
                ? (lotteryFactor as ExtendedLotteryFactorType).score.toFixed(1)
                : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              {lotteryFactor
                ? (lotteryFactor as ExtendedLotteryFactorType).rating
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
