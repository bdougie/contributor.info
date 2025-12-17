import { Suspense, lazy } from 'react';

const DistributionRoute = lazy(() =>
  import('@/components/features/repository/repo-view').then((m) => ({
    default: m.DistributionRoute,
  }))
);

export default function DistributionPage() {
  return (
    <Suspense fallback={<div className="h-64 bg-muted animate-pulse rounded" />}>
      <DistributionRoute />
    </Suspense>
  );
}
