import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { PullRequest } from '../WorkspacePullRequestsTable';

// Lazy load the heavy chart component
const ReviewerDistributionChartInner = lazy(() =>
  import('./ReviewerDistributionChart').then((module) => ({
    default: module.ReviewerDistributionChart,
  }))
);

interface ReviewerDistributionChartSkeletonProps {
  className?: string;
}

function ReviewerDistributionChartSkeleton({ className }: ReviewerDistributionChartSkeletonProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-52" />
          <div className="flex gap-4">
            <Skeleton className="h-7 w-36" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-6 w-full" />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      </CardContent>
    </Card>
  );
}

interface LazyReviewerDistributionChartProps {
  pullRequests: PullRequest[];
  onReviewerClick?: (reviewer: string) => void;
  className?: string;
  maxVisible?: number;
  showPercentage?: boolean;
  title?: string;
}

export function LazyReviewerDistributionChart(props: LazyReviewerDistributionChartProps) {
  return (
    <Suspense fallback={<ReviewerDistributionChartSkeleton className={props.className} />}>
      <ReviewerDistributionChartInner {...props} />
    </Suspense>
  );
}
