// Wrapper component to conditionally load contributions chart
import { lazy, Suspense } from 'react';
import { useParams } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShareableCard } from '@/components/features/sharing/shareable-card';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load the contributions component to avoid ES module issues in tests
const ContributionsChart = lazy(() => {
  // Check if we're in a test environment
  if (
    import.meta.env?.MODE === 'test' ||
    (typeof global !== 'undefined' && global.process?.env?.NODE_ENV === 'test')
  ) {
    // Return a mock component for tests
    return Promise.resolve({
      default: () => (
        <div
          data-testid="mock-contributions-chart"
          className="h-[400px] w-full flex items-center justify-center"
        >
          <span>Mock Contributions Chart</span>
        </div>
      ),
    });
  }

  // Load the actual component in production
  return import('./contributions').then((module) => ({ default: module.default }));
});

/**
 * Lightweight skeleton for the contributions chart loading state
 * Uses only basic Skeleton component to minimize bundle impact
 */
function ContributionsChartSkeleton() {
  return (
    <div className="space-y-4 w-full" aria-label="Loading contributions chart..." aria-busy="true">
      {/* Controls section */}
      <div className="flex flex-col gap-4 pt-3 md:px-7">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <Skeleton className="h-5 w-36" />
          <div className="flex gap-1">
            <Skeleton className="h-9 w-16 rounded-md" />
            <Skeleton className="h-9 w-16 rounded-md" />
            <Skeleton className="h-9 w-20 rounded-md" />
            <Skeleton className="h-9 w-16 rounded-md" />
          </div>
          <div className="flex items-center space-x-2">
            <Skeleton className="h-5 w-9 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      </div>

      {/* Simple chart placeholder */}
      <div className="h-[400px] w-full relative rounded-lg border border-border bg-muted/20">
        {/* Y-axis labels */}
        <div className="absolute left-2 top-4 bottom-12 flex flex-col justify-between">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-3 w-6" />
        </div>
        {/* X-axis labels */}
        <div className="absolute bottom-2 left-16 right-4 flex justify-between">
          <Skeleton className="h-3 w-6" />
          <Skeleton className="h-3 w-6" />
          <Skeleton className="h-3 w-6" />
          <Skeleton className="h-3 w-6" />
          <Skeleton className="h-3 w-10" />
        </div>
        {/* Scatter dots placeholder */}
        <div className="absolute inset-12 flex items-center justify-center">
          <div className="grid grid-cols-4 gap-8 opacity-40">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-6 w-6 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ContributionsWrapper() {
  const { owner, repo } = useParams();

  return (
    <Card>
      <ShareableCard
        title="Contributor Distribution"
        contextInfo={{
          repository: owner && repo ? `${owner}/${repo}` : undefined,
          metric: 'contributor distribution',
        }}
        chartType="contributor-distribution"
        className="flex flex-col h-full"
      >
        <CardHeader>
          <CardTitle>Contributor Distribution</CardTitle>
          <CardDescription>
            This chart is a representation of 30 days of PR contributions based on size (Y axis) and
            date (X axis).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <Suspense fallback={<ContributionsChartSkeleton />}>
            <ContributionsChart />
          </Suspense>
        </CardContent>
      </ShareableCard>
    </Card>
  );
}
