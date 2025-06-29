import { lazy, Suspense } from 'react';
import { FeedSourceToggle, useFeedSourcePreference } from './feed-source-toggle';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

// Lazy load the components
const PRActivity = lazy(() => import('./pr-activity'));
const FilteredPRActivity = lazy(() => import('./pr-activity-filtered'));

export default function PRActivityWrapper() {
  const [feedSource, setFeedSource] = useFeedSourcePreference('github');

  const LoadingFallback = () => (
    <Card>
      <CardHeader>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <FeedSourceToggle
          value={feedSource}
          onChange={setFeedSource}
        />
      </div>

      <Suspense fallback={<LoadingFallback />}>
        {feedSource === 'github' ? (
          <PRActivity />
        ) : (
          <FilteredPRActivity />
        )}
      </Suspense>
    </div>
  );
}