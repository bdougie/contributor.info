import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { PullRequest } from '../WorkspacePullRequestsTable';

const PRReviewStatusChart = lazy(() =>
  import('./PRReviewStatusChart').then((m) => ({ default: m.PRReviewStatusChart }))
);

interface PRReviewStatusChartProps {
  pullRequests: PullRequest[];
  onReviewerClick?: (reviewer: string) => void;
  className?: string;
  maxVisible?: number;
  title?: string;
}

function PRReviewStatusChartSkeleton() {
  return (
    <Card className="w-full">
      <CardHeader>
        <Skeleton className="h-6 w-48" />
        <div className="flex items-center gap-4 mt-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-20" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-full" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function LazyPRReviewStatusChart(props: PRReviewStatusChartProps) {
  return (
    <Suspense fallback={<PRReviewStatusChartSkeleton />}>
      <PRReviewStatusChart {...props} />
    </Suspense>
  );
}
