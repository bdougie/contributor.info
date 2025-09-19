import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import type { UPlotChartProps } from './UPlotChart';

// Lazy load the heavy UPlot chart component
const UPlotChartInner = lazy(() =>
  import('./UPlotChart').then((module) => ({
    default: module.UPlotChart,
  }))
);

interface UPlotChartSkeletonProps {
  className?: string;
}

function UPlotChartSkeleton({ className }: UPlotChartSkeletonProps) {
  return (
    <div className={className}>
      <Skeleton className="h-64 w-full rounded-md" />
    </div>
  );
}

export function LazyUPlotChart(props: UPlotChartProps) {
  return (
    <Suspense fallback={<UPlotChartSkeleton className={props.className} />}>
      <UPlotChartInner {...props} />
    </Suspense>
  );
}
