import { useState } from "react"
import { GitPullRequest, Users } from '@/components/ui/icon';
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTimeRangeStore } from "@/lib/time-range-store";
import { useProgressiveRepoData } from "@/hooks/use-progressive-repo-data";
import { useLazyLoadData } from "@/hooks/use-intersection-observer";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

/**
 * Progressive Repository View that loads data in stages:
 * 1. Critical metrics (immediate)
 * 2. Full data (after critical)
 * 3. Enhancement data (background)
 * 
 * This component demonstrates the progressive loading pattern
 * for optimal Core Web Vitals performance.
 */
export function ProgressiveRepoView() {
  const { owner, repo } = useParams();
  const timeRange = useTimeRangeStore((state) => state.timeRange);
  const [includeBots] = useState(false);
  
  const progressiveData = useProgressiveRepoData(
    owner,
    repo,
    timeRange,
    includeBots
  );

  // Example of lazy loading a heavy component
  const { 
    ref: chartRef, 
    data: chartData, 
    loading: chartLoading 
  } = useLazyLoadData(
    async () => {
      // Simulate loading chart data
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { loaded: true };
    },
    { rootMargin: '100px' } // Start loading 100px before visible
  );

  return (
    <div className="space-y-6">
      {/* Stage 1: Critical Metrics - Render immediately */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pull Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {!progressiveData.basicInfo
? (
                <Skeleton className="h-8 w-20" />
              )
: (
                <div className="flex items-center gap-2">
                  <GitPullRequest className="h-5 w-5 text-muted-foreground" />
                  {progressiveData.basicInfo?.prCount || 0}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Contributors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {!progressiveData.basicInfo
? (
                <Skeleton className="h-8 w-20" />
              )
: (
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  {progressiveData.basicInfo?.contributorCount || 0}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Top Contributors</CardTitle>
          </CardHeader>
          <CardContent>
            {!progressiveData.basicInfo ? (
              <div className="flex -space-x-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-8 rounded-full" />
                ))}
              </div>
            ) : (
              <div className="flex -space-x-2">
                {progressiveData.basicInfo?.topContributors.map((contributor: unknown, i: number) => (
                  <Avatar key={contributor.id} className="h-8 w-8 border-2 border-background">
                    <AvatarImage 
                      src={`${contributor.avatar_url}?s=64`} 
                      alt={contributor.username}
                      loading={i < 3 ? "eager" : "lazy"} // Eager load first 3
                    />
                    <AvatarFallback>{contributor.username[0]}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stage 2: Full Data - Render when available */}
      {(progressiveData.stats.loading || progressiveData.stats.pullRequests.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Repository Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {progressiveData.stats.loading
? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            )
: (
              <div>
                <p className="text-sm text-muted-foreground">
                  {progressiveData.stats?.pullRequests.length || 0} pull requests in the last {timeRange} days
                </p>
                {progressiveData.lotteryFactor && (
                  <p className="text-sm mt-2">
                    Lottery Factor: {progressiveData.lotteryFactor.riskLevel} ({progressiveData.lotteryFactor.topContributorsPercentage.toFixed(1)}% from top {progressiveData.lotteryFactor.topContributorsCount} contributors)
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stage 3: Enhancement Data - Background loading */}
      {progressiveData.directCommitsData && (
        <Card>
          <CardHeader>
            <CardTitle>Direct Commits</CardTitle>
          </CardHeader>
          <CardContent>
            {!progressiveData.stageProgress.enhancement
? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            )
: (
              <div>
                <p className="text-sm text-muted-foreground">
                  {progressiveData.directCommitsData?.hasYoloCoders ? `${progressiveData.directCommitsData.yoloCoderStats.length} YOLO coders detected` : 'No YOLO coders'}
                </p>
                {progressiveData.directCommitsData?.yoloCoderStats && progressiveData.directCommitsData.yoloCoderStats.length > 0 && (
                  <p className="text-sm mt-1">
                    Top YOLO coder: {progressiveData.directCommitsData.yoloCoderStats[0].login} ({progressiveData.directCommitsData.yoloCoderStats[0].directCommitPercentage.toFixed(1)}% direct commits)
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Lazy loaded chart section */}
      <div ref={chartRef}>
        {chartLoading
? (
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        )
: chartData
? (
          <Card>
            <CardHeader>
              <CardTitle>Activity Chart</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Chart loaded via Intersection Observer
              </div>
            </CardContent>
          </Card>
        )
: null}
      </div>
    </div>
  );
}