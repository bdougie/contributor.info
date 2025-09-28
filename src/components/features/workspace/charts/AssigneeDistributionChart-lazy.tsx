import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { Issue } from '../WorkspaceIssuesTable';

// Lazy load the heavy chart component with error boundary
const AssigneeDistributionChartInner = lazy(() =>
  import('./AssigneeDistributionChart')
    .then((module) => ({
      default: module.AssigneeDistributionChart,
    }))
    .catch((error) => {
      console.error('Failed to load AssigneeDistributionChart:', error);
      // Return a fallback component
      return {
        default: () => (
          <Card>
            <CardContent className="p-6">
              <div className="text-muted-foreground text-sm">
                Failed to load Assignee Distribution chart. Please refresh the page.
              </div>
            </CardContent>
          </Card>
        ),
      };
    })
);

interface AssigneeDistributionChartSkeletonProps {
  className?: string;
}

function AssigneeDistributionChartSkeleton({ className }: AssigneeDistributionChartSkeletonProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-48" />
          <div className="flex gap-4">
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
          <Skeleton className="h-4 w-40" />
        </div>
      </CardContent>
    </Card>
  );
}

interface LazyAssigneeDistributionChartProps {
  issues: Issue[];
  onAssigneeClick?: (assignee: string) => void;
  className?: string;
  maxVisible?: number;
  showPercentage?: boolean;
  title?: string;
}

export function LazyAssigneeDistributionChart(props: LazyAssigneeDistributionChartProps) {
  return (
    <Suspense fallback={<AssigneeDistributionChartSkeleton className={props.className} />}>
      <AssigneeDistributionChartInner {...props} />
    </Suspense>
  );
}
