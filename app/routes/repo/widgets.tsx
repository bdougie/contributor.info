import { Suspense, lazy } from 'react';

const WidgetsPage = lazy(() => import('@/pages/widgets'));

export default function RepoWidgetsRoute() {
  return (
    <Suspense fallback={<div className="h-64 bg-muted animate-pulse rounded" />}>
      <WidgetsPage />
    </Suspense>
  );
}
