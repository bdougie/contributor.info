import { Suspense, lazy } from 'react';

const TrendingPage = lazy(() => import('@/pages/trending'));

export default function TrendingRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <TrendingPage />
    </Suspense>
  );
}
