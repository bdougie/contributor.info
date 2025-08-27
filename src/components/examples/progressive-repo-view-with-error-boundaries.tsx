import {
  GitPullRequest,
  Users,
  Activity,
  TrendingUp,
  AlertCircle,
  RefreshCw,
} from '@/components/ui/icon';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTimeRangeStore } from '@/lib/time-range-store';
import { useProgressiveRepoDataWithErrorBoundaries } from '@/hooks/use-progressive-repo-data-with-error-boundaries';
import { DataLoadingErrorBoundary } from '@/components/error-boundaries/data-loading-error-boundary';
import {
  FullDataFallback,
  EnhancementDataFallback,
} from '@/components/fallbacks/loading-fallbacks';
import { useErrorTracking } from '@/lib/error-tracking';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

/**
 * Enhanced Progressive Repository View with comprehensive error boundaries
 * This example demonstrates the new error handling system integration
 */
export function ProgressiveRepoViewWithErrorBoundaries() {
  const { owner, repo } = useParams();
  const timeRange = useTimeRangeStore((state) => state.timeRange);
  const includeBots = false;
  const { trackError, addBreadcrumb } = useErrorTracking();

  const progressiveData = useProgressiveRepoDataWithErrorBoundaries(
    owner,
    repo,
    timeRange,
    includeBots,
    {
      enableRetry: true,
      enableGracefulDegradation: true,
      onError: (error, stage) => {
        trackError(error, {
          repository: `${owner}/${repo}`,
          timeRange,
        });
        addBreadcrumb(`Data loading error in ${stage} stage: ${error.type}`, 'data', 'error', {
          stage,
          errorType: error.type,
        });
      },
      onRecovery: (stage) => {
        addBreadcrumb(`Successfully recovered from ${stage} stage error`, 'data', 'info', {
          stage,
        });
      },
    }
  );

  const handleManualRetry = (stage?: any) => {
    addBreadcrumb(`Manual retry triggered for stage: ${stage || 'all'}`, 'user', 'info', { stage });
    progressiveData.manualRetry(stage);
  };

  return (
    <div className="space-y-6">
      {/* Critical Data Section - Wrapped in Critical Stage Error Boundary */}
      <DataLoadingErrorBoundary
        stage="critical"
        enableGracefulDegradation={false} // Critical data is required
        onRetry={() => handleManualRetry('critical')}
        onError={(error) => console.error('Critical stage error boundary:', error)}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <GitPullRequest className="h-4 w-4" />
                Pull Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {!progressiveData.basicInfo ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="flex items-center gap-2">
                    {progressiveData.basicInfo?.prCount || 0}
                    {progressiveData.stageErrors.critical && (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Contributors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {!progressiveData.basicInfo ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  progressiveData.basicInfo?.contributorCount || 0
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
                  {progressiveData.basicInfo?.topContributors.map((contributor: any, i: number) => (
                    <Avatar key={contributor.login} className="h-8 w-8 border-2 border-background">
                      <AvatarImage
                        src={`${contributor.avatar_url}?s=64`}
                        alt={contributor.login}
                        loading={i < 3 ? 'eager' : 'lazy'}
                      />
                      <AvatarFallback>{contributor.login[0]}</AvatarFallback>
                    </Avatar>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DataLoadingErrorBoundary>

      {/* Full Data Section - Wrapped in Full Stage Error Boundary with Graceful Degradation */}
      <DataLoadingErrorBoundary
        stage="full"
        enableGracefulDegradation={true}
        onRetry={() => handleManualRetry('full')}
        fallbackData={
          <FullDataFallback
            stage="full"
            partialData={progressiveData.basicInfo ? { stats: progressiveData.stats } : undefined}
            message={progressiveData.stageErrors.full?.userMessage}
          />
        }
      >
        {(progressiveData.stats.loading || progressiveData.stats.pullRequests.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Repository Activity
                {progressiveData.stageErrors.full && (
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                )}
                {progressiveData.isRetrying === 'full' && (
                  <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {progressiveData.stats.loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : (
                <div>
                  <p className="text-sm text-muted-foreground">
                    {progressiveData.stats?.pullRequests.length || 0} pull requests in the last{' '}
                    {timeRange} days
                  </p>
                  {progressiveData.lotteryFactor && (
                    <p className="text-sm mt-2">
                      Lottery Factor: {progressiveData.lotteryFactor.riskLevel} (
                      {progressiveData.lotteryFactor.topContributorsPercentage.toFixed(1)}% from top{' '}
                      {progressiveData.lotteryFactor.topContributorsCount} contributors)
                    </p>
                  )}
                  {progressiveData.stageErrors.full && (
                    <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded-md">
                      <p className="text-sm text-orange-800">
                        ⚠️ Some data may be incomplete:{' '}
                        {progressiveData.stageErrors.full.userMessage}
                      </p>
                      {progressiveData.stageErrors.full.retryable && (
                        <button
                          onClick={() => handleManualRetry('full')}
                          className="text-sm text-orange-700 hover:text-orange-900 mt-1 underline"
                          disabled={progressiveData.isRetrying === 'full'}
                        >
                          {progressiveData.isRetrying === 'full' ? 'Retrying...' : 'Retry loading'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </DataLoadingErrorBoundary>

      {/* Enhancement Data Section - Wrapped in Enhancement Stage Error Boundary */}
      <DataLoadingErrorBoundary
        stage="enhancement"
        enableGracefulDegradation={true}
        onRetry={() => handleManualRetry('enhancement')}
        fallbackData={
          <EnhancementDataFallback
            stage="enhancement"
            partialData={
              progressiveData.directCommitsData
                ? { directCommitsData: progressiveData.directCommitsData }
                : undefined
            }
            message={progressiveData.stageErrors.enhancement?.userMessage}
            showPartialData={true}
          />
        }
      >
        {(progressiveData.stageProgress.enhancement || progressiveData.directCommitsData) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Advanced Analytics
                {progressiveData.stageErrors.enhancement && (
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                )}
                {progressiveData.isRetrying === 'enhancement' && (
                  <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!progressiveData.stageProgress.enhancement && !progressiveData.directCommitsData ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : progressiveData.directCommitsData ? (
                <div>
                  <p className="text-sm text-muted-foreground">
                    {progressiveData.directCommitsData?.hasYoloCoders
                      ? `${progressiveData.directCommitsData.yoloCoderStats?.length || 0} YOLO coders detected`
                      : 'No YOLO coders detected'}
                  </p>
                  {progressiveData.directCommitsData?.yoloCoderStats &&
                    progressiveData.directCommitsData.yoloCoderStats.length > 0 && (
                      <p className="text-sm mt-1">
                        Top YOLO coder: {progressiveData.directCommitsData.yoloCoderStats[0].login}(
                        {progressiveData.directCommitsData.yoloCoderStats[0].directCommitPercentage.toFixed(
                          1
                        )}
                        % direct commits)
                      </p>
                    )}

                  {progressiveData.stageErrors.enhancement && (
                    <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-sm text-yellow-800">
                        ℹ️ Enhancement features partially unavailable:{' '}
                        {progressiveData.stageErrors.enhancement.userMessage}
                      </p>
                      <button
                        onClick={() => handleManualRetry('enhancement')}
                        className="text-sm text-yellow-700 hover:text-yellow-900 mt-1 underline"
                        disabled={progressiveData.isRetrying === 'enhancement'}
                      >
                        {progressiveData.isRetrying === 'enhancement'
                          ? 'Retrying...'
                          : 'Try loading enhancements'}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Loading advanced analytics...</div>
              )}
            </CardContent>
          </Card>
        )}
      </DataLoadingErrorBoundary>

      {/* Debug Information (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <Card className="border-dashed border-gray-300">
          <CardHeader>
            <CardTitle className="text-sm font-normal text-gray-500">Debug Info</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-gray-500 space-y-1">
            <div>Current Stage: {progressiveData.currentStage}</div>
            <div>Data Status: {progressiveData.dataStatus.status}</div>
            <div>Has Partial Data: {progressiveData.hasPartialData.toString()}</div>
            <div>Is Retrying: {progressiveData.isRetrying || 'none'}</div>
            <div>Retry Attempts: {JSON.stringify(progressiveData.retryAttempts)}</div>
            <div>
              Stage Errors:{' '}
              {Object.keys(progressiveData.stageErrors)
                .filter(
                  (stage) =>
                    progressiveData.stageErrors[stage as keyof typeof progressiveData.stageErrors]
                )
                .join(', ') || 'none'}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Example of using the withDataLoadingErrorBoundary HOC
 */
export const ProgressiveRepoViewWithHOC = () => {
  const BasicComponent = () => <div>Basic repository view without error handling</div>;

  const EnhancedComponent = withDataLoadingErrorBoundary(BasicComponent, 'full', {
    enableGracefulDegradation: true,
    onError: (error, errorInfo) => {
      console.error('HOC caught error:', error, errorInfo);
    },
    onRetry: () => {
      console.log('HOC retry triggered');
    },
  });

  return <EnhancedComponent />;
};

// Re-export the HOC for convenience
import { withDataLoadingErrorBoundary } from '@/components/error-boundaries/data-loading-error-boundary';
export { withDataLoadingErrorBoundary };
