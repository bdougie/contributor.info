import { Suspense, lazy } from 'react';

const WidgetsPage = lazy(() => import('@/pages/widgets'));

export default function WidgetsRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <WidgetsPage />
    </Suspense>
  );
}
