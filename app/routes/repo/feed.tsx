import { Suspense, lazy } from 'react';

const FeedPage = lazy(() => import('@/components/features/feed/feed-page'));

export default function FeedRoute() {
  return (
    <Suspense fallback={<div className="h-64 bg-muted animate-pulse rounded" />}>
      <FeedPage />
    </Suspense>
  );
}
