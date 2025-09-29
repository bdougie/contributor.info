import { GitPullRequest, Users, Activity, TrendingUp, AlertCircle } from '@/components/ui/icon';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LoadingStage } from '@/lib/types/data-loading-errors';

/**
 * Fallback UI components for different loading stages and error scenarios
 * These provide meaningful placeholders while data loads or when errors occur
 */

interface FallbackProps {
  stage: LoadingStage;
  message?: string;
  showPartialData?: boolean;
  partialData?: {
    prCount?: number;
    contributorCount?: number;
    topContributors?: Array<{ login?: string; avatar_url?: string; contributions?: number }>;
    stats?: {
      totalPRs?: number;
      mergedPRs?: number;
      pullRequests?: Array<{ id: number; title: string; number: number; html_url: string }>;
    };
    lotteryFactor?: {
      score?: number;
      rating?: string;
      riskLevel?: string;
    };
    directCommitsData?: {
      totalCommits?: number;
      contributors?: number;
      recentActivity?: boolean;
      hasYoloCoders?: boolean;
      yoloCoderStats?: Array<{ login: string; directCommitPercentage: number }>;
    };
  };
}

/**
 * Critical stage fallback - shows basic repo structure
 */
export function CriticalDataFallback({ message, partialData }: FallbackProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <GitPullRequest className="h-4 w-4" />
              Pull Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            {partialData?.prCount !== undefined ? (
              <div className="text-2xl font-bold">{partialData.prCount}</div>
            ) : (
              <Skeleton className="h-8 w-16" />
            )}
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
            {partialData?.contributorCount !== undefined ? (
              <div className="text-2xl font-bold">{partialData.contributorCount}</div>
            ) : (
              <Skeleton className="h-8 w-16" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Top Contributors</CardTitle>
          </CardHeader>
          <CardContent>
            {partialData?.topContributors && partialData.topContributors.length > 0 ? (
              <div className="flex -space-x-2">
                {partialData.topContributors.slice(0, 5).map((contributor, i: number) => (
                  <div
                    key={i}
                    className="h-8 w-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-medium"
                  >
                    {contributor.login?.[0]?.toUpperCase() || '?'}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex -space-x-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-8 rounded-full" />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {message && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <p className="text-sm text-yellow-800">{message}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Full stage fallback - shows detailed loading states
 */
export function FullDataFallback({ message, partialData }: FallbackProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Repository Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {partialData?.stats ? (
            <div>
              <p className="text-sm text-gray-600">
                Showing {partialData.stats.pullRequests?.length || 0} pull requests
              </p>
              {partialData.lotteryFactor && (
                <p className="text-sm text-gray-600 mt-1">
                  Risk Level: {partialData.lotteryFactor.riskLevel}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          )}

          {/* Pull request list skeleton */}
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4 p-3 border rounded-lg">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {message && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <p className="text-sm text-orange-800">{message}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Enhancement stage fallback - shows optional features as loading
 */
export function EnhancementDataFallback({ message, showPartialData, partialData }: FallbackProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Advanced Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          {partialData?.directCommitsData ? (
            <div>
              <p className="text-sm text-gray-600">
                {partialData.directCommitsData.hasYoloCoders
                  ? 'YOLO coders detected'
                  : 'No YOLO coders found'}
              </p>
              {partialData.directCommitsData.yoloCoderStats &&
                partialData.directCommitsData.yoloCoderStats.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Top: {partialData.directCommitsData.yoloCoderStats?.[0]?.login || 'N/A'}
                  </p>
                )}
            </div>
          ) : (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historical Trends</CardTitle>
        </CardHeader>
        <CardContent>
          {showPartialData ? (
            <div className="space-y-2">
              <div className="h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                <p className="text-sm text-gray-500">Chart data loading...</p>
              </div>
            </div>
          ) : (
            <Skeleton className="h-32 w-full" />
          )}
        </CardContent>
      </Card>

      {message && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <p className="text-sm text-blue-800">{message}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Generic error state with contextual message
 */
export function ErrorFallback({
  stage,
  message = 'Something went wrong',
  onRetry,
}: FallbackProps & { onRetry?: () => void }) {
  const getStageDescription = (stage: LoadingStage) => {
    switch (stage) {
      case 'critical':
        return 'essential repository data';
      case 'full':
        return 'detailed repository information';
      case 'enhancement':
        return 'additional analytics';
      default:
        return 'data';
    }
  };

  return (
    <Card className="border-red-200">
      <CardContent className="p-6 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Failed to load {getStageDescription(stage)}
        </h3>
        <p className="text-gray-600 mb-4">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Try Again
          </button>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Loading state with progress indication
 */
export function LoadingWithProgress({
  stage,
  progress = 0,
  message = 'Loading...',
}: FallbackProps & { progress?: number }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h4 className="text-md font-medium text-gray-900 mb-2">{message}</h4>

          {progress > 0 && (
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.min(progress, 100)}%` }}
              ></div>
            </div>
          )}

          <p className="text-sm text-gray-500">
            {stage === 'critical' && 'Loading essential data...'}
            {stage === 'full' && 'Fetching detailed information...'}
            {stage === 'enhancement' && 'Loading additional features...'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Minimal inline loading state for components
 */
export function InlineLoadingFallback({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
      <span className="text-sm text-gray-600">{message}</span>
    </div>
  );
}
